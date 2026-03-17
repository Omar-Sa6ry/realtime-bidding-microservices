package graph

import service "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/services"

type Resolver struct {
	AuctionService service.AuctionService
}
