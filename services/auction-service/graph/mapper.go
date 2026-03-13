package graph

import (
	"time"

	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/graph/model"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/domain"
)

func mapDomainToModel(d *domain.Auction) *model.Auction {
	return &model.Auction{
		ID:            d.ID.Hex(),
		Title:         d.Title,
		Description:   d.Description,
		StartingPrice: d.StartingPrice,
		CurrentPrice:  d.CurrentPrice,
		Currency:      d.Currency,
		Images:        d.Images,
		Status:        model.AuctionStatus(d.Status),
		StartTime:     d.StartTime.Format(time.RFC3339),
		EndTime:       d.EndTime.Format(time.RFC3339),
		SellerID:      d.SellerID,
		WinnerID:      d.WinnerID,
		CreatedAt:     d.CreatedAt.Format(time.RFC3339),
		UpdatedAt:     d.UpdatedAt.Format(time.RFC3339),
	}
}
