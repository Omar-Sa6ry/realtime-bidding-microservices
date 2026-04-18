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
	domains "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/domains"
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
	mockUserService   *mocks.MockUserService
	mockAuctionService *mocks.MockAuctionService
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
	s.mockUserService = &mocks.MockUserService{}
	pb_user.RegisterUserServiceServer(s.mockUserServer, s.mockUserService)

	lisAuction, _ := net.Listen("tcp", "localhost:50054")
	s.mockAuctionServer = grpc.NewServer()
	s.mockAuctionService = &mocks.MockAuctionService{}
	pb_auction.RegisterAuctionServiceServer(s.mockAuctionServer, s.mockAuctionService)

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
	var nerr error
	s.natsConn, nerr = nats_lib.Connect(natsURI)
	s.Require().NoError(nerr, "Failed to connect to NATS for verification")

	s.testToken = s.generateToken("test-user-id")

	time.Sleep(2 * time.Second) // Wait for startup
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
	s.Run("Success", func() {
		auctionID := "auction-success"
		amount := 1500.0

		// Reset Mocks for success
		s.mockUserService.UpdateBalanceFunc = nil
		s.mockAuctionService.ValidateAuctionForBidFunc = nil
		s.mockAuctionService.GetAuctionFunc = nil

		sub, _ := s.natsConn.SubscribeSync("bid.created")
		defer sub.Unsubscribe()

		mutation := fmt.Sprintf(`
		mutation {
			placeBid(auctionId: "%s", amount: %f) {
				success
				message
				data {
					id
					auction { id }
					amount
					status
				}
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
					Success bool   `json:"success"`
					Data    struct {
						ID      string `json:"id"`
						Auction struct {
							ID string `json:"id"`
						} `json:"auction"`
						Amount float64 `json:"amount"`
						Status string  `json:"status"`
					} `json:"data"`
				} `json:"placeBid"`
			} `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&result)

		s.True(result.Data.PlaceBid.Success)
		s.Equal(auctionID, result.Data.PlaceBid.Data.Auction.ID)
		s.Equal(amount, result.Data.PlaceBid.Data.Amount)

		// Verify NATS event
		msg, err := sub.NextMsg(2 * time.Second)
		s.Require().NoError(err, "NATS event not received")
		s.Contains(string(msg.Data), auctionID)
	})

	s.Run("InsufficientBalance", func() {
		// Reset Mocks
		s.mockUserService.UpdateBalanceFunc = nil
		s.mockAuctionService.ValidateAuctionForBidFunc = nil
		
		s.mockUserService.UpdateBalanceFunc = func(ctx context.Context, in *pb_user.UpdateBalanceRequest) (*pb_user.UpdateBalanceResponse, error) {
			return &pb_user.UpdateBalanceResponse{Success: false, Message: "Insufficient balance"}, nil
		}

		mutation := `mutation { placeBid(auctionId: "any", amount: 100) { success message } }`
		reqBody, _ := json.Marshal(map[string]string{"query": mutation})
		req, _ := http.NewRequest("POST", "http://localhost:4003/graphql", bytes.NewBuffer(reqBody))
		req.Header.Set("Authorization", "Bearer "+s.testToken)
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		s.Require().NoError(err)
		defer resp.Body.Close()

		var result struct {
			Data struct {
				PlaceBid struct {
					Success bool   `json:"success"`
					Message string `json:"message"`
				} `json:"placeBid"`
			} `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&result)

		s.False(result.Data.PlaceBid.Success)
		s.Contains(result.Data.PlaceBid.Message, "Insufficient balance")
	})

	s.Run("AuctionNotActive", func() {
		// Reset Mocks
		s.mockUserService.UpdateBalanceFunc = nil
		s.mockAuctionService.ValidateAuctionForBidFunc = nil
		
		s.mockAuctionService.ValidateAuctionForBidFunc = func(ctx context.Context, in *pb_auction.ValidateAuctionRequest) (*pb_auction.ValidateAuctionResponse, error) {
			return &pb_auction.ValidateAuctionResponse{IsActive: false}, nil
		}

		mutation := `mutation { placeBid(auctionId: "inactive", amount: 100) { success message } }`
		reqBody, _ := json.Marshal(map[string]string{"query": mutation})
		req, _ := http.NewRequest("POST", "http://localhost:4003/graphql", bytes.NewBuffer(reqBody))
		req.Header.Set("Authorization", "Bearer "+s.testToken)
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		s.Require().NoError(err)
		defer resp.Body.Close()

		var result struct {
			Data struct {
				PlaceBid struct {
					Success bool   `json:"success"`
					Message string `json:"message"`
				} `json:"placeBid"`
			} `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&result)

		s.False(result.Data.PlaceBid.Success)
		s.Contains(result.Data.PlaceBid.Message, "active auctions")
	})

	s.Run("AlreadyHighestBidder", func() {
		// Reset Mocks
		s.mockUserService.UpdateBalanceFunc = nil
		s.mockAuctionService.ValidateAuctionForBidFunc = nil
		
		auctionID := "already-highest"
		s.mockAuctionService.ValidateAuctionForBidFunc = nil

		s.mockAuctionService.GetAuctionFunc = func(ctx context.Context, in *pb_auction.GetAuctionRequest) (*pb_auction.GetAuctionResponse, error) {
			return &pb_auction.GetAuctionResponse{
				Exists: true,
				Status: "ACTIVE",
				CurrentPrice: 1000,
				SellerId: "other-user",
			}, nil
		}
		
		mutation := fmt.Sprintf(`mutation { placeBid(auctionId: "%s", amount: 1200) { success message } }`, auctionID)
		reqBody, _ := json.Marshal(map[string]string{"query": mutation})
		
		// First bid (Success)
		req1, _ := http.NewRequest("POST", "http://localhost:4003/graphql", bytes.NewBuffer(reqBody))
		req1.Header.Set("Authorization", "Bearer "+s.testToken)
		req1.Header.Set("Content-Type", "application/json")
		resp1, err1 := http.DefaultClient.Do(req1)
		s.Require().NoError(err1)
		resp1.Body.Close()

		// Second bid (Should fail with already_highest_bidder)
		req2, _ := http.NewRequest("POST", "http://localhost:4003/graphql", bytes.NewBuffer(reqBody))
		req2.Header.Set("Authorization", "Bearer "+s.testToken)
		req2.Header.Set("Content-Type", "application/json")
		resp2, err2 := http.DefaultClient.Do(req2)
		s.Require().NoError(err2)
		defer resp2.Body.Close()

		var result struct {
			Data struct {
				PlaceBid struct {
					Success bool   `json:"success"`
					Message string `json:"message"`
				} `json:"placeBid"`
			} `json:"data"`
		}
		json.NewDecoder(resp2.Body).Decode(&result)

		s.False(result.Data.PlaceBid.Success)
		s.Contains(result.Data.PlaceBid.Message, "already the highest bidder")
	})

	s.Run("Unauthorized", func() {
		mutation := `mutation { placeBid(auctionId: "any", amount: 100) { success } }`
		reqBody, _ := json.Marshal(map[string]string{"query": mutation})
		req, _ := http.NewRequest("POST", "http://localhost:4003/graphql", bytes.NewBuffer(reqBody))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := http.DefaultClient.Do(req)
		var result struct {
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		}
		json.NewDecoder(resp.Body).Decode(&result)

		s.NotEmpty(result.Errors)
		s.Contains(result.Errors[0].Message, "UNAUTHENTICATED")
	})
}

