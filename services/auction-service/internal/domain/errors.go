package domain

import (
	"errors"
)

var (
	ErrAuctionNotFound      = errors.New("AUCTION_NOT_FOUND")
	ErrUnauthorizedSeller   = errors.New("UNAUTHORIZED_SELLER")
	ErrSellerNotFound       = errors.New("SELLER_NOT_FOUND")
	ErrInvalidStartTime     = errors.New("INVALID_START_TIME")
	ErrInvalidEndTime       = errors.New("INVALID_END_TIME")
	ErrImageUploadFailed    = errors.New("IMAGE_UPLOAD_FAILED")
	ErrAuctionNotPending    = errors.New("AUCTION_NOT_PENDING")
	ErrValidationFailed     = errors.New("VALIDATION_FAILED")
	ErrInternalServerError  = errors.New("INTERNAL_SERVER_ERROR")
	YouOwnAuction           = errors.New("YOU_OWN_AUCTION")
	AuctionNotActive        = errors.New("AUCTION_NOT_ACTIVE")
)
