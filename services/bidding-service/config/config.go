package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port           string
	NodeEnv        string
	JWTSecret      string
	JWTExpire      string
	MongoURI       string
	DBName         string
	RedisHost      string
	RedisPort      string
	NatsURL        string
	UserServiceURL string
}

func LoadConfig() *Config {
	// Load .env file if it exists (useful for local development)
	_ = godotenv.Load()

	return &Config{
		Port:           getEnv("PORT_BIDDING", "3003"),
		NodeEnv:        getEnv("NODE_ENV", "development"),
		JWTSecret:      getEnv("JWT_SECRET", ""),
		JWTExpire:      getEnv("JWT_EXPIRE", "36000s"),
		MongoURI:       getEnv("MONGO_URI", "mongodb://localhost:27017"),
		DBName:         getEnv("DB_NAME", "bidding-bidding_service_dev"),
		RedisHost:      getEnv("REDIS_HOST", "localhost"),
		RedisPort:      getEnv("REDIS_PORT", "6379"),
		NatsURL:        getEnv("NATS_URL", "nats://localhost:4222"),
		UserServiceURL: getEnv("USER_SERVICE_URL", "localhost:50051"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
