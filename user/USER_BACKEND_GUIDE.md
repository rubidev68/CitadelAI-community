
# Backend Guide for User Interface

This document specifies the data models and API endpoints required to power the `user/interface` chat application.

## 1. Data Models

Based on the frontend components (`ChatInterface.tsx`, `useAuth.ts`), the following database models are necessary.

### `User`

Represents an end-user of the chat platform.

-   `id` (String, Primary Key, CUID)
-   `email` (String, Unique)
-   `password` (String, Hashed)
-   `name` (String, Optional)
-   `createdAt` (DateTime)
-   `updatedAt` (DateTime)

### `ChatSession`

Represents a single conversation thread.

-   `id` (String, Primary Key, CUID)
-   `userId` (String, Foreign Key to `User`)
-   `chatbotId` (String, Foreign Key to `Chatbot` from the admin context)
-   `createdAt` (DateTime)
-   `updatedAt` (DateTime)

### `ChatMessage`

Represents a single message within a `ChatSession`.

-   `id` (String, Primary Key, CUID)
-   `chatSessionId` (String, Foreign Key to `ChatSession`)
-   `role` (Enum: `USER` or `ASSISTANT`)
-   `content` (Text)
-   `createdAt` (DateTime)

## 2. API Endpoints

The frontend `config/api.ts` file explicitly lists the required endpoints. The backend must implement these.

### Auth Endpoints (`/api/auth`)

-   **`POST /api/auth/register`**
    -   **Body:** `{ "email": "user@example.com", "password": "...", "name": "..." }`
    -   **Action:** Creates a new `User`. Hashes the password.
    -   **Response:** `{ "token": "...", "user": { ... } }`

-   **`POST /api/auth/login`**
    -   **Body:** `{ "email": "user@example.com", "password": "..." }`
    -   **Action:** Verifies credentials. Generates a JWT.
    -   **Response:** `{ "token": "...", "user": { ... } }`

-   **`POST /api/auth/logout`**
    -   **Action:** Can be implemented to blacklist a token if using a more complex auth system. For simple JWT, this can be a no-op endpoint, as the frontend just deletes the token.
    -   **Response:** `200 OK`

### Chat Endpoints (`/api/chat`)

These endpoints should be protected by user authentication middleware.

-   **`POST /api/chat/respond`**
    -   **Body:** `{ "message": "Hello there", "chatSessionId": "..." }`
    -   **Action:** This is the core of the application. It receives a user message, processes it through the appropriate chatbot's workflow (defined in the admin panel), generates a response, and persists the user message and the assistant's response to the database as `ChatMessage`s.
    -   **Response:** `{ "message": "This is the AI response.", "followUps": [{ "id": "1", "text": "..." }] }`

-   **`GET /api/chat/history`**
    -   **Query Params:** `?sessionId=...`
    -   **Action:** Retrieves all `ChatMessage`s for a given `ChatSession`, ordered by `createdAt`.
    -   **Response:** `[{ "id": "...", "role": "...", "content": "..." }, ...]`

### Real-time (Optional but Recommended)

For a better user experience, consider using **WebSockets** (`socket.io` or `ws`) for the chat. The flow would be:

1.  User sends a message via WebSocket.
2.  Backend receives the message, processes it.
3.  Backend sends the AI's response back to the client via the same WebSocket connection.

This avoids the need for the `isLoading` state on the frontend and provides instant feedback.
