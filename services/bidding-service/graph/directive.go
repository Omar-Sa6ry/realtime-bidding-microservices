package graph

import (
	"context"
	"fmt"

	"github.com/99designs/gqlgen/graphql"
	middlewares "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/middlewares"
)

func AuthDirective(ctx context.Context, obj interface{}, next graphql.Resolver) (interface{}, error) {
	userId := middlewares.GetUserIDFromContext(ctx)
	if userId == "" {
		return nil, fmt.Errorf("UNAUTHENTICATED")
	}

	return next(ctx)
}
