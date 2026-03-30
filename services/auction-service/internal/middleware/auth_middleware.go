package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const (
	UserIDKey      contextKey = "userId"
	UserRoleKey    contextKey = "userRole"
	UserPermsKey   contextKey = "userPermissions"
)

func AuthMiddleware(secretKey string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				next.ServeHTTP(w, r)
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				next.ServeHTTP(w, r)
				return
			}

			tokenString := parts[1]
			token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
				}
				return []byte(secretKey), nil
			})

			if err != nil || !token.Valid {
				next.ServeHTTP(w, r)
				return
			}

			if claims, ok := token.Claims.(jwt.MapClaims); ok {
				ctx := r.Context()
				if userID, ok := claims["id"].(string); ok {
					ctx = context.WithValue(ctx, UserIDKey, userID)
				}
				if role, ok := claims["role"].(string); ok {
					ctx = context.WithValue(ctx, UserRoleKey, role)
				}
				if perms, ok := claims["permissions"].([]interface{}); ok {
					permStrings := make([]string, len(perms))
					for i, v := range perms {
						permStrings[i] = fmt.Sprint(v)
					}
					ctx = context.WithValue(ctx, UserPermsKey, permStrings)
				}
				r = r.WithContext(ctx)
			}

			next.ServeHTTP(w, r)
		})
	}
}

func GetUserIDFromContext(ctx context.Context) string {
	userID, _ := ctx.Value(UserIDKey).(string)
	return userID
}

func GetUserRoleFromContext(ctx context.Context) string {
	role, _ := ctx.Value(UserRoleKey).(string)
	return role
}

func GetUserPermissionsFromContext(ctx context.Context) []string {
	perms, _ := ctx.Value(UserPermsKey).([]string)
	return perms
}
