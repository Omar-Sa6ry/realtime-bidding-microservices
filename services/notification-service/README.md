# Notification Service

## Overview

The Notification Service is a critical component of the real-time bidding microservices architecture, responsible for orchestrating multidimensional delivery of system alerts, auction updates, and real-time user engagement. It functions as a centralized notification engine that aggregates events from the internal message bus (NATS), processes them through a context-aware strategy layer, and delivers updates via GraphQL Subscriptions (WebSockets) and persistent storage.

Designed with high availability and low latency in mind, the service ensures that stakeholders receive immediate feedback on auction states, bid status, and system-wide notifications, maintaining a consistent state across the distributed system.

## Internal Architecture

The service adheres to NestJS modular design principles combined with an interface-driven approach to ensure loose coupling and high cohesion:

- **Modules Layer**: Segregates business domains (Auction, User, Notification) and infrastructure concerns (gRPC, PubSub).
- **Strategy Pattern**: Implemented within the notification module to encapsulate content generation logic for diverse event types (e.g., `BidCreatedStrategy`, `OutbidStrategy`).
- **Repository Pattern**: Abstracts database operations, ensuring the domain logic remains independent of the underlying persistence layer (Mongoose/MongoDB).
- **Adapter Layer**: Facilitates communication with external services through gRPC clients and third-party delivery systems (e.g., Email).
- **Context Management**: Robust GraphQL context factory handles authentication across both HTTP and WebSocket transports.

```text
src/
├── common/             # Shared filters, interceptors, and translation modules
├── modules/
│   ├── notification/   # Core domain: logic, repositories, and strategies
│   ├── grpc/           # Client configuration for User and Auction services
│   ├── pubsub/         # Redis-backed Pub/Sub for real-time broadcasts
│   └── user/           # User-related domain context and DTOs
└── main.ts             # Service entry point and microservice configuration
```

## Tech Stack & Dependencies

### Core Frameworks
- **NestJS**: Enterprise-grade Node.js framework for scalable server-side applications.
- **GraphQL**: Apollo Federation v2 for distributed schema management.
- **gRPC**: High-performance RPC framework for internal service-to-service communication.

### Persistence & Messaging
- **MongoDB (Mongoose)**: Document-oriented database for notification persistence.
- **Redis**: High-speed in-memory store utilized for GraphQL subscriptions and caching.
- **NATS**: Distributed messaging system for asynchronous event-driven communication.

### Key Libraries
- **@bts-soft/notifications**: Internal framework for standardized notification handling.
- **@bidding-micro/shared**: Shared domain entities and utility functions.
- **ioredis**: Robust Redis client for Node.js.
- **nestjs-i18n**: Internationalization support for localized notification content.

## Prerequisites

- **Node.js**: v18.x or higher
- **Docker & Docker Compose**: For containerized deployment and dependency management
- **MongoDB**: v6.0+ instance
- **NATS Server**: For event-driven orchestration
- **Redis**: v7.0+ for Pub/Sub functionality

## Environment Variables

| Variable | Type | Purpose | Sample Value |
| :--- | :--- | :--- | :--- |
| `PORT_NOTIFICATION` | Number | Service listener port | `3004` |
| `MONGO_URI` | String | MongoDB connection string | `mongodb://user:pass@mongo:27017/notifications` |
| `NATS_URL` | String | NATS server connection URL | `nats://nats-srv:4222` |
| `REDIS_HOST` | String | Redis server hostname | `redis-srv` |
| `REDIS_PORT` | Number | Redis server port | `6379` |
| `USER_GRPC_URL` | String | User Service gRPC endpoint | `user-srv:50051` |
| `AUCTION_GRPC_URL` | String | Auction Service gRPC endpoint | `auction-srv:50052` |

## Setup & Execution

### Bare-Metal Local Execution

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure external dependencies (MongoDB, NATS, Redis).
3. Start the service in development mode:
   ```bash
   npm run start:dev
   ```

### Containerized Execution (Docker)

Build and run the service using the provided Dockerfile:
```bash
docker build -t notification-service .
docker run -p 3004:3004 --env-file .env notification-service
```

### Orchestration via Skaffold

Integration with Kubernetes is managed via Skaffold for rapid development:
```bash
skaffold dev --modules=notification-service
```

## Communication Protocols & Contracts

### gRPC Consumption

The service consumes the following gRPC contracts for data enrichment:

- **User Service (`user.proto`)**: Fetches user identity and preferences.
- **Auction Service (`auction.proto`)**: Validates auction status and retrieves metadata for notifications.

### GraphQL API

The service exposes a Federated GraphQL Subgraph with the following primary operations:

#### Queries
- `getUserNotifications`: Retrieves a paginated list of notifications for the authenticated user.
- `getUnreadNotificationCount`: Returns the count of unread notifications.

#### Mutations
- `markNotificationAsRead`: Updates a specific notification status.
- `markAllNotificationsAsRead`: Batch updates for user notifications.
- `deleteNotification`: Removes a specific notification record.

#### Subscriptions (Real-time)
- `notificationCreated`: Real-time stream of new notifications via WebSockets.
- `aiMessageChunk`: Stream for AI-generated localized content chunks.

## Event-Driven Architecture (Message Broker)

The service subscribes to internal system events via NATS to trigger notification workflows:

| Subject | Payload Structure | Triggered Action |
| :--- | :--- | :--- |
| `bid.created` | `{ auctionId, userId, amount }` | Persists bid confirmation and notifies user |
| `bid.outbid` | `{ auctionId, userId, oldMaxAmount }` | Alerts the previous high bidder |
| `auction.ended` | `{ auctionId, winnerId, finalAmount }` | Notifies the winner and participants |
| `bid.won` | `{ auctionId, winnerId, amount }` | Specific notification for auction victory |
| `ai.message.chunk` | `{ chunk, isFinal, threadId, userId }` | Broadcasts real-time AI response fragments |

## Data & Caching Strategy

### MongoDB Persistence
The `Notification` entity stores immutable notification history, categorized by type and associated with a unique user ID. TTL indexes are recommended for high-volume environments to manage storage lifecycle.

### Redis Pub/Sub
Redis is the backbone of the service's real-time capabilities. It handles:
- **Subscription Broadcasting**: Synchronizing notifications across multiple service instances for WebSocket delivery.
- **Caching**: Storing ephemeral session-related data to reduce database load during peak traffic.

## Testing Strategy

### Unit Testing
Unit tests focus on isolating domain logic and strategies. Mock objects are utilized for the Repository and gRPC adapters through NestJS Dependency Injection.
- Command: `npm run test`

### End-to-End (E2E) Testing
E2E tests validate the complete notification pipeline, from NATS event consumption to GraphQL Subscription delivery.
- **Infrastructure**: Utilizes **Testcontainers** to spawn ephemeral instances of MongoDB, NATS, and Redis during the test lifecycle.
- **Execution**: Ensures integration between the NestJS app, message broker, and databases is consistent.
- Command: `npm run test:e2e`

## Build & CI/CD Scripts

The following scripts facilitate development and deployment workflows:

| Script | Command | Description |
| :--- | :--- | :--- |
| `build` | `nest build` | Compiles the TypeScript source to production-ready JS |
| `start:dev` | `nest start --watch` | Launches service with hot-reload for development |
| `test` | `jest` | Executes the unit test suite |
| `test:e2e` | `jest --config ./test/jest-e2e.json` | Executes the full E2E integration tests |
| `lint` | `eslint "{src,test}/**/*.ts" --fix` | Performs static code analysis and auto-formatting |
| `format` | `prettier --write "src/**/*.ts"` | Ensures consistent code styling |
