package grpc_server

import (
	"context"
	"fmt"
	"time"

	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/domain"
	pb "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/proto/auction"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/pkg/logger"
)

type AuctionServer struct {
	pb.UnimplementedAuctionServiceServer
	repo domain.AuctionRepository
}

func NewAuctionServer(repo domain.AuctionRepository) *AuctionServer {
	return &AuctionServer{
		repo: repo,
	}
}

func (s *AuctionServer) ValidateAuctionForBid(ctx context.Context, req *pb.ValidateAuctionRequest) (*pb.ValidateAuctionResponse, error) {
	userID := req.UserId
	amount := req.Amount

	auction, err := s.repo.FindByID(ctx, req.AuctionId)
	if err != nil {
		logger.Error("AuctionGRPC", "Failed to find auction", err)
		return &pb.ValidateAuctionResponse{
			IsActive:     false,
			ErrorMessage: domain.ErrInternalServerError.Error(),
		}, nil
	}

	if auction == nil {
		return &pb.ValidateAuctionResponse{
			IsActive:     false,
			ErrorMessage: domain.ErrAuctionNotFound.Error(),
		}, nil
	}

	if auction.Status != domain.StatusActive {
		return &pb.ValidateAuctionResponse{
			IsActive:     false,
			ErrorMessage: domain.AuctionNotActive.Error(),
		}, nil
	}

	if auction.SellerID == userID {
		return &pb.ValidateAuctionResponse{
			IsActive:     false,
			ErrorMessage: domain.YouOwnAuction.Error(),
		}, nil
	}

	if amount <= auction.CurrentPrice {
		return &pb.ValidateAuctionResponse{
			IsActive:     false,
			ErrorMessage: fmt.Sprintf("Bid amount must be greater than current price (%.2f)", auction.CurrentPrice),
		}, nil
	}

	// If bid is within last 5 minutes, extend by 2 minutes
	const snipingWindow = 5 * 60
	const extensionAmount = 2 * 60
	now := time.Now()
	timeRemaining := auction.EndTime.Sub(now).Seconds()

	if timeRemaining > 0 && timeRemaining < snipingWindow {
		auction.EndTime = auction.EndTime.Add(time.Duration(extensionAmount) * time.Second)
		logger.Info("AuctionGRPC", fmt.Sprintf("Auction %s extended to %s", auction.ID, auction.EndTime))
	}

	auction.CurrentPrice = amount
	if err := s.repo.Update(ctx, auction); err != nil {
		logger.Error("AuctionGRPC", "Failed to update auction state", err)
		return &pb.ValidateAuctionResponse{
			IsActive:     false,
			ErrorMessage: domain.ErrInternalServerError.Error(),
		}, nil
	}

	logger.Info("AuctionGRPC", "Auction validated and updated successfully")
	return &pb.ValidateAuctionResponse{
		IsActive: true,
	}, nil
}

func (s *AuctionServer) GetAuction(ctx context.Context, req *pb.GetAuctionRequest) (*pb.GetAuctionResponse, error) {
	auction, err := s.repo.FindByID(ctx, req.AuctionId)
	if err != nil {
		return &pb.GetAuctionResponse{Exists: false}, nil
	}
	if auction == nil {
		return &pb.GetAuctionResponse{Exists: false}, nil
	}

	return &pb.GetAuctionResponse{
		Exists:       true,
		CurrentPrice: auction.CurrentPrice,
		SellerId:     auction.SellerID,
		Status:       string(auction.Status),
	}, nil
}
