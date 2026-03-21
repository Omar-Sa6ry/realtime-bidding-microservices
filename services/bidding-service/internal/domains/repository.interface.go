package domain

import "context"

type BiddingRepository interface {
	PlaceBid(ctx context.Context, bid *Bid) error
	GetHighestBid(ctx context.Context, auctionID string) (*Bid, error)
	GetAuctionHistory(ctx context.Context, auctionID string) ([]*Bid, error)
}
