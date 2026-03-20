package domain

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Auction struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Title         string             `bson:"title" json:"title"`
	Description   string             `bson:"description" json:"description"`
	StartingPrice float64            `bson:"startingPrice" json:"startingPrice"`
	CurrentPrice  float64            `bson:"currentPrice" json:"currentPrice"`
	Currency      string             `bson:"currency" json:"currency"`
	Images        []string           `bson:"images" json:"images"`
	Status        AuctionStatus      `bson:"status" json:"status"`
	StartTime     time.Time          `bson:"startTime" json:"startTime"`
	EndTime       time.Time          `bson:"endTime" json:"endTime"`
	SellerID      string             `bson:"sellerId" json:"sellerId"`
	WinnerID      *string            `bson:"winnerId,omitempty" json:"winnerId,omitempty"`
	CreatedAt     time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt     time.Time          `bson:"updatedAt" json:"updatedAt"`
	DomainEvents  []interface{}      `bson:"-" json:"-"`
}

func (a *Auction) AddEvent(event interface{}) {
	a.DomainEvents = append(a.DomainEvents, event)
}

func (a *Auction) ClearEvents() {
	a.DomainEvents = nil
}
