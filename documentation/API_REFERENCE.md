# API Reference

This document provides comprehensive API documentation for the CitadelAI platform, covering all services and their endpoints.

## Base URLs

- **User Service**: `http://localhost:3003/api`
- **Admin Service**: `http://localhost:3002/api`
- **Crawling Service**: `http://localhost:3001`
- **Cron Scheduler Service**: `http://localhost:3004`

## Authentication

All API endpoints require authentication via JWT tokens in the Authorization header:

```bash
Authorization: Bearer <your-jwt-token>
```

## User Service API (Port 3003)

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

**Response**:
```json
{
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2025-01-01T10:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response**:
```json
{
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Logout User
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

**Response**:
```json
{
  "message": "Logged out successfully"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

**Response**:
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "name": "John Doe",
  "defaultChatbotId": "chatbot-456",
  "createdAt": "2025-01-01T10:00:00Z"
}
```

### Chat Endpoints

#### Send Message (Standard)
```http
POST /api/chat/respond
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "What is your company's return policy?",
  "chatSessionId": "session-123"
}
```

**Response**:
```json
{
  "message": "Our return policy allows returns within 30 days of purchase...",
  "followUps": [
    "What items are eligible for return?",
    "How do I process a return?",
    "What is the refund timeline?"
  ],
  "chatSessionId": "session-123",
  "citations": "\n\n**Sources:**\n1. [Company Website](https://example.com) (pages: 3)\n2. Return Policy Document (part 1)"
}
```

#### Send Message (Streaming)
```http
POST /api/chat/respond-streaming
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "Explain our product features",
  "chatSessionId": "session-123"
}
```

**Response**: Server-Sent Events (SSE)
```
data: {"type": "content", "content": "Our product features include..."}

data: {"type": "content", "content": " advanced analytics..."}

data: {"type": "citations", "citations": "\n\n**Sources:**\n1. [Product Docs](https://docs.example.com)"}

data: {"type": "followUps", "followUps": ["Learn more about pricing", "See feature comparison"]}

data: [DONE]
```

#### Get Chat History
```http
GET /api/chat/history?sessionId=session-123
Authorization: Bearer <token>
```

**Response**:
```json
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
```

#### Get Chat Sessions
```http
GET /api/chat/sessions?chatbotId=chatbot-456
Authorization: Bearer <token>
```

**Response**:
```json
[
  {
    "id": "session-123",
    "title": "Product Support Chat",
    "chatbotId": "chatbot-456",
    "createdAt": "2025-01-01T09:00:00Z",
    "updatedAt": "2025-01-01T10:30:00Z"
  }
]
```

#### Create Chat Session
```http
POST /api/chat/sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "chatbotId": "chatbot-456"
}
```

**Response**:
```json
{
  "id": "session-123",
  "title": "New Chat",
  "chatbotId": "chatbot-456",
  "createdAt": "2025-01-01T09:00:00Z"
}
```

#### Generate Chat Title
```http
POST /api/chat/:id/title
Authorization: Bearer <token>
```

**Response**:
```json
{
  "id": "session-123",
  "title": "Product Support Chat",
  "chatbotId": "chatbot-456",
  "createdAt": "2025-01-01T09:00:00Z",
  "updatedAt": "2025-01-01T10:30:00Z"
}
```

#### Delete Chat Session
```http
DELETE /api/chat/:id
Authorization: Bearer <token>
```

**Response**: `204 No Content`

### Chatbot Endpoints

#### Get Accessible Chatbots
```http
GET /api/chatbots
Authorization: Bearer <token>
```

**Response**:
```json
[
  {
    "id": "chatbot-456",
    "name": "Customer Support Bot",
    "status": "ACTIVE",
    "isDefault": true,
    "createdAt": "2025-01-01T08:00:00Z"
  }
]
```

#### Get Specific Chatbot
```http
GET /api/chatbots/:id
Authorization: Bearer <token>
```

**Response**:
```json
{
  "id": "chatbot-456",
  "name": "Customer Support Bot",
  "status": "ACTIVE",
  "blocks": [...],
  "connections": [...],
  "websiteContexts": [...]
}
```

#### Set Default Chatbot
```http
POST /api/chatbots/:chatbotId/set-default
Authorization: Bearer <token>
```

**Response**:
```json
{
  "message": "Default chatbot updated successfully"
}
```

## Admin Service API (Port 3002)

### Authentication Endpoints

#### Register Admin User
```http
POST /api/admin/auth/register
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "securepassword",
  "role": "ADMIN",
  "company": "Acme Corp",
  "name": "John Admin"
}
```

**Response**:
```json
{
  "id": "admin-123",
  "email": "admin@example.com",
  "name": "John Admin",
  "role": "ADMIN",
  "company": "Acme Corp",
  "testUserId": "test-user-456",
  "createdAt": "2025-01-01T10:00:00Z"
}
```

#### Login Admin User
```http
POST /api/admin/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "securepassword"
}
```

**Response**:
```json
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
```

#### Login as Test User
```http
POST /api/admin/auth/login-as-test-user
Authorization: Bearer <admin-token>
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Get Current Admin
```http
GET /api/admin/me
Authorization: Bearer <admin-token>
```

**Response**:
```json
{
  "id": "admin-123",
  "email": "admin@example.com",
  "name": "John Admin",
  "role": "ADMIN",
  "company": "Acme Corp",
  "tutorialCompleted": false,
  "createdAt": "2025-01-01T10:00:00Z"
}
```

#### Update Profile
```http
PUT /api/admin/profile
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "John Updated",
  "email": "john.updated@example.com",
  "company": "Updated Corp"
}
```

**Response**:
```json
{
  "id": "admin-123",
  "email": "john.updated@example.com",
  "name": "John Updated",
  "role": "ADMIN",
  "company": "Updated Corp",
  "tutorialCompleted": false,
  "updatedAt": "2025-01-01T11:00:00Z"
}
```

#### Change Password
```http
PUT /api/admin/change-password
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword"
}
```

**Response**:
```json
{
  "message": "Password changed successfully"
}
```

#### Delete Account
```http
DELETE /api/admin/delete-account
Authorization: Bearer <admin-token>
```

**Response**:
```json
{
  "message": "Account deleted successfully"
}
```

### Dashboard Endpoints

#### Get Dashboard Statistics
```http
GET /api/admin/dashboard/stats
Authorization: Bearer <admin-token>
```

**Response**:
```json
{
  "totalChatbots": 15,
  "totalConversations": 2513,
  "activeUsers": 892
}
```

### Chatbot Management Endpoints

#### Create Chatbot
```http
POST /api/admin/chatbots
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Customer Support Bot",
  "description": "AI assistant for customer support"
}
```

**Response**:
```json
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
        "behavior": "helpful",
        "additionalInstructions": ""
      }
    }
  ],
  "connections": [...],
  "websiteContexts": []
}
```

#### Get All Chatbots
```http
GET /api/admin/chatbots
Authorization: Bearer <admin-token>
```

**Response**:
```json
[
  {
    "id": "chatbot-456",
    "name": "Customer Support Bot",
    "status": "ACTIVE",
    "ownerId": "admin-123",
    "createdAt": "2025-01-01T10:00:00Z"
  }
]
```

#### Get Specific Chatbot
```http
GET /api/admin/chatbots/:id
Authorization: Bearer <admin-token>
```

**Response**:
```json
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
```

#### Update Chatbot
```http
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
```

**Response**:
```json
{
  "id": "chatbot-456",
  "name": "Updated Bot Name",
  "status": "ACTIVE",
  "ownerId": "admin-123",
  "blocks": [...],
  "connections": [...],
  "websiteContexts": [...],
  "updatedAt": "2025-01-01T11:00:00Z"
}
```

#### Delete Chatbot
```http
DELETE /api/admin/chatbots/:id
Authorization: Bearer <admin-token>
```

**Response**: `204 No Content`

#### Delete Block
```http
DELETE /api/admin/chatbots/:chatbotId/blocks/:blockId
Authorization: Bearer <admin-token>
```

**Response**: `204 No Content`

### User Access Management Endpoints

#### Get Chatbot Users
```http
GET /api/admin/chatbots/:id/users
Authorization: Bearer <admin-token>
```

**Response**:
```json
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
```

#### Add User Access
```http
POST /api/admin/chatbots/:id/users
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "email": "newuser@example.com"
}
```

**Response**:
```json
{
  "id": "access-124",
  "chatbotId": "chatbot-456",
  "userId": "user-790",
  "userEmail": "newuser@example.com",
  "assignedAt": "2025-01-01T11:00:00Z"
}
```

#### Remove User Access
```http
DELETE /api/admin/chatbots/:id/users/:accessId
Authorization: Bearer <admin-token>
```

**Response**: `204 No Content`

### Crawling Management Endpoints

#### Start Crawling Job
```http
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
```

**Response**:
```json
{
  "message": "Crawling job started successfully"
}
```

#### Get Crawling Status
```http
GET /api/admin/status/:blockId
Authorization: Bearer <admin-token>
```

**Response**:
```json
{
  "status": "crawling",
  "progress": 5,
  "total": 10,
  "currentUrl": "https://example.com/page5"
}
```

#### Stop Crawling Job
```http
POST /api/admin/stop
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "chatbotId": "chatbot-456",
  "blockId": "block-789"
}
```

**Response**:
```json
{
  "message": "Crawling stopped successfully"
}
```

#### Update Cron Settings
```http
POST /api/admin/cron/update
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "blockId": "block-789",
  "cronEnabled": true,
  "cronSchedule": "0 0 * * *",
  "cronTimezone": "UTC"
}
```

**Response**:
```json
{
  "message": "Cron settings updated successfully",
  "nextCrawlAt": "2025-01-02T00:00:00Z"
}
```

### Document Processing Endpoints

#### Upload Document
```http
POST /api/admin/documents/upload
Authorization: Bearer <admin-token>
Content-Type: multipart/form-data

