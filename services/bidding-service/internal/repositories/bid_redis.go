package repository

import (
	"context"
	"fmt"

	domains "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/domains"
	"github.com/redis/go-redis/v9"
)

type redisBiddingRepository struct {
	client *redis.Client
}

func NewRedisBiddingRepository(client *redis.Client) domains.BiddingRepository {
	return &redisBiddingRepository{
		client: client,
	}
}

func (r *redisBiddingRepository) PlaceBid(ctx context.Context, bid *domains.Bid) error {
	key := fmt.Sprintf("auction:%s:current_bid", bid.AuctionID)
	
	script := `
		local current_price = redis.call("GET", KEYS[1])
		if not current_price or tonumber(ARGV[1]) > tonumber(current_price) then
			redis.call("SET", KEYS[1], ARGV[1])
			redis.call("SET", KEYS[1] .. ":bidder", ARGV[2])
			return 1
		end
		return 0
	`
	
	res, err := r.client.Eval(ctx, script, []string{key}, bid.Amount, bid.UserID).Int()
	if err != nil {
		return err
	}
	
	if res == 0 {
		return fmt.Errorf("OUTBID")
	}
	
	return nil
}

func (r *redisBiddingRepository) GetHighestBid(ctx context.Context, auctionID string) (*domains.Bid, error) {
	key := fmt.Sprintf("auction:%s:current_bid", auctionID)
	
	val, err := r.client.Get(ctx, key).Float64()
	if err == redis.Nil {
		return nil, nil
	} else if err != nil {
		return nil, err
	}
	
	bidder, _ := r.client.Get(ctx, key+":bidder").Result()
	
	return &domains.Bid{
		AuctionID: auctionID,
		UserID:    bidder,
		Amount:    val,
	}, nil
}

func (r *redisBiddingRepository) GetAuctionHistory(ctx context.Context, auctionID string) ([]*domains.Bid, error) {
	// Redis is mostly for the current state. History should be fetched from MongoDB.
	// This method could return an error or be left for the Mongo implementation.
	return nil, fmt.Errorf("use MongoDB repository for auction history")
}
