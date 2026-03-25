package app

import (
	"context"
	"fmt"
	"log"
	"net/http"

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
	repositories "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/repositories"
	services "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/services"
)

type App struct {
	cfg            *config.Config
	biddingService *services.BiddingService
	natsPublisher  broker.Publisher
	userClient     user_client.UserClient
	auctionClient  user_client.AuctionClient
}

func New() *App {
	return &App{
		cfg: config.LoadConfig(),
	}
}

func (a *App) Run() {
	logger.Info("BiddingApp", "Initializing Bidding Service...")

	// 1 Initialize Translation
	translation.Init()

	// 2 Initialize MongoDB
	mongoClient, disconnectMongo := databases.InitMongoDB(a.cfg.MongoURI)
	defer disconnectMongo()

	mongoDB := mongoClient.Database(a.cfg.DBName)
	mongoRepo := repositories.NewMongoBiddingRepository(mongoDB)

	// Ensure Indexes
	if err := mongoRepo.EnsureIndexes(context.Background()); err != nil {
		logger.Error("BiddingApp", "Failed to ensure MongoDB indexes", err)
	}

	// 3 Initialize Redis
	redisClient, disconnectRedis := databases.InitRedis(a.cfg.RedisHost, a.cfg.RedisPort)
	defer disconnectRedis()

	redisRepo := repositories.NewRedisBiddingRepository(redisClient)

	// 4 Initialize NATS
	var err error
	a.natsPublisher, err = broker.NewNatsPublisher(a.cfg.NatsURL)
	if err != nil {
		logger.Warn("BiddingApp", fmt.Sprintf("Failed to connect to NATS: %v Events will not be published.", err))
	}

	// 5 Initialize gRPC Clients
	a.userClient, err = user_client.NewUserClient(a.cfg.UserServiceURL)
	if err != nil {
		log.Fatalf("Failed to initialize User gRPC Client: %v", err)
	}

	a.auctionClient, err = user_client.NewAuctionClient(a.cfg.AuctionServiceURL)
	if err != nil {
		log.Fatalf("Failed to initialize Auction gRPC Client: %v", err)
	}

	// 6 Initialize Bidding Service
	a.biddingService = services.NewBiddingService(redisRepo, mongoRepo, a.natsPublisher, a.userClient, a.auctionClient)

	// 7 Initialize NATS Listener for auction.ended events
	natsListener, err := broker.NewNatsListener(a.cfg.NatsURL, a.biddingService.ResolveAuction)
	if err != nil {
		logger.Warn("BiddingApp", fmt.Sprintf("Failed to start NATS listener: %v", err))
	} else {
		defer natsListener.Close()
	}

	// 8 Setup GraphQL
	srv := handler.NewDefaultServer(graph.NewExecutableSchema(graph.Config{
		Resolvers: &graph.Resolver{BiddingService: a.biddingService},
		Directives: graph.DirectiveRoot{
			Auth: graph.AuthDirective,
		},
	}))

	// 9 Setup Router & Middlewares
	mux := http.NewServeMux()
	mux.Handle("/", playground.Handler("GraphQL playground", "/graphql"))

	// 10 Apply Middlewares 
	handler := middlewares.AuthMiddleware(a.cfg.JWTSecret)(srv)
	handler = middlewares.LangMiddleware(handler)

	mux.Handle("/graphql", handler)

	logger.Info("BiddingApp", "Server is running on port "+a.cfg.Port)
	if err := http.ListenAndServe(":"+a.cfg.Port, mux); err != nil {
		logger.Error("BiddingApp", "Server failed", err)
	}
}
