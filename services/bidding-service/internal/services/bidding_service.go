package service

import (
	"context"
	"time"

	domains "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/domains"
	Middlewares "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/middlewares"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type BiddingService struct {
	redisRepo domains.BiddingRepository
	mongoRepo domains.BiddingRepository
}

func NewBiddingService(redisRepo, mongoRepo domains.BiddingRepository) *BiddingService {
	return &BiddingService{
		redisRepo: redisRepo,
		mongoRepo: mongoRepo,
	}
}

func (s *BiddingService) PlaceBid(ctx context.Context, auctionID string, amount float64) (*domains.Bid, error) {
	userID := Middlewares.GetUserIDFromContext(ctx)

	bid := &domains.Bid{
		ID:        primitive.NewObjectID().Hex(),
		AuctionID: auctionID,
		UserID:    userID,
		Amount:    amount,
		Status:    domains.StatusAccepted,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	err := s.redisRepo.PlaceBid(ctx, bid)
	if err != nil {
		return nil, err
	}

	go func() {
		_ = s.mongoRepo.PlaceBid(context.Background(), bid)
	}()

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
