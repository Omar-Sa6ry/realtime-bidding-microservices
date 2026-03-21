package database

import (
	"context"
	"time"

	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/pkg/logger"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func InitMongoDB(uri string) (*mongo.Client, func()) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOptions := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		logger.Error("MongoDB", "MongoDB Connection Error", err)
		panic(err)
	}

	err = client.Ping(ctx, nil)
	if err != nil {
		logger.Error("MongoDB", "MongoDB Ping Error", err)
		panic(err)
	}

	logger.Info("MongoDB", "Connected to MongoDB successfully")

	disconnect := func() {
		if err := client.Disconnect(context.Background()); err != nil {
			logger.Error("MongoDB", "Error while disconnecting MongoDB", err)
		} else {
			logger.Info("MongoDB", "MongoDB connection closed safely")
		}
	}

	return client, disconnect
}
