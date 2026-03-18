package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/graph/model"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/broker"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/client"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/domain"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/middleware"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/pkg/translation"
	"go.mongodb.org/mongo-driver/bson"
)

type AuctionService interface {
	CreateAuction(ctx context.Context, input CreateAuctionParams) (*domain.Auction, error)
	FindByID(ctx context.Context, id string) (*domain.Auction, error)
	FindAll(ctx context.Context, input *model.FindAuctionsInput, pagination *model.PaginationInput) ([]*domain.Auction, int64, error)
	UpdateAuction(ctx context.Context, id string, input model.UpdateAuctionInput) (*domain.Auction, error)
	DeleteAuction(ctx context.Context, id string) (*domain.Auction, error)
	ProcessLifecycleTransitions(ctx context.Context) error
}

type auctionService struct {
	repo       domain.AuctionRepository
	cloudinary CloudinaryService
	publisher  broker.Publisher
	userClient client.UserClient
}

func NewAuctionService(repo domain.AuctionRepository, cloudinary CloudinaryService, publisher broker.Publisher, userClient client.UserClient) AuctionService {
	return &auctionService{
		repo:       repo,
		cloudinary: cloudinary,
		publisher:  publisher,
		userClient: userClient,
	}
}

func (s *auctionService) CreateAuction(ctx context.Context, input CreateAuctionParams) (*domain.Auction, error) {
	userID := middleware.GetUserIDFromContext(ctx)

	// Validate seller existence via gRPC
	user, err := s.userClient.GetUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to validate seller: %w", err)
	}
	if user == nil {
		return nil, errors.New(translation.T(ctx, "SELLER_NOT_FOUND"))
	}

	startTime, err := time.Parse(time.RFC3339, input.StartTime)
	if err != nil {
		return nil, errors.New(translation.T(ctx, "INVALID_START_TIME"))
	}

	endTime, err := time.Parse(time.RFC3339, input.EndTime)
	if err != nil {
		return nil, errors.New(translation.T(ctx, "INVALID_END_TIME"))
	}

	imageURLs, err := s.cloudinary.UploadMultipleImages(ctx, input.Images)
	if err != nil {
		return nil, errors.New(translation.T(ctx, "IMAGE_UPLOAD_FAILED"))
	}

	auction := &domain.Auction{
		Title:         input.Title,
		Description:   input.Description,
		StartingPrice: input.StartingPrice,
		CurrentPrice:  input.StartingPrice,
		Currency:      input.Currency,
		StartTime:     startTime,
		EndTime:       endTime,
		Status:        domain.StatusPending,
		Images:        imageURLs,
		SellerID:      userID,
	}

	if err := s.repo.Create(ctx, auction); err != nil {
		return nil, fmt.Errorf("failed to create auction: %w", err)
	}

	// Publish auction.create event
	_ = s.publisher.Publish(ctx, broker.Event{
		Subject: "auction.create",
		Data:    auction,
	})

	return auction, nil
}

func (s *auctionService) FindByID(ctx context.Context, id string) (*domain.Auction, error) {
	return s.repo.FindByID(ctx, id)
}

