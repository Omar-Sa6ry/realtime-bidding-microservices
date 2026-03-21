package app

import (
	"net/http"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/graph"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/config"
	databases "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/databases"
	middlewares "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/middlewares"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/pkg/logger"
	repositories "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/repositories"
	services "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/services"
)

type App struct {
	cfg            *config.Config
	biddingService *services.BiddingService
}

func New() *App {
	return &App{
		cfg: config.LoadConfig(),
	}
}

func (a *App) Run() {
	logger.Info("BiddingApp", "Initializing Bidding Service...")

	// 1. Initialize MongoDB
	mongoClient, disconnectMongo := databases.InitMongoDB(a.cfg.MongoURI)
	defer disconnectMongo()

	mongoDB := mongoClient.Database(a.cfg.DBName)
	mongoRepo := repositories.NewMongoBiddingRepository(mongoDB)

	// 2. Initialize Redis
	redisClient, disconnectRedis := databases.InitRedis(a.cfg.RedisHost, a.cfg.RedisPort)
	defer disconnectRedis()

	redisRepo := repositories.NewRedisBiddingRepository(redisClient)

	// 3. Initialize Bidding Service
	a.biddingService = services.NewBiddingService(redisRepo, mongoRepo)

	// 4. Setup GraphQL
	srv := handler.NewDefaultServer(graph.NewExecutableSchema(graph.Config{
		Resolvers: &graph.Resolver{BiddingService: a.biddingService},
		Directives: graph.DirectiveRoot{
			Auth: graph.AuthDirective,
		},
	}))

	// 5. Setup Router & Middlewares
	mux := http.NewServeMux()
	mux.Handle("/", playground.Handler("GraphQL playground", "/query"))
	mux.Handle("/query", middlewares.AuthMiddleware(a.cfg.JWTSecret)(srv))

	logger.Info("BiddingApp", "Server is running on port "+a.cfg.Port)
	if err := http.ListenAndServe(":"+a.cfg.Port, mux); err != nil {
		logger.Error("BiddingApp", "Server failed", err)
	}
}
