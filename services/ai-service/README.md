# AI-Service

This document provides a comprehensive technical overview and operational guide for the AI-Service, a mission-critical component of the real-time bidding microservices architecture.

## 1. Title and Overview

The AI-Service is a high-performance microservice designed to facilitate intelligent, context-aware interactions within the bidding ecosystem. It leverages advanced Large Language Models (LLMs) to provide real-time assistance, auction analysis, and automated user support.

In the distributed architecture, the AI-Service acts as a specialized utility that:
- Orchestrates communication with Google Gemini AI models.
- Manages persistent chat threads and message history for users and auctions.
- Synchronizes with Auction and Bidding services via gRPC to retrieve domain-specific context.
- Streams real-time response fragments to frontend clients using NATS messaging.

## 2. Internal Architecture

The service is built on the NestJS framework, adhering to modularity, loose coupling, and high cohesion principles. It implements a layered architecture inspired by Clean Architecture and SOLID principles.

### Directory Structure

| Path | Responsibility |
| :--- | :--- |
| `src/common` | Global filters, guards, interceptors, and shared utilities. |
| `src/modules/ai` | Data persistence layer containing MongoDB schemas and repositories. |
| `src/modules/gemini` | Core business logic, LLM adapters, and prompt engineering strategies. |
| `src/modules/grpc` | gRPC client implementations for inter-service communication. |
| `src/modules/nats` | Messaging infrastructure for event emission and consumption. |
| `src/modules/user` | User domain bridge and authorization logic. |

### Design Patterns

- **Adapter Pattern**: Used in `GeminiProviderAdapter` to abstract the underlying AI provider, allowing for seamless transitions between different LLM versions or providers.
- **Strategy Pattern**: Implemented in `PromptFactory` to build dynamic system instructions based on the specific interaction context (e.g., auction support vs. general inquiry).
- **Dependency Injection**: Utilized throughout the service to manage lifecycle and facilitate unit testing through mocking.

## 3. Tech Stack & Dependencies

| Category | Technology |
| :--- | :--- |
| Core Framework | NestJS (Node.js) |
| AI Engine | Google Generative AI (Gemini 1.5/2.0 Flash/Pro) |
| Primary API | GraphQL (Apollo Federation) |
| Database | MongoDB (via Mongoose) |
| Distributed Cache | Redis (via ioredis) |
| Event Broker | NATS |
| Inter-service Comm | gRPC |
| Validation | Class-validator & Class-transformer |

## 4. Prerequisites

To execute and develop the AI-Service locally, the following environment components are required:

- Node.js (v18 or higher)
- Docker & Docker Compose
- MongoDB (v6.0+)
- NATS Server
- Redis (v7.0+)
- Valid Google Gemini API Key

## 5. Environment Variables

| Variable | Type | Purpose | Default |
| :--- | :--- | :--- | :--- |
| `PORT_AI` | Integer | HTTP listening port for the service | `3005` |
| `MONGO_URI` | String | MongoDB connection string | `mongodb://localhost:27017/ai` |
| `REDIS_HOST` | String | Redis server hostname | `localhost` |
| `REDIS_PORT` | Integer | Redis server port | `6379` |
| `NATS_URL` | String | NATS broker connection URL | `nats://localhost:4222` |
| `GEMINI_API_KEY` | String | **Required** Google Gemini API key | N/A |
| `GEMINI_MODEL` | String | Primary model used for generation | `gemini-1.5-flash` |
| `USER_GRPC_URL` | String | Endpoint for the User-Service gRPC | `user-srv:50051` |
| `AUCTION_GRPC_URL` | String | Endpoint for the Auction-Service gRPC | `auction-srv:50052` |
| `BIDDING_GRPC_URL` | String | Endpoint for the Bidding-Service gRPC | `bidding-srv:50053` |
| `JWT_SECRET` | String | Secret key for JWT verification | N/A |

## 10. Setup & Execution

### Bare-metal Local Execution
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables in a `.env` file based on the table above.
3. Start the service in development mode:
   ```bash
   npm run start:dev
   ```

