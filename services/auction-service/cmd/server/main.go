package main

import (
	"log"

	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/config"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/database"
)

func main() {
	log.Println("Starting Auction Service")

	cfg := config.LoadConfig()

	_, disconnect := database.InitMongoDB(cfg.MongoURI)
	defer disconnect()

	log.Printf("Auction Service is running on port %s", cfg.Port)

	// Keep the application running without deadlock
	forever := make(chan bool)
	log.Println("Waiting for events/traffic...")
	<-forever
}
