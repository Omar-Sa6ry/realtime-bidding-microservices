package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/graph/model"
	broker "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/broker"
	domains "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/domains"
	Middlewares "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/middlewares"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/pkg/translation"
	auction_pb "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/protos/auction"
	user_pb "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/protos/user"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// Mocks
type MockBiddingRepository struct {
	mock.Mock
}

func (m *MockBiddingRepository) PlaceBid(ctx context.Context, bid *domains.Bid) error {
	args := m.Called(ctx, bid)
	return args.Error(0)
}

func (m *MockBiddingRepository) GetHighestBid(ctx context.Context, auctionID string) (*domains.Bid, error) {
	args := m.Called(ctx, auctionID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domains.Bid), args.Error(1)
}

func (m *MockBiddingRepository) GetAuctionHistory(ctx context.Context, auctionID string, limit, offset int64) ([]*domains.Bid, int64, error) {
	args := m.Called(ctx, auctionID, limit, offset)
	return args.Get(0).([]*domains.Bid), args.Get(1).(int64), args.Error(2)
}

func (m *MockBiddingRepository) GetBidsByUserID(ctx context.Context, userID string, limit, offset int64) ([]*domains.Bid, int64, error) {
	args := m.Called(ctx, userID, limit, offset)
	return args.Get(0).([]*domains.Bid), args.Get(1).(int64), args.Error(2)
}

func (m *MockBiddingRepository) UpdateBidStatus(ctx context.Context, bidID string, status domains.BidStatus) error {
	args := m.Called(ctx, bidID, status)
	return args.Error(0)
}

func (m *MockBiddingRepository) Lock(ctx context.Context, auctionID string, expiration time.Duration) (string, error) {
	args := m.Called(ctx, auctionID, expiration)
	return args.String(0), args.Error(1)
}

func (m *MockBiddingRepository) Unlock(ctx context.Context, auctionID string, lockID string) error {
	args := m.Called(ctx, auctionID, lockID)
	return args.Error(0)
}

func (m *MockBiddingRepository) EnsureIndexes(ctx context.Context) error {
	return nil
}

type MockPublisher struct {
	mock.Mock
}

func (m *MockPublisher) Publish(ctx context.Context, event broker.Event) error {
	args := m.Called(ctx, event)
	return args.Error(0)
}

func (m *MockPublisher) Close() {}

type MockUserClient struct {
	mock.Mock
}

func (m *MockUserClient) GetUser(ctx context.Context, id string) (*user_pb.User, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*user_pb.User), args.Error(1)
}

func (m *MockUserClient) UpdateBalance(ctx context.Context, userId string, amount float64, transactionType string) (*user_pb.UpdateBalanceResponse, error) {
	args := m.Called(ctx, userId, amount, transactionType)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*user_pb.UpdateBalanceResponse), args.Error(1)
}

func (m *MockUserClient) Close() error { return nil }

type MockAuctionClient struct {
	mock.Mock
}

func (m *MockAuctionClient) ValidateAuctionForBid(ctx context.Context, auctionId string, userId string, amount float64) (*auction_pb.ValidateAuctionResponse, error) {
	args := m.Called(ctx, auctionId, userId, amount)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*auction_pb.ValidateAuctionResponse), args.Error(1)
}

func (m *MockAuctionClient) GetAuction(ctx context.Context, auctionId string) (*auction_pb.GetAuctionResponse, error) {
	args := m.Called(ctx, auctionId)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*auction_pb.GetAuctionResponse), args.Error(1)
}

func (m *MockAuctionClient) Close() error { return nil }

// Tests

func setupService() (*BiddingService, *MockBiddingRepository, *MockBiddingRepository, *MockPublisher, *MockUserClient, *MockAuctionClient) {
	translation.Init()
	redisRepo := new(MockBiddingRepository)
	mongoRepo := new(MockBiddingRepository)
	publisher := new(MockPublisher)
	userClient := new(MockUserClient)
	auctionClient := new(MockAuctionClient)

	s := NewBiddingService(redisRepo, mongoRepo, publisher, userClient, auctionClient)
	return s, redisRepo, mongoRepo, publisher, userClient, auctionClient
}

