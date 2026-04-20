# Auction Service

The Auction Service is a core microservice within the Real-time Bidding ecosystem responsible for managing the complete lifecycle of auction entities. It serves as the source of truth for auction states, pricing, and timing constraints, coordinating with the Bidding Service to ensure valid transaction flows.

## Internal Architecture

The service adheres to **Clean Architecture** and **Domain-Driven Design (DDD)** principles to maintain high cohesion and low coupling.

*   **cmd/server**: Application entry point and server bootstrap.
*   **graph**: GraphQL delivery layer (Schema, Resolvers, and Generated code via Gqlgen).
*   **internal/app**: Application container, initialization logic, and background worker orchestration (Cron).
*   **internal/domain**: Core business logic, entity definitions (`Auction`), and interface abstractions.
*   **internal/repository**: Data access layer implementing the `AuctionRepository` interface for MongoDB.
*   **internal/services**: Use-case layer orchestrating domain logic, external clients (Cloudinary, User Service), and event publishing.
*   **internal/broker**: Messaging infrastructure implementation (NATS).
*   **internal/grpc_server**: gRPC service implementation for inter-service communication.
*   **internal/proto**: Protocol Buffer definitions and generated gRPC stubs.
*   **internal/pkg**: Shared utilities including logging, translation (i18n), and dataloaders.

## Tech Stack & Dependencies

| Category | Technology |
| :--- | :--- |
| **Language** | Go 1.25 |
| **API (External)** | GraphQL (Gqlgen) |
| **API (Internal)** | gRPC |
| **Database** | MongoDB 6.0+ |
| **Message Broker** | NATS |
| **Media Storage** | Cloudinary |
| **Authentication** | JWT (JSON Web Tokens) |
| **Testing** | Testify, Testcontainers (MongoDB, NATS) |
| **Task Runner** | Air (Hot Reload) |

## Prerequisites

*   Go 1.25 or higher
*   Docker & Docker Compose
*   Skaffold (for Kubernetes development)
*   NATS Server
*   MongoDB Instance

## Environment Variables

| Variable | Type | Description | Sample Value |
| :--- | :--- | :--- | :--- |
| `PORT_AUCTION` | String | Port for the GraphQL server | `3002` |
| `MONGO_URI` | String | MongoDB connection string | `mongodb://localhost:27017` |
| `DB_NAME` | String | MongoDB database name | `bidding-auction_service` |
| `NATS_URL` | String | NATS server connection URL | `nats://localhost:4222` |
| `JWT_SECRET` | String | Secret key for JWT verification | `your-secure-secret` |
| `USER_SERVICE_URL` | String | gRPC endpoint for User Service | `user-srv:50051` |
| `CLOUDINARY_CLOUD_NAME` | String | Cloudinary account name | `demo-cloud` |
| `CLOUDINARY_API_KEY` | String | Cloudinary API Key | `123456789` |
| `CLOUDINARY_API_SECRET` | String | Cloudinary API Secret | `secret-hash` |

## Setup & Execution

### Bare-metal Local Execution
1. Install dependencies:
   ```bash
   go mod download
   ```
2. Run the service using Air for hot-reload:
   ```bash
   air -c .air.toml
   ```
   Or directly:
   ```bash
   go run cmd/server/main.go
   ```

### Containerized Execution
1. Build the Docker image:
   ```bash
   docker build -t auction-service -f Dockerfile .
   ```
2. Run the container:
   ```bash
   docker run -p 3002:3002 --env-file .env auction-service
   ```

### Orchestration via Skaffold
From the project root:
```bash
skaffold dev
```

## Communication Protocols & Contracts

### gRPC Services
The service exposes a gRPC server on port `50052`.

| Method | Request | Response | Description |
| :--- | :--- | :--- | :--- |
| `ValidateAuctionForBid` | `ValidateAuctionRequest` | `ValidateAuctionResponse` | Validates if a bid is allowed for an auction. Includes anti-sniping logic (extending time). |
| `GetAuction` | `GetAuctionRequest` | `GetAuctionResponse` | Retrieves auction details including current price and status. |

**Proto Reference**: `internal/proto/auction/auction.proto`

### GraphQL API
The external API is exposed at `/graphql` on `PORT_AUCTION`.

*   **Queries**:
    *   `findAuctions(input, pagination)`: Filter and paginate through auctions.
    *   `findAuctionByID(id)`: Retrieve a single auction.
*   **Mutations**:
    *   `createAuction(input)`: Create a new auction (requires `CREATE_AUCTION` permission).
    *   `updateAuction(id, input)`: Modify a pending auction.
    *   `deleteAuction(id)`: Remove an auction.

## Event-Driven Architecture

The service utilizes NATS as a message broker for broadcasting state changes.

### Published Events
| Subject | Payload | Trigger |
| :--- | :--- | :--- |
| `auction.create` | `Auction` Domain Object | Successful auction creation. |
| `auction.update` | `Auction` Domain Object | Auction details modification. |
| `auction.delete` | `Auction` Domain Object | Auction removal. |
| `auction.active` | `Auction` Domain Object | Transition from `PENDING` to `ACTIVE` (via Cron). |
| `auction.ended` | `Auction` Domain Object | Transition from `ACTIVE` to `ENDED` (via Cron). |

## Data & Caching Strategy

### Database Schema
The service owns a `auctions` collection in MongoDB.
*   **Indices**: Optimized for status-based lookups and time-cutoff queries (used by lifecycle workers).
*   **Document Structure**: Includes fields for title, description, pricing, timing, seller-id, and image assets.

### Media Caching
Product images are stored and processed via **Cloudinary**, ensuring optimized delivery and offloading storage requirements from the primary database.

## Testing Strategy

### Unit Testing
Unit tests focus on isolating domain logic and service layers.
*   **Methodology**: Utilizing `testify/mock` to simulate repository and external client behaviors.
*   **Execution**:
    ```bash
    go test ./internal/services/...
    ```

### End-to-End (E2E) Testing
E2E tests validate the entire service pipeline in an isolated environment.
*   **Methodology**: Leveraging **Testcontainers** to spin up ephemeral MongoDB and NATS instances during execution. This ensures tests are deterministic and do not rely on local infrastructure.
*   **Execution**:
    ```bash
    go test -v ./tests/e2e/...
    ```

## Build & Scripts

| Command | Description |
| :--- | :--- |
| `go mod download` | Fetch all project dependencies. |
| `go generate ./...` | Trigger code generation (Gqlgen, Protoc). |
| `go test ./...` | Run all unit and integration tests. |
| `go build -o main cmd/server/main.go` | Compile binary for production. |
| `air` | Start development server with live reload. |
