package service

import (
	"context"
	"fmt"
	"time"

	"github.com/99designs/gqlgen/graphql"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/graph/model"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/domain"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/middleware"
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

type CreateAuctionParams struct {
	Title         string
	Description   string
	StartingPrice float64
	Currency      string
	StartTime     string
	EndTime       string
	Images        []*graphql.Upload
}

type auctionService struct {
	repo       domain.AuctionRepository
	cloudinary CloudinaryService
}

func NewAuctionService(repo domain.AuctionRepository, cloudinary CloudinaryService) AuctionService {
	return &auctionService{
		repo:       repo,
		cloudinary: cloudinary,
	}
}

func (s *auctionService) CreateAuction(ctx context.Context, input CreateAuctionParams) (*domain.Auction, error) {
	userID := middleware.GetUserIDFromContext(ctx)

	startTime, err := time.Parse(time.RFC3339, input.StartTime)
	if err != nil {
		return nil, fmt.Errorf("invalid startTime format: %w", err)
	}

	endTime, err := time.Parse(time.RFC3339, input.EndTime)
	if err != nil {
		return nil, fmt.Errorf("invalid endTime format: %w", err)
	}

	imageURLs, err := s.cloudinary.UploadMultipleImages(ctx, input.Images)
	if err != nil {
		return nil, fmt.Errorf("failed to upload images: %w", err)
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

	auction, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to find auction: %w", err)
	}

	if auction == nil {
		return nil, fmt.Errorf("auction not found")
	}
	if userID != auction.SellerID {
		return nil, fmt.Errorf("you are not the seller of this auction")
	}
	if auction.Status != domain.StatusPending {
		return nil, fmt.Errorf("auction is not pending")
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
			return nil, fmt.Errorf("invalid startTime format: %w", err)
		}
	}

	if input.EndTime != nil {
		auction.EndTime, err = time.Parse(time.RFC3339, *input.EndTime)
		if err != nil {
			return nil, fmt.Errorf("invalid endTime format: %w", err)
		}
	}

	if input.Images != nil {
		imageURLs, err := s.cloudinary.UploadMultipleImages(ctx, input.Images)
		if err != nil {
			return nil, fmt.Errorf("failed to upload images: %w", err)
		}
		auction.Images = imageURLs
	}

	if err := s.repo.Update(ctx, auction); err != nil {
		return nil, fmt.Errorf("failed to update auction: %w", err)
	}

	return auction, nil
}

func (s *auctionService) DeleteAuction(ctx context.Context, id string) (*domain.Auction, error) {
	userID := middleware.GetUserIDFromContext(ctx)

	auction, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to find auction: %w", err)
	}

	if auction == nil {
		return nil, fmt.Errorf("auction not found")
	}
	if userID != auction.SellerID {
		return nil, fmt.Errorf("you are not the seller of this auction")
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		return nil, fmt.Errorf("failed to delete auction: %w", err)
	}

	return auction, nil
}

func (s *auctionService) ProcessLifecycleTransitions(ctx context.Context) error {
	activated, err := s.repo.UpdateStatusBulk(ctx, domain.StatusPending, domain.StatusActive, "startTime", time.Now())
	if err != nil {
		return fmt.Errorf("failed to activate auctions: %w", err)
	}
	if activated > 0 {
		fmt.Printf("Activated %d pending auctions\n", activated)
	}

	ended, err := s.repo.UpdateStatusBulk(ctx, domain.StatusActive, domain.StatusEnded, "endTime", time.Now())
	if err != nil {
		return fmt.Errorf("failed to end auctions: %w", err)
	}
	if ended > 0 {
		fmt.Printf("Ended %d active auctions\n", ended)
	}

	return nil
}
