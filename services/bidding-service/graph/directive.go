package graph

import (
	"context"
	"fmt"
	"strings"

	"github.com/99designs/gqlgen/graphql"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/graph/model"
	middlewares "github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/middlewares"
)

var rolePermissions = map[string][]string{
	"admin": {"CREATE_BID", "VIEW_USER", "VIEW_BID", "VIEW_BID_BY_ID", "VIEW_BID_BY_AUCTION", "VIEW_BID_BY_USER"},
	"user":  {"CREATE_BID", "VIEW_USER", "VIEW_BID", "VIEW_BID_BY_ID", "VIEW_BID_BY_AUCTION", "VIEW_BID_BY_USER"},
}

func AuthDirective(ctx context.Context, obj interface{}, next graphql.Resolver, permissions []model.Permission) (interface{}, error) {
	userId := middlewares.GetUserIDFromContext(ctx)
	if userId == "" {
		return nil, fmt.Errorf("UNAUTHENTICATED")
	}

	if len(permissions) > 0 {
		userPerms := middlewares.GetUserPermissionsFromContext(ctx)
		userRole := strings.ToLower(middlewares.GetUserRoleFromContext(ctx))

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
