# Development and Operations Guide

This document contains the necessary commands to set up, run, and test the Real-Time Bidding Microservices ecosystem.

## **1. Environment Setup (Minikube)**

Initialize the Kubernetes cluster with the recommended driver and settings:

```powershell
# Start Minikube with Docker driver
minikube start --driver=docker --image-mirror-country=all --base-image=docker.io/kicbase/stable:v0.0.48

# Check status
minikube status

# Enable Ingress controller
minikube addons enable ingress

# Apply initial Kubernetes manifests
kubectl apply -f k8s

# Configure shell to use Minikube's Docker daemon
& minikube -p minikube docker-env | Invoke-Expression
```

## **2. Running the Ecosystem**

We use **Skaffold** for automated development workflow (build, push, deploy):

```powershell
# Start development mode with hot-reloading
skaffold dev --cache-artifacts=true --build-concurrency=0

# In a separate terminal, start the Minikube tunnel to expose services
minikube tunnel
```

## **3. Code Generation**

Generate GraphQL code and resolvers (for Go services):

```powershell
# Run gqlgen generator
go run github.com/99designs/gqlgen generate

# Cleanup Go modules
go mod tidy
```

## **4. Testing**

Run the comprehensive test suites:

```powershell
# Run End-to-End tests (NestJS services)
npm run test:e2e

# Run unit tests
npm run test
```
