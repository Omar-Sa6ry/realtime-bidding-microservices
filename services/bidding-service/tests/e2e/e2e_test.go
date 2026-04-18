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
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/app"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/config"
	pb_auction "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/protos/auction"
	pb_user "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/protos/user"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/tests/mocks"
	"github.com/stretchr/testify/suite"
	"github.com/testcontainers/testcontainers-go/modules/mongodb"
	"github.com/testcontainers/testcontainers-go/modules/nats"
	"github.com/testcontainers/testcontainers-go/modules/redis"
	"google.golang.org/grpc"
)

type BiddingE2ESuite struct {
	suite.Suite
	ctx               context.Context
	mongoContainer    *mongodb.MongoDBContainer
	natsContainer     *nats.NATSContainer
	redisContainer    *redis.RedisContainer
	mockUserServer    *grpc.Server
	mockAuctionServer *grpc.Server
	natsConn          *nats_lib.Conn

	biddingApp *app.App
	cfg        *config.Config
	testToken  string
}

func (s *BiddingE2ESuite) SetupSuite() {
	s.ctx = context.Background()

	// Start MongoDB Container
	mongoC, err := mongodb.Run(s.ctx, "mongo:6.0")
	s.Require().NoError(err)
	s.mongoContainer = mongoC
	mongoURI, _ := mongoC.ConnectionString(s.ctx)

	// Start NATS Container
	natsC, err := nats.Run(s.ctx, "nats:latest")
	s.Require().NoError(err)
	s.natsContainer = natsC
	natsURI, _ := natsC.ConnectionString(s.ctx)

	// Start Redis Container
	redisC, err := redis.Run(s.ctx, "redis:alpine")
	s.Require().NoError(err)
	s.redisContainer = redisC
	redisHost, _ := redisC.Host(s.ctx)
	redisPort, _ := redisC.MappedPort(s.ctx, "6379")

	// Start Mock gRPC Servers
	lisUser, _ := net.Listen("tcp", "localhost:50053")
	s.mockUserServer = grpc.NewServer()
	mockUserService := &mocks.MockUserService{}
	pb_user.RegisterUserServiceServer(s.mockUserServer, mockUserService)

	lisAuction, _ := net.Listen("tcp", "localhost:50054")
	s.mockAuctionServer = grpc.NewServer()
	mockAuctionService := &mocks.MockAuctionService{}
	pb_auction.RegisterAuctionServiceServer(s.mockAuctionServer, mockAuctionService)

	go s.mockUserServer.Serve(lisUser)
	go s.mockAuctionServer.Serve(lisAuction)

	// Initialize Config
	s.cfg = &config.Config{
		MongoURI:          mongoURI,
		DBName:            "test_bidding_db",
		RedisHost:         redisHost,
		RedisPort:         redisPort.Port(),
		NatsURL:           natsURI,
		Port:              "4003",
		JWTSecret:         "test_secret",
		UserServiceURL:    "localhost:50053",
		AuctionServiceURL: "localhost:50054",
	}

	// Start App
	s.biddingApp = app.NewWithConfig(s.cfg)
	err = s.biddingApp.Setup()
	s.Require().NoError(err)
	go s.biddingApp.Start()

	// Setup NATS connection for verification
	s.natsConn, _ = nats_lib.Connect(natsURI)
	s.testToken = s.generateToken("test-user-id")

	time.Sleep(1 * time.Second) // Wait for startup
}

func (s *BiddingE2ESuite) generateToken(userID string) string {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":          userID,
		"role":        "USER",
		"permissions": []string{"CREATE_BID", "VIEW_USER", "VIEW_BID", "VIEW_BID_BY_ID", "VIEW_BID_BY_AUCTION", "VIEW_BID_BY_USER"},
		"exp":         time.Now().Add(time.Hour).Unix(),
	})
	t, _ := token.SignedString([]byte(s.cfg.JWTSecret))
	return t
}

func (s *BiddingE2ESuite) TearDownSuite() {
	if s.biddingApp != nil {
		s.biddingApp.Shutdown()
	}
	if s.mockUserServer != nil {
		s.mockUserServer.Stop()
	}
	if s.mockAuctionServer != nil {
		s.mockAuctionServer.Stop()
	}
	if s.natsConn != nil {
		s.natsConn.Close()
	}
	s.mongoContainer.Terminate(s.ctx)
	s.natsContainer.Terminate(s.ctx)
	s.redisContainer.Terminate(s.ctx)
}

func (s *BiddingE2ESuite) TestPlaceBid() {
	auctionID := "auction-1"
	amount := 1500.0

	// Subscribe to NATS to verify bid event
	sub, _ := s.natsConn.SubscribeSync("bid.created")
	defer sub.Unsubscribe()

	mutation := fmt.Sprintf(`
	mutation {
		placeBid(auctionId: "%s", amount: %f) {
			id
			auctionId
			amount
			status
		}
	}`, auctionID, amount)

	reqBody, _ := json.Marshal(map[string]string{"query": mutation})
	req, _ := http.NewRequest("POST", "http://localhost:4003/graphql", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.testToken)

	resp, err := http.DefaultClient.Do(req)
	s.Require().NoError(err)
	defer resp.Body.Close()

	var result struct {
		Data struct {
			PlaceBid struct {
				ID        string  `json:"id"`
				AuctionId string  `json:"auctionId"`
				Amount    float64 `json:"amount"`
				Status    string  `json:"status"`
			} `json:"placeBid"`
		} `json:"data"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	s.NotEmpty(result.Data.PlaceBid.ID)
	s.Equal(auctionID, result.Data.PlaceBid.AuctionId)
	s.Equal(amount, result.Data.PlaceBid.Amount)
	s.Equal("ACCEPTED", result.Data.PlaceBid.Status)

	// Verify NATS event
	msg, err := sub.NextMsg(2 * time.Second)
	s.Require().NoError(err)
	s.Contains(string(msg.Data), auctionID)
}

func TestBiddingE2E(t *testing.T) {
	suite.Run(t, new(BiddingE2ESuite))
}
