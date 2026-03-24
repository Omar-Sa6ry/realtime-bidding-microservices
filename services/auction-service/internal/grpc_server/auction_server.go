package grpc_server

import (
	"context"
	"fmt"

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

	logger.Info("AuctionGRPC", "Auction validated successfully")
	return &pb.ValidateAuctionResponse{
		IsActive: true,
	}, nil
}
