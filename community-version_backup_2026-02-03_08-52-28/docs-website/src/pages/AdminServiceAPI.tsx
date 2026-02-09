import MarkdownRenderer from "@/components/MarkdownRenderer";

const AdminServiceAPI = () => {
  const content = `# Admin Service API

Complete API documentation for the Admin Service (Port 3002).

## Overview

The Admin Service provides administrative interface for chatbot management, configuration, and user access control. It handles all admin-facing operations including chatbot CRUD, block management, and crawling job coordination.

## Base URL

\`http://localhost:3002/api\` or \`https://api.citadelai.app/api/admin\`

## Authentication

All endpoints require an admin JWT token:

\`\`\`http
Authorization: Bearer <admin-jwt-token>
\`\`\`

## Architecture Flow

\`\`\`mermaid
graph LR
    A[Admin Frontend] -->|HTTP| B[Admin Backend]
    B -->|Query| C[PostgreSQL]
    B -->|Trigger| D[Crawling Service]
    B -->|Manage| E[User Access]
    D -->|Index| F[Weaviate]
    B -->|Update| C
\`\`\`

## Authentication Endpoints

### Register Admin User

\`\`\`http
POST /api/admin/auth/register
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "securepassword",
  "role": "ADMIN",
  "company": "Acme Corp",
  "name": "John Admin"
}
\`\`\`

**Response:**
\`\`\`json
{
  "id": "admin-123",
  "email": "admin@example.com",
  "name": "John Admin",
  "role": "ADMIN",
  "company": "Acme Corp",
  "testUserId": "test-user-456",
  "createdAt": "2025-01-01T10:00:00Z"
}
\`\`\`

### Login Admin User

\`\`\`http
POST /api/admin/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "securepassword"
}
\`\`\`

**Response:**
\`\`\`json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "admin-123",
    "email": "admin@example.com",
    "name": "John Admin",
    "role": "ADMIN",
    "company": "Acme Corp"
  }
}
\`\`\`

### Get Current Admin

\`\`\`http
GET /api/admin/me
Authorization: Bearer <admin-token>
\`\`\`

**Response:**
\`\`\`json
{
  "id": "admin-123",
  "email": "admin@example.com",
  "name": "John Admin",
  "role": "ADMIN",
  "company": "Acme Corp",
  "tutorialCompleted": false,
  "createdAt": "2025-01-01T10:00:00Z"
}
\`\`\`

### Update Profile

\`\`\`http
PUT /api/admin/profile
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "John Updated",
  "email": "john.updated@example.com",
  "company": "Updated Corp"
}
\`\`\`

### Change Password

\`\`\`http
PUT /api/admin/change-password
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword"
}
\`\`\`

### Delete Account

\`\`\`http
DELETE /api/admin/delete-account
Authorization: Bearer <admin-token>
\`\`\`

## Dashboard Endpoints

### Get Dashboard Statistics

\`\`\`http
GET /api/admin/dashboard/stats
Authorization: Bearer <admin-token>
\`\`\`

**Response:**
\`\`\`json
{
  "totalChatbots": 15,
  "totalConversations": 2513,
  "activeUsers": 892
}
\`\`\`

## Chatbot Management Endpoints

### Create Chatbot

\`\`\`http
POST /api/admin/chatbots
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Customer Support Bot",
  "description": "AI assistant for customer support"
}
\`\`\`

**Response:**
\`\`\`json
{
  "id": "chatbot-456",
  "name": "Customer Support Bot",
  "status": "INACTIVE",
  "ownerId": "admin-123",
  "createdAt": "2025-01-01T10:00:00Z",
  "blocks": [
    {
      "id": "block-789",
      "type": "LOGIC",
      "subtype": "System Prompt",
      "title": "System Prompt",
      "properties": {
        "botName": "Customer Support Bot",
        "companyName": "Acme Corp",
        "behavior": "helpful"
      }
    }
  ],
  "connections": [],
  "websiteContexts": []
}
\`\`\`

### Get All Chatbots

\`\`\`http
GET /api/admin/chatbots
Authorization: Bearer <admin-token>
\`\`\`

**Response:**
\`\`\`json
[
  {
    "id": "chatbot-456",
    "name": "Customer Support Bot",
    "status": "ACTIVE",
    "ownerId": "admin-123",
    "createdAt": "2025-01-01T10:00:00Z"
  }
]
\`\`\`

### Get Specific Chatbot

\`\`\`http
GET /api/admin/chatbots/:id
Authorization: Bearer <admin-token>
\`\`\`

**Response:**
\`\`\`json
{
  "id": "chatbot-456",
  "name": "Customer Support Bot",
  "status": "ACTIVE",
  "ownerId": "admin-123",
  "blocks": [...],
  "connections": [...],
  "websiteContexts": [...],
  "createdAt": "2025-01-01T10:00:00Z",
  "updatedAt": "2025-01-01T11:00:00Z"
}
\`\`\`

### Update Chatbot

\`\`\`http
PUT /api/admin/chatbots/:id
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Updated Bot Name",
  "status": "ACTIVE",
  "blocks": [...],
  "connections": [...],
  "websiteContexts": [...]
}
\`\`\`

### Delete Chatbot

\`\`\`http
DELETE /api/admin/chatbots/:id
Authorization: Bearer <admin-token>
\`\`\`

**Response:** \`204 No Content\`

### Delete Block

\`\`\`http
DELETE /api/admin/chatbots/:chatbotId/blocks/:blockId
Authorization: Bearer <admin-token>
\`\`\`

**Response:** \`204 No Content\`

## User Access Management Endpoints

### Get Chatbot Users

\`\`\`http
GET /api/admin/chatbots/:id/users
Authorization: Bearer <admin-token>
\`\`\`

**Response:**
\`\`\`json
[
  {
    "id": "access-123",
    "chatbotId": "chatbot-456",
    "userId": "user-789",
    "userEmail": "user@example.com",
    "assignedAt": "2025-01-01T10:00:00Z",
    "user": {
      "id": "user-789",
      "name": "John User",
      "email": "user@example.com"
    }
  }
]
\`\`\`

### Add User Access

\`\`\`http
POST /api/admin/chatbots/:id/users
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "email": "newuser@example.com"
}
\`\`\`

**Response:**
\`\`\`json
{
  "id": "access-124",
  "chatbotId": "chatbot-456",
  "userId": "user-790",
  "userEmail": "newuser@example.com",
  "assignedAt": "2025-01-01T11:00:00Z"
}
\`\`\`

### Remove User Access

\`\`\`http
DELETE /api/admin/chatbots/:id/users/:accessId
Authorization: Bearer <admin-token>
\`\`\`

**Response:** \`204 No Content\`

## Crawling Management Endpoints

### Start Crawling Job

\`\`\`http
POST /api/admin/crawl
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "url": "https://example.com",
  "chatbotId": "chatbot-456",
  "blockId": "block-789",
  "recursive": true,
  "maxDepth": 3
}
\`\`\`

**Response:**
\`\`\`json
{
  "message": "Crawling job started successfully"
}
\`\`\`

### Get Crawling Status

\`\`\`http
GET /api/admin/status/:blockId
Authorization: Bearer <admin-token>
\`\`\`

**Response:**
\`\`\`json
{
  "status": "crawling",
  "progress": 5,
  "total": 10,
  "currentUrl": "https://example.com/page5"
}
\`\`\`

### Stop Crawling Job

\`\`\`http
POST /api/admin/stop
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "chatbotId": "chatbot-456",
  "blockId": "block-789"
}
\`\`\`

**Response:**
\`\`\`json
{
  "message": "Crawling stopped successfully"
}
\`\`\`

## Document Processing Endpoints

### Upload Document

\`\`\`http
POST /api/admin/documents/upload
Authorization: Bearer <admin-token>
Content-Type: multipart/form-data

{
  "file": <file>,
  "chatbotId": "chatbot-456",
  "blockId": "block-789"
}
\`\`\`

**Response:**
\`\`\`json
{
  "id": "doc-123",
  "filename": "document.pdf",
  "chatbotId": "chatbot-456",
  "blockId": "block-789",
  "status": "processing",
  "uploadedAt": "2025-01-01T10:00:00Z"
}
\`\`\`

### Get Documents

\`\`\`http
GET /api/admin/documents?chatbotId=chatbot-456
Authorization: Bearer <admin-token>
\`\`\`

**Response:**
\`\`\`json
[
  {
    "id": "doc-123",
    "filename": "document.pdf",
    "chatbotId": "chatbot-456",
    "blockId": "block-789",
    "status": "completed",
    "uploadedAt": "2025-01-01T10:00:00Z"
  }
]
\`\`\`

### Delete Document

\`\`\`http
DELETE /api/admin/documents/:id
Authorization: Bearer <admin-token>
\`\`\`

**Response:** \`204 No Content\`

## Error Responses

All endpoints may return error responses:

\`\`\`json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "statusCode": 400
}
\`\`\`

## Rate Limiting

- **Limit**: 200 requests per minute per admin
- **Headers**: \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\`, \`X-RateLimit-Reset\`

## Next Steps

- [User Service API](/api/user-service) - User-facing API
- [Crawling Service API](/api/crawling-service) - Web crawling API
- [Services Overview](/services/overview) - Understand all services
`;

  return (
    <div>
      <MarkdownRenderer content={content} />
    </div>
  );
};

export default AdminServiceAPI;
