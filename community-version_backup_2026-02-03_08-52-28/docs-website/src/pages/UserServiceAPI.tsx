import MarkdownRenderer from "@/components/MarkdownRenderer";

const UserServiceAPI = () => {
  const content = `# User Service API

Complete API documentation for the User Service (Port 3003).

## Overview

The User Service handles all user-facing chatbot interactions, authentication, and chat management. It provides both standard HTTP responses and Server-Sent Events (SSE) for real-time streaming.

## Base URL

\`http://localhost:3003/api\` or \`https://api.citadelai.app/api/user\`

## Authentication

Most endpoints require a JWT token in the Authorization header:

\`\`\`http
Authorization: Bearer <your-jwt-token>
\`\`\`

## Architecture Flow

\`\`\`mermaid
graph LR
    A[User Frontend] -->|HTTP/SSE| B[User Backend]
    B -->|Query| C[PostgreSQL]
    B -->|Vector Search| D[Weaviate]
    B -->|AI Request| E[AI Provider]
    E -->|Stream| B
    B -->|SSE Stream| A
\`\`\`

## Authentication Endpoints

### Register User

\`\`\`http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
\`\`\`

**Response:**
\`\`\`json
{
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2025-01-01T10:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
\`\`\`

### Login User

\`\`\`http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
\`\`\`

**Response:**
\`\`\`json
{
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
\`\`\`

### Get Current User

\`\`\`http
GET /api/auth/me
Authorization: Bearer <token>
\`\`\`

**Response:**
\`\`\`json
{
  "id": "user-123",
  "email": "user@example.com",
  "name": "John Doe",
  "defaultChatbotId": "chatbot-456",
  "createdAt": "2025-01-01T10:00:00Z"
}
\`\`\`

### Logout User

\`\`\`http
POST /api/auth/logout
Authorization: Bearer <token>
\`\`\`

**Response:**
\`\`\`json
{
  "message": "Logged out successfully"
}
\`\`\`

## Chat Endpoints

### Send Message (Standard)

Sends a message and receives a complete response.

\`\`\`http
POST /api/chat/respond
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "What is your company's return policy?",
  "chatSessionId": "session-123"
}
\`\`\`

**Response:**
\`\`\`json
{
  "message": "Our return policy allows returns within 30 days of purchase...",
  "followUps": [
    "What items are eligible for return?",
    "How do I process a return?",
    "What is the refund timeline?"
  ],
  "chatSessionId": "session-123",
  "citations": "\\n\\n**Sources:**\\n1. [Company Website](https://example.com) (pages: 3)"
}
\`\`\`

### Send Message (Streaming)

Sends a message and receives a real-time streaming response via Server-Sent Events (SSE).

\`\`\`http
POST /api/chat/respond-streaming
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "Explain our product features",
  "chatSessionId": "session-123"
}
\`\`\`

**Response (SSE):**
\`\`\`
data: {"type": "metadata", "chatSessionId": "session-123"}
data: {"type": "chunk", "content": "Our product features include..."}
data: {"type": "chunk", "content": " advanced analytics..."}
data: {"type": "complete", "fullResponse": "Complete AI response"}
data: {"type": "citations", "citations": "**Sources:**\\n1. [Product Docs](https://docs.example.com)"}
data: {"type": "followUps", "followUps": [{"id": "1", "text": "Learn more about pricing"}]}
data: [DONE]
\`\`\`

**Event Types:**
- \`metadata\` - Session information
- \`chunk\` - Text chunks for progressive display
- \`complete\` - Final response completion
- \`citations\` - Source citations
- \`followUps\` - AI-generated follow-up suggestions
- \`error\` - Error handling

### Get Chat History

\`\`\`http
GET /api/chat/history?sessionId=session-123
Authorization: Bearer <token>
\`\`\`

**Response:**
\`\`\`json
[
  {
    "id": "msg-1",
    "role": "USER",
    "content": "What is your company's return policy?",
    "createdAt": "2025-01-01T10:00:00Z"
  },
  {
    "id": "msg-2",
    "role": "ASSISTANT",
    "content": "Our return policy allows returns within 30 days...",
    "createdAt": "2025-01-01T10:00:01Z"
  }
]
\`\`\`

### Get Chat Sessions

\`\`\`http
GET /api/chat/sessions?chatbotId=chatbot-456
Authorization: Bearer <token>
\`\`\`

**Response:**
\`\`\`json
[
  {
    "id": "session-123",
    "title": "Product Support Chat",
    "chatbotId": "chatbot-456",
    "createdAt": "2025-01-01T09:00:00Z",
    "updatedAt": "2025-01-01T10:30:00Z"
  }
]
\`\`\`

### Create Chat Session

\`\`\`http
POST /api/chat/sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "chatbotId": "chatbot-456"
}
\`\`\`

**Response:**
\`\`\`json
{
  "id": "session-123",
  "title": "New Chat",
  "chatbotId": "chatbot-456",
  "createdAt": "2025-01-01T09:00:00Z"
}
\`\`\`

### Generate Chat Title

\`\`\`http
POST /api/chat/:id/title
Authorization: Bearer <token>
\`\`\`

**Response:**
\`\`\`json
{
  "id": "session-123",
  "title": "Product Support Chat",
  "chatbotId": "chatbot-456",
  "updatedAt": "2025-01-01T10:30:00Z"
}
\`\`\`

### Delete Chat Session

\`\`\`http
DELETE /api/chat/:id
Authorization: Bearer <token>
\`\`\`

**Response:** \`204 No Content\`

## Chatbot Endpoints

### Get Accessible Chatbots

Returns all chatbots the user has access to.

\`\`\`http
GET /api/chatbots
Authorization: Bearer <token>
\`\`\`

**Response:**
\`\`\`json
[
  {
    "id": "chatbot-456",
    "name": "Customer Support Bot",
    "status": "ACTIVE",
    "isDefault": true,
    "createdAt": "2025-01-01T08:00:00Z"
  }
]
\`\`\`

### Get Specific Chatbot

\`\`\`http
GET /api/chatbots/:id
Authorization: Bearer <token>
\`\`\`

**Response:**
\`\`\`json
{
  "id": "chatbot-456",
  "name": "Customer Support Bot",
  "status": "ACTIVE",
  "blocks": [...],
  "connections": [...],
  "websiteContexts": [...]
}
\`\`\`

### Set Default Chatbot

\`\`\`http
POST /api/chatbots/:chatbotId/set-default
Authorization: Bearer <token>
\`\`\`

**Response:**
\`\`\`json
{
  "message": "Default chatbot updated successfully"
}
\`\`\`

## Error Responses

All endpoints may return the following error responses:

\`\`\`json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "statusCode": 400
}
\`\`\`

**Common Status Codes:**
- \`400 Bad Request\` - Invalid request parameters
- \`401 Unauthorized\` - Invalid or missing token
- \`403 Forbidden\` - Insufficient permissions
- \`404 Not Found\` - Resource not found
- \`500 Internal Server Error\` - Server error

## Rate Limiting

- **Limit**: 100 requests per minute per user
- **Headers**: \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\`, \`X-RateLimit-Reset\`

## Next Steps

- [Admin Service API](/api/admin-service) - Admin management API
- [Crawling Service API](/api/crawling-service) - Web crawling API
- [Services Overview](/services/overview) - Understand all services
`;

  return (
    <div>
      <MarkdownRenderer content={content} />
    </div>
  );
};

export default UserServiceAPI;
