package mocks

import (
	"context"

	pb "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/protos/auction"
)

type MockAuctionService struct {
	pb.UnimplementedAuctionServiceServer
	GetAuctionFunc           func(ctx context.Context, in *pb.GetAuctionRequest) (*pb.GetAuctionResponse, error)
	ValidateAuctionForBidFunc func(ctx context.Context, in *pb.ValidateAuctionRequest) (*pb.ValidateAuctionResponse, error)
}

func (m *MockAuctionService) GetAuction(ctx context.Context, in *pb.GetAuctionRequest) (*pb.GetAuctionResponse, error) {
	if m.GetAuctionFunc != nil {
		return m.GetAuctionFunc(ctx, in)
	}

	return &pb.GetAuctionResponse{
		Exists:       true,
		CurrentPrice: 100,
		SellerId:     "test-user-id",
		Status:       "ACTIVE",
	}, nil
}

func (m *MockAuctionService) ValidateAuctionForBid(ctx context.Context, in *pb.ValidateAuctionRequest) (*pb.ValidateAuctionResponse, error) {
	if m.ValidateAuctionForBidFunc != nil {
		return m.ValidateAuctionForBidFunc(ctx, in)
	}

	return &pb.ValidateAuctionResponse{
		IsActive: true,
	}, nil
}