func TestPlaceBid(t *testing.T) {
	auctionID := "auction-123"
	amount := 100.0

	t.Run("Success", func(t *testing.T) {
		s, redisRepo, mongoRepo, publisher, userClient, auctionClient := setupService()
		ctx := context.WithValue(context.Background(), Middlewares.UserIDKey, "user-123")
		
		redisRepo.On("Lock", ctx, auctionID, 5*time.Second).Return("lock-id", nil)
		redisRepo.On("Unlock", ctx, auctionID, "lock-id").Return(nil)
		auctionClient.On("ValidateAuctionForBid", ctx, auctionID, "user-123", amount).Return(&auction_pb.ValidateAuctionResponse{IsActive: true}, nil)
		auctionClient.On("GetAuction", ctx, auctionID).Return(&auction_pb.GetAuctionResponse{Exists: true}, nil)
		redisRepo.On("GetHighestBid", ctx, auctionID).Return(nil, nil)
		mongoRepo.On("GetHighestBid", ctx, auctionID).Return(nil, nil)
		userClient.On("UpdateBalance", ctx, "user-123", amount, "deduct").Return(&user_pb.UpdateBalanceResponse{Success: true}, nil)
		redisRepo.On("PlaceBid", ctx, mock.AnythingOfType("*domain.Bid")).Return(nil)
		mongoRepo.On("PlaceBid", mock.Anything, mock.AnythingOfType("*domain.Bid")).Return(nil)
		publisher.On("Publish", ctx, mock.AnythingOfType("broker.Event")).Return(nil)

		bid, err := s.PlaceBid(ctx, auctionID, amount)
		assert.NoError(t, err)
		require.NotNil(t, bid)
		assert.Equal(t, amount, bid.Amount)
		assert.Equal(t, "user-123", bid.UserID)
	})

	t.Run("Lock Failure", func(t *testing.T) {
		s, redisRepo, _, _, _, _ := setupService()
		ctx := context.WithValue(context.Background(), Middlewares.UserIDKey, "user-123")
		redisRepo.On("Lock", ctx, auctionID, 5*time.Second).Return("", errors.New("lock error"))

		bid, err := s.PlaceBid(ctx, auctionID, amount)
		assert.Error(t, err)
		assert.Nil(t, bid)
		assert.Contains(t, err.Error(), "Failed to place bid")
	})

	t.Run("Auction Not Active", func(t *testing.T) {
		s, redisRepo, _, _, _, auctionClient := setupService()
		ctx := context.WithValue(context.Background(), Middlewares.UserIDKey, "user-123")
		redisRepo.On("Lock", ctx, auctionID, 5*time.Second).Return("lock-id", nil)
		redisRepo.On("Unlock", ctx, auctionID, "lock-id").Return(nil)
		auctionClient.On("ValidateAuctionForBid", ctx, auctionID, "user-123", amount).Return(&auction_pb.ValidateAuctionResponse{IsActive: false}, nil)

		_, err := s.PlaceBid(ctx, auctionID, amount)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "Bidding is only allowed on active auctions")
	})

	t.Run("Already Highest Bidder", func(t *testing.T) {
		s, redisRepo, mongoRepo, _, _, auctionClient := setupService()
		ctx := context.WithValue(context.Background(), Middlewares.UserIDKey, "user-123")
		redisRepo.On("Lock", ctx, auctionID, 5*time.Second).Return("lock-id", nil)
		redisRepo.On("Unlock", ctx, auctionID, "lock-id").Return(nil)
		auctionClient.On("ValidateAuctionForBid", ctx, auctionID, "user-123", amount).Return(&auction_pb.ValidateAuctionResponse{IsActive: true}, nil)
		auctionClient.On("GetAuction", ctx, auctionID).Return(&auction_pb.GetAuctionResponse{Exists: true}, nil)
		redisRepo.On("GetHighestBid", ctx, auctionID).Return(&domains.Bid{UserID: "user-123"}, nil)
		mongoRepo.On("GetHighestBid", ctx, auctionID).Return(&domains.Bid{UserID: "user-123"}, nil)

		_, err := s.PlaceBid(ctx, auctionID, amount)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "You are already the highest bidder")
	})

	t.Run("Insufficient Balance", func(t *testing.T) {
		s, redisRepo, mongoRepo, _, userClient, auctionClient := setupService()
		ctx := context.WithValue(context.Background(), Middlewares.UserIDKey, "user-123")
		redisRepo.On("Lock", ctx, auctionID, 5*time.Second).Return("lock-id", nil)
		redisRepo.On("Unlock", ctx, auctionID, "lock-id").Return(nil)
		auctionClient.On("ValidateAuctionForBid", ctx, auctionID, "user-123", amount).Return(&auction_pb.ValidateAuctionResponse{IsActive: true}, nil)
		auctionClient.On("GetAuction", ctx, auctionID).Return(&auction_pb.GetAuctionResponse{Exists: true}, nil)
		redisRepo.On("GetHighestBid", ctx, auctionID).Return(nil, nil)
		mongoRepo.On("GetHighestBid", ctx, auctionID).Return(nil, nil)
		userClient.On("UpdateBalance", ctx, "user-123", amount, "deduct").Return(&user_pb.UpdateBalanceResponse{Success: false}, nil)

		_, err := s.PlaceBid(ctx, auctionID, amount)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "Insufficient balance")
	})
}