### Containerized Execution (Docker)
Build and run the service using the provided Dockerfile:
```bash
docker build -t ai-service .
docker run -p 3005:3005 --env-file .env ai-service
```

### Orchestration (Skaffold)
If running within the complete microservices cluster:
```bash
skaffold dev --modules=ai-service
```

## 7. Communication Protocols & Contracts

### GraphQL API
The service exposes a GraphQL endpoint for client-facing operations.

| Operation | Type | Input | Description |
| :--- | :--- | :--- | :--- |
| `sendMessage` | Mutation | `SendMessageInput` | Initiates a chat message and triggers AI response streaming. |
| `getUserChatThreads` | Query | `PaginationInput` | Retrieves a paginated list of chat threads for the current user. |
| `getChatMessages` | Query | `threadId`, `Pagination` | Retrieves the message history for a specific thread. |

#### Sample Mutation
```graphql
mutation {
  sendMessage(input: {
    auctionId: "auc_123",
    text: "What is the current status of this auction?",
    language: "en"
  }) {
    success
    data {
      threadId
      isFinal
    }
  }
}
```

### gRPC Client Contracts
The service consumes external gRPC services to gather context. Contracts are defined in `.proto` files located in the shared repository directory.

- **User Service**: `getUser` (Retrieves profile and permission data).
- **Auction Service**: `getAuction` (Retrieves item details, status, and rules).
- **Bidding Service**: `getUserBids` (Retrieves user participation history).

## 8. Event-Driven Architecture

The service utilizes NATS for high-throughput, low-latency communication.

| Event Subject | Action | Payload Structure |
| :--- | :--- | :--- |
| `ai.message.chunk` | Published | `{ userId: string, threadId: string, chunk: string, isFinal: boolean }` |

The `ai.message.chunk` event is published repeatedly during the AI generation process to provide a streaming experience to the end-user.

## 9. Data & Caching Strategy

### Data Persistence
MongoDB is the system of record for all AI interactions.
- **ChatThreads**: Stores metadata about a conversation, including the associated `userId` and `auctionId`.
- **ChatMessages**: Stores individual message entities with roles (`user`, `model`) and timestamps. Indexed by `threadId` and `createdAt` for fast retrieval.

### Caching
Redis is utilized for:
- **Rate Limiting**: Throttling requests to prevent LLM API exhaustion.
- **Session State**: Temporary storage of user session metadata.
- **PubSub Subscriptions**: Coordination of real-time events across multiple service instances.

## 10. Testing Strategy

### Unit Testing
Unit tests focus on isolating domain logic within services and adapters.
- **Methodology**: Extensive use of `jest.mock()` to isolate external dependencies such as the Mongoose models, NATS client, and Google Generative AI SDK.
- **Dependency Injection**: Mock providers are injected via `Test.createTestingModule`.
- **Command**:
  ```bash
  npm run test
  ```

### End-to-End (E2E) Testing
E2E tests validate the complete request-response lifecycle, including database persistence and message emission.
- **Methodology**: Utilizes **Testcontainers** to spin up ephemeral Docker containers for MongoDB, Redis, and NATS. This ensures a clean, isolated environment for every test run.
- **Mocking**: External microservices (gRPC) are mocked using NestJS provider overrides within the test context.
- **Command**:
  ```bash
  npm run test:e2e
  ```

## 11. Build & CI/CD Scripts

| Script | Command | Description |
| :--- | :--- | :--- |
| `build` | `nest build` | Compiles the TypeScript code into the `dist` directory. |
| `format` | `prettier --write` | Standardizes code formatting. |
| `lint` | `eslint --fix` | Performs static analysis and applies automatic fixes. |
| `test` | `jest` | Executes unit tests. |
| `test:e2e` | `jest --config ./test/jest-e2e.json` | Executes end-to-end tests using Testcontainers. |
| `test:cov` | `jest --coverage` | Generates a code coverage report. |
| `start:prod` | `node dist/main` | Runs the compiled production build. |