func (s *auctionService) FindAll(ctx context.Context, input *model.FindAuctionsInput, pagination *model.PaginationInput) ([]*domain.Auction, int64, error) {
	filter := bson.M{}
	if input != nil {
		if input.Title != nil {
			filter["title"] = bson.M{"$regex": *input.Title, "$options": "i"}
		}

		if input.Status != nil {
			filter["status"] = *input.Status
		}
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

	return s.repo.FindAll(ctx, filter, limit, offset)
}

func (s *auctionService) UpdateAuction(ctx context.Context, id string, input model.UpdateAuctionInput) (*domain.Auction, error) {
	userID := middleware.GetUserIDFromContext(ctx)

	// Validate seller existence via gRPC
	user, err := s.userClient.GetUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to validate seller: %w", err)
	}
	if user == nil {
		return nil, fmt.Errorf("seller profile not found in user service")
	}

	auction, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to find auction: %w", err)
	}

	if auction == nil {
		return nil, errors.New(translation.T(ctx, "AUCTION_NOT_FOUND"))
	}
	if userID != auction.SellerID {
		return nil, errors.New(translation.T(ctx, "UNAUTHORIZED_SELLER"))
	}
	if auction.Status != domain.StatusPending {
		return nil, errors.New(translation.T(ctx, "AUCTION_NOT_PENDING"))
	}

	if input.Title != nil {
		auction.Title = *input.Title
	}

	if input.Description != nil {
		auction.Description = *input.Description
	}

	if input.StartingPrice != nil {
		auction.StartingPrice = *input.StartingPrice
	}

	if input.Currency != nil {
		auction.Currency = *input.Currency
	}

	if input.StartTime != nil {
		auction.StartTime, err = time.Parse(time.RFC3339, *input.StartTime)
		if err != nil {
			return nil, errors.New(translation.T(ctx, "INVALID_START_TIME"))
		}
	}

	if input.EndTime != nil {
		auction.EndTime, err = time.Parse(time.RFC3339, *input.EndTime)
		if err != nil {
			return nil, errors.New(translation.T(ctx, "INVALID_END_TIME"))
		}
	}

	if input.Images != nil {
		imageURLs, err := s.cloudinary.UploadMultipleImages(ctx, input.Images)
		if err != nil {
			return nil, errors.New(translation.T(ctx, "IMAGE_UPLOAD_FAILED"))
		}
		auction.Images = imageURLs
	}

	if err := s.repo.Update(ctx, auction); err != nil {
		return nil, fmt.Errorf("failed to update auction: %w", err)
	}

	// Publish auction.update event
	_ = s.publisher.Publish(ctx, broker.Event{
		Subject: "auction.update",
		Data:    auction,
	})

	return auction, nil
}

func (s *auctionService) DeleteAuction(ctx context.Context, id string) (*domain.Auction, error) {
	userID := middleware.GetUserIDFromContext(ctx)

	// Validate seller existence via gRPC
	user, err := s.userClient.GetUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to validate seller: %w", err)
	}
	if user == nil {
		return nil, errors.New(translation.T(ctx, "SELLER_NOT_FOUND"))
	}
	auction, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to find auction: %w", err)
	}

	if auction == nil {
		return nil, errors.New(translation.T(ctx, "AUCTION_NOT_FOUND"))
	}
	if userID != auction.SellerID {
		return nil, errors.New(translation.T(ctx, "UNAUTHORIZED_SELLER"))
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		return nil, fmt.Errorf("failed to delete auction: %w", err)
	}

	// Publish auction.delete event
	_ = s.publisher.Publish(ctx, broker.Event{
		Subject: "auction.delete",
		Data:    auction,
	})

	return auction, nil
}

func (s *auctionService) ProcessLifecycleTransitions(ctx context.Context) error {
	now := time.Now()

	pendingToActive, err := s.repo.FindByStatusAndCutoff(ctx, domain.StatusPending, "startTime", now)
	if err == nil && len(pendingToActive) > 0 {
		count, err := s.repo.UpdateStatusBulk(ctx, domain.StatusPending, domain.StatusActive, "startTime", now)
		if err == nil && count > 0 {
			fmt.Printf("Activated %d pending auctions\n", count)
			for _, a := range pendingToActive {
				a.Status = domain.StatusActive
				_ = s.publisher.Publish(ctx, broker.Event{
					Subject: "auction.active",
					Data:    a,
				})
			}
		}
	}

	activeToEnded, err := s.repo.FindByStatusAndCutoff(ctx, domain.StatusActive, "endTime", now)
	if err == nil && len(activeToEnded) > 0 {
		count, err := s.repo.UpdateStatusBulk(ctx, domain.StatusActive, domain.StatusEnded, "endTime", now)
		if err == nil && count > 0 {
			fmt.Printf("Ended %d active auctions\n", count)
			for _, a := range activeToEnded {
				a.Status = domain.StatusEnded 
				_ = s.publisher.Publish(ctx, broker.Event{
					Subject: "auction.ended",
					Data:    a,
				})
			}
		}
	}

	return nil
}
