package client

import (
	"context"
	"fmt"
	"log"

	pb "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/proto/user"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type UserClient interface {
	GetUser(ctx context.Context, id string) (*pb.User, error)
	GetUsers(ctx context.Context, ids []string) (*pb.GetUsersResponse, error)
	Close() error
}

type userClient struct {
	conn   *grpc.ClientConn
	client pb.UserServiceClient
}

func NewUserClient(url string) (UserClient, error) {
	conn, err := grpc.Dial(url, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to User Service at %s: %w", url, err)
	}

	log.Printf("Successfully connected to User Service gRPC at %s", url)

	return &userClient{
		conn:   conn,
		client: pb.NewUserServiceClient(conn),
	}, nil
}

func (c *userClient) GetUser(ctx context.Context, id string) (*pb.User, error) {
	resp, err := c.client.GetUser(ctx, &pb.GetUserRequest{Id: id})
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return resp.User, nil
}

func (c *userClient) GetUsers(ctx context.Context, ids []string) (*pb.GetUsersResponse, error) {
	resp, err := c.client.GetUsers(ctx, &pb.GetUsersRequest{Ids: ids})
	if err != nil {
		return nil, fmt.Errorf("failed to get users: %w", err)
	}

	return resp, nil
}

func (c *userClient) Close() error {
	return c.conn.Close()
}
