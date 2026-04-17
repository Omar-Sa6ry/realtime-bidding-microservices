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
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/app"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/config"
	pb "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/proto/user"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/tests/mocks"
	"github.com/stretchr/testify/suite"
	"github.com/testcontainers/testcontainers-go/modules/mongodb"
	"github.com/testcontainers/testcontainers-go/modules/nats"
	"google.golang.org/grpc"
)


type AuctionE2ESuite struct {
	suite.Suite
	ctx            context.Context
	mongoContainer *mongodb.MongoDBContainer
	natsContainer  *nats.NATSContainer
	mockUserServer *grpc.Server

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
	pb.RegisterUserServiceServer(s.mockUserServer, mockUserService)

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
	
	// Wait for server to be ready
	time.Sleep(1 * time.Second)
}

func (s *AuctionE2ESuite) generateToken(userID string) string {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":          userID,
		"role":        "USER",
		"permissions": []string{"CREATE_AUCTION", "VIEW_AUCTION"},
		"exp":         time.Now().Add(time.Hour).Unix(),
	})

	tokenString, _ := token.SignedString([]byte(s.cfg.JWTSecret))
	return tokenString
}

func (s *AuctionE2ESuite) TearDownSuite() {
	if s.auctionApp != nil {
		s.auctionApp.Shutdown()
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

	mutation := fmt.Sprintf(`
	mutation {
		createAuction(input: {
			title: "Vintage Watch",
			description: "A beautiful vintage watch",
			startingPrice: 100.0,
			currency: "USD",
			startTime: "%s",
			endTime: "%s"
		}) {
			success
			message
			data {
				id
				title
				startingPrice
			}
		}
	}`, startTime, endTime)

	requestBody, _ := json.Marshal(map[string]string{
		"query": mutation,
	})

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
				Message string `json:"message"`
				Data    struct {
					ID            string  `json:"id"`
					Title         string  `json:"title"`
					StartingPrice float64 `json:"startingPrice"`
				} `json:"data"`
			} `json:"createAuction"`
		} `json:"data"`
	}
	
	err = json.NewDecoder(resp.Body).Decode(&result)
	s.Require().NoError(err)

	s.True(result.Data.CreateAuction.Success, result.Data.CreateAuction.Message)
	s.NotEmpty(result.Data.CreateAuction.Data.ID)
	s.Equal("Vintage Watch", result.Data.CreateAuction.Data.Title)
	s.Equal(100.0, result.Data.CreateAuction.Data.StartingPrice)
}

func TestAuctionE2E(t *testing.T) {
	suite.Run(t, new(AuctionE2ESuite))
}

