# User Service Documentation

The User Service is the core backend service that handles user-facing chatbot interactions, authentication, and real-time communication. It provides a RESTful API for the user frontend and integrates with the AI pipeline to deliver intelligent, context-aware responses.

## Overview

**Service**: User Backend Service  
**Port**: 3003  
**Technology**: Node.js + Express + TypeScript  
**Database**: PostgreSQL with Prisma ORM  
**Authentication**: JWT tokens  
**Real-time**: Server-Sent Events (SSE)  

## Architecture

### Service Components

```mermaid
graph TD
    A[User Frontend] --> B[User Service API]
    B --> C[Auth Controller]
    B --> D[Chat Controller]
    B --> E[Chatbot Controller]
    B --> F[Middleware Layer]
    
    C --> G[User Authentication]
    D --> H[AI Response Generation]
    E --> I[Chatbot Access Control]
    F --> J[Auth Middleware<br/>@shared/middleware]
    F --> K[Rate Limiting<br/>@shared/middleware]
    F --> L[Error Handling<br/>@shared/middleware]
    F --> L2[Logging Middleware]
    
    G --> M[PostgreSQL Database]
    H --> N[AI Providers<br/>Gemini, OpenAI,<br/>Claude, Mistral]
    H --> O[Weaviate Vector DB]
    I --> M
```

### Key Features

- **User Authentication**: Registration, login, logout, and profile management
- **Real-time Chat**: Streaming AI responses with Server-Sent Events
- **Chat Session Management**: Persistent conversation storage and retrieval
- **Chatbot Access Control**: User-specific chatbot permissions
- **AI Integration**: Dynamic system prompt generation and context retrieval
- **Message History**: Complete conversation persistence and search

## Middleware

The service uses shared middleware from the `@shared/middleware` package, which provides consistent authentication, rate limiting, and error handling across all services.

### Authentication Middleware

#### User JWT Authentication
The service uses `createJwtAuthMiddleware` from `@shared/middleware` for user authentication:

```typescript
import { createJwtAuthMiddleware } from '@shared/middleware';

export const authMiddleware = createJwtAuthMiddleware<UserAuthRequest>({
  prisma,
  jwtSecret: process.env.JWT_SECRET!,
  model: 'user',
  requestProperty: 'user',
  logger,
});
```

**Usage:**
- Verifies JWT tokens from `Authorization: Bearer <token>` header
- Attaches `user` object to request with `{ id, email }`
- Returns 401 Unauthorized for invalid/missing tokens

#### API Token Authentication
For public API endpoints, the service uses `createApiTokenAuthMiddleware`:

```typescript
import { createApiTokenAuthMiddleware } from '@shared/middleware';

export const authenticateApiToken = createApiTokenAuthMiddleware<ApiAuthRequest>({
  findTokenByValue,
  validateToken,
  incrementUsage,
  prisma,
  logger,
});
```

**Usage:**
- Validates API tokens from `Authorization: Bearer <token>` header
- Verifies token belongs to the requested chatbot
- Attaches `apiToken` and `chatbotId` to request
- Returns 401/403 for invalid tokens

### Rate Limiting

The service uses pre-configured rate limiters from `@shared/middleware`:

```typescript
import {
  authRateLimit,
  globalRateLimit,
} from '@shared/middleware';

// Authentication endpoints (5 requests per 15 minutes)
app.use('/api/auth', authRateLimit);

// General API (100 requests per 15 minutes)
app.use('/api', globalRateLimit);
```

### Error Handling

Standardized error handling using `createErrorHandler`:

```typescript
import { createErrorHandler } from '@shared/middleware';

const errorHandler = createErrorHandler({
  logger,
  includeStack: process.env.NODE_ENV === 'development',
});

app.use(errorHandler);
```

**Error Response Format:**
```json
{
  "error": "Internal Server Error",
  "message": "Error message",
  "code": "ERROR_CODE",
  "requestId": "correlation-id"
}
```

For more details, see the [@shared/middleware README](../../shared/middleware/README.md).

