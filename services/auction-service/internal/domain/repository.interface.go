package domain

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

type AuctionRepository interface {
	Create(ctx context.Context, auction *Auction) error
	FindByID(ctx context.Context, id string) (*Auction, error)
	FindAll(ctx context.Context, filter bson.M, limit, offset int64) ([]*Auction, int64, error)
	Update(ctx context.Context, auction *Auction) error
	Delete(ctx context.Context, id string) error
	UpdateStatusBulk(ctx context.Context, currentStatus AuctionStatus, newStatus AuctionStatus, timeField string, cutoff time.Time) (int64, error)
	FindByStatusAndCutoff(ctx context.Context, status AuctionStatus, timeField string, cutoff time.Time) ([]*Auction, error)
}
