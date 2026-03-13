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
	JWTSecret string
}

func LoadConfig() *Config {
	return &Config{
		MongoURI: getEnv("MONGO_URI", "mongodb://localhost:27017"),
		DBName:   getEnv("DB_NAME", "bidding_auction_db"),
		Port:     getEnv("PORT_AUCTION", "3002"),
		NatsURL:  getEnv("NATS_URL", "nats://localhost:4222"),
		JWTSecret:  getEnv("JWT_SECRET", "f3c12be5d179b8d5690d4735a0b48b5d68e7b68e3cda6b3"),
	}

}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		log.Println("Configuration is loaded successfully")
		return value
	}
	
	return fallback
}
