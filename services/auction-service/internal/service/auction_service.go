package service

import (
	"context"
	"fmt"
	"time"

	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/domain"
)

type AuctionService interface {
	CreateAuction(ctx context.Context, input CreateAuctionParams) (*domain.Auction, error)
}

type CreateAuctionParams struct {
	Title         string
	Description   string
	StartingPrice float64
	Currency      string
	StartTime     string
	EndTime       string
}

type auctionService struct {
	repo domain.AuctionRepository
}

func NewAuctionService(repo domain.AuctionRepository) AuctionService {
	return &auctionService{
		repo: repo,
	}
}

func (s *auctionService) CreateAuction(ctx context.Context, input CreateAuctionParams) (*domain.Auction, error) {
	startTime, err := time.Parse(time.RFC3339, input.StartTime)
	if err != nil {
		return nil, fmt.Errorf("invalid startTime format: %w", err)
	}

	endTime, err := time.Parse(time.RFC3339, input.EndTime)
	if err != nil {
		return nil, fmt.Errorf("invalid endTime format: %w", err)
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
		Images:        []string{},
		SellerID:      "test-seller-id",
	}

	if err := s.repo.Create(ctx, auction); err != nil {
		return nil, fmt.Errorf("failed to create auction: %w", err)
	}

	return auction, nil
}
