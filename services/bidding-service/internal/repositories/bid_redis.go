package repository

import (
	"context"
	"fmt"
	"time"

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
			redis.call("SET", KEYS[1] .. ":id", ARGV[3])
			redis.call("SET", KEYS[1] .. ":created_at", ARGV[4])
			return 1
		end
		return 0
	`
	
	res, err := r.client.Eval(ctx, script, []string{key}, 
		bid.Amount,        // ARGV[1]
		bid.UserID,        // ARGV[2]
		bid.ID,            // ARGV[3]
		bid.CreatedAt.Format(time.RFC3339), // ARGV[4]
	).Int()
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
	id, _ := r.client.Get(ctx, key+":id").Result()
	createdAtStr, _ := r.client.Get(ctx, key+":created_at").Result()
	
	createdAt, _ := time.Parse(time.RFC3339, createdAtStr)
	
	return &domains.Bid{
		ID:        id,
		AuctionID: auctionID,
		UserID:    bidder,
		Amount:    val,
		CreatedAt: createdAt,
	}, nil
}

func (r *redisBiddingRepository) GetAuctionHistory(ctx context.Context, auctionID string) ([]*domains.Bid, error) {
	return nil, fmt.Errorf("use MongoDB repository for auction history")
}
