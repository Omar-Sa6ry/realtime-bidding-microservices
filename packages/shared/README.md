# @bidding-micro/shared

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/Omar-Sa6ry/realtime-bidding-microservices)
[![NestJS](https://img.shields.io/badge/framework-NestJS-red)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-blue)](https://www.typescriptlang.org/)
[![NATS](https://img.shields.io/badge/messaging-NATS-cyan)](https://nats.io/)

A highly optimized, technical utility package providing shared infrastructure, decorators, guards, and communication abstractions for the real-time bidding microservices architecture. This package ensures consistency, security, and standardized error handling across all backend services.

## Architecture & Core Concepts

The `@bidding-micro/shared` package is designed as a core dependency for a distributed Microservices architecture. It adheres to the following principles:

*   **SOLID Principles**: Ensuring modular, extensible, and maintainable cross-cutting concerns.
*   **Decoupled Communication**: Leveraging NATS for event-driven and request-reply messaging patterns, abstracted through a unified service layer.
*   **Centralized Security**: Implementing Role-Based Access Control (RBAC) and permission validation at the shared level to ensure uniform security policies.
*   **Standardized Error Mapping**: Employing custom gRPC exception filters to bridge the gap between HTTP status codes and gRPC status codes in inter-service communication.

## Key Features

*   **Standardized NATS Client**: A robust wrapper around NestJS NATS ClientProxy supporting both fire-and-forget (emit) and request-reply (send) patterns with built-in logging.
*   **Role-Based Access Control (RBAC)**: Comprehensive Guard implementation for validating JWT-based roles and permissions across GraphQL and REST contexts.
*   **Advanced gRPC Exception Filter**: Automated mapping of HTTP status codes (400, 401, 403, 404, 409, 429) to corresponding gRPC status codes.
*   **Custom Parameter Decorators**: Intuitive decorators for accessing the current authenticated user context within GraphQL resolvers.
*   **Unified DTOs and Interfaces**: Shared definitions for user entities and data transfer objects to maintain type safety throughout the system.
*   **Centralized Messaging**: Consistent error and system message constants to facilitate internationalization and logging.

## Technology Stack

### Backend & Logic
*   **NestJS**: Core framework for generating modular and injectable utilities.
*   **TypeScript**: Ensuring strict type safety and high development velocity.
*   **RxJS**: Managing asynchronous data flows and event streams.

### Messaging & Communication
*   **NATS**: High-performance messaging system for event-driven architecture.
*   **gRPC**: Used for high-speed, low-latency inter-service communication.

### Tools & Utilities
*   **Jest**: Unit testing framework for ensuring reliability of core components.
*   **TypeScript Compiler (TSC)**: Used for transpiling the source into production-ready JavaScript artifacts.

## Implementation Deep-Dive

### NATS Communication Service (`NatsService`)
The `NatsService` is a technical abstraction over the NestJS `ClientProxy`, optimized for reliable inter-service messaging. It encapsulates the complexities of Reactive Streams (RxJS) to provide a standard Promise-based API.

*   **Request-Reply Pattern (`send<TResponse>`)**: Utilizing the `firstValueFrom` utility to convert the `Observable` returned by the NATS client into a `Promise`. This method ensures that call sites can utilize `async/await` syntax for synchronous-like request-reply communication. It includes comprehensive error trapping to log failure patterns before propagating exceptions.
*   **Event Emission (`emit`)**: Implements fire-and-forget logic for asynchronous event distribution. The implementation carefully wraps the base `emit` call in a try-catch block to prevent messaging failures from disrupting the primary execution flow of the host service, maintaining high availability.

### Inter-protocol Exception Mapping (`GrpcExceptionFilter`)
This component facilitates protocol interoperability by translating high-level application errors into the low-latency gRPC status specification.

*   **Status Code Normalization**: The filter intercepts exceptions and extracts diagnostic data from `status` or `statusCode` properties.
*   **Logic Mapping**: A systematic `switch` construct evaluates HTTP-standard error codes and maps them to gRPC `status` enums:
    *   `400 Bad Request` -> `INVALID_ARGUMENT`
    *   `401 Unauthorized` -> `UNAUTHENTICATED`
    *   `403 Forbidden` -> `PERMISSION_DENIED`
    *   `404 Not Found` -> `NOT_FOUND`
    *   `409 Conflict` -> `ALREADY_EXISTS`
    *   `429 Too Many Requests` -> `RESOURCE_EXHAUSTED`
    *   Unknown errors default to `INTERNAL` (13).
*   **Telemetry**: Every trapped exception is logged with a structured signature `[gRPC Error] {Code}: {Message}` for centralized monitoring.

### Declarative Security Layer (`RoleGuard`)
The `RoleGuard` provides a centralized enforcement point for Role-Based Access Control (RBAC) and Permission-Based Access Control (PBAC).

*   **Context Discovery**: Implements `CanActivate` and utilizes the `Reflector` service to dynamically discover security requirements attached to class handlers or methods via `@Roles()` and `@Permissions()` decorators.
*   **Authentication Pipeline**:
    1.  **Token Extraction**: Isolates the Bearer token from the `Authorization` header.
    2.  **Verification**: Validates the JWT against the shared `JWT_SECRET`, handling expiration and signature mismatches.
    3.  **User Provisioning**: Resolves the full user profile via the injected `USER_SERVICE` (referenced via injection token for modularity).
*   **Validation Logic**:
    *   **Role Check**: Ensures the user's primary role matches any of the required identifiers.
    *   **Permission Check**: Performs a deep comparison between the user's inherited permissions (mapped from their role via `rolePermissionsMap`) and the specific permissions required for the execution context.
*   **Request Augmentation**: Upon successful validation, the guard attaches the sanitized user object and their calculated permissions to the `Request` object, making it accessible to downstream resolvers and controllers.

## Prerequisites

Before interacting with this package, ensure the following environment is established:

*   **Node.js**: Version 18.x or later.
*   **NPM**: Version 9.x or later.
*   **Environment**: A Unix-like or Windows development environment.

## Installation & Setup

To integrate or work locally on the shared package, follow these technical steps:

### Cloning the Repository
```bash
git clone https://github.com/Omar-Sa6ry/realtime-bidding-microservices.git
cd realtime-bidding-microservices/packages/shared
```

### Dependency Installation
```bash
npm install
```

### Building the Package
To compile the TypeScript source into the `dist` directory:
```bash
npm run build
```

## Testing

The package includes a robust suite of unit tests focusing on core logic, including guards, filters, and services.

### Running Unit Tests
```bash
npm run test
```

### Coverage Analysis
To generate a comprehensive coverage report documenting the percentage of logic tested:
```bash
npm run test:cov
```

## Deployment

As a shared library, this package is intended to be consumed by other services within the monorepo.

### Local Development Reference
Services can reference this package locally within the monorepo using npm workspaces or by installing it directly from the local path.

### Production Release
In a CI/CD context, this package is typically published to a private npm registry or built as part of the Docker image layer for dependent microservices.

## Folder Structure

```text
shared/
├── src/
│   ├── constants/           # Enumerations and static message strings
│   ├── decorators/          # Custom parameter and method decorators
│   ├── dtos/                # Data Transfer Objects for validation
│   ├── filters/             # Exception filters for protocol mapping (gRPC)
│   ├── guard/               # RBAC and Permission guards
│   ├── interfaces/          # TypeScript interface definitions
│   ├── modules/             # NestJS module definitions
│   ├── nats/                # NATS communication service and types
│   └── index.ts             # Primary barrel file for all exports
├── dist/                    # Compiled JavaScript artifacts (after build)
├── package.json             # Package metadata and dependencies
└── tsconfig.json            # TypeScript compiler configuration
```

## Contributing Guidelines

Standardized contribution workflows are required to maintain package integrity:

1.  **Branching**: Create feature branches from `main` using the format `feature/shared-[ticket-id]`.
2.  **Linting**: Ensure all code adheres to the project's Prettier and ESLint configurations.
3.  **Testing**: New logic must be accompanied by corresponding `.spec.ts` files with substantial coverage.
4.  **Pull Requests**: PRs must pass all automated CI checks and receive peer review approval before merging.
