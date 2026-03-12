package domain

type AuctionStatus string

const (
	StatusPending   AuctionStatus = "PENDING"
	StatusActive    AuctionStatus = "ACTIVE"
	StatusEnded     AuctionStatus = "ENDED"
	StatusCancelled AuctionStatus = "CANCELLED"
)
