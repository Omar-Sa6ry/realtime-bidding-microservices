# Kubernetes Infrastructure

This directory contains the Kubernetes manifest files required to deploy and manage the Real-time Bidding Microservices architecture. The system is designed as a distributed set of services coordinated through an API Gateway and an Ingress controller, utilizing NATS for event-driven communication and MongoDB for persistence.

## Architecture Overview

The infrastructure is composed of several functional layers:
1.  **Routing Layer**: Handles external requests and routes them to the appropriate services.
2.  **Application Layer**: Contains the core logic for auctions, bidding, users, notifications, and AI.
3.  **Data Layer**: Dedicated MongoDB instances for each service and a shared Redis cache.
4.  **Messaging Layer**: NATS Streaming for reliable event distribution.
5.  **Configuration Layer**: Secrets and environment variables for sensitive data management.

## Component Breakdown

### 1. Core Services

Each core service is typically accompanied by a database deployment and a secret management manifest.

| Service | Deployment File | Database File | Secrets File | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Auction** | `auction-depl.yaml` | `auction-db-depl.yaml` | `auction-secrets.yaml` | Manages auction lifecycles. |
| **Bidding** | `bidding-depl.yaml` | `bidding-db-depl.yaml` | `bidding-secrets.yaml` | Handles real-time bid placements. |
| **User** | `user-depl.yaml` | `user-db-depl.yaml` | N/A | Manages user profiles and authentication. |
| **Notification** | `notification-depl.yaml` | `notification-db-depl.yaml` | `notification-secrets.yaml` | Handles system alerts and messages. |
| **AI** | `ai-depl.yaml` | `ai-db-depl.yaml` | `ai-secrets.yaml` | AI-driven insights and features. |

### 2. Networking and Gateway

*   **`api-gateway-depl.yaml`**: Deploys the API Gateway which acts as the single entry point for the microservices, aggregating responses and handling cross-cutting concerns.
*   **`ingress-srv.yaml`**: Configures the NGINX Ingress Controller. It defines routing rules for `bidding.test`, mapping paths to internal services and managing TLS termination.

### 3. Shared Infrastructure

*   **`nats-depl.yaml`**: Deploys the NATS Streaming server using the `nats-streaming:0.17.0` image. It manages message bus communication for the entire cluster.
*   **`redis-depl.yaml`**: Deploys a Redis instance for high-performance caching and distributed state management.

### 4. Shared Configuration

*   **`secrets.yaml`**: Contains global secret definitions shared across multiple components in the cluster.

## Deployment Strategy

### Persistent Storage
The database deployments (`*-db-depl.yaml`) utilize `PersistentVolumeClaims` to ensure data durability across pod restarts. Each database has its own isolated storage volume.

### Service Discovery
Internal communication is handled via Kubernetes Services (ClusterIP). For example, the Auction service is accessible via `auction-srv:3002`.

### Environment Configuration
Sensitive values such as database credentials and JWT secrets are injected into pods using `SecretKeyRef` to ensure they are not exposed in plaintext within the deployment manifests.

## Usage

To deploy the entire infrastructure to a Kubernetes cluster (e.g., Minikube or GKE):

1.  Ensure you have a running Kubernetes cluster.
2.  Apply all manifests in the directory:
    ```bash
    kubectl apply -f k8s/
    ```
3.  Expose the Ingress controller (if using Minikube):
    ```bash
    minikube tunnel
    ```
4.  Add the host entry to your `/etc/hosts` (or equivalent):
    ```text
    127.0.0.1 bidding.test
    ```

## Development and Observation

For local development with hot-reloading and automated synchronization, it is recommended to use **Skaffold** in conjunction with these manifests:

```bash
skaffold dev
```