func TestResolveAuction(t *testing.T) {
	auctionID := "auction-123"
	sellerID := "seller-456"

	t.Run("Success", func(t *testing.T) {
		s, redisRepo, mongoRepo, publisher, userClient, auctionClient := setupService()
		ctx := context.Background()

		redisRepo.On("Lock", ctx, "resolve:"+auctionID, 10*time.Second).Return("lock-id", nil)
		redisRepo.On("Unlock", ctx, "resolve:"+auctionID, "lock-id").Return(nil)
		
		highestBid := &domains.Bid{ID: "bid-1", UserID: "user-123", Amount: 200.0, Status: domains.StatusAccepted}
		auctionClient.On("GetAuction", ctx, auctionID).Return(&auction_pb.GetAuctionResponse{Exists: true}, nil)
		redisRepo.On("GetHighestBid", ctx, auctionID).Return(highestBid, nil)
		
		mongoRepo.On("UpdateBidStatus", ctx, "bid-1", domains.StatusWinnerPending).Return(nil)
		userClient.On("UpdateBalance", ctx, sellerID, 200.0, "add").Return(&user_pb.UpdateBalanceResponse{Success: true}, nil)
		mongoRepo.On("UpdateBidStatus", ctx, "bid-1", domains.StatusWinner).Return(nil)
		publisher.On("Publish", ctx, mock.Anything).Return(nil)

		err := s.ResolveAuction(ctx, auctionID, sellerID)
		assert.NoError(t, err)
	})

	t.Run("No Bids Found", func(t *testing.T) {
		s, redisRepo, mongoRepo, _, _, auctionClient := setupService()
		ctx := context.Background()

		redisRepo.On("Lock", ctx, "resolve:"+auctionID, 10*time.Second).Return("lock-id", nil)
		redisRepo.On("Unlock", ctx, "resolve:"+auctionID, "lock-id").Return(nil)
		
		auctionClient.On("GetAuction", ctx, auctionID).Return(&auction_pb.GetAuctionResponse{Exists: true}, nil)
		redisRepo.On("GetHighestBid", ctx, auctionID).Return(nil, nil)
		mongoRepo.On("GetHighestBid", ctx, auctionID).Return(nil, nil)

		err := s.ResolveAuction(ctx, auctionID, sellerID)
		assert.NoError(t, err)
	})
}

