package e2e

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	nats_lib "github.com/nats-io/nats.go"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/app"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/config"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/domain"
	pb_auction "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/proto/auction"
	pb_user "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/proto/user"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/tests/mocks"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"github.com/testcontainers/testcontainers-go/modules/mongodb"
	"github.com/testcontainers/testcontainers-go/modules/nats"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)


type AuctionE2ESuite struct {
	suite.Suite
	ctx            context.Context
	mongoContainer *mongodb.MongoDBContainer
	natsContainer  *nats.NATSContainer
	mockUserServer *grpc.Server
	natsConn       *nats_lib.Conn
	grpcClient     pb_auction.AuctionServiceClient
	grpcConn       *grpc.ClientConn

	auctionApp     *app.App
	cfg            *config.Config
	testToken      string
}


func (s *AuctionE2ESuite) SetupSuite() {
	s.ctx = context.Background()

	// Start MongoDB Container
	mongoC, err := mongodb.Run(s.ctx, "mongo:6.0")
	s.Require().NoError(err)
	s.mongoContainer = mongoC

	mongoURI, err := mongoC.ConnectionString(s.ctx)
	s.Require().NoError(err)

	// Start NATS Container
	natsC, err := nats.Run(s.ctx, "nats:latest")
	s.Require().NoError(err)
	s.natsContainer = natsC

	natsURI, err := natsC.ConnectionString(s.ctx)
	s.Require().NoError(err)

	// Start Mock User gRPC Server
	lis, err := net.Listen("tcp", "localhost:50051")
	s.Require().NoError(err)

	s.mockUserServer = grpc.NewServer()
	mockUserService := &mocks.MockUserService{}
	pb_user.RegisterUserServiceServer(s.mockUserServer, mockUserService)

	go func() {
		if err := s.mockUserServer.Serve(lis); err != nil {
			fmt.Printf("Mock gRPC server stopped: %v\n", err)
		}
	}()

	// Initialize Config for Test
	s.cfg = &config.Config{
		MongoURI:       mongoURI,
		DBName:         "test_auction_db",
		Port:           "4001",
		NatsURL:        natsURI,
		JWTSecret:      "test_secret",
		UserServiceURL: "localhost:50051",
	}

	// Generate Test Token
	s.testToken = s.generateToken("test-user-id")

	// Initialize Auction App
	s.auctionApp = app.NewWithConfig(s.cfg)
	err = s.auctionApp.Setup()
	s.Require().NoError(err)

	// Initialize NATS client for verification
	s.natsConn, err = nats_lib.Connect(natsURI)
	s.Require().NoError(err)

	// Initialize gRPC client for auction-service
	s.grpcConn, err = grpc.Dial("localhost:50052", grpc.WithTransportCredentials(insecure.NewCredentials()))
	s.Require().NoError(err)
	s.grpcClient = pb_auction.NewAuctionServiceClient(s.grpcConn)
	
	// Wait for server to be ready
	time.Sleep(1 * time.Second)
}

func (s *AuctionE2ESuite) generateToken(userID string) string {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":          userID,
		"role":        "USER",
		"permissions": []string{"CREATE_AUCTION", "VIEW_AUCTION", "UPDATE_AUCTION", "DELETE_AUCTION"},
		"exp":         time.Now().Add(time.Hour).Unix(),
	})

	tokenString, _ := token.SignedString([]byte(s.cfg.JWTSecret))
	return tokenString
}

func (s *AuctionE2ESuite) TearDownSuite() {
	if s.auctionApp != nil {
		s.auctionApp.Shutdown()
	}
	if s.grpcConn != nil {
		s.grpcConn.Close()
	}
	if s.natsConn != nil {
		s.natsConn.Close()
	}
	if s.mockUserServer != nil {
		s.mockUserServer.Stop()
	}
	if s.mongoContainer != nil {
		s.mongoContainer.Terminate(s.ctx)
	}
	if s.natsContainer != nil {
		s.natsContainer.Terminate(s.ctx)
	}
}

