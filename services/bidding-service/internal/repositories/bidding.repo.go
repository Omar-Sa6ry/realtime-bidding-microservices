package repository

import (
	"context"

	domains "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/domains"
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

func (r *mongoBiddingRepository) GetAuctionHistory(ctx context.Context, auctionID string) ([]*domains.Bid, error) {
	var bids []*domains.Bid
	opts := options.Find().SetSort(bson.M{"created_at": -1})
	cursor, err := r.collection.Find(ctx, bson.M{"auction_id": auctionID}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	for cursor.Next(ctx) {
		var bid domains.Bid
		if err := cursor.Decode(&bid); err != nil {
			return nil, err
		}
		bids = append(bids, &bid)
	}
	return bids, nil
}
