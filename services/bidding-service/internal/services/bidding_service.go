package service

import (
	"context"
	"time"
	"fmt"

	domains "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/domains"
	Middlewares "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/middlewares"
	user_client "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/clients"

	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/broker"
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
	// 0. Acquire Distributed Lock
	lockID, err := s.redisRepo.Lock(ctx, auctionID, 5*time.Second)
	if err != nil {
		return nil, fmt.Errorf("could not acquire lock: %w", err)
	}
	defer s.redisRepo.Unlock(ctx, auctionID, lockID)

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

	resp, err := s.auctionClient.GetAuction(ctx, auctionID)
	if err != nil || !resp.Exists {
		return nil, fmt.Errorf("auction not found")
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
		return nil, 0, fmt.Errorf("auction not found")
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

func (s *BiddingService) ResolveAuction(ctx context.Context, auctionID string, sellerID string) error {
	highestBid, err := s.GetHighestBid(ctx, auctionID)
	if err != nil {
		return fmt.Errorf("failed to get highest bid during resolution: %w", err)
	}
	
	if highestBid == nil {
		return nil
	}

	highestBid.Status = domains.StatusWinner
	highestBid.UpdatedAt = time.Now()
	
	_ = s.mongoRepo.PlaceBid(ctx, highestBid)

	resp, err := s.userClient.UpdateBalance(ctx, sellerID, highestBid.Amount, user_client.TransactionAdd)
	if err != nil || !resp.Success {
		return fmt.Errorf("failed to transfer funds to seller: %w", err)
	}

	highestBid.AddEvent(broker.Event{
		Subject: "bid.won",
		Data:    highestBid,
	})
	s.publishEvents(ctx, highestBid)

	return nil
}

func (s *BiddingService) GetMyBids(ctx context.Context, pagination *model.PaginationInput) ([]*domains.Bid, int64, error) {
	userID := Middlewares.GetUserIDFromContext(ctx)
	if userID == "" {
		return nil, 0, fmt.Errorf("unauthorized: missing user id")
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
