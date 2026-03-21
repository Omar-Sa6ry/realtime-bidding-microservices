package domain

import "time"

type Bid struct {
	ID string `json:"id"`
	AuctionID string `json:"auction_id"`
	UserID string `json:"user_id"`
	Amount float64 `json:"amount"`
	Status BidStatus `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}