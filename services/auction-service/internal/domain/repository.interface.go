package domain

import (
	"context"
)

type AuctionRepository interface {
	Create(ctx context.Context, auction *Auction) error
	FindAll(ctx context.Context) ([]*Auction, error)
	FindByID(ctx context.Context, id string) (*Auction, error)
	UpdateStatus(ctx context.Context, id string, status AuctionStatus) error
}
