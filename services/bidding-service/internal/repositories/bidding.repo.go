package repository

import (
	"context"
	"fmt"
	"time"

	domains "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/domains"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/pkg/logger"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type mongoBiddingRepository struct {
	collection *mongo.Collection
}

func NewMongoBiddingRepository(db *mongo.Database) domains.BiddingRepository {
	return &mongoBiddingRepository{
		collection: db.Collection("bids"),
	}
}

func (r *mongoBiddingRepository) PlaceBid(ctx context.Context, bid *domains.Bid) error {
	_, err := r.collection.InsertOne(ctx, bid)
	return err
}

func (r *mongoBiddingRepository) GetHighestBid(ctx context.Context, auctionID string) (*domains.Bid, error) {
	var bid domains.Bid
	opts := options.FindOne().SetSort(bson.M{"amount": -1})
	err := r.collection.FindOne(ctx, bson.M{"auction_id": auctionID}, opts).Decode(&bid)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return &bid, nil
}

func (r *mongoBiddingRepository) GetAuctionHistory(ctx context.Context, auctionID string, limit, offset int64) ([]*domains.Bid, int64, error) {
	var bids []*domains.Bid
	filter := bson.M{"auction_id": auctionID}
	
	findOptions := options.Find()
	findOptions.SetLimit(limit)
	findOptions.SetSkip(offset)
	findOptions.SetSort(bson.M{"created_at": -1})
	
	cursor, err := r.collection.Find(ctx, filter, findOptions)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)
	
	total, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	for cursor.Next(ctx) {
		var bid domains.Bid
		if err := cursor.Decode(&bid); err != nil {
			return nil, 0, err
		}
		bids = append(bids, &bid)
	}
	return bids, total, nil
}

func (r *mongoBiddingRepository) GetBidsByUserID(ctx context.Context, userID string, limit, offset int64) ([]*domains.Bid, int64, error) {
	var bids []*domains.Bid
	filter := bson.M{"user_id": userID}

	findOptions := options.Find()
	findOptions.SetLimit(limit)
	findOptions.SetSkip(offset)
	findOptions.SetSort(bson.M{"created_at": -1})

	cursor, err := r.collection.Find(ctx, filter, findOptions)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)
	
	total, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	for cursor.Next(ctx) {
		var bid domains.Bid
		if err := cursor.Decode(&bid); err != nil {
			return nil, 0, err
		}
		bids = append(bids, &bid)
	}
	return bids, total, nil
}

func (r *mongoBiddingRepository) UpdateBidStatus(ctx context.Context, bidID string, status domains.BidStatus) error {
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": bidID}, bson.M{"$set": bson.M{"status": string(status), "updated_at": time.Now()}})
	return err
}

func (r *mongoBiddingRepository) Lock(ctx context.Context, auctionID string, expiration time.Duration) (string, error) {
	return "", nil
}

func (r *mongoBiddingRepository) Unlock(ctx context.Context, auctionID string, lockID string) error {
	return nil
}

func (r *mongoBiddingRepository) EnsureIndexes(ctx context.Context) error {
	indexSpecs := []mongo.IndexModel{
		{
			Keys: bson.D{{Key: "auction_id", Value: 1}, {Key: "amount", Value: -1}},
		},
		{
			Keys: bson.D{{Key: "auction_id", Value: 1}, {Key: "created_at", Value: -1}},
		},
		{
			Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "created_at", Value: -1}},
		},
	}

	_, err := r.collection.Indexes().CreateMany(ctx, indexSpecs)
	if err != nil {
		return fmt.Errorf("failed to ensure indexes: %w", err)
	}

	logger.Info("MongoDB", "Bid collection indexes ensured successfully")
	return nil
}
