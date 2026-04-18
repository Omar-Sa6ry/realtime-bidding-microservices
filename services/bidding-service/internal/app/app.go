package app

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/graph"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/broker"
	user_client "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/clients"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/config"
	databases "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/databases"
	middlewares 	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/middlewares"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/pkg/logger"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/pkg/translation"
	domains "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/domains"
	repositories "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/repositories"
	services "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/services"
)

type App struct {
	cfg             *config.Config
	BiddingService  *services.BiddingService
	MongoRepo       domains.BiddingRepository
	RedisRepo       domains.BiddingRepository
	NatsPublisher   broker.Publisher
	UserClient      user_client.UserClient
	AuctionClient   user_client.AuctionClient
	httpServer      *http.Server
	natsListener    *broker.NatsListener
	disconnectMongo func()
	disconnectRedis func()
}

func New() *App {
	return NewWithConfig(config.LoadConfig())
}

func NewWithConfig(cfg *config.Config) *App {
	return &App{
		cfg: cfg,
	}
}

func (a *App) Setup() error {
	logger.Info("BiddingApp", "Setting up Bidding Service...")

	// Initialize Translation
	translation.Init()

	// Initialize MongoDB
	if a.MongoRepo == nil {
		mongoClient, disconnectMongo := databases.InitMongoDB(a.cfg.MongoURI)
		a.disconnectMongo = disconnectMongo
		mongoDB := mongoClient.Database(a.cfg.DBName)
		a.MongoRepo = repositories.NewMongoBiddingRepository(mongoDB)

		// Ensure Indexes
		if err := a.MongoRepo.EnsureIndexes(context.Background()); err != nil {
			logger.Error("BiddingApp", "Failed to ensure MongoDB indexes", err)
		}
	}

	// Initialize Redis
	if a.RedisRepo == nil {
		redisClient, disconnectRedis := databases.InitRedis(a.cfg.RedisHost, a.cfg.RedisPort)
		a.disconnectRedis = disconnectRedis
		a.RedisRepo = repositories.NewRedisBiddingRepository(redisClient)
	}

	// Initialize NATS
	var err error
	if a.NatsPublisher == nil {
		a.NatsPublisher, err = broker.NewNatsPublisher(a.cfg.NatsURL)
		if err != nil {
			logger.Warn("BiddingApp", fmt.Sprintf("Failed to connect to NATS: %v Events will not be published.", err))
		}
	}

	// Initialize gRPC Clients
	if a.UserClient == nil {
		a.UserClient, err = user_client.NewUserClient(a.cfg.UserServiceURL)
		if err != nil {
			return fmt.Errorf("failed to initialize User gRPC Client: %w", err)
		}
	}

	if a.AuctionClient == nil {
		a.AuctionClient, err = user_client.NewAuctionClient(a.cfg.AuctionServiceURL)
		if err != nil {
			return fmt.Errorf("failed to initialize Auction gRPC Client: %w", err)
		}
	}

	// Initialize Bidding Service
	if a.BiddingService == nil {
		a.BiddingService = services.NewBiddingService(a.RedisRepo, a.MongoRepo, a.NatsPublisher, a.UserClient, a.AuctionClient)
	}

	// Setup GraphQL
	srv := handler.NewDefaultServer(graph.NewExecutableSchema(graph.Config{
		Resolvers: &graph.Resolver{BiddingService: a.BiddingService},
		Directives: graph.DirectiveRoot{
			Auth: graph.AuthDirective,
		},
	}))

	// Setup Router & Middlewares
	mux := http.NewServeMux()
	mux.Handle("/", playground.Handler("GraphQL playground", "/graphql"))

	// 10 Apply Middlewares 
	handler := middlewares.AuthMiddleware(a.cfg.JWTSecret)(srv)
	handler = middlewares.LangMiddleware(handler)

	mux.Handle("/graphql", handler)

	a.httpServer = &http.Server{
		Addr:    ":" + a.cfg.Port,
		Handler: mux,
	}

	return nil
}

func (a *App) Start() {
	// Start NATS Listener for auction.ended events
	var err error
	a.natsListener, err = broker.NewNatsListener(a.cfg.NatsURL, a.BiddingService.ResolveAuction)
	if err != nil {
		logger.Warn("BiddingApp", fmt.Sprintf("Failed to start NATS listener: %v", err))
	}

	logger.Info("BiddingApp", "Server is running on port "+a.cfg.Port)
	if err := a.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Error("BiddingApp", "Server failed", err)
	}
}

func (a *App) Shutdown() {
	logger.Info("BiddingApp", "Shutting down Bidding Service...")

	if a.httpServer != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = a.httpServer.Shutdown(ctx)
	}

	if a.natsListener != nil {
		a.natsListener.Close()
	}

	if a.disconnectMongo != nil {
		a.disconnectMongo()
	}

	if a.disconnectRedis != nil {
		a.disconnectRedis()
	}

	logger.Info("BiddingApp", "Bidding Service exited gracefully")
}

func (a *App) Run() {
	if err := a.Setup(); err != nil {
		log.Fatal(err)
	}
	a.Start()
}
