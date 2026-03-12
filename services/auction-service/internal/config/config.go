package config

import (
	"log"
	"os"
)

type Config struct {
	MongoURI string
	DBName   string
	Port     string
	NatsURL  string
}

func LoadConfig() *Config {
	return &Config{
		MongoURI: getEnv("MONGO_URI", "mongodb://localhost:27017"),
		DBName:   getEnv("DB_NAME", "bidding_auction_db"),
		Port:     getEnv("PORT_AUCTION", "3002"),
		NatsURL:  getEnv("NATS_URL", "nats://localhost:4222"),
	}

}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		log.Println("Configuration is loaded successfully")
		return value
	}
	
	return fallback
}
