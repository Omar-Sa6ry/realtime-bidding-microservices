package app

import (
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/config"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/pkg/logger"
)

type App struct {
	cfg *config.Config
}

func New() *App {
	return &App{
		cfg: config.LoadConfig(),
	}
}

func (a *App) Run() {
	logger.Info("BiddingApp", "Initializing Bidding Service...")

}
