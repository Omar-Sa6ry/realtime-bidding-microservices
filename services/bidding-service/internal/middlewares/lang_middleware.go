package middleware

import (
	"context"
	"net/http"

	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/bidding-service/internal/pkg/translation"
)

func LangMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lang := r.Header.Get("x-lang")
		if lang == "" {
			lang = r.Header.Get("Accept-Language")
		}
		if lang == "" {
			lang = "en"
		}

		ctx := context.WithValue(r.Context(), translation.LangContextKey, lang)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