## API Endpoints

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

## Data Models

### User Model
```typescript
interface User {
  id: string;
  email: string;
  password: string; // hashed
  name?: string;
  createdAt: Date;
  updatedAt: Date;
  defaultChatbotId?: string;
  chatSessions: ChatSession[];
  chatbotAccesses: ChatbotAccess[];
}
```

### ChatSession Model
```typescript
interface ChatSession {
  id: string;
  title: string;
  userId: string;
  chatbotId: string;
  createdAt: Date;
  updatedAt: Date;
  chatMessages: ChatMessage[];
}
```

### ChatMessage Model
```typescript
interface ChatMessage {
  id: string;
  chatSessionId: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: Date;
}
```

### ChatbotAccess Model
```typescript
interface ChatbotAccess {
  id: string;
  chatbotId: string;
  userId?: string;
  userEmail: string;
  assignedAt: Date;
}
```

## Authentication & Authorization

### JWT Token Structure
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "iat": 1640995200,
  "exp": 1640998800
}
```

### Password Security
- **Hashing**: bcrypt with salt rounds (10)
- **Validation**: Minimum 6 characters
- **Storage**: Never stored in plain text

### Access Control
- **User Level**: Access only to assigned chatbots
- **Session Level**: JWT token validation
- **API Level**: Bearer token authentication

## AI Integration

### System Prompt Generation

The service integrates with the AI pipeline to generate dynamic system prompts:

1. **Retrieve Chatbot Configuration**: Get chatbot blocks and settings
2. **Context Retrieval**: Search Weaviate for relevant content
3. **Prompt Assembly**: Combine system prompt with context
4. **AI Generation**: Send to OpenAI with streaming support
5. **Response Processing**: Format response with citations

### Context Integration

**Knowledge Sources**:
- **Website Contexts**: Crawled web content
- **Document Contexts**: Uploaded documents
- **System Prompts**: Bot personality and behavior
- **Conversation History**: Previous messages

**Vector Search**:
- **Query**: User message + conversation context
- **Search**: Semantic similarity in Weaviate
- **Retrieval**: Top-k relevant content chunks
- **Integration**: Context injection into system prompt

### Streaming Implementation

**Server-Sent Events (SSE)**:
- **Connection**: Persistent HTTP connection
- **Streaming**: Progressive text delivery
- **Format**: JSON data chunks
- **Termination**: `[DONE]` marker

**Stream Types**:
- `content`: AI response content
- `citations`: Source references
- `followUps`: Suggested follow-up questions
- `error`: Error messages

## Error Handling

### Error Response Format
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
| `RATE_LIMITED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Server error | 500 |
| `AI_ERROR` | AI service error | 500 |

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