func (s *AuctionE2ESuite) TestCreateAuction() {
	startTime := time.Now().Add(time.Hour).Format(time.RFC3339)
	endTime := time.Now().Add(2 * time.Hour).Format(time.RFC3339)

	// Subscribe to NATS to verify event
	sub, err := s.natsConn.SubscribeSync("auction.create")
	s.Require().NoError(err)
	defer sub.Unsubscribe()

	mutation := fmt.Sprintf(`
	mutation {
		createAuction(input: {
			title: "E2E Watch",
			description: "Testing NATS and GraphQL",
			startingPrice: 500.0,
			currency: "USD",
			startTime: "%s",
			endTime: "%s"
		}) {
			success
			message
			data {
				id
				title
			}
		}
	}`, startTime, endTime)

	requestBody, _ := json.Marshal(map[string]string{"query": mutation})
	req, _ := http.NewRequest("POST", "http://localhost:4001/graphql", bytes.NewBuffer(requestBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.testToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	s.Require().NoError(err)
	defer resp.Body.Close()

	s.Require().Equal(http.StatusOK, resp.StatusCode)

	var result struct {
		Data struct {
			CreateAuction struct {
				Success bool   `json:"success"`
				Data    struct {
					ID    string `json:"id"`
					Title string `json:"title"`
				} `json:"data"`
			} `json:"createAuction"`
		} `json:"data"`
	}
	err = json.NewDecoder(resp.Body).Decode(&result)
	s.Require().NoError(err)
	s.True(result.Data.CreateAuction.Success)

	// Verify NATS Message
	msg, err := sub.NextMsg(2 * time.Second)
	s.Require().NoError(err)
	s.Require().NotNil(msg)

	var natsData struct {
		ID    string `json:"id"`
		Title string `json:"title"`
	}
	err = json.Unmarshal(msg.Data, &natsData)
	s.Require().NoError(err)
	s.Equal(result.Data.CreateAuction.Data.ID, natsData.ID)
	s.Equal("E2E Watch", natsData.Title)
}

func (s *AuctionE2ESuite) TestGRPCValidateAuction() {
	// Seed an active auction
	auc := &domain.Auction{
		ID:           primitive.NewObjectID(),
		Title:        "GRPC Test",
		SellerID:     "seller-1",
		Status:       domain.StatusActive,
		CurrentPrice: 100.0,
		StartTime:    time.Now().Add(-time.Hour),
		EndTime:      time.Now().Add(time.Hour),
	}
	err := s.auctionApp.Repo.Create(s.ctx, auc)
	s.Require().NoError(err)

	// Call gRPC Validate Service
	req := &pb_auction.ValidateAuctionRequest{
		AuctionId: auc.ID.Hex(),
		UserId:    "buyer-1",
		Amount:    150.0,
	}

	resp, err := s.grpcClient.ValidateAuctionForBid(s.ctx, req)
	s.Require().NoError(err)
	s.True(resp.IsActive)
	s.Empty(resp.ErrorMessage)

	// Verify price updated in DB
	updated, err := s.auctionApp.Repo.FindByID(s.ctx, auc.ID.Hex())
	s.Require().NoError(err)
	s.Equal(150.0, updated.CurrentPrice)
}

func (s *AuctionE2ESuite) TestAuctionLifecycle() {
	// Create a PENDING auction that should have started
	auc := &domain.Auction{
		ID:        primitive.NewObjectID(),
		Title:     "Should be Active",
		Status:    domain.StatusPending,
		StartTime: time.Now().Add(-time.Minute),
		EndTime:   time.Now().Add(time.Hour),
	}
	err := s.auctionApp.Repo.Create(s.ctx, auc)
	s.Require().NoError(err)

	// Manually trigger transitions
	err = s.auctionApp.AuctionService.ProcessLifecycleTransitions(s.ctx)
	s.Require().NoError(err)

	// Verify it's now ACTIVE
	updated, err := s.auctionApp.Repo.FindByID(s.ctx, auc.ID.Hex())
	s.Require().NoError(err)
	s.Equal(domain.StatusActive, updated.Status)
}

func (s *AuctionE2ESuite) TestUnauthorized() {
	mutation := `mutation { 
		createAuction(input: { 
			title: "Unauthorized Watch", 
			description: "Should fail", 
			startingPrice: 100, 
			currency: "USD",
			startTime: "2026-01-01T00:00:00Z",
			endTime: "2026-01-02T00:00:00Z"
		}) { 
			success 
			message 
		} 
	}`
	requestBody, _ := json.Marshal(map[string]string{"query": mutation})
	
	req, _ := http.NewRequest("POST", "http://localhost:4001/graphql", bytes.NewBuffer(requestBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer invalid-token")

	client := &http.Client{}
	resp, err := client.Do(req)
	s.Require().NoError(err)
	defer resp.Body.Close()

	var result struct {
		Data struct {
			CreateAuction *struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			} `json:"createAuction"`
		} `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	
	err = json.NewDecoder(resp.Body).Decode(&result)
	s.Require().NoError(err)
	
	isFailed := (len(result.Errors) > 0) || (result.Data.CreateAuction != nil && !result.Data.CreateAuction.Success)
	s.True(isFailed, "The request should have failed due to invalid token")
}

func TestAuctionE2E(t *testing.T) {
	suite.Run(t, new(AuctionE2ESuite))
}


