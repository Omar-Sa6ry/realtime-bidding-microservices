# API-Gateway

The API-Gateway serves as the centralized orchestration layer and the single entry point for the Real-time Bidding Microservices architecture. It leverages Apollo Federation to aggregate multiple downstream subgraphs into a unified GraphQL schema, providing a seamless interface for client-side applications. Beyond simple request routing, it implements critical cross-cutting concerns including security auditing, protocol translation, and resilient service discovery.

## Internal Architecture

The service is built on the NestJS framework and follows a modular design focused on high performance and loose coupling.

### Folder Structure Overview

- `src/main.ts`: Entry point responsible for service bootstrapping, environment configuration, and the implementation of a high-performance WebSocket proxy for GraphQL subscriptions.
- `src/app.module.ts`: Central configuration hub where the Apollo Federation Gateway is initialized, subgraphs are defined, and global interceptors are registered.
- `src/common/interceptors/`: Contains security and logic-related interceptors, such as the `SqlInjectionInterceptor` which sanitizes all incoming GraphQL arguments.
- `Dockerfile`: Multi-stage build configuration for containerized deployment.

### Design Patterns

- **Gateway Aggregation Pattern**: Consolidates multiple microservices into a single API surface.
- **Interceptor Pattern**: Utilized for cross-cutting concerns like SQL injection protection and error normalization.
- **Remote Data Source Pattern**: Implemented to manage downstream communication, enabling header propagation (e.g., Authorization, Language) across the distributed system.
- **Proxy Pattern**: Specialized WebSocket proxying to handle real-time subscription traffic from clients to the notification subsystem.

## Tech Stack & Dependencies

| Component | Technology |
| :--- | :--- |
| **Core Framework** | NestJS v11.0.0 |
| **API Protocol** | GraphQL (Apollo Federation) |
| **Gateway Driver** | Apollo Gateway Driver |
| **Real-time Traffic** | WebSocket (ws) |
| **Language** | TypeScript v5.7.0 |
| **Security** | Custom SQL Injection Regex Sanitizers |
| **Runtime** | Node.js v24.11.0 |

## Prerequisites

Before starting the service, ensure the following tools are installed:

- **Node.js**: Version 24.11.0 or higher.
- **npm**: Version 10.x or higher.
- **Docker**: For containerized execution.
- **Kubernetes (Local)**: Recommended (e.g., Kind or Minikube) for full architecture testing.
- **Skaffold**: Required for orchestrated local development.

## Environment Variables

| Variable | Type | Purpose | Sample Value |
| :--- | :--- | :--- | :--- |
| `PORT_GATEWAY` | Integer | Network port for the Gateway service | `4000` |
| `NOTIFICATION_WS_URL` | String | WebSocket endpoint for subscription proxying | `ws://notification-srv:3004/graphql` |
| `NODE_ENV` | String | Application environment mode | `development` |
| `USER_SERVICE_URL` | String | Internal gRPC/URL for User service (Orchestration) | `user-srv:50051` |

## Setup & Execution

### Bare-metal Local Execution

1.  **Install Dependencies**:
    ```bash
    npm install --legacy-peer-deps
    ```
2.  **Start in Development Mode**:
    ```bash
    npm run start:dev
    ```
3.  **Access GraphQL Playground**:
    The playground is available at `http://localhost:4000/graphql`.

### Containerized Execution (Docker)

1.  **Build Image**:
    ```bash
    docker build -t bidding/api-gateway -f services/api-gateway/Dockerfile .
    ```
2.  **Run Container**:
    ```bash
    docker run -p 4000:4000 bidding/api-gateway
    ```

### Orchestration via Kubernetes/Skaffold

The API-Gateway is integrated into the root `skaffold.yaml` configuration. To run the entire ecosystem:

```bash
skaffold dev
```

## Communication Protocols & Contracts

### GraphQL Federation

The Gateway aggregates the following subgraphs into a unified Supergraph:

| Service | Protocol | Endpoint | Primary Responsibility |
| :--- | :--- | :--- | :--- |
| **User-Service** | HTTP/GraphQL | `http://user-srv:3000/user/graphql` | Identity and Profile management |
| **AI-Service** | HTTP/GraphQL | `http://ai-srv:3005/graphql` | Intelligent bidding suggestions |
| **Notification-Service** | HTTP/GraphQL | `http://notification-srv:3004/graphql` | Real-time alerts and Subscriptions |
| **Auction-Service** | HTTP/GraphQL | `http://auction-srv:3002/graphql` | Core auction lifecycle |
| **Bidding-Service** | HTTP/GraphQL | `http://bidding-srv:3003/graphql` | Bid placement and logic |

### WebSocket Proxy (Subscriptions)

The Gateway implements a custom WebSocket upgrade handler that proxies `graphql-transport-ws` and `graphql-ws` protocols. It intercepts connection requests on `/graphql` and forwards them to the `notification-service`, preserving authentication headers during the handshake.

## Event-Driven Architecture (Message Broker)

While the API-Gateway does not directly publish domain events to the message broker, it acts as the egress point for the Event-Driven architecture by managing real-time subscriptions.

| Feature | Protocol | Description |
| :--- | :--- | :--- |
| **Subscription Egress** | WebSocket | Proxies real-time events from NATS-backed services to connected clients. |
| **Auth Propagation** | Headers | Forwards JWT tokens from the client handshake to the downstream subscription server. |

## Data & Caching Strategy

The API-Gateway is a **stateless service**. It does not own a primary database.

- **Persistence**: None. It relies on downstream services for data residency.
- **Caching**: The Gateway utilizes Apollo's internal introspection caching to optimize query planning and reduce overhead during supergraph composition.
- **Security Interception**: All incoming data is processed through the `SqlInjectionInterceptor` which performs deep object inspection to block malicious payloads before they reach downstream subgraphs.

## Testing Strategy

### Unit Testing

Unit testing for the Gateway focuses on the logic of interceptors and utility functions.

- **Methodology**: Isolating the `SqlInjectionInterceptor` logic using Jest to verify regex patterns against various attack vectors.
- **Execution Command**:
  ```bash
  npm run test
  ```

### End-to-End (E2E) Testing

E2E testing is performed at the system level. The Gateway's role is verified by ensuring that the federated schema is correctly composed and that cross-service queries (e.g., fetching an auction with its owner details) resolve successfully.

- **Service Resiliency**: The Gateway implements a `waitForService` strategy during bootstrap, which polls downstream services until they are ready, ensuring high availability in distributed environments.
- **Execution Command**:
  Refer to the root repository documentation for the full system E2E test suite.

## Build & CI/CD Scripts

| Script | Description |
| :--- | :--- |
| `npm run build` | Compiles the TypeScript source into the `dist` directory. |
| `npm run start` | Executes the compiled application. |
| `npm run start:dev` | Starts the service in watch mode with automatic reloads. |
| `npm run format` | Runs Prettier to ensure code style consistency across the service. |
| `npm run lint` | Performs static analysis to identify potential code quality issues. |
