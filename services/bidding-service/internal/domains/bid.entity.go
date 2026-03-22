package domain

import "time"

type Bid struct {
	ID           string               `json:"id" bson:"_id"`
	AuctionID    string               `json:"auction_id" bson:"auction_id"`
	UserID       string               `json:"user_id" bson:"user_id"`
	Amount       float64              `json:"amount" bson:"amount"`
	Status       BidStatus            `json:"status" bson:"status"`
	CreatedAt    time.Time            `json:"created_at" bson:"created_at"`
	UpdatedAt    time.Time            `json:"updated_at" bson:"updated_at"`
	DomainEvents []interface{}        `bson:"-" json:"-"`
}

func (b *Bid) AddEvent(event interface{}) {
	b.DomainEvents = append(b.DomainEvents, event)
}

func (b *Bid) ClearEvents() {
	b.DomainEvents = nil
}

func (Bid) IsEntity() {}