func (s *BiddingE2ESuite) TestGetHighestBid() {
	auctionID := "auction-highest-test"

	s.Run("Success_FromCache", func() {
		s.mockAuctionService.GetAuctionFunc = func(ctx context.Context, in *pb_auction.GetAuctionRequest) (*pb_auction.GetAuctionResponse, error) {
			return &pb_auction.GetAuctionResponse{Exists: true, Status: "ACTIVE"}, nil
		}
		s.mockUserService.UpdateBalanceFunc = nil
		s.mockAuctionService.ValidateAuctionForBidFunc = nil

		// Place a bid
		mutation := fmt.Sprintf(`mutation { placeBid(auctionId: "%s", amount: 2000) { success } }`, auctionID)
		reqBody, _ := json.Marshal(map[string]string{"query": mutation})
		req, _ := http.NewRequest("POST", "http://localhost:4003/graphql", bytes.NewBuffer(reqBody))
		req.Header.Set("Authorization", "Bearer "+s.testToken)
		req.Header.Set("Content-Type", "application/json")
		resp, _ := http.DefaultClient.Do(req)
		resp.Body.Close()

		// Get Highest Bid
		query := fmt.Sprintf(`{ getHighestBid(auctionId: "%s") { success data { amount } } }`, auctionID)
		reqBody, _ = json.Marshal(map[string]string{"query": query})
		req, _ = http.NewRequest("POST", "http://localhost:4003/graphql", bytes.NewBuffer(reqBody))
		req.Header.Set("Content-Type", "application/json")
		
		resp, _ = http.DefaultClient.Do(req)
		var result struct {
			Data struct {
				GetHighestBid struct {
					Success bool `json:"success"`
					Data    struct {
						Amount float64 `json:"amount"`
					} `json:"data"`
				} `json:"getHighestBid"`
			} `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&result)

		s.True(result.Data.GetHighestBid.Success)
		s.Equal(2000.0, result.Data.GetHighestBid.Data.Amount)
	})

	s.Run("Success_DBFallback", func() {
		auctionIDFallback := "auction-fallback"
		s.mockAuctionService.GetAuctionFunc = func(ctx context.Context, in *pb_auction.GetAuctionRequest) (*pb_auction.GetAuctionResponse, error) {
			return &pb_auction.GetAuctionResponse{Exists: true, Status: "ACTIVE"}, nil
		}

		bid := &domains.Bid{
			ID:        "bid-manual",
			AuctionID: auctionIDFallback,
			UserID:    "user-1",
			Amount:    3000.0,
			Status:    "ACCEPTED",
			CreatedAt: time.Now(),
		}
		s.biddingApp.MongoRepo.PlaceBid(s.ctx, bid)

		query := fmt.Sprintf(`{ getHighestBid(auctionId: "%s") { success data { amount } } }`, auctionIDFallback)
		reqBody, _ := json.Marshal(map[string]string{"query": query})
		req, _ := http.NewRequest("POST", "http://localhost:4003/graphql", bytes.NewBuffer(reqBody))
		req.Header.Set("Content-Type", "application/json")
		
		resp, _ := http.DefaultClient.Do(req)
		var result struct {
			Data struct {
				GetHighestBid struct {
					Success bool `json:"success"`
					Data    struct {
						Amount float64 `json:"amount"`
					} `json:"data"`
				} `json:"getHighestBid"`
			} `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&result)

		s.True(result.Data.GetHighestBid.Success)
		s.Equal(3000.0, result.Data.GetHighestBid.Data.Amount)
	})

	s.Run("AuctionNotFound", func() {
		s.mockAuctionService.GetAuctionFunc = func(ctx context.Context, in *pb_auction.GetAuctionRequest) (*pb_auction.GetAuctionResponse, error) {
			return &pb_auction.GetAuctionResponse{Exists: false}, nil
		}

		query := `{ getHighestBid(auctionId: "non-existent") { success message } }`
		reqBody, _ := json.Marshal(map[string]string{"query": query})
		req, _ := http.NewRequest("POST", "http://localhost:4003/graphql", bytes.NewBuffer(reqBody))
		req.Header.Set("Content-Type", "application/json")
		
		resp, _ := http.DefaultClient.Do(req)
		var result struct {
			Data struct {
				GetHighestBid struct {
					Success bool   `json:"success"`
					Message string `json:"message"`
				} `json:"getHighestBid"`
			} `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&result)

		s.False(result.Data.GetHighestBid.Success)
		s.Contains(result.Data.GetHighestBid.Message, "not found")
	})

	s.Run("NoBidsFound", func() {
		auctionIDNoBids := "auction-no-bids"
		s.mockAuctionService.GetAuctionFunc = func(ctx context.Context, in *pb_auction.GetAuctionRequest) (*pb_auction.GetAuctionResponse, error) {
			return &pb_auction.GetAuctionResponse{Exists: true, Status: "ACTIVE"}, nil
		}

		query := fmt.Sprintf(`{ getHighestBid(auctionId: "%s") { success data { id } } }`, auctionIDNoBids)
		reqBody, _ := json.Marshal(map[string]string{"query": query})
		req, _ := http.NewRequest("POST", "http://localhost:4003/graphql", bytes.NewBuffer(reqBody))
		req.Header.Set("Content-Type", "application/json")
		
		resp, _ := http.DefaultClient.Do(req)
		defer resp.Body.Close()
		var result struct {
			Data struct {
				GetHighestBid struct {
					Success bool `json:"success"`
					Data    *struct {
						ID string `json:"id"`
					} `json:"data"`
				} `json:"getHighestBid"`
			} `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&result)

		s.False(result.Data.GetHighestBid.Success)
		s.Nil(result.Data.GetHighestBid.Data)
	})
}

