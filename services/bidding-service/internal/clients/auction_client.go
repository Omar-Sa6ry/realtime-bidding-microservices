package client

import (
	"context"
	"fmt"
	"log"

	pb "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/protos/auction"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type AuctionClient interface {
	ValidateAuctionForBid(ctx context.Context, auctionId string, userId string, amount float64) (*pb.ValidateAuctionResponse, error)
	GetAuction(ctx context.Context, auctionId string) (*pb.ValidateAuctionResponse, error)
	Close() error
}

type auctionClient struct {
	conn   *grpc.ClientConn
	client pb.AuctionServiceClient
}

func NewAuctionClient(url string) (AuctionClient, error) {
	conn, err := grpc.Dial(url, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Auction Service at %s: %w", url, err)
	}

	log.Printf("Successfully connected to Auction Service gRPC at %s", url)

	return &auctionClient{
		conn:   conn,
		client: pb.NewAuctionServiceClient(conn),
	}, nil
}

func (c *auctionClient) ValidateAuctionForBid(ctx context.Context, auctionId string, userId string, amount float64) (*pb.ValidateAuctionResponse, error) {
	resp, err := c.client.ValidateAuctionForBid(ctx, &pb.ValidateAuctionRequest{AuctionId: auctionId, UserId: userId, Amount: amount})
	if err != nil {
		return nil, fmt.Errorf("failed to validate auction: %w", err)
	}

	return resp, nil
}

func (c *auctionClient) GetAuction(ctx context.Context, auctionId string) (*pb.ValidateAuctionResponse, error) {
	resp, err := c.client.GetAuction(ctx, &pb.GetAuctionRequest{AuctionId: auctionId})
	if err != nil {
		return nil, fmt.Errorf("failed to get auction: %w", err)
	}
	return resp, nil
}

func (c *auctionClient) Close() error {
	return c.conn.Close()
}
