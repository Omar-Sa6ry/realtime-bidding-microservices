package service

import (
	"context"
	"time"
	"fmt"

	domains "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/domains"
	Middlewares "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/middlewares"
	user_client "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/clients"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/pkg/logger"

	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/broker"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/pkg/translation"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/graph/model"
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
	// Acquire Distributed Lock
	lockID, err := s.redisRepo.Lock(ctx, auctionID, 5*time.Second)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", translation.T(ctx, "failed_to_place_bid"), err)
	}
	defer s.redisRepo.Unlock(ctx, auctionID, lockID)

	userID := Middlewares.GetUserIDFromContext(ctx)

	// Validate Auction Details via gRPC
	valResp, err := s.auctionClient.ValidateAuctionForBid(ctx, auctionID, userID, amount)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", translation.T(ctx, "failed_to_place_bid"), err)
	}

	if !valResp.IsActive {
		return nil, fmt.Errorf(translation.T(ctx, "auction_not_active"))
	}
	
	prevBid, _ := s.GetHighestBid(ctx, auctionID)
	if prevBid != nil && prevBid.UserID == userID {
		return nil, fmt.Errorf(translation.T(ctx, "already_highest_bidder"))
	}

	resp, err := s.userClient.UpdateBalance(ctx, userID, amount, user_client.TransactionDeduct)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", translation.T(ctx, "failed_to_place_bid"), err)
	}
	if !resp.Success {
		return nil, fmt.Errorf(translation.T(ctx, "insufficient_balance"))
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
		go func() {
			_, _ = s.userClient.UpdateBalance(context.Background(), userID, amount, user_client.TransactionAdd)
		}()
		return nil, err
	}

	if prevBid != nil && prevBid.UserID != userID {
		bid.AddEvent(broker.Event{
			Subject: "bid.outbid",
			Data: map[string]interface{}{
				"userId": prevBid.UserID,
				"amount": prevBid.Amount,
			},
		})

		go func(bidID string) {
			_ = s.mongoRepo.UpdateBidStatus(context.Background(), bidID, domains.StatusOutbid)
		}(prevBid.ID)
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

	resp, err := s.auctionClient.GetAuction(ctx, auctionID)
	if err != nil || !resp.Exists {
		return nil, fmt.Errorf(translation.T(ctx, "auction_not_found"))
	}

	bid, err := s.redisRepo.GetHighestBid(ctx, auctionID)
	if err == nil && bid != nil {
		return bid, nil
	}

	return s.mongoRepo.GetHighestBid(ctx, auctionID)
}


func (s *BiddingService) GetAuctionHistory(ctx context.Context, auctionID string, pagination *model.PaginationInput) ([]*domains.Bid, int64, error) {
	resp, err := s.auctionClient.GetAuction(ctx, auctionID)
	if err != nil || !resp.Exists {
		return nil, 0, fmt.Errorf(translation.T(ctx, "auction_not_found"))
	}
	
	limit := int64(10)
	offset := int64(0)
	if pagination != nil {
		if pagination.Limit != nil {
			limit = int64(*pagination.Limit)
		}
		if pagination.Page != nil {
			offset = int64(*pagination.Page-1) * limit
		}
	}
	
	return s.mongoRepo.GetAuctionHistory(ctx, auctionID, limit, offset)
}

func (s *BiddingService) GetMyBids(ctx context.Context, pagination *model.PaginationInput) ([]*domains.Bid, int64, error) {
	userID := Middlewares.GetUserIDFromContext(ctx)
	if userID == "" {
		return nil, 0, fmt.Errorf(translation.T(ctx, "unauthorized"))
	}

	limit := int64(10)
	offset := int64(0)
	if pagination != nil {
		if pagination.Limit != nil {
			limit = int64(*pagination.Limit)
		}
		if pagination.Page != nil {
			offset = int64(*pagination.Page-1) * limit
		}
	}

	return s.mongoRepo.GetBidsByUserID(ctx, userID, limit, offset)
}

func (s *BiddingService) ResolveAuction(ctx context.Context, auctionID string, sellerID string) error {
	// Distributed Lock for Resolution
	lockID, err := s.redisRepo.Lock(ctx, "resolve:"+auctionID, 10*time.Second)
	if err != nil {
		return fmt.Errorf("failed to acquire resolution lock for auction %s: %w", auctionID, err)
	}
	defer s.redisRepo.Unlock(ctx, "resolve:"+auctionID, lockID)

	highestBid, err := s.GetHighestBid(ctx, auctionID)
	if err != nil {
		return fmt.Errorf("failed to get highest bid during resolution: %w", err)
	}

	if highestBid == nil {
		logger.Info("BiddingService", fmt.Sprintf("No bids found for auction %s. No resolution needed.", auctionID))
		return nil
	}

	if highestBid.Status == domains.StatusWinner {
		logger.Info("BiddingService", fmt.Sprintf("Auction %s already resolved for winner %s", auctionID, highestBid.UserID))
		return nil
	}

	highestBid.Status = domains.StatusWinnerPending
	highestBid.UpdatedAt = time.Now()
	_ = s.mongoRepo.UpdateBidStatus(ctx, highestBid.ID, domains.StatusWinnerPending)

	var success bool
	maxRetries := 3
	for i := 0; i < maxRetries; i++ {
		resp, err := s.userClient.UpdateBalance(ctx, sellerID, highestBid.Amount, user_client.TransactionAdd)
		if err == nil && resp != nil && resp.Success {
			success = true
			break
		}
		logger.Warn("BiddingService", fmt.Sprintf("Retry %d/%d: Failed to transfer funds to seller %s for auction %s. Error: %v", i+1, maxRetries, sellerID, auctionID, err))
		time.Sleep(2 * time.Second)
	}

	if !success {
		logger.Error("BiddingService", fmt.Sprintf("CRITICAL: Failed to transfer funds after %d retries. Auction: %s, Seller: %s, Amount: %f", maxRetries, auctionID, sellerID, highestBid.Amount), nil)
		return fmt.Errorf("robustness: funds could not be transferred. Manual intervention required for auction %s", auctionID)
	}

	highestBid.Status = domains.StatusWinner
	highestBid.UpdatedAt = time.Now()
	_ = s.mongoRepo.UpdateBidStatus(ctx, highestBid.ID, domains.StatusWinner)

	highestBid.AddEvent(broker.Event{
		Subject: "bid.won",
		Data:    highestBid,
	})
	s.publishEvents(ctx, highestBid)

	logger.Info("BiddingService", fmt.Sprintf("Successfully resolved auction %s. Winner: %s, Amount: %f", auctionID, highestBid.UserID, highestBid.Amount))
	return nil
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
