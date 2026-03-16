package main

import (
	"log"
	"net/http"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/graph"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/config"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/database"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/middleware"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/repository"
	service "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/services"
)

func main() {
	log.Println("Starting Auction Service")

	// Load configuration
	cfg := config.LoadConfig()

	// Initialize MongoDB
	client, disconnect := database.InitMongoDB(cfg.MongoURI)
	defer disconnect()

	// Initialize repository
	db := client.Database(cfg.DBName)
	repo := repository.NewMongoAuctionRepository(db)

	cldService, err := service.NewCloudinaryService(cfg.CloudinaryCloudName, cfg.CloudinaryAPIKey, cfg.CloudinaryAPISecret)
	if err != nil {
		log.Fatalf("Failed to initialize CloudinaryService: %v", err)
	}

	auctionService := service.NewAuctionService(repo, cldService)

	// Configure gqlgen with the Auth directive
	graphConfig := graph.Config{Resolvers: &graph.Resolver{AuctionService: auctionService}}
	graphConfig.Directives.Auth = graph.AuthDirective

	srv := handler.NewDefaultServer(graph.NewExecutableSchema(graphConfig))


	http.Handle("/", playground.Handler("GraphQL playground", "/graphql"))
	http.Handle("/graphql", middleware.AuthMiddleware(cfg.JWTSecret)(srv))

	log.Printf("Auction Service is running on port %s", cfg.Port)
	log.Printf("Connect to http://localhost:%s/graphql for GraphQL playground", cfg.Port)

	if err := http.ListenAndServe(":"+cfg.Port, nil); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