{
  "file": <file>,
  "chatbotId": "chatbot-456",
  "blockId": "block-789"
}
```

**Response**:
```json
{
  "id": "doc-123",
  "filename": "document.pdf",
  "chatbotId": "chatbot-456",
  "blockId": "block-789",
  "status": "processing",
  "uploadedAt": "2025-01-01T10:00:00Z"
}
```

#### Get Documents
```http
GET /api/admin/documents?chatbotId=chatbot-456
Authorization: Bearer <admin-token>
```

**Response**:
```json
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
```

#### Delete Document
```http
DELETE /api/admin/documents/:id
Authorization: Bearer <admin-token>
```

**Response**: `204 No Content`

## Crawling Service API (Port 3001)

### Primary Endpoints

#### Start Crawling Job (Optimized)
```http
POST /crawl
Content-Type: application/json

{
  "url": "https://example.com",
  "chatbotId": "chatbot-456",
  "blockId": "block-789",
  "recursive": true,
  "maxDepth": 3
}
```

**Response**:
```json
{
  "message": "Optimized crawling job added to the queue",
  "jobId": "job-123",
  "estimatedTime": "5-10 minutes"
}
```

#### Start Crawling Job (Legacy)
```http
POST /crawl-legacy
Content-Type: application/json

{
  "url": "https://example.com",
  "chatbotId": "chatbot-456",
  "blockId": "block-789",
  "recursive": false,
  "maxDepth": 1
}
```

**Response**:
```json
{
  "message": "Legacy crawling job added to the queue",
  "jobId": "job-124"
}
```

#### Get Crawling Status
```http
GET /status/:blockId
```

**Response**:
```json
{
  "status": "crawling",
  "progress": 5,
  "total": 10,
  "currentUrl": "https://example.com/page5",
  "pagesProcessed": 5,
  "pagesRemaining": 5,
  "estimatedTimeRemaining": "2 minutes",
  "startedAt": "2025-01-01T10:00:00Z",
  "lastUpdate": "2025-01-01T10:05:00Z"
}
```

#### Stop Crawling Job
```http
POST /stop
Content-Type: application/json

