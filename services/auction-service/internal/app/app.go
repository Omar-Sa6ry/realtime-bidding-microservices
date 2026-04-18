package app

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"google.golang.org/grpc"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/graph"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/broker"
	user_client "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/client"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/config"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/database"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/domain"
	grpc_server "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/grpc_server"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/middleware"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/pkg/dataloader"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/pkg/logger"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/pkg/translation"
	pb "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/proto/auction"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/repository"
	service "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/services"
)

type App struct {
	cfg               *config.Config
	AuctionService    service.AuctionService
	Repo              domain.AuctionRepository
	CloudinaryService service.CloudinaryService
	userClient        user_client.UserClient
	natsPublisher     broker.Publisher
	grpcServer        *grpc.Server
	httpServer        *http.Server
	disconnectMongo   func()
}

func New() *App {
	return &App{
		cfg: config.LoadConfig(),
	}
}

func NewWithConfig(cfg *config.Config) *App {
	return &App{
		cfg: cfg,
	}
}

func (a *App) Setup() error {
	logger.Info("AuctionApp", "Initializing Auction Service...")

	translation.Init()

	client, disconnect := database.InitMongoDB(a.cfg.MongoURI)
	a.disconnectMongo = disconnect

	db := client.Database(a.cfg.DBName)
	a.Repo = repository.NewMongoAuctionRepository(db)

	if err := a.Repo.EnsureIndexes(context.Background()); err != nil {
		logger.Error("AuctionApp", "Failed to ensure MongoDB indexes", err)
	}

	// Initialize Clients (Cloudinary, gRPC, NATS)
	var err error
	if a.CloudinaryService == nil {
		a.CloudinaryService, err = service.NewCloudinaryService(a.cfg.CloudinaryCloudName, a.cfg.CloudinaryAPIKey, a.cfg.CloudinaryAPISecret)
		if err != nil {
			return fmt.Errorf("failed to initialize CloudinaryService: %w", err)
		}
	}

	a.userClient, err = user_client.NewUserClient(a.cfg.UserServiceURL)
	if err != nil {
		return fmt.Errorf("failed to initialize User gRPC Client: %w", err)
	}

	a.natsPublisher, err = broker.NewNatsPublisher(a.cfg.NatsURL)
	if err != nil {
		logger.Warn("AuctionApp", fmt.Sprintf("Failed to connect to NATS: %v. Events will not be published.", err))
	}

	// Initialize Service Layer
	a.AuctionService = service.NewAuctionService(a.Repo, a.CloudinaryService, a.natsPublisher, a.userClient)

	// Start Background Workers (Cron)
	a.startCronJobs()

	// Setup gRPC Server
	if err := a.setupGRPCServer(a.Repo); err != nil {
		return err
	}

	// Setup GraphQL Server
	a.setupHTTPServer()

	return nil
}

func (a *App) Run() {
	if err := a.Setup(); err != nil {
		log.Fatalf("App setup failed: %v", err)
	}

	a.Start()

	// Graceful Shutdown Logic
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	a.Shutdown()
}

func (a *App) Start() {
	// Start gRPC in background
	// (gRPC server is started in Setup currently, let's keep it consistent or move it here)
}

func (a *App) setupGRPCServer(repo domain.AuctionRepository) error {
	lis, err := net.Listen("tcp", ":50052")
	if err != nil {
		return fmt.Errorf("failed to listen on gRPC port 50052: %w", err)
	}

	a.grpcServer = grpc.NewServer()
	auctionServer := grpc_server.NewAuctionServer(repo)
	pb.RegisterAuctionServiceServer(a.grpcServer, auctionServer)

	go func() {
		logger.Info("AuctionApp", "gRPC Server is running on port 50052")
		if err := a.grpcServer.Serve(lis); err != nil {
			log.Printf("gRPC server stopped: %v", err)
		}
	}()
	return nil
}

func (a *App) setupHTTPServer() {
	graphConfig := graph.Config{Resolvers: &graph.Resolver{AuctionService: a.AuctionService}}
	graphConfig.Directives.Auth = graph.AuthDirective

	srv := handler.NewDefaultServer(graph.NewExecutableSchema(graphConfig))

	mux := http.NewServeMux()
	mux.Handle("/", playground.Handler("GraphQL playground", "/graphql"))
	
	// Wrap with DataLoader middleware
	handlerWithLoaders := dataloader.Middleware(a.userClient, srv)
	
	mux.Handle("/graphql", middleware.LangMiddleware(middleware.AuthMiddleware(a.cfg.JWTSecret)(handlerWithLoaders)))

	a.httpServer = &http.Server{
		Addr:    ":" + a.cfg.Port,
		Handler: mux,
	}

	go func() {
		logger.Info("AuctionApp", fmt.Sprintf("GraphQL Endpoint: http://localhost:%s/graphql", a.cfg.Port))
		logger.Info("AuctionApp", fmt.Sprintf("GraphQL Playground: http://localhost:%s/", a.cfg.Port))
		if err := a.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()
}

func (a *App) Shutdown() {
	logger.Warn("AuctionApp", "Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Stop HTTP Server
	if a.httpServer != nil {
		if err := a.httpServer.Shutdown(ctx); err != nil {
			logger.Error("AuctionApp", "Server forced to shutdown", err)
		}
	}

	// Stop gRPC Server
	if a.grpcServer != nil {
		a.grpcServer.GracefulStop()
	}

	// Close gRPC Client
	if a.userClient != nil {
		a.userClient.Close()
	}

	// Close NATS Publisher
	if a.natsPublisher != nil {
		a.natsPublisher.Close()
	}

	// Disconnect MongoDB
	if a.disconnectMongo != nil {
		a.disconnectMongo()
	}

	logger.Info("AuctionApp", "Server exited gracefully")
}

