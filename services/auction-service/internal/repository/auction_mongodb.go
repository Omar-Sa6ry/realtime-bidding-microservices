package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/domain"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type mongoAuctionRepository struct {
	collection *mongo.Collection
}

func NewMongoAuctionRepository(db *mongo.Database) domain.AuctionRepository {
	return &mongoAuctionRepository{
		collection: db.Collection("auctions"),
	}
}

func (r *mongoAuctionRepository) Create(ctx context.Context, auction *domain.Auction) error {
	auction.ID = primitive.NewObjectID()
	auction.CreatedAt = time.Now()
	auction.UpdatedAt = time.Now()

	_, err := r.collection.InsertOne(ctx, auction)
	if err != nil {
		return fmt.Errorf("failed to insert auction: %w", err)
	}

	return nil
}
