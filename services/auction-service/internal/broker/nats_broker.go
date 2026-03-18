package broker

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/pkg/logger"

	"github.com/nats-io/nats.go"
)

type Event struct {
	Subject string      `json:"-"`
	Data    interface{} `json:"data"`
}

type Publisher interface {
	Publish(ctx context.Context, event Event) error
	Close()
}

type natsPublisher struct {
	conn *nats.Conn
}

func NewNatsPublisher(url string) (Publisher, error) {
	nc, err := nats.Connect(url)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS: %w", err)
	}

	logger.Info("NATS", fmt.Sprintf("Successfully connected to NATS at %s", url))

	return &natsPublisher{
		conn: nc,
	}, nil
}

func (n *natsPublisher) Publish(ctx context.Context, event Event) error {
	data, err := json.Marshal(event.Data)
	if err != nil {
		return fmt.Errorf("failed to marshal event data: %w", err)
	}

	if err := n.conn.Publish(event.Subject, data); err != nil {
		return fmt.Errorf("failed to publish event to NATS: %w", err)
	}

	logger.Info("NATS", fmt.Sprintf("Event published to subject %s", event.Subject))
	return nil
}

func (n *natsPublisher) Close() {
	if n.conn != nil {
		n.conn.Close()
	}
}
