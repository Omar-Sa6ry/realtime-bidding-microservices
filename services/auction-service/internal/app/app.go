package app

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/graph"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/broker"
	user_client "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/client"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/config"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/database"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/middleware"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/pkg/logger"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/pkg/translation"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/repository"
	service "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/services"
)

type App struct {
	cfg            *config.Config
	auctionService service.AuctionService
	userClient     user_client.UserClient
	natsPublisher  broker.Publisher
}

func New() *App {
	return &App{
		cfg: config.LoadConfig(),
	}
}

func (a *App) Run() {
	logger.Info("AuctionApp", "Initializing Auction Service...")

	// 0. Initialize Translations
	translation.Init()

	// 1. Initialize MongoDB
	client, disconnect := database.InitMongoDB(a.cfg.MongoURI)
	// We'll call disconnect manually during shutdown
	_ = disconnect 

	db := client.Database(a.cfg.DBName)
	repo := repository.NewMongoAuctionRepository(db)

	// 2. Initialize Clients (Cloudinary, gRPC, NATS)
	cldService, err := service.NewCloudinaryService(a.cfg.CloudinaryCloudName, a.cfg.CloudinaryAPIKey, a.cfg.CloudinaryAPISecret)
	if err != nil {
		log.Fatalf("Failed to initialize CloudinaryService: %v", err)
	}

	a.userClient, err = user_client.NewUserClient(a.cfg.UserServiceURL)
	if err != nil {
		log.Fatalf("Failed to initialize User gRPC Client: %v", err)
	}

	a.natsPublisher, err = broker.NewNatsPublisher(a.cfg.NatsURL)
	if err != nil {
		logger.Warn("AuctionApp", fmt.Sprintf("Failed to connect to NATS: %v. Events will not be published.", err))
	}

	// 3. Initialize Service Layer
	a.auctionService = service.NewAuctionService(repo, cldService, a.natsPublisher, a.userClient)

	// 4. Start Background Workers (Cron)
	a.startCronJobs()

	// 5. Setup GraphQL Server & Wait for Shutdown
	a.setupHTTPServer(disconnect)
}

func (a *App) setupHTTPServer(disconnect func()) {
	graphConfig := graph.Config{Resolvers: &graph.Resolver{AuctionService: a.auctionService}}
	graphConfig.Directives.Auth = graph.AuthDirective

	srv := handler.NewDefaultServer(graph.NewExecutableSchema(graphConfig))

	http.Handle("/", playground.Handler("GraphQL playground", "/graphql"))
	http.Handle("/graphql", middleware.LangMiddleware(middleware.AuthMiddleware(a.cfg.JWTSecret)(srv)))

	server := &http.Server{Addr: ":" + a.cfg.Port}

	// Run server in a goroutine
	go func() {
		logger.Info("AuctionApp", fmt.Sprintf("GraphQL Endpoint: http://localhost:%s/graphql", a.cfg.Port))
		logger.Info("AuctionApp", fmt.Sprintf("GraphQL Playground: http://localhost:%s/", a.cfg.Port))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Graceful Shutdown Logic
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Warn("AuctionApp", "Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Stop HTTP Server
	if err := server.Shutdown(ctx); err != nil {
		logger.Error("AuctionApp", "Server forced to shutdown", err)
	}

	// 2. Close gRPC Client
	if a.userClient != nil {
		a.userClient.Close()
	}

	// 3. Close NATS Publisher
	if a.natsPublisher != nil {
		a.natsPublisher.Close()
	}

	// 4. Disconnect MongoDB
	disconnect()

	logger.Info("AuctionApp", "Server exited gracefully")
}