func TestGetHighestBid(t *testing.T) {
	auctionID := "auction-123"

	t.Run("Found in Redis", func(t *testing.T) {
		s, redisRepo, _, _, _, auctionClient := setupService()
		ctx := context.Background()
		auctionClient.On("GetAuction", ctx, auctionID).Return(&auction_pb.GetAuctionResponse{Exists: true}, nil)
		expectedBid := &domains.Bid{ID: "bid-1", Amount: 100.0}
		redisRepo.On("GetHighestBid", ctx, auctionID).Return(expectedBid, nil)

		bid, err := s.GetHighestBid(ctx, auctionID)
		assert.NoError(t, err)
		assert.Equal(t, expectedBid, bid)
	})

	t.Run("Found in Mongo", func(t *testing.T) {
		s, redisRepo, mongoRepo, _, _, auctionClient := setupService()
		ctx := context.Background()
		auctionClient.On("GetAuction", ctx, auctionID).Return(&auction_pb.GetAuctionResponse{Exists: true}, nil)
		expectedBid := &domains.Bid{ID: "bid-2", Amount: 200.0}
		redisRepo.On("GetHighestBid", ctx, auctionID).Return(nil, errors.New("not found"))
		mongoRepo.On("GetHighestBid", ctx, auctionID).Return(expectedBid, nil)

		bid, err := s.GetHighestBid(ctx, auctionID)
		assert.NoError(t, err)
		assert.Equal(t, expectedBid, bid)
	})

	t.Run("Auction Not Found", func(t *testing.T) {
		s, _, _, _, _, auctionClient := setupService()
		ctx := context.Background()
		auctionClient.On("GetAuction", ctx, auctionID).Return(&auction_pb.GetAuctionResponse{Exists: false}, nil)

		bid, err := s.GetHighestBid(ctx, auctionID)
		require.Error(t, err)
		assert.Nil(t, bid)
		assert.Contains(t, err.Error(), "Auction not found")
	})
}

func TestGetAuctionHistory(t *testing.T) {
	auctionID := "auction-123"

	t.Run("Success with Pagination", func(t *testing.T) {
		s, _, mongoRepo, _, _, auctionClient := setupService()
		ctx := context.Background()
		auctionClient.On("GetAuction", ctx, auctionID).Return(&auction_pb.GetAuctionResponse{Exists: true}, nil)
		
		limit := 5
		page := 2
		pagination := &model.PaginationInput{Limit: &limit, Page: &page}
		
		expectedBids := []*domains.Bid{{ID: "bid-1"}}
		mongoRepo.On("GetAuctionHistory", ctx, auctionID, int64(5), int64(5)).Return(expectedBids, int64(10), nil)

		bids, total, err := s.GetAuctionHistory(ctx, auctionID, pagination)
		assert.NoError(t, err)
		assert.Equal(t, expectedBids, bids)
		assert.Equal(t, int64(10), total)
	})
}

func TestGetMyBids(t *testing.T) {
	userID := "user-123"

	t.Run("Success", func(t *testing.T) {
		s, _, mongoRepo, _, _, _ := setupService()
		ctx := context.WithValue(context.Background(), Middlewares.UserIDKey, userID)
		expectedBids := []*domains.Bid{{ID: "bid-1"}}
		mongoRepo.On("GetBidsByUserID", ctx, userID, int64(10), int64(0)).Return(expectedBids, int64(1), nil)

		bids, total, err := s.GetMyBids(ctx, nil)
		assert.NoError(t, err)
		assert.Equal(t, expectedBids, bids)
		assert.Equal(t, int64(1), total)
	})

	t.Run("Unauthorized", func(t *testing.T) {
		s, _, _, _, _, _ := setupService()
		bids, total, err := s.GetMyBids(context.Background(), nil)
		require.Error(t, err)
		assert.Nil(t, bids)
		assert.Equal(t, int64(0), total)
		assert.Contains(t, err.Error(), "Unauthorized access")
	})
}
