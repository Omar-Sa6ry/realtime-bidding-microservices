package service

import (
	"context"
	"testing"
	"time"

	"github.com/99designs/gqlgen/graphql"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/broker"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/domain"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/middleware"
	pb "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/proto/user"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"go.mongodb.org/mongo-driver/bson"
)

// Mocks
type MockAuctionRepository struct {
	mock.Mock
}

func (m *MockAuctionRepository) Create(ctx context.Context, auction *domain.Auction) error {
	args := m.Called(ctx, auction)
	return args.Error(0)
}

func (m *MockAuctionRepository) FindByID(ctx context.Context, id string) (*domain.Auction, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Auction), args.Error(1)
}

func (m *MockAuctionRepository) FindAll(ctx context.Context, filter bson.M, limit, offset int64) ([]*domain.Auction, int64, error) {
	args := m.Called(ctx, filter, limit, offset)
	return args.Get(0).([]*domain.Auction), args.Get(1).(int64), args.Error(2)
}

func (m *MockAuctionRepository) Update(ctx context.Context, auction *domain.Auction) error {
	args := m.Called(ctx, auction)
	return args.Error(0)
}

func (m *MockAuctionRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockAuctionRepository) UpdateStatusBulk(ctx context.Context, currentStatus domain.AuctionStatus, newStatus domain.AuctionStatus, timeField string, cutoff time.Time) (int64, error) {
	args := m.Called(ctx, currentStatus, newStatus, timeField, cutoff)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockAuctionRepository) FindByStatusAndCutoff(ctx context.Context, status domain.AuctionStatus, timeField string, cutoff time.Time) ([]*domain.Auction, error) {
	args := m.Called(ctx, status, timeField, cutoff)
	return args.Get(0).([]*domain.Auction), args.Error(1)
}

func (m *MockAuctionRepository) EnsureIndexes(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

type MockCloudinaryService struct {
	mock.Mock
}

func (m *MockCloudinaryService) UploadImage(ctx context.Context, file graphql.Upload) (string, error) {
	args := m.Called(ctx, file)
	return args.String(0), args.Error(1)
}

func (m *MockCloudinaryService) UploadMultipleImages(ctx context.Context, files []*graphql.Upload) ([]string, error) {
	args := m.Called(ctx, files)
	return args.Get(0).([]string), args.Error(1)
}

type MockPublisher struct {
	mock.Mock
}

func (m *MockPublisher) Publish(ctx context.Context, event broker.Event) error {
	args := m.Called(ctx, event)
	return args.Error(0)
}

func (m *MockPublisher) Close() {
	m.Called()
}

type MockUserClient struct {
	mock.Mock
}

func (m *MockUserClient) GetUser(ctx context.Context, id string) (*pb.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*pb.User), args.Error(1)
}

func (m *MockUserClient) GetUsers(ctx context.Context, ids []string) (*pb.GetUsersResponse, error) {
	args := m.Called(ctx, ids)
	return args.Get(0).(*pb.GetUsersResponse), args.Error(1)
}

func (m *MockUserClient) Close() error {
	args := m.Called()
	return args.Error(0)
}

// Tests

func TestCreateAuction(t *testing.T) {
	// Common Test Data
	startTime := time.Now().Add(time.Hour).Format(time.RFC3339)
	endTime := time.Now().Add(time.Hour * 2).Format(time.RFC3339)

	input := CreateAuctionParams{
		Title:         "Old Antique Watch",
		Description:   "A beautiful antique watch from the 19th century.",
		StartingPrice: 1000.0,
		Currency:      "USD",
		StartTime:     startTime,
		EndTime:       endTime,
		Images:        nil,
	}

	userID := "user-123"
	ctx := context.WithValue(context.Background(), middleware.UserIDKey, userID)

	t.Run("Success Path", func(t *testing.T) {
		// Setup fresh mocks and service
		repo := new(MockAuctionRepository)
		cloudinary := new(MockCloudinaryService)
		publisher := new(MockPublisher)
		userClient := new(MockUserClient)
		service := NewAuctionService(repo, cloudinary, publisher, userClient)

		// Expectations
		userClient.On("GetUser", ctx, userID).Return(&pb.User{Id: userID}, nil)
		cloudinary.On("UploadMultipleImages", ctx, mock.Anything).Return([]string{"http://image.com/1.jpg"}, nil)
		repo.On("Create", ctx, mock.Anything).Return(nil)
		publisher.On("Publish", ctx, mock.Anything).Return(nil)

		// Execute
		auction, err := service.CreateAuction(ctx, input)

		// Assert
		assert.NoError(t, err)
		assert.NotNil(t, auction)
		assert.Equal(t, input.Title, auction.Title)
		assert.Equal(t, userID, auction.SellerID)
		assert.Equal(t, domain.StatusPending, auction.Status)

		repo.AssertExpectations(t)
		userClient.AssertExpectations(t)
	})

	t.Run("Seller Not Found Error", func(t *testing.T) {
		repo := new(MockAuctionRepository)
		cloudinary := new(MockCloudinaryService)
		publisher := new(MockPublisher)
		userClient := new(MockUserClient)
		service := NewAuctionService(repo, cloudinary, publisher, userClient)

		userClient.On("GetUser", ctx, userID).Return(nil, nil)

		auction, err := service.CreateAuction(ctx, input)

		assert.Error(t, err)
		assert.Nil(t, auction)
		assert.ErrorIs(t, err, domain.ErrSellerNotFound)
	})

	t.Run("Invalid Start Time Format", func(t *testing.T) {
		repo := new(MockAuctionRepository)
		cloudinary := new(MockCloudinaryService)
		publisher := new(MockPublisher)
		userClient := new(MockUserClient)
		service := NewAuctionService(repo, cloudinary, publisher, userClient)

		userClient.On("GetUser", ctx, userID).Return(&pb.User{Id: userID}, nil)

		badInput := input
		badInput.StartTime = "invalid-date"

		_, err := service.CreateAuction(ctx, badInput)

		assert.Error(t, err)
		assert.ErrorIs(t, err, domain.ErrInvalidStartTime)
	})
}
