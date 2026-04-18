package mocks

import (
	"context"

	pb "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/protos/user"
)

type MockUserService struct {
	pb.UnimplementedUserServiceServer
	GetUserFunc       func(ctx context.Context, in *pb.GetUserRequest) (*pb.GetUserResponse, error)
	UpdateBalanceFunc func(ctx context.Context, in *pb.UpdateBalanceRequest) (*pb.UpdateBalanceResponse, error)
}

func (m *MockUserService) GetUser(ctx context.Context, in *pb.GetUserRequest) (*pb.GetUserResponse, error) {
	if m.GetUserFunc != nil {
		return m.GetUserFunc(ctx, in)
	}

	return &pb.GetUserResponse{
		User: &pb.User{
			Id:        in.Id,
			Firstname: "Test",
			Lastname:  "User",
			Email:     "test@example.com",
			Balance:   1000,
		},
	}, nil
}

func (m *MockUserService) UpdateBalance(ctx context.Context, in *pb.UpdateBalanceRequest) (*pb.UpdateBalanceResponse, error) {
	if m.UpdateBalanceFunc != nil {
		return m.UpdateBalanceFunc(ctx, in)
	}

	return &pb.UpdateBalanceResponse{
		Success: true,
		Message: "Balance updated successfully",
	}, nil
}