{
  "chatbotId": "chatbot-456",
  "blockId": "block-789"
}
```

**Response**:
```json
{
  "message": "Crawling stopped for block",
  "blockId": "block-789",
  "stoppedAt": "2025-01-01T10:05:00Z"
}
```

#### Health Check
```http
GET /health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T10:00:00Z",
  "version": "1.0.0",
  "uptime": "2h 30m 15s"
}
```

#### Get Concurrency Status
```http
GET /concurrency-status
```

**Response**:
```json
{
  "maxConcurrentJobs": 4,
  "maxCrawlersPerJob": 5,
  "maxTotalCrawlers": 20,
  "activeJobsCount": 2,
  "totalActiveCrawlers": 8,
  "queueLength": 1,
  "memoryUsage": "45%",
  "cpuUsage": "23%",
  "activeJobs": [
    {
      "jobKey": "chatbot-456-block-789",
      "chatbotId": "chatbot-456",
      "blockId": "block-789",
      "startUrl": "https://example.com",
      "activeCrawlers": 4,
      "maxCrawlersPerJob": 5,
      "pagesProcessed": 12,
      "pagesRemaining": 8,
      "startedAt": "2025-01-01T10:00:00Z"
    }
  ],
  "queue": [
    {
      "chatbotId": "chatbot-789",
      "blockId": "block-101",
      "startUrl": "https://another-site.com",
      "queuedAt": "2025-01-01T10:05:00Z"
    }
  ]
}
```

## Cron Scheduler Service API (Port 3004)

### Health Check

#### Get Service Health
```http
GET /health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T10:00:00Z",
  "scheduler": {
    "activeJobs": 3,
    "totalSchedules": 15,
    "nextExecution": "2025-01-01T12:00:00Z"
  }
}
```

### Schedule Management

#### Update Cron Settings
```http
POST /cron/update
Content-Type: application/json

