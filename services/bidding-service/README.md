# Bidding Service

The Bidding Service is a critical component of the Real-time Bidding microservices architecture. It manages the lifecycle of bids, enforces bidding rules, ensures transactional integrity through distributed locking, and coordinates with the User and Auction services to facilitate secure and real-time electronic bidding.

## Internal Architecture

The service implementation follows **Clean Architecture** and **SOLID** principles, utilizing a decoupled layer-based structure:

*   **cmd/server**: Entry point for bootstrapping the application services and HTTP/NATS layers.
*   **graph**: GraphQL delivery layer including schema definitions, resolvers, and generated execution logic.
*   **internal/app**: Main application container responsible for dependency injection, infrastructure initialization, and graceful shutdown orchestration.
*   **internal/domains**: Core business logic, domain entities (`Bid`), and interface definitions.
*   **internal/services**: Use-case orchestration layer managing the coordination between repositories, gRPC clients, and event publishers.
*   **internal/repositories**: Data persistence implementations for MongoDB (durability) and Redis (real-time caching/locking).
*   **internal/broker**: Event-driven infrastructure implementation for NATS (Publish/Subscribe).
*   **internal/clients**: gRPC client implementations for inter-service communication with Identity and Auction services.
*   **internal/middlewares**: Transport-level logic for authentication (JWT), logging, and internationalization (i18n).
*   **internal/pkg**: Shared utilities including custom loggers and translation providers.

## Tech Stack & Dependencies

| Category | Technology |
| :--- | :--- |
| **Language** | Go 1.25 |
| **API Layer** | GraphQL (Gqlgen) |
| **Inter-Service Communication** | gRPC |
| **Primary Database** | MongoDB |
| **Distributed Cache & Locking** | Redis |
| **Messaging Infrastructure** | NATS |
| **Authentication** | JWT (JSON Web Token) |
| **Containerization** | Docker |
| **Testing Frameworks** | Testify, Testcontainers (Mongo, Redis, NATS) |

## Prerequisites

*   Go Runtime v1.25.5+
*   Docker & Docker Compose
*   Skaffold (Optional, for Kubernetes orchestration)
*   NATS Server Instance
*   MongoDB Instance
*   Redis Instance

## Environment Variables

| Variable | Type | Purpose | Sample Value |
| :--- | :--- | :--- | :--- |
| `PORT_BIDDING` | Integer | Service listener port for GraphQL | `3003` |
| `MONGO_URI` | String | Connection string for MongoDB | `mongodb://localhost:27017` |
| `DB_NAME` | String | Target database name | `bidding-bidding_service` |
| `REDIS_HOST` | String | Redis server hostname | `localhost` |
| `REDIS_PORT` | Integer | Redis server port | `6379` |
| `NATS_URL` | String | NATS server connection URL | `nats://localhost:4222` |
| `JWT_SECRET` | String | Secret for JWT validation | `secure-auth-secret` |
| `USER_SERVICE_URL` | String | gRPC endpoint for User Service | `user-srv:50051` |
| `AUCTION_SERVICE_URL` | String | gRPC endpoint for Auction Service | `auction-srv:50051` |

## Setup & Execution

### Bare-metal Local Execution
1. Install project dependencies:
   ```bash
   go mod download
   ```
2. Start the service with hot-reload enabled:
   ```bash
   air -c .air.toml
   ```

### Containerized Execution via Docker
1. Build the production-grade image:
   ```bash
   docker build -t bidding-service -f Dockerfile .
   ```
2. Launch the container:
   ```bash
   docker run -p 3003:3003 bidding-service
   ```

### Orchestration via Kubernetes/Skaffold
Deploy the service within a cluster:
```bash
skaffold dev
```

## Communication Protocols & Contracts

### gRPC Clients
The Bidding Service acts as a gRPC client to consume the following services:

| Target Service | RPC Method | Purpose |
| :--- | :--- | :--- |
| `AuctionService` | `ValidateAuctionForBid` | Verifies auction status and price before accepting bids. |
| `AuctionService` | `GetAuction` | Fetches auction metadata for bid history views. |
| `UserService` | `UpdateBalance` | Deducts funds for bids and refunds outbid users. |

### GraphQL API (External)
Exposed at `/graphql`.

| Operation | Type | parameters | Description |
| :--- | :--- | :--- | :--- |
| `placeBid` | Mutation | `auctionId`, `amount` | Places a new bid with distributed locking. |
| `getHighestBid` | Query | `auctionId` | Retrieves the current winning bid. |
| `getAuctionHistory` | Query | `auctionId`, `pagination` | List of all bids for a specific auction. |
| `getMyBids` | Query | `pagination` | Retrieves bids placed by the authenticated user. |

## Event-Driven Architecture (Message Broker)

The service leverages NATS for asynchronous communication and robust auction resolution.

| Event Subject | Type | Payload (JSON) | Trigger / Effect |
| :--- | :--- | :--- | :--- |
| `bid.created` | Published | `Bid` object | Triggered upon successful bid placement. |
| `bid.outbid` | Published | `{userId, amount}` | Notifies a user they have been outbid. |
| `bid.won` | Published | `Bid` object | Triggered after successful auction resolution. |
| `auction.ended` | Subscribed | `{id, sellerId}` | Initiates the `ResolveAuction` logic. |

## Data & Caching Strategy

### Persistent Storage
All bid records are stored in MongoDB. Indices are maintained on `auctionId` and `userId` to ensure high-performance query execution for history and user-specific views.

### Distributed Locking & Caching
Redis is utilized for:
1.  **Distributed Mutual Exclusion**: Prevents race conditions during simultaneous bid placements on the same auction using localized locks.
2.  **High-Performance Caching**: Stores the `highestBid` for every active auction to minimize MongoDB read pressure during rapid bidding intervals.

## Testing Strategy

### Unit Testing
Unit tests isolate domain logic from infrastructure dependencies.
*   **Methodology**: Interfaces are mocked using `stretchr/testify`. Dependency injection enables the replacement of physical repositories and gRPC clients with controlled mock objects.
*   **Execution Command**:
    ```bash
    go test ./internal/services/...
    ```

### End-to-End (E2E) Testing
Validates the integrated pipeline, including database persistence and message broker interactions.
*   **Methodology**: Utilizes **Testcontainers** to orchestrate managed instances of MongoDB, Redis, and NATS within the CI pipeline. This ensures zero-config, reproducible test environments.
*   **Execution Command**:
    ```bash
    go test -v ./tests/e2e/...
    ```

## Build & CI/CD Scripts

| Command | Description |
| :--- | :--- |
| `go mod tidy` | Cleans and synchronizes dependencies. |
| `go test ./...` | Executes the full test suite. |
| `go run github.com/99designs/gqlgen generate` | Generates GraphQL code from schema. |
| `go build -o server ./cmd/server` | Compiles the binary for deployment. |
| `docker build` | Packages the service for container orchestration. |
