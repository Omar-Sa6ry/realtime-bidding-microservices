package graph

import (
	"context"
	"fmt"
	"strings"

	"github.com/99designs/gqlgen/graphql"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/graph/model"
	middlewares "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/middlewares"
)

func AuthDirective(ctx context.Context, obj interface{}, next graphql.Resolver, permissions []model.Permission) (interface{}, error) {
	userId := middlewares.GetUserIDFromContext(ctx)
	if userId == "" {
		return nil, fmt.Errorf("UNAUTHENTICATED")
	}

	if len(permissions) > 0 {
		userPerms := middlewares.GetUserPermissionsFromContext(ctx)
		for _, required := range permissions {
			found := false
			for _, userPerm := range userPerms {
				if strings.ToLower(userPerm) == strings.ToLower(string(required)) {
					found = true
					break
				}
			}
			if !found {
				return nil, fmt.Errorf("forbidden: you do not have the required permission: %s", required)
			}
		}
	}

	return next(ctx)
}