{
  "blockId": "block-789",
  "cronEnabled": true,
  "cronSchedule": "0 0 * * *",
  "cronTimezone": "UTC"
}
```

**Response**:
```json
{
  "message": "Cron settings updated successfully",
  "nextCrawlAt": "2025-01-02T00:00:00Z",
  "schedule": {
    "blockId": "block-789",
    "cronEnabled": true,
    "cronSchedule": "0 0 * * *",
    "cronTimezone": "UTC",
    "nextCrawlAt": "2025-01-02T00:00:00Z"
  }
}
```

#### Get Cron Status
```http
GET /cron/status/:blockId
```

**Response**:
```json
{
  "blockId": "block-789",
  "cronEnabled": true,
  "cronSchedule": "0 0 * * *",
  "cronTimezone": "UTC",
  "nextCrawlAt": "2025-01-02T00:00:00Z",
  "lastExecuted": "2025-01-01T00:00:00Z",
  "executionCount": 15
}
```

#### List All Scheduled Crawls
```http
GET /cron/scheduled
```

**Response**:
```json
[
  {
    "blockId": "block-789",
    "url": "https://example.com",
    "cronSchedule": "0 0 * * *",
    "cronTimezone": "UTC",
    "nextCrawlAt": "2025-01-02T00:00:00Z",
    "chatbot": {
      "name": "Customer Support Bot"
    }
  }
]
```

#### Unschedule Crawl Task
```http
DELETE /cron/unschedule/:blockId
```

**Response**:
```json
{
  "message": "Crawl task unscheduled successfully",
  "blockId": "block-789"
}
```

## Error Handling

### Standard Error Response Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error details"
  }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `UNAUTHORIZED` | Authentication required | 401 |
| `INVALID_CREDENTIALS` | Invalid email/password | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `VALIDATION_ERROR` | Invalid request data | 400 |
| `DUPLICATE_EMAIL` | Email already exists | 409 |
| `RATE_LIMITED` | Too many requests | 429 |
| `CRAWL_ERROR` | Crawling operation failed | 500 |
| `DOCUMENT_ERROR` | Document processing failed | 500 |
| `WEAVIATE_ERROR` | Vector database error | 500 |
| `INTERNAL_ERROR` | Server error | 500 |

### Error Examples

#### Authentication Error
```json
{
  "error": "Invalid credentials",
  "code": "INVALID_CREDENTIALS"
}
```

#### Validation Error
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "email": "Invalid email format",
    "password": "Password must be at least 6 characters"
  }
}
```

