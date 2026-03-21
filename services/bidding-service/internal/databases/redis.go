package database

import (
	"context"
	"fmt"
	"time"

	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/pkg/logger"
	"github.com/redis/go-redis/v9"
)

func InitRedis(host, port string) (*redis.Client, func()) {
	addr := fmt.Sprintf("%s:%s", host, port)
	client := redis.NewClient(&redis.Options{
		Addr: addr,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5 * time.Second)
	defer cancel()

	_, err := client.Ping(ctx).Result()
	if err != nil {
		logger.Error("Database", "Failed to connect to Redis", err)
		panic(err)
	}

	logger.Info("Database", "Connected to Redis successfully.")

	cleanup := func() {
		if err := client.Close(); err != nil {
			logger.Error("Database", "Failed to close Redis connection", err)
		}
	}

	return client, cleanup
}
