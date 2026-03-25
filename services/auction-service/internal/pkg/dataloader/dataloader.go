package dataloader

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/graph/model"
	"github.com/Omar-Sa6ry/realtime-bidding-microservices/services/auction-service/internal/client"
	"github.com/graph-gophers/dataloader/v7"
)

type ctxKey string

const loaderKey ctxKey = "userloader"

type UserReader struct {
	userClient client.UserClient
}

func (u *UserReader) GetUsers(ctx context.Context, ids []string) []*dataloader.Result[*model.User] {
	results := make([]*dataloader.Result[*model.User], len(ids))
	
	resp, err := u.userClient.GetUsers(ctx, ids)
	if err != nil {
		for i := range ids {
			results[i] = &dataloader.Result[*model.User]{Error: err}
		}
		return results
	}

	userMap := make(map[string]*model.User)
	for _, user := range resp.Users {
		userMap[user.Id] = &model.User{
			ID:        user.Id,
			Email:     user.Email,
			Firstname: &user.Firstname,
			Lastname:  &user.Lastname,
		}
	}

	for i, id := range ids {
		if user, ok := userMap[id]; ok {
			results[i] = &dataloader.Result[*model.User]{Data: user}
		} else {
			results[i] = &dataloader.Result[*model.User]{Error: fmt.Errorf("user %s not found", id)}
		}
	}

	return results
}

func Middleware(userClient client.UserClient, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reader := &UserReader{userClient: userClient}
		loader := dataloader.NewBatchedLoader(reader.GetUsers, dataloader.WithWait[string, *model.User](2*time.Millisecond))
		ctx := context.WithValue(r.Context(), loaderKey, loader)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func For(ctx context.Context) *dataloader.Loader[string, *model.User] {
	loader, _ := ctx.Value(loaderKey).(*dataloader.Loader[string, *model.User])
	return loader
}