#### Crawling Error
```json
{
  "error": "Failed to start crawling job",
  "code": "CRAWL_ERROR",
  "details": {
    "reason": "Crawling service unavailable",
    "url": "https://example.com"
  }
}
```

## Rate Limiting

### Limits by Endpoint Type

| Endpoint Type | Rate Limit | Window |
|---------------|------------|--------|
| Authentication | 10 requests | 1 minute |
| Chat Messages | 100 requests | 1 minute |
| Chat Sessions | 50 requests | 1 minute |
| Chatbot Management | 20 requests | 1 minute |
| Crawling Jobs | 5 requests | 1 minute |
| Document Upload | 10 requests | 1 minute |
| Status Checks | 200 requests | 1 minute |

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Webhooks

### Crawling Status Updates

**Endpoint**: `POST /webhooks/crawling-status`

**Description**: Receives real-time updates about crawling job status.

**Payload**:
```json
{
  "event": "crawling.status.updated",
  "data": {
    "blockId": "block-789",
    "chatbotId": "chatbot-456",
    "status": "completed",
    "progress": 10,
    "total": 10,
    "crawledPagesCount": 15,
    "timestamp": "2025-01-01T10:00:00Z"
  }
}
```

### System Prompt Updates

**Endpoint**: `POST /webhooks/system-prompt.updated`

**Description**: Receives notifications when system prompts are updated.

**Payload**:
```json
{
  "event": "system-prompt.updated",
  "data": {
    "blockId": "block-789",
    "chatbotId": "chatbot-456",
    "properties": {
      "botName": "Updated Bot Name",
      "behavior": "professional"
    },
    "timestamp": "2025-01-01T10:00:00Z"
  }
}
```

## SDKs and Libraries

### JavaScript/TypeScript SDK

```typescript
import { CitadelAI } from '@citadelai/sdk';

const client = new CitadelAI({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.citadelai.com'
});

// Send a message
const response = await client.chat.sendMessage({
  message: "What is the company's return policy?",
  chatbotId: "chatbot-456"
});

// Start crawling
const crawlJob = await client.crawling.start({
  url: "https://example.com",
  chatbotId: "chatbot-456",
  blockId: "block-789",
  recursive: true,
  maxDepth: 3
});
```

### Python SDK

```python
from citadelai import CitadelAI

client = CitadelAI(api_key="your-api-key")

# Send a message
response = client.chat.send_message(
    message="What is the company's return policy?",
    chatbot_id="chatbot-456"
)

# Start crawling
crawl_job = client.crawling.start(
    url="https://example.com",
    chatbot_id="chatbot-456",
    block_id="block-789",
    recursive=True,
    max_depth=3
)
```

## Testing

### Test Endpoints

- **Health Check**: `GET /health`
- **Status Check**: `GET /concurrency-status`
- **Test Crawl**: `POST /test-crawl` (development only)

### Test Data

Use the following test data for API testing:

```json
{
  "testChatbotId": "test-chatbot-123",
  "testBlockId": "test-block-456",
  "testUrl": "https://httpbin.org/html",
  "testMessage": "Hello, how can you help me?"
}
```

## API Versioning

### Current Version
- **Version**: v1
- **Base URL**: `https://api.citadelai.com/v1`
- **Status**: Stable

### Versioning Strategy
- **URL Path**: Version in URL path (`/v1/`, `/v2/`)
- **Header**: Version in Accept header
- **Backward Compatibility**: Maintained for at least 12 months
- **Deprecation Notice**: 6 months advance notice

---

*This API reference is maintained alongside the codebase and reflects the current state of all CitadelAI services. For implementation details, refer to the individual service documentation.*