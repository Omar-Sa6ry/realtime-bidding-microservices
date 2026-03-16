package service

import (
	"context"
	"fmt"
	"time"

	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/graph/model"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/domain"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/middleware"
	"github.com/99designs/gqlgen/graphql"
	"go.mongodb.org/mongo-driver/bson"
)

type AuctionService interface {
	CreateAuction(ctx context.Context, input CreateAuctionParams) (*domain.Auction, error)
	FindByID(ctx context.Context, id string) (*domain.Auction, error)
	FindAll(ctx context.Context, input *model.FindAuctionsInput, pagination *model.PaginationInput) ([]*domain.Auction, int64, error)
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
