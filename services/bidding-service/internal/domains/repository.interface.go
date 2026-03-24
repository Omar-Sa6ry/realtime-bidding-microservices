package domain

import (
	"context"
	"time"
)

type BiddingRepository interface {
	PlaceBid(ctx context.Context, bid *Bid) error
	GetHighestBid(ctx context.Context, auctionID string) (*Bid, error)
	GetAuctionHistory(ctx context.Context, auctionID string) ([]*Bid, error)
	Lock(ctx context.Context, auctionID string, expiration time.Duration) (string, error)
	Unlock(ctx context.Context, auctionID string, lockID string) error
}
