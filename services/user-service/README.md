# User Service

## Overview

The User Service is a mission-critical component of the real-time bidding microservices architecture, serving as the centralized authority for identity management, user profiles, and financial ledger operations. It manages the lifecycle of user accounts and maintains a highly consistent wallet system that tracks balances and transaction history. Within the distributed system, this service provides the source of truth for user data and facilitates secure authentication and authorization across all sibling services.

## Internal Architecture

The service implementation adheres to several key design patterns to ensure loose coupling, high cohesion, and maintainability:

*   **Modular Architecture**: Organized into functional domains (Auth, Users, Payment), each containing its own controllers, services, entities, and data transfer objects (DTOs).
*   **Repository Pattern**: Encapsulates data access logic, isolating the domain layer from the underlying persistence mechanism (PostgreSQL via TypeORM).
*   **Facade Pattern**: Utilized in the Auth module (`AuthServiceFacade`) to simplify complex authentication workflows and provide a unified interface to internal components.
*   **Adapter Pattern**: Implemented for external dependencies such as the password hashing mechanism (`PasswordServiceAdapter`) and third-party payment gateways.
*   **Transactional Management**: Leverages `typeorm-transactional` to ensure ACID compliance for critical operations, particularly wallet balance updates and transaction logging.

### Folder Structure

```text
src/
├── common/             # Cross-cutting concerns (Database configuration, i18n, common filters)
├── modules/
│   ├── auth/           # Authentication logic, JWT management, and identity interfaces
│   ├── payment/        # Wallet recharge logic, Stripe integration, and payment strategies
│   └── users/          # Core user profile management, balance tracking, and transaction history
├── app.module.ts       # Application root module configuring global providers and imports
└── main.ts             # Application entry point and microservice bootstrap configuration
```

## Tech Stack & Dependencies

| Category | Technology |
| :--- | :--- |
| **Framework** | NestJS |
| **Language** | TypeScript |
| **Database** | PostgreSQL |
| **ORM** | TypeORM |
| **Caching** | Redis (ioredis) |
| **Communication** | gRPC, NATS, GraphQL (Apollo Federation) |
| **Security** | JWT, bcrypt |
| **Validation** | class-validator, class-transformer |
| **Internationalization** | nestjs-i18n |
| **Payments** | Stripe SDK |

## Prerequisites

To maintain and develop the User Service locally, the following tools must be installed:

*   **Node.js**: Version 20.x or higher
*   **Docker & Docker Compose**: For containerized execution and dependency management
*   **Kubernetes (Minikube)**: If running within the orchestrated cluster
*   **Skaffold**: For automated development workflows in Kubernetes
*   **PostgreSQL**: Version 15 or higher (if running barefoot)
*   **Redis**: Version 7.0 or higher (if running barefoot)

## Environment Variables

| Variable | Type | Purpose | Sample Value |
| :--- | :--- | :--- | :--- |
| `PORT_USER` | Number | Service listening port | `3000` |
| `DB_HOST` | String | PostgreSQL database host | `user-db` |
| `DB_PORT` | Number | PostgreSQL database port | `5432` |
| `DB_USERNAME` | String | Database administrative user | `postgres` |
| `POSTGRES_PASSWORD` | String | Database user password | `********` |
| `DB_NAME` | String | Target database name | `user_db` |
| `REDIS_HOST` | String | Redis server host | `redis-service` |
| `REDIS_PORT` | Number | Redis server port | `6379` |
| `NATS_URL` | URL | NATS broker connection string | `nats://nats:4222` |
| `JWT_SECRET` | String | Secret key for JWT signing | `super_secret_key` |
| `JWT_EXPIRE` | String | Token expiration duration | `1d` |
| `STRIPE_SECRET_KEY` | String | Stripe API secret key | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | String | Stripe webhook verification secret | `whsec_...` |

## Setup & Execution

### Bare-metal Local Execution

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env # Ensure all variables are correctly populated

# 3. Start the application
npm run start:dev
```

### Containerized Execution via Docker

```bash
# Build the image
docker build -t user-service .

# Run the container (requires link to DB and Redis)
docker run --env-file .env -p 3000:3000 user-service
```

### Orchestration via Skaffold

```bash
# From the project root
skaffold dev --modules=user-service
```

## Communication Protocols & Contracts

### gRPC Services

The service exposes the `UserService` gRPC interface for internal high-performance communication.

*   **Proto File**: `proto/user.proto`
*   **Package**: `user`
*   **Port**: `50051`

| Method | Request | Response | Description |
| :--- | :--- | :--- | :--- |
| `GetUser` | `GetUserRequest` | `GetUserResponse` | Retrieves a single user by ID |
| `GetUsers` | `GetUsersRequest` | `GetUsersResponse` | Batch retrieval of users by ID list |
| `UpdateBalance` | `UpdateBalanceRequest` | `UpdateBalanceResponse` | Atomically increments or decrements user balance |

### GraphQL API (Apollo Federation)

The service acts as a federated subgraph at the `/user/graphql` endpoint.

| Operation | Type | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `getUserById` | Query | `UserResponse` | Fetch user profile by ID |
| `updateProfile` | Mutation | `UserResponse` | Update own profile information |
| `login` | Mutation | `AuthResponse` | Authenticate user and return JWT |
| `rechargeWallet` | Mutation | `UrlResponse` | Generate a Stripe checkout URL |

## Event-Driven Architecture (Message Broker)

The User Service utilizes NATS for asynchronous, decoupled communication.

### Subscribed Events

| Subject | Source | Expected Side Effect |
| :--- | :--- | :--- |
| `user.exists` | Auction/Bidding Service | Validates user existence during bid placement |
| `bid.outbid` | Bidding Service | Automatically refunds the outbid user's balance |
| `user.get.id` | Shared Components | Returns user details for internal enrichment |

## Data & Caching Strategy

### Database Schema

The service manages the following primary entities in PostgreSQL:

*   **Users**: Stores identity details, credentials (hashed), roles, and current balance.
*   **Transactions**: An audit log of every financial operation (Credit/Debit), linked to a specific user and transaction status.

### Distributed Caching

Distributed caching is implemented via Redis to optimize performance and reduce database load:

*   **Cache-Aside Pattern**: User profiles are cached for 24 hours. Read operations check Redis before querying PostgreSQL.
*   **Cache Invalidation**: Every write operation (update profile, update balance) triggers an automatic cache eviction or update to ensure data consistency.
*   **Aggregated Data**: Computed statistics like Monthly User Growth are cached with a fixed TTL to reduce computation overhead.

## Testing Strategy

### Unit Testing

Unit tests focus on isolating business logic within services and resolvers.

*   **Methodology**: Utilizing NestJS testing utilities to provide mocked dependencies for repositories and external services.
*   **Execution**:
    ```bash
    npm run test
    ```

### End-to-End (E2E) Testing

E2E tests validate the entire request-response pipeline, including database persistence and middleware execution.

*   **Methodology**: Leverages **Testcontainers** to spin up an isolated, ephemeral PostgreSQL instance during test execution. This ensures tests are deterministic and do not interfere with development data.
*   **Execution**:
    ```bash
    npm run test:e2e
    ```

## Build & Scripts

| Script | Description |
| :--- | :--- |
| `npm run build` | Compiles the TypeScript code into the `dist/` directory |
| `npm run start:dev` | Starts the service in watch mode for development |
| `npm run test` | Executes all Jest unit tests |
| `npm run test:e2e` | Executes end-to-end integration tests |
| `npm run lint` | Runs ESLint to enforce code style and catch static errors |
| `npm run format` | Automatically formats source code using Prettier |
