package graph

import (
	"context"
	"fmt"

	"github.com/99designs/gqlgen/graphql"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/middleware"
)

func AuthDirective(ctx context.Context, obj interface{}, next graphql.Resolver) (interface{}, error) {
	userID := middleware.GetUserIDFromContext(ctx)
	if userID == "" {
		return nil, fmt.Errorf("unauthorized: you must be logged in to access this resource")
	}

	return next(ctx)
}
