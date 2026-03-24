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
	auctionClient user_client.AuctionClient
}

func NewBiddingService(redisRepo, mongoRepo domains.BiddingRepository, natsPublisher broker.Publisher, userClient user_client.UserClient, auctionClient user_client.AuctionClient) *BiddingService {
	return &BiddingService{
		redisRepo:     redisRepo,
		mongoRepo:     mongoRepo,
		natsPublisher: natsPublisher,
		userClient:    userClient,
		auctionClient: auctionClient,
	}
}

func (s *BiddingService) PlaceBid(ctx context.Context, auctionID string, amount float64) (*domains.Bid, error) {
	userID := Middlewares.GetUserIDFromContext(ctx)

	// 1. Validate Auction Details via gRPC
	valResp, err := s.auctionClient.ValidateAuctionForBid(ctx, auctionID, userID, amount)
	if err != nil {
		return nil, fmt.Errorf("failed to validate auction: %w", err)
	}

	if !valResp.IsActive {
		return nil, fmt.Errorf("auction validation failed: %s", valResp.ErrorMessage)
	}
	
	// 2. Get previous highest bid for refund
	prevBid, _ := s.GetHighestBid(ctx, auctionID)
	if prevBid != nil && prevBid.UserID == userID {
		return nil, fmt.Errorf("you are already the highest bidder")
	}

	// 2. Deduct balance from new bidder
	resp, err := s.userClient.UpdateBalance(ctx, userID, amount, user_client.TransactionDeduct)
	if err != nil {
		return nil, fmt.Errorf("failed to process balance deduction: %w", err)
	}
	if !resp.Success {
		return nil, fmt.Errorf("insufficient balance or user not found: %s", resp.Message)
	}

	// 3. Place new bid
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
		// ROLLBACK: If bid fails, refund the user immediately
		go func() {
			_, _ = s.userClient.UpdateBalance(context.Background(), userID, amount, user_client.TransactionAdd)
		}()
		return nil, err
	}

	// 4. Record refund event for previous bidder (to be published via NATS)
	if prevBid != nil && prevBid.UserID != userID {
		bid.AddEvent(broker.Event{
			Subject: "bid.outbid",
			Data: map[string]interface{}{
				"userId": prevBid.UserID,
				"amount": prevBid.Amount,
			},
		})
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

	_, err := s.auctionClient.GetAuction(ctx, auctionID)
	if err != nil {
		return nil, fmt.Errorf("auction not found")
	}

	bid, err := s.redisRepo.GetHighestBid(ctx, auctionID)
	if err == nil && bid != nil {
		return bid, nil
	}

	return s.mongoRepo.GetHighestBid(ctx, auctionID)
}


func (s *BiddingService) GetAuctionHistory(ctx context.Context, auctionID string) ([]*domains.Bid, error) {
	_, err := s.auctionClient.GetAuction(ctx, auctionID)
	if err != nil {
		return nil, fmt.Errorf("auction not found")
	}
	
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
