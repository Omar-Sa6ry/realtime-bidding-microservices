package domain

import (
	"context"
	"time"
)

type BiddingRepository interface {
	PlaceBid(ctx context.Context, bid *Bid) error
	GetHighestBid(ctx context.Context, auctionID string) (*Bid, error)
	GetAuctionHistory(ctx context.Context, auctionID string, limit, offset int64) ([]*Bid, int64, error)
	GetBidsByUserID(ctx context.Context, userID string, limit, offset int64) ([]*Bid, int64, error)
	Lock(ctx context.Context, auctionID string, expiration time.Duration) (string, error)
	Unlock(ctx context.Context, auctionID string, lockID string) error
}
