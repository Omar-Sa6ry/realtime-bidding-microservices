package graph

import (
	"context"
	"fmt"
	"strings"

	"github.com/99designs/gqlgen/graphql"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/graph/model"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/middleware"
)

func AuthDirective(ctx context.Context, obj interface{}, next graphql.Resolver, permissions []model.Permission) (interface{}, error) {
	userID := middleware.GetUserIDFromContext(ctx)
	if userID == "" {
		return nil, fmt.Errorf("unauthorized: you must be logged in to access this resource")
	}

	if len(permissions) > 0 {
		userPerms := middleware.GetUserPermissionsFromContext(ctx)
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
