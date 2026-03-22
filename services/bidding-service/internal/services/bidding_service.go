package service

import (
	"context"
	"time"
	"fmt"

	domains "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/domains"
	Middlewares "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/middlewares"
	user_client "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/clients"

	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/broker"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type BiddingService struct {
	redisRepo     domains.BiddingRepository
	mongoRepo     domains.BiddingRepository
	natsPublisher broker.Publisher
	userClient    user_client.UserClient
}

func NewBiddingService(redisRepo, mongoRepo domains.BiddingRepository, natsPublisher broker.Publisher, userClient user_client.UserClient) *BiddingService {
	return &BiddingService{
		redisRepo:     redisRepo,
		mongoRepo:     mongoRepo,
		natsPublisher: natsPublisher,
		userClient:    userClient,
	}
}

func (s *BiddingService) PlaceBid(ctx context.Context, auctionID string, amount float64) (*domains.Bid, error) {
	userID := Middlewares.GetUserIDFromContext(ctx)
	user, err := s.userClient.GetUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to validate user: %w", err)
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}


	bid := &domains.Bid{
		ID:        primitive.NewObjectID().Hex(),
		AuctionID: auctionID,
		UserID:    userID,
		Amount:    amount,
		Status:    domains.StatusAccepted,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	err = s.redisRepo.PlaceBid(ctx, bid)
	if err != nil {
		return nil, err
	}

	go func() {
		_ = s.mongoRepo.PlaceBid(context.Background(), bid)
	}()

	// Add Domain Event
	bid.AddEvent(broker.Event{
		Subject: "bid.created",
		Data:    bid,
	})

	s.publishEvents(ctx, bid)

	return bid, nil
}

func (s *BiddingService) GetHighestBid(ctx context.Context, auctionID string) (*domains.Bid, error) {
	// Try Redis first for performance
	bid, err := s.redisRepo.GetHighestBid(ctx, auctionID)
	if err == nil && bid != nil {
		return bid, nil
	}

	// Fallback to MongoDB if not in Redis
	return s.mongoRepo.GetHighestBid(ctx, auctionID)
}

func (s *BiddingService) GetAuctionHistory(ctx context.Context, auctionID string) ([]*domains.Bid, error) {
	return s.mongoRepo.GetAuctionHistory(ctx, auctionID)
}

func (s *BiddingService) publishEvents(ctx context.Context, bid *domains.Bid) {
	if s.natsPublisher == nil {
		return
	}

	for _, event := range bid.DomainEvents {
		e := event.(broker.Event)
		_ = s.natsPublisher.Publish(ctx, e)
	}

	bid.ClearEvents()
}
