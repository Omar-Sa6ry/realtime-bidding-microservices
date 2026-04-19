# Real-time Bidding Microservices - GraphQL Documentation

This directory contains reference GraphQL queries, mutations, and subscriptions for the various microservices in the system. These documents serve as a practical guide for developers and testers to interact with the API.

## Table of Contents
- [Authentication Service](#1-authentication-service-authgraphql)
- [Auction Service](#2-auction-service-auctiongraphql)
- [Bidding Service](#3-bidding-service-biddinggraphql)
- [User Service](#4-user-service-usergraphql)
- [Notification Service](#5-notification-service-notificationgraphql)
- [AI Assistant Service](#6-ai-assistant-service-aigraphql)
- [Payment Service](#7-payment-service-paymentgraphql)

---

### 1. Authentication Service (`auth.graphql`)
Responsible for identity management, security, and access control.
- **Key Operations**:
    - `register`: Create a new user profile.
    - `login`: Obtain access tokens.
    - `changePassword` / `resetPassword`: Security management.
    - `forgotPassword`: Trigger recovery emails.
    - `roleBasedLogin`: Access restricted areas (e.g., ADMIN).

### 2. Auction Service (`auction.graphql`)
Manages the creation and lifecycle of auctions.
- **Key Operations**:
    - `createAuction`: List new items with start/end times and prices.
    - `findAuctions`: Multi-criteria search with pagination.
    - `updateAuction` / `deleteAuction`: Lifecycle management for sellers/admins.

### 3. Bidding Service (`bidding.graphql`)
Handles the high-concurrency real-time bidding logic.
- **Key Operations**:
    - `placeBid`: Submit a bid (validated against current highest bid and user balance).
    - `getHighestBid`: Real-time check for the leading offer.
    - `getAuctionHistory`: Full audit trail of bids for a specific auction.
    - `getMyBids`: Tracking personal bidding activity.

### 4. User Service (`user.graphql`)
Detailed user profile management and administrative tools.
- **Key Operations**:
    - `getUserByOfMe`: Fetch current authenticated user's profile.
    - `getUsers`: Admin query for user listing and auditing.
    - `updateUser`: Profile information updates.
    - `UpdateUserRoleToAdmin`: Privilege escalation for system management.

### 5. Notification Service (`notification.graphql`)
Real-time alerts and communication.
- **Key Operations**:
    - `notificationCreated` (Subscription): Real-time WebSocket stream for new alerts.
    - `getUserNotifications`: Inbox management.
    - `markNotificationAsRead`: Acknowledge specific alerts.

### 6. AI Assistant Service (`ai.graphql`)
Integrated intelligent assistant for bidding advice and auction analysis.
- **Key Operations**:
    - `sendMessage`: Interact with the AI helper regarding specific auctions or financial advice.
    - `aiMessageChunk` (Subscription): Stream results for a smooth chat experience.
    - `getChatMessages` / `getUserChatThreads`: History and context management.

### 7. Payment Service (`payment.graphql`)
Financial transactions and wallet management.
- **Key Operations**:
    - `rechargeWallet`: Add funds to the user balance.

---

## Technical Instructions

### Authorization
Most operations (except registration and initial login) require a **Bearer Token**.
Add the following header to your requests:
```http
Authorization: Bearer <TOKEN_HERE>
```

### Tools
- **GraphQL Playground / Apollo Studio**: Often available at the `/graphql` endpoint of each service or a centralized gateway.
- **Postman**: Supports GraphQL natively with schema introspection.
- **Altair GraphQL Client**: Recommended for testing subscriptions (WebSockets).
