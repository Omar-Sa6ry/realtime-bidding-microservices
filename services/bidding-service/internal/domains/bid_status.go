package domain

type BidStatus string

const (
	StatusAccepted      BidStatus = "ACCEPTED"
	StatusOutbid        BidStatus = "OUTBID"
	StatusCancelled     BidStatus = "CANCELLED"
	StatusWinner        BidStatus = "WINNER"
	StatusWinnerPending BidStatus = "WINNER_PENDING"
)