func (s *BiddingE2ESuite) TestGetAuctionHistory() {
	auctionID := "auction-history-test"

	s.Run("Success", func() {
		s.mockAuctionService.GetAuctionFunc = func(ctx context.Context, in *pb_auction.GetAuctionRequest) (*pb_auction.GetAuctionResponse, error) {
			return &pb_auction.GetAuctionResponse{Exists: true, Status: "ACTIVE"}, nil
		}

		for i := 1; i <= 3; i++ {
			bid := &domains.Bid{
				ID:        fmt.Sprintf("bid-hist-%d", i),
				AuctionID: auctionID,
				UserID:    "user-hist",
				Amount:    float64(1000 * i),
				Status:    "ACCEPTED",
				CreatedAt: time.Now().Add(time.Duration(i) * time.Minute),
			}
			s.biddingApp.MongoRepo.PlaceBid(s.ctx, bid)
		}

		query := fmt.Sprintf(`{ getAuctionHistory(auctionId: "%s", pagination: { limit: 2, page: 1 }) { success data { amount } totalItems } }`, auctionID)
		reqBody, _ := json.Marshal(map[string]string{"query": query})
		req, _ := http.NewRequest("POST", "http://localhost:4003/graphql", bytes.NewBuffer(reqBody))
		req.Header.Set("Content-Type", "application/json")
		
		resp, _ := http.DefaultClient.Do(req)
		var result struct {
			Data struct {
				GetAuctionHistory struct {
					Success    bool `json:"success"`
					Data       []struct { Amount float64 `json:"amount"` } `json:"data"`
					TotalItems int  `json:"totalItems"`
				} `json:"getAuctionHistory"`
			} `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&result)

		s.True(result.Data.GetAuctionHistory.Success)
		s.Len(result.Data.GetAuctionHistory.Data, 2)
		s.Equal(3, result.Data.GetAuctionHistory.TotalItems)
	})

	s.Run("AuctionNotFound", func() {
		s.mockAuctionService.GetAuctionFunc = func(ctx context.Context, in *pb_auction.GetAuctionRequest) (*pb_auction.GetAuctionResponse, error) {
			return &pb_auction.GetAuctionResponse{Exists: false}, nil
		}

		query := `{ getAuctionHistory(auctionId: "non-existent") { success message } }`
		reqBody, _ := json.Marshal(map[string]string{"query": query})
		req, _ := http.NewRequest("POST", "http://localhost:4003/graphql", bytes.NewBuffer(reqBody))
		req.Header.Set("Content-Type", "application/json")
		
		resp, _ := http.DefaultClient.Do(req)
		var result struct {
			Data struct {
				GetAuctionHistory struct {
					Success bool   `json:"success"`
					Message string `json:"message"`
				} `json:"getAuctionHistory"`
			} `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&result)

		s.False(result.Data.GetAuctionHistory.Success)
		s.Contains(result.Data.GetAuctionHistory.Message, "not found")
	})
}

