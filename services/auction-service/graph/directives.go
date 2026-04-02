package graph

import (
	"context"
	"fmt"
	"strings"

	"github.com/99designs/gqlgen/graphql"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/graph/model"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/middleware"
)

var rolePermissions = map[string][]string{
	"admin": {"CREATE_AUCTION", "UPDATE_AUCTION", "DELETE_AUCTION", "VIEW_AUCTION", "VIEW_AUCTION_BY_ID", "VIEW_AUCTION_CATEGORIES"},
	"user": {"CREATE_AUCTION", "UPDATE_AUCTION", "DELETE_AUCTION", "VIEW_AUCTION", "VIEW_AUCTION_BY_ID", "VIEW_AUCTION_CATEGORIES"},
}

func AuthDirective(ctx context.Context, obj interface{}, next graphql.Resolver, permissions []model.Permission) (interface{}, error) {
	userID := middleware.GetUserIDFromContext(ctx)
	if userID == "" {
		return nil, fmt.Errorf("unauthorized: you must be logged in to access this resource")
	}

	if len(permissions) > 0 {
		userPerms := middleware.GetUserPermissionsFromContext(ctx)
		userRole := strings.ToLower(middleware.GetUserRoleFromContext(ctx))

		if defaultPerms, ok := rolePermissions[userRole]; ok {
			userPerms = append(userPerms, defaultPerms...)
		}

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