#### AI Service Error
```json
{
  "error": "AI service temporarily unavailable",
  "code": "AI_ERROR",
  "details": {
    "reason": "OpenAI API rate limit exceeded"
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
| Chatbot Access | 20 requests | 1 minute |

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Performance Optimization

### Caching Strategy

**Application Level**:
- **User Sessions**: In-memory session cache
- **Chatbot Configs**: Cached chatbot configurations
- **System Prompts**: Cached prompt generation

**Database Level**:
- **Query Optimization**: Indexed queries
- **Connection Pooling**: Efficient database connections
- **Read Replicas**: Read-only database replicas

### Response Optimization

**Streaming Benefits**:
- **Perceived Performance**: Immediate response start
- **User Experience**: Progressive text display
- **Resource Efficiency**: Reduced memory usage
- **Error Handling**: Graceful error recovery

**Batch Processing**:
- **Message Batching**: Efficient database writes
- **Context Batching**: Optimized vector searches
- **Response Batching**: Reduced API calls

## Monitoring & Logging

### Key Metrics

**Performance Metrics**:
- **Response Time**: API endpoint performance
- **Throughput**: Requests per second
- **Error Rate**: Error frequency and types
- **Streaming Performance**: SSE connection metrics

**Business Metrics**:
- **Active Users**: Concurrent user count
- **Chat Sessions**: Conversation volume
- **Message Volume**: Messages per session
- **AI Response Time**: AI generation latency

### Logging Strategy

**Structured Logging**:
```json
{
  "timestamp": "2025-01-01T10:00:00Z",
  "level": "INFO",
  "service": "user-service",
  "requestId": "req-123",
  "userId": "user-456",
  "endpoint": "/api/chat/respond",
  "method": "POST",
  "statusCode": 200,
  "responseTime": 1500
}
```

**Log Levels**:
- **DEBUG**: Detailed debugging information
- **INFO**: General information and flow
- **WARN**: Warning conditions
- **ERROR**: Error conditions

### Health Monitoring

**Health Check Endpoint**:
```http
GET /health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T10:00:00Z",
  "services": {
    "database": "healthy",
    "ai": "healthy",
    "weaviate": "healthy"
  }
}
```

## Security Considerations

### Input Validation

**Request Validation**:
- **Email Format**: RFC 5322 compliance
- **Password Strength**: Minimum requirements
- **Message Content**: XSS protection
- **Session IDs**: UUID format validation

**SQL Injection Prevention**:
- **Prisma ORM**: Parameterized queries
- **Input Sanitization**: Special character handling
- **Type Validation**: TypeScript type checking

### Data Protection

**Encryption**:
- **In Transit**: HTTPS/TLS for all communications
- **At Rest**: Database encryption
- **Passwords**: bcrypt hashing
- **Tokens**: Secure JWT signing

**Privacy**:
- **Data Minimization**: Only necessary data collection
- **Retention Policies**: Configurable data retention
- **User Rights**: Data deletion and export
- **Audit Logging**: Access and modification logs

## Development & Testing

### Development Setup

**Prerequisites**:
- Node.js >= 18.0.0
- PostgreSQL database
- OpenAI API key
- Weaviate instance

**Installation**:
```bash
cd user/backend
npm install
cp .env.example .env
npm run dev
```

**Environment Variables**:
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/citadel_db
OPENAI_API_KEY=your_openai_key
JWT_SECRET=your_jwt_secret
WEAVIATE_URL=http://localhost:8080
```

### Testing

**Test Types**:
- **Unit Tests**: Individual function testing
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Complete flow testing
- **Performance Tests**: Load and stress testing

**Test Commands**:
```bash
npm test                    # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:coverage      # Coverage report
```

### Code Quality

**Linting**:
- **ESLint**: Code style and error detection
- **Prettier**: Code formatting
- **TypeScript**: Type checking
- **Husky**: Pre-commit hooks

**Code Standards**:
- **TypeScript**: Strict type checking
- **Async/Await**: Modern async patterns
- **Error Handling**: Comprehensive error management
- **Documentation**: JSDoc comments

## Deployment

### Docker Configuration

**Dockerfile**:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3003
CMD ["npm", "start"]
```

**Docker Compose**:
```yaml
user-backend:
  build: ./user/backend
  ports:
    - "3003:3003"
  environment:
    - DATABASE_URL=postgresql://user:pass@db:5432/citadel_db
    - OPENAI_API_KEY=${OPENAI_API_KEY}
  depends_on:
    - db
    - weaviate
```

### Production Considerations

**Scaling**:
- **Horizontal Scaling**: Multiple service instances
- **Load Balancing**: Request distribution
- **Database Scaling**: Read replicas and connection pooling
- **Caching**: Redis for session and data caching

**Monitoring**:
- **Application Metrics**: Performance and business metrics
- **Infrastructure Metrics**: CPU, memory, disk usage
- **Log Aggregation**: Centralized logging
- **Alerting**: Proactive error and performance alerts

**Security**:
- **HTTPS**: SSL/TLS termination
- **Firewall**: Network security
- **Secrets Management**: Secure credential storage
- **Regular Updates**: Security patches and updates

---

*This documentation is maintained alongside the codebase and reflects the current state of the User Service. For API implementation details, refer to the source code in `user/backend/src/`.*