func (s *BiddingE2ESuite) TestGetMyBids() {
	userA := "user-a"
	userB := "user-b"

	s.Run("Success_UserA_Bids", func() {
		s.biddingApp.MongoRepo.PlaceBid(s.ctx, &domains.Bid{ID: "bid-a-1", UserID: userA, AuctionID: "auc-1", Amount: 500, CreatedAt: time.Now()})
		s.biddingApp.MongoRepo.PlaceBid(s.ctx, &domains.Bid{ID: "bid-a-2", UserID: userA, AuctionID: "auc-2", Amount: 600, CreatedAt: time.Now()})
		s.biddingApp.MongoRepo.PlaceBid(s.ctx, &domains.Bid{ID: "bid-b-1", UserID: userB, AuctionID: "auc-1", Amount: 700, CreatedAt: time.Now()})

		query := `{ getMyBids(pagination: { limit: 10, page: 1 }) { success data { id userId } totalItems } }`
		reqBody, _ := json.Marshal(map[string]string{"query": query})
		req, _ := http.NewRequest("POST", "http://localhost:4003/graphql", bytes.NewBuffer(reqBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+s.generateToken(userA))
		
		resp, _ := http.DefaultClient.Do(req)
		var result struct {
			Data struct {
				GetMyBids struct {
					Success    bool `json:"success"`
					Data       []struct {
						ID     string `json:"id"`
						UserID string `json:"userId"`
					} `json:"data"`
					TotalItems int `json:"totalItems"`
				} `json:"getMyBids"`
			} `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&result)

		s.True(result.Data.GetMyBids.Success)
		s.Equal(2, result.Data.GetMyBids.TotalItems)
		for _, b := range result.Data.GetMyBids.Data {
			s.Equal(userA, b.UserID)
		}
	})

	s.Run("Unauthorized", func() {
		query := `{ getMyBids(pagination: { limit: 10 }) { success } }`
		reqBody, _ := json.Marshal(map[string]string{"query": query})
		req, _ := http.NewRequest("POST", "http://localhost:4003/graphql", bytes.NewBuffer(reqBody))
		req.Header.Set("Content-Type", "application/json")
		
		resp, _ := http.DefaultClient.Do(req)
		var result struct {
			Errors []struct { Message string `json:"message"` } `json:"errors"`
		}
		json.NewDecoder(resp.Body).Decode(&result)

		s.NotEmpty(result.Errors)
		s.Contains(result.Errors[0].Message, "UNAUTHENTICATED")
	})
}

func TestBiddingE2E(t *testing.T) {
	suite.Run(t, new(BiddingE2ESuite))
}
