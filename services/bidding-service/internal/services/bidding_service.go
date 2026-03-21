package service

import (
	"context"
	"time"

	domains "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/domains"
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

func (s *BiddingService) PlaceBid(ctx context.Context, auctionID, userID string, amount float64) (*domains.Bid, error) {
	bid := &domains.Bid{
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

	// 2. Persist to MongoDB (Asynchronous history)
	// Even if this fails, the current bid is already set in Redis for speed.
	// In a real production system, we might use a queue here, 
	// but direct write is fine for now as it's the secondary storage.
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
	// History is always from MongoDB
	return s.mongoRepo.GetAuctionHistory(ctx, auctionID)
}
