package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
)

// Helper to generate a token for tests
func generateTestToken(secret string, claims jwt.MapClaims) string {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, _ := token.SignedString([]byte(secret))
	return tokenString
}

func TestAuthMiddleware(t *testing.T) {
	secret := "test-secret"
	mw := AuthMiddleware(secret)

	t.Run("Valid Token ,Inject User Info", func(t *testing.T) {
		userID := "user-123"
		role := "admin"
		token := generateTestToken(secret, jwt.MapClaims{
			"id":          userID,
			"role":        role,
			"permissions": []interface{}{"read", "write"},
			"exp":         time.Now().Add(time.Hour).Unix(),
		})

		nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, userID, GetUserIDFromContext(r.Context()))
			assert.Equal(t, role, GetUserRoleFromContext(r.Context()))
			assert.Contains(t, GetUserPermissionsFromContext(r.Context()), "read")
			w.WriteHeader(http.StatusOK)
		})

		// Perform request
		req := httptest.NewRequest("GET", "/", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rr := httptest.NewRecorder()

		mw(nextHandler).ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
	})

	t.Run("Missing Authorization Header, No Context Injection", func(t *testing.T) {
		nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Empty(t, GetUserIDFromContext(r.Context()))
			w.WriteHeader(http.StatusOK)
		})

		req := httptest.NewRequest("GET", "/", nil)
		rr := httptest.NewRecorder()

		mw(nextHandler).ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
	})

	t.Run("Invalid Header Format, Skip Injection", func(t *testing.T) {
		nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Empty(t, GetUserIDFromContext(r.Context()))
			w.WriteHeader(http.StatusOK)
		})

		req := httptest.NewRequest("GET", "/", nil)
		req.Header.Set("Authorization", "InvalidHeader abc")
		rr := httptest.NewRecorder()

		mw(nextHandler).ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
	})

	t.Run("Expired Token, Skip Injection", func(t *testing.T) {
		token := generateTestToken(secret, jwt.MapClaims{
			"id":  "expired-user",
			"exp": time.Now().Add(-time.Hour).Unix(),
		})

		nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Empty(t, GetUserIDFromContext(r.Context()))
			w.WriteHeader(http.StatusOK)
		})

		req := httptest.NewRequest("GET", "/", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rr := httptest.NewRecorder()

		mw(nextHandler).ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
	})

	t.Run("Wrong Secret Key, Skip Injection", func(t *testing.T) {
		token := generateTestToken("wrong-secret", jwt.MapClaims{
			"id": "wrong-user",
		})

		nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Empty(t, GetUserIDFromContext(r.Context()))
			w.WriteHeader(http.StatusOK)
		})

		req := httptest.NewRequest("GET", "/", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rr := httptest.NewRecorder()

		mw(nextHandler).ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
	})
}

func TestContextHelpers(t *testing.T) {
	t.Run("GetUserIDFromContext - Not Found", func(t *testing.T) {
		res := GetUserIDFromContext(context.Background())
		assert.Equal(t, "", res)
	})

	t.Run("Helpers with valid context", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), UserIDKey, "test-user")
		assert.Equal(t, "test-user", GetUserIDFromContext(ctx))
	})
}
