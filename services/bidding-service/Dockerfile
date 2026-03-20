FROM golang:1.25-alpine

WORKDIR /usr/src/app

RUN apk add --no-cache git gcc musl-dev
RUN go install github.com/air-verse/air@latest

# Pre-fetch dependencies to improve caching and handle network issues better
COPY services/bidding-service/go.mod services/bidding-service/go.sum ./services/bidding-service/
WORKDIR /usr/src/app/services/bidding-service
RUN go env -w GOPROXY=https://proxy.golang.org,direct
RUN go mod download

WORKDIR /usr/src/app
COPY . .

WORKDIR /usr/src/app/services/bidding-service

CMD ["air", "-c", ".air.toml"]
