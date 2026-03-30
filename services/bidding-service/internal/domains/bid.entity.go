package domain

import "time"

type Bid struct {
	ID           string               `json:"id" bson:"_id"`
	AuctionID    string               `json:"auctionId" bson:"auction_id"`
	UserID       string               `json:"userId" bson:"user_id"`
	Amount       float64              `json:"amount" bson:"amount"`
	Status       BidStatus            `json:"status" bson:"status"`
	CreatedAt    time.Time            `json:"createdAt" bson:"created_at"`
	UpdatedAt    time.Time            `json:"updatedAt" bson:"updated_at"`
	DomainEvents []interface{}        `bson:"-" json:"-"`
}

func (b *Bid) AddEvent(event interface{}) {
	b.DomainEvents = append(b.DomainEvents, event)
}

func (b *Bid) ClearEvents() {
	b.DomainEvents = nil
}

func (Bid) IsEntity() {}