import MarkdownRenderer from "@/components/MarkdownRenderer";

const APIReference = () => {
  const content = `# API Reference

Complete API documentation for CitadelAI services.

## Overview

CitadelAI provides RESTful APIs for all core services. All APIs use JSON for request and response bodies and require JWT authentication (except public endpoints).

## Base URLs

- **User Service**: \`http://localhost:3003/api\` or \`https://api.citadelai.app/api/user\`
- **Admin Service**: \`http://localhost:3002/api\` or \`https://api.citadelai.app/api/admin\`
- **Crawling Service**: \`http://localhost:3001\` or \`https://api.citadelai.app/crawl\`

## Authentication

Most endpoints require authentication via JWT tokens in the Authorization header:

\`\`\`http
Authorization: Bearer <your-jwt-token>
\`\`\`

### Getting a Token

1. **User Token**: Register or login via \`POST /api/auth/register\` or \`POST /api/auth/login\`
2. **Admin Token**: Register or login via \`POST /api/admin/auth/register\` or \`POST /api/admin/auth/login\`

## API Services

### User Service API

Handles user-facing chatbot interactions, authentication, and chat management.

**Key Features:**
- User registration and authentication
- Chat message sending (standard and streaming)
- Chat history and session management
- Chatbot access control

[View User Service API Documentation →](/api/user-service)

### Admin Service API

Provides administrative interface for chatbot management and configuration.

**Key Features:**
- Admin authentication and profile management
- Chatbot CRUD operations
- Block-based visual editor API
- User access management
- Website context configuration
- Crawling job management

[View Admin Service API Documentation →](/api/admin-service)

### Crawling Service API

Handles web crawling and content indexing for chatbot knowledge bases.

**Key Features:**
- Website crawling with configurable depth
- Content extraction and processing
- Weaviate vector database integration
- Real-time crawling status updates

[View Crawling Service API Documentation →](/api/crawling-service)

## Request/Response Format

### Standard Request

\`\`\`http
POST /api/endpoint
Authorization: Bearer <token>
Content-Type: application/json

{
  "field": "value"
}
\`\`\`

### Standard Response

\`\`\`json
{
  "data": {...},
  "message": "Success"
}
\`\`\`

### Error Response

\`\`\`json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "statusCode": 400
}
\`\`\`

## HTTP Status Codes

- \`200 OK\` - Request successful
- \`201 Created\` - Resource created successfully
- \`204 No Content\` - Request successful, no content to return
- \`400 Bad Request\` - Invalid request parameters
- \`401 Unauthorized\` - Authentication required or invalid token
- \`403 Forbidden\` - Insufficient permissions
- \`404 Not Found\` - Resource not found
- \`500 Internal Server Error\` - Server error

## Rate Limiting

API requests are rate-limited to prevent abuse:
- **User Service**: 100 requests per minute per user
- **Admin Service**: 200 requests per minute per admin
- **Crawling Service**: 10 requests per minute per admin

Rate limit headers are included in responses:
\`\`\`http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
\`\`\`

## Pagination

List endpoints support pagination:

\`\`\`http
GET /api/resource?page=1&limit=20
\`\`\`

Response includes pagination metadata:
\`\`\`json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
\`\`\`

## Streaming Responses

Some endpoints support Server-Sent Events (SSE) for real-time streaming:

\`\`\`http
POST /api/chat/respond-streaming
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "Hello",
  "chatSessionId": "session-123"
}
\`\`\`

Response format:
\`\`\`
data: {"type": "chunk", "content": "Hello"}
data: {"type": "chunk", "content": " there"}
data: {"type": "complete", "fullResponse": "Hello there"}
data: [DONE]
\`\`\`

## Next Steps

- [User Service API](/api/user-service) - Complete user-facing API documentation
- [Admin Service API](/api/admin-service) - Complete admin API documentation
- [Crawling Service API](/api/crawling-service) - Complete crawling service documentation
- [Services Overview](/services/overview) - Understand service architecture
`;

  return (
    <div>
      <MarkdownRenderer content={content} />
    </div>
  );
};

export default APIReference;
