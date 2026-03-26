package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/domain"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/pkg/logger"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
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

func (r *mongoAuctionRepository) FindByID(ctx context.Context, id string) (*domain.Auction, error) {
	var auction domain.Auction
	auctionId, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, fmt.Errorf("invalid auction ID: %w", err)
	}

	if err := r.collection.FindOne(ctx, bson.M{"_id": auctionId}).Decode(&auction); err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find auction: %w", err)
	}

	return &auction, nil
}

func (r *mongoAuctionRepository) FindAll(ctx context.Context, filter bson.M, limit, offset int64) ([]*domain.Auction, int64, error) {
	var auctions []*domain.Auction

	findOptions := options.Find()
	findOptions.SetLimit(limit)
	findOptions.SetSkip(offset)
	findOptions.SetSort(bson.M{"createdAt": -1})

	cursor, err := r.collection.Find(ctx, filter, findOptions)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to find auctions: %w", err)
	}
	defer cursor.Close(ctx)

	total, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count auctions: %w", err)
	}

	for cursor.Next(ctx) {
		var auction domain.Auction
		if err := cursor.Decode(&auction); err != nil {
			return nil, 0, fmt.Errorf("failed to decode auction: %w", err)
		}
		auctions = append(auctions, &auction)
	}

	return auctions, total, nil
}

func (r *mongoAuctionRepository) Update(ctx context.Context, auction *domain.Auction) error {
	auction.UpdatedAt = time.Now()

	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": auction.ID}, bson.M{"$set": auction})
	if err != nil {
		return fmt.Errorf("failed to update auction: %w", err)
	}

	return nil
}

func (r *mongoAuctionRepository) Delete(ctx context.Context, id string) error {
	auctionId, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return fmt.Errorf("invalid auction ID: %w", err)
	}

	_, err = r.collection.DeleteOne(ctx, bson.M{"_id": auctionId})
	if err != nil {
		return fmt.Errorf("failed to delete auction: %w", err)
	}

	return nil
}

func (r *mongoAuctionRepository) UpdateStatusBulk(ctx context.Context, currentStatus domain.AuctionStatus, newStatus domain.AuctionStatus, timeField string, cutoff time.Time) (int64, error) {
	filter := bson.M{
		"status":  currentStatus,
		timeField: bson.M{"$lte": cutoff},
	}

	update := bson.M{
		"$set": bson.M{
			"status":    newStatus,
			"updatedAt": time.Now(),
		},
	}

	res, err := r.collection.UpdateMany(ctx, filter, update)
	if err != nil {
		return 0, fmt.Errorf("failed to execute bulk update: %w", err)
	}

	return res.ModifiedCount, nil
}

func (r *mongoAuctionRepository) FindByStatusAndCutoff(ctx context.Context, status domain.AuctionStatus, timeField string, cutoff time.Time) ([]*domain.Auction, error) {
	filter := bson.M{
		"status":    status,
		timeField: bson.M{"$lte": cutoff},
	}

	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to find auctions for transition: %w", err)
	}
	defer cursor.Close(ctx)

	var auctions []*domain.Auction
	if err := cursor.All(ctx, &auctions); err != nil {
		return nil, fmt.Errorf("failed to decode auctions: %w", err)
	}

	return auctions, nil
}

func (r *mongoAuctionRepository) EnsureIndexes(ctx context.Context) error {
	indexSpecs := []mongo.IndexModel{
		{
			Keys: bson.D{{Key: "status", Value: 1}, {Key: "startTime", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "status", Value: 1}, {Key: "endTime", Value: 1}},
		},
		{
			Keys: bson.D{{Key: "createdAt", Value: -1}},
		},
		{
			Keys: bson.D{{Key: "sellerId", Value: 1}},
		},
	}

	_, err := r.collection.Indexes().CreateMany(ctx, indexSpecs)
	if err != nil {
		return fmt.Errorf("failed to ensure indexes: %w", err)
	}

	logger.Info("MongoDB", "Auction collection indexes ensured successfully")
	return nil
}
