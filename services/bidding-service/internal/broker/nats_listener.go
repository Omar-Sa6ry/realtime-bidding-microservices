package broker

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/pkg/logger"
	"github.com/nats-io/nats.go"
)

type AuctionEndedEvent struct {
	ID            string    `json:"id"`
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	StartingPrice float64   `json:"starting_price"`
	CurrentPrice  float64   `json:"current_price"`
	Currency      string    `json:"currency"`
	StartTime     time.Time `json:"start_time"`
	EndTime       time.Time `json:"end_time"`
	Status        string    `json:"status"`
	SellerID      string    `json:"seller_id"`
}

type NatsListener struct {
	conn *nats.Conn
	resolveAction func(ctx context.Context, auctionID string, sellerID string) error
}

func NewNatsListener(url string, resolveAction func(ctx context.Context, auctionID string, sellerID string) error) (*NatsListener, error) {
	nc, err := nats.Connect(url)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS for listening: %w", err)
	}

	listener := &NatsListener{
		conn:          nc,
		resolveAction: resolveAction,
	}

	if err := listener.SubscribeToAuctionEnded(); err != nil {
		return nil, err
	}

	return listener, nil
}

func (l *NatsListener) SubscribeToAuctionEnded() error {
	subject := "auction.ended"
	queue := "bidding-service-queue"

	_, err := l.conn.QueueSubscribe(subject, queue, func(msg *nats.Msg) {
		logger.Info("NATS_LISTENER", fmt.Sprintf("Received message on subject: %s", msg.Subject))

		var payload struct {
			Data AuctionEndedEvent `json:"data"`
		}

		if err := json.Unmarshal(msg.Data, &payload); err != nil {
			logger.Error("NATS_LISTENER", "Failed to unmarshal auction.ended event", err)
			return
		}

		auction := payload.Data
		logger.Info("NATS_LISTENER", fmt.Sprintf("Processing auction resolution for auction ID: %s, Seller: %s", auction.ID, auction.SellerID))

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := l.resolveAction(ctx, auction.ID, auction.SellerID); err != nil {
			logger.Error("NATS_LISTENER", fmt.Sprintf("Failed to resolve auction %s", auction.ID), err)
			return
		}

		logger.Info("NATS_LISTENER", fmt.Sprintf("Successfully resolved auction %s. Funds transferred to seller %s", auction.ID, auction.SellerID))
	})

	if err != nil {
		return fmt.Errorf("failed to subscribe to %s: %w", subject, err)
	}

	logger.Info("NATS_LISTENER", fmt.Sprintf("Successfully subscribed to subject %s", subject))
	return nil
}

func (l *NatsListener) Close() {
	if l.conn != nil {
		l.conn.Close()
	}
}
