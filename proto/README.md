# Protocol Buffer Definitions

## Overview

This repository serves as the centralized source of truth for all gRPC service contracts and message schemas across the Real-time Bidding microservices ecosystem. By utilizing Protocol Buffers (proto3), we ensure strongly-typed, cross-language compatibility and high-performance binary serialization for internal service-to-service communication.

These definitions enable decouple development between services (e.g., Auction, Bidding, User, and Notification) while maintaining a strict interface contract that prevents integration regressions.

## Directory Structure

```text
proto/
├── auction.proto   # Auction service contracts and validation logic
├── bidding.proto   # Bidding history and user-specific bid tracking
└── user.proto      # Authentication, identity, and balance management
```

## Service Catalog

### Auction Service (`auction.proto`)
The `AuctionService` provides critical endpoints for auction lifecycle management and real-time validation.

| Method | Request | Response | Description |
| :--- | :--- | :--- | :--- |
| `ValidateAuctionForBid` | `ValidateAuctionRequest` | `ValidateAuctionResponse` | Validates if an auction is active and eligible for a specific bid amount/user. |
| `GetAuction` | `GetAuctionRequest` | `GetAuctionResponse` | Retrieves detailed metadata and current status for a specific auction. |

### Bidding Service (`bidding.proto`)
The `BiddingService` facilitates the retrieval of historical bid data for synchronization and reporting.

| Method | Request | Response | Description |
| :--- | :--- | :--- | :--- |
| `GetUserBids` | `GetUserBidsRequest` | `GetUserBidsResponse` | Retrieves all bids placed by a specific user on a specific auction. |

### User Service (`user.proto`)
The `UserService` handles identity orchestration, authentication flows, and financial balance integrity.

| Method | Request | Response | Description |
| :--- | :--- | :--- | :--- |
| `Register` | `RegisterRequest` | `RegisterResponse` | Handles user registration and initial JWT issuance. |
| `Login` | `LoginRequest` | `LoginResponse` | Authenticates users and returns session tokens. |
| `GetUser` | `GetUserRequest` | `GetUserResponse` | Retrieves individual user profile metadata. |
| `GetUsers` | `GetUsersRequest` | `GetUsersResponse` | Batch retrieval of user profiles for data enrichment. |
| `UpdateBalance` | `UpdateBalanceRequest` | `UpdateBalanceResponse` | Atomically modifies user balance (deposits/deductions). |

## Core Message Entities

The following messages represent the fundamental domain objects shared across the architecture:

- **User**: Contains identity metadata (ID, Email, Role) and atomic state (Balance).
- **Bid**: Encapsulates bid telemetry, including ID, Amount, and Creation Timestamp.
- **GetAuctionResponse**: Detailed snapshot of an auction's state, including current pricing and temporal constraints.

## Code Generation

### Prerequisites
To generate code from these definitions, ensure the following tools are installed:
- `protoc` (Protocol Buffers Compiler)
- Language-specific plugins:
  - `protoc-gen-go` / `protoc-gen-go-grpc` for Go.
  - `protoc-gen-ts` or `@nestjs/microservices` compatible tools for TypeScript.

### Sample Generation Commands

#### For Go
```bash
protoc --go_out=. --go_opt=paths=source_relative \
    --go-grpc_out=. --go-grpc_opt=paths=source_relative \
    proto/*.proto
```

#### For TypeScript (NestJS)
When using NestJS, the `@grpc/proto-loader` is typically utilized at runtime, but static types can be generated using `ts-proto`:
```bash
protoc --plugin=./node_modules/.bin/protoc-gen-ts_proto \
    --ts_proto_out=./src/generated \
    --ts_proto_opt=nestJs=true \
    proto/*.proto
```

## Consistency Standards

1. **Naming Conventions**: Fields must use `snake_case` to ensure cross-language compatibility.
2. **Package Versioning**: Future iterations should introduce versioned packages (e.g., `package auction.v1;`) to support breaking changes.
3. **Immutability**: Once a field number is assigned, it must never be changed or reused. Use the `reserved` keyword when deleting fields.
4. **Go Package Options**: All files must include an `option go_package` to specify the Go import path relative to the microservices repository.
