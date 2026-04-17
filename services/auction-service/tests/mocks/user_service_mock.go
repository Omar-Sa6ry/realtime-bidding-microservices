package mocks

import (
	context "context"

	pb "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/proto/user"
)

type MockUserService struct {
	pb.UnimplementedUserServiceServer
	GetUserFunc func(ctx context.Context, in *pb.GetUserRequest) (*pb.GetUserResponse, error)
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
		},
	}, nil
}

func (m *MockUserService) GetUsers(ctx context.Context, in *pb.GetUsersRequest) (*pb.GetUsersResponse, error) {
	users := make([]*pb.User, len(in.Ids))
	for i, id := range in.Ids {
		users[i] = &pb.User{
			Id:        id,
			Firstname: "Test",
			Lastname:  "User " + id,
			Email:     id + "@example.com",
		}
	}
	return &pb.GetUsersResponse{Users: users}, nil
}

