package app

import (
	"context"
	"log"
	"time"

	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/pkg/logger"
	"github.com/robfig/cron/v3"
)

func (a *App) startCronJobs() {
	c := cron.New(cron.WithChain(
		cron.SkipIfStillRunning(cron.DefaultLogger),
	))

	_, err := c.AddFunc("@every 1m", func() {
		ctx, cancel := context.WithTimeout(context.Background(), 50*time.Second)
		defer cancel()

		logger.Info("CronWorker", "Checking Auction Lifecycles...")
		if err := a.AuctionService.ProcessLifecycleTransitions(ctx); err != nil {
			logger.Error("CronWorker", "Lifecycle Error", err)
		}
	})

	if err != nil {
		log.Fatalf("Failed to setup cron job: %v", err)
	}

	c.Start()
	logger.Info("CronWorker", "Auction lifecycle background worker started")
}
