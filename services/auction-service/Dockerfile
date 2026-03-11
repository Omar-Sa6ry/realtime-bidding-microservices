FROM golang:1.25-alpine

WORKDIR /usr/src/app

# Install build dependencies and Air for live-reloading
RUN apk add --no-cache git gcc musl-dev
RUN go install github.com/air-verse/air@latest

# We copy the entire monorepo so the context is similar to your Node services
# This also helps if we need to share proto files or other cross-service logic later.
COPY . .

WORKDIR /usr/src/app/services/auction-service

# Download Go dependencies
RUN go mod download

# Run air for hot-reloading
CMD ["air", "-c", ".air.toml"]
