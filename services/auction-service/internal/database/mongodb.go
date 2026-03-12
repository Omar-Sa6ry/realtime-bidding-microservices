package database

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func InitMongoDB(uri string) (*mongo.Client, func()) {
	ctx, cancel := context.WithTimeout(context.Background(), 10 * time.Second)
	defer cancel()

	clientOptions := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		log.Fatalf("MongoDB Connection Error: %v", err)
	}

	err = client.Ping(ctx, nil)
	if err != nil {
		log.Fatalf("MongoDB Ping Error: %v", err)
	}

	log.Println("Connected to MongoDB successfully")

	disconnect := func() {
		if err := client.Disconnect(context.Background()); err != nil {
			log.Printf("Error while disconnecting MongoDB: %v", err)
		} else {
			log.Println("MongoDB connection closed safely")
		}
	}

	return client, disconnect
}
