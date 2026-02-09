# Admin Service Documentation

The Admin Service is the comprehensive backend service that provides administrative functionality for the CitadelAI platform. It handles chatbot management, user access control, web crawling operations, document processing, and system administration through a robust RESTful API.

## Overview

**Service**: Admin Backend Service  
**Port**: 3002  
**Technology**: Node.js + Express + TypeScript  
**Database**: PostgreSQL with Prisma ORM  
**Authentication**: JWT tokens with role-based access  
**File Processing**: Multer for document uploads  
**External Integrations**: Crawling Service, Cron Scheduler, Weaviate  

## Architecture

### Service Components

```mermaid
graph TD
    A[Admin Frontend] --> B[Admin Service API]
    B --> C[Auth Controller]
    B --> D[Chatbot Controller]
    B --> E[Block Controller]
    B --> F[Crawling Controller]
    B --> G[Document Controller]
    B --> H[User Management Controller]
    B --> I[Middleware Layer]
    
    C --> J[Admin Authentication]
    D --> K[Chatbot CRUD Operations]
    E --> L[Visual Block Editor]
    F --> M[Web Crawling Management]
    G --> N[Document Processing]
    H --> O[Access Control]
    I --> P[Auth Middleware<br/>@shared/middleware]
    I --> Q[Rate Limiting<br/>@shared/middleware]
    I --> R[Error Handling<br/>@shared/middleware]
    I --> S2[Logging Middleware]
    
    J --> S[PostgreSQL Database]
    K --> S
    L --> S
    M --> T[Crawling Service<br/>Port 3001]
    M --> U[Cron Scheduler<br/>Port 3004]
    N --> V[Weaviate Vector DB]
    O --> S
    J --> W
```

### Key Features

- **Admin Authentication**: Secure admin user management with role-based access
- **Chatbot Management**: Complete CRUD operations for chatbot configurations
- **Visual Block Editor**: Drag-and-drop interface for chatbot building
- **Web Crawling Integration**: Management of website context and crawling jobs
- **Document Processing**: PDF upload, processing, and vectorization
- **User Access Control**: Granular permissions and chatbot sharing
- **Performance Monitoring**: Real-time metrics and system status
- **Tutorial System**: Guided onboarding and feature discovery

## Middleware

The service uses shared middleware from the `@shared/middleware` package, which provides consistent authentication, rate limiting, and error handling across all services.

### Authentication Middleware

#### Admin JWT Authentication
The service uses `createJwtAuthMiddleware` from `@shared/middleware` for admin authentication:

```typescript
import { createJwtAuthMiddleware } from '@shared/middleware';

export const adminAuthMiddleware = createJwtAuthMiddleware<AdminAuthRequest>({
  prisma,
  jwtSecret: process.env.JWT_SECRET!,
  model: 'adminUser',
  requestProperty: 'adminUser',
  logger,
});
```

**Usage:**
- Verifies JWT tokens from `Authorization: Bearer <token>` header
- Attaches `adminUser` object to request with `{ id, email }`
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
  strictRateLimit,
} from '@shared/middleware';

// Authentication endpoints (5 requests per 15 minutes)
app.use('/api/admin/auth', authRateLimit);

// General API (100 requests per 15 minutes)
app.use('/api/admin', globalRateLimit);

// Sensitive operations (10 requests per 15 minutes)
app.use('/api/admin/sensitive', strictRateLimit);
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

## Data Models

### AdminUser Model
```typescript
interface AdminUser {
  id: string;
  email: string;
  password: string; // hashed
  name?: string;
  role: 'ADMIN' | 'ARCHITECT';
  company?: string;
  tutorialCompleted: boolean;
  testUserId?: string;
  createdAt: Date;
  updatedAt: Date;
  chatbots: Chatbot[];
}
```

### Chatbot Model
```typescript
interface Chatbot {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  blocks: Block[];
  connections: Connection[];
  accesses: ChatbotAccess[];
  websiteContexts: WebsiteContext[];
  owner: AdminUser;
}
```

### Block Model
```typescript
interface Block {
  id: string;
  chatbotId: string;
  type: 'CONTEXT' | 'LOGIC' | 'ACTION' | 'FRONTEND';
  subtype: string;
  title: string;
  position: { x: number; y: number };
  properties: Record<string, any>;
  fromConnections: Connection[];
  toConnections: Connection[];
}
```

### WebsiteContext Model
```typescript
interface WebsiteContext {
  id: string;
  chatbotId: string;
  blockId: string;
  url: string;
  recursive: boolean;
  maxDepth: number;
  crawlingStatus?: {
    status: 'queued' | 'crawling' | 'completed' | 'error';
    progress?: number;
    total?: number;
    currentUrl?: string;
  };
  lastCrawledAt?: Date;
  crawledPagesCount?: number;
  cronEnabled: boolean;
  cronSchedule?: string;
  cronTimezone: string;
  nextCrawlAt?: Date;
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
  chatbot: Chatbot;
  user?: User;
}
```

## Block Editor System

### Block Types

#### 1. Context Blocks
**Purpose**: Knowledge source integration

**Subtypes**:
- **Website Context**: Web crawling configuration
- **Document Context**: File upload and processing
- **API Context**: External API integration

**Properties**:
```typescript
interface WebsiteContextProperties {
  url: string;
  recursive: boolean;
  maxDepth: number;
  cronEnabled: boolean;
  cronSchedule?: string;
  cronTimezone: string;
}
```

#### 2. Logic Blocks
**Purpose**: AI behavior and prompt configuration

**Subtypes**:
- **System Prompt**: Core AI personality and instructions
- **Conditional Logic**: If-then decision trees
- **Response Templates**: Predefined response patterns

**Properties**:
```typescript
interface SystemPromptProperties {
  botName: string;
  companyName: string;
  behavior: 'helpful' | 'professional' | 'casual' | 'technical' | 'creative' | 'supportive';
  additionalInstructions: string;
  prompt: string;
}
```

#### 3. Action Blocks
**Purpose**: External integrations and actions

**Subtypes**:
- **API Call**: External service integration
- **Email Action**: Email sending capabilities
- **Webhook**: External system notifications

#### 4. Frontend Blocks
**Purpose**: User interface configuration

**Subtypes**:
- **Custom Interface**: Chat interface customization
- **Form Builder**: Data collection forms
- **Button Actions**: Interactive elements

**Properties**:
```typescript
interface CustomInterfaceProperties {
  title: string;
  description: string;
  theme: 'light' | 'dark' | 'auto';
  primaryColor: string;
  secondaryColor: string;
  logo?: string;
}
```

### Block Editor Features

**Visual Editor**:
- **Drag & Drop**: Intuitive block placement
- **Connection System**: Visual flow connections
- **Real-time Preview**: Live chatbot testing
- **Undo/Redo**: Action history management

**Block Management**:
- **CRUD Operations**: Create, read, update, delete blocks
- **Position Management**: Coordinate-based positioning
- **Connection Management**: Block relationship handling
- **Validation**: Block configuration validation

## Crawling Integration

### Crawling Service Communication

**Service Integration**:
- **HTTP Client**: Axios for service communication
- **Error Handling**: Comprehensive error management
- **Retry Logic**: Automatic retry for failed requests
- **Status Monitoring**: Real-time crawling status

**API Endpoints**:
```typescript
// Start crawling job
POST /crawl
{
  url: string;
  chatbotId: string;
  blockId: string;
  recursive: boolean;
  maxDepth: number;
}

// Get crawling status
GET /status/:blockId

// Stop crawling job
POST /stop
{
  chatbotId: string;
  blockId: string;
}
```

### Cron Scheduler Integration

**Scheduled Crawling**:
- **Cron Expressions**: Full cron syntax support
- **Timezone Support**: Global timezone handling
- **Schedule Management**: CRUD operations for schedules
- **Automatic Triggering**: Background job execution

**API Endpoints**:
```typescript
// Update cron settings
POST /cron/update
{
  blockId: string;
  cronEnabled: boolean;
  cronSchedule: string;
  cronTimezone: string;
}

// Get cron status
GET /cron/status/:blockId

// Unschedule task
DELETE /cron/unschedule/:blockId
```

## Document Processing

### Supported Formats

**File Types**:
- **PDF**: Portable Document Format
- **TXT**: Plain text files
- **MD**: Markdown files
- **DOCX**: Microsoft Word documents (planned)

**Processing Pipeline**:
1. **File Upload**: Multer middleware handling
2. **Format Detection**: Automatic file type detection
3. **Content Extraction**: Text extraction from files
4. **Markdown Conversion**: Structured content conversion
5. **Chunking**: Content splitting for vector storage
6. **Vectorization**: Embedding generation
7. **Storage**: Weaviate vector database storage

### Document Management

**Storage Strategy**:
- **File Storage**: Local or cloud storage
- **Metadata Storage**: PostgreSQL database
- **Vector Storage**: Weaviate for semantic search
- **Cleanup**: Automatic file cleanup on deletion

**Security**:
- **File Validation**: Type and size validation
- **Virus Scanning**: Malware detection (planned)
- **Access Control**: User-based file access
- **Encryption**: File encryption at rest

## User Access Control

### Permission System

**Access Levels**:
- **Owner**: Full chatbot control
- **Editor**: Modify chatbot configuration
- **Viewer**: Read-only access
- **Tester**: Test chatbot functionality

**Permission Matrix**:

| Action | Owner | Editor | Viewer | Tester |
|--------|-------|--------|--------|--------|
| View Chatbot | ✅ | ✅ | ✅ | ✅ |
| Edit Blocks | ✅ | ✅ | ❌ | ❌ |
| Manage Users | ✅ | ❌ | ❌ | ❌ |
| Delete Chatbot | ✅ | ❌ | ❌ | ❌ |
| Test Chatbot | ✅ | ✅ | ❌ | ✅ |

### User Management

**User Invitation**:
- **Email-based**: Invite users by email
- **Auto-creation**: Automatic user account creation
- **Access Assignment**: Automatic access granting
- **Notification**: Email notifications for invitations

**Access Control**:
- **Granular Permissions**: Per-chatbot permissions
- **Role-based Access**: Predefined permission sets
- **Inheritance**: Permission inheritance from owner
- **Audit Trail**: Access and modification logging

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
| `FORBIDDEN` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `VALIDATION_ERROR` | Invalid request data | 400 |
| `DUPLICATE_EMAIL` | Email already exists | 409 |
| `CRAWL_ERROR` | Crawling operation failed | 500 |
| `DOCUMENT_ERROR` | Document processing failed | 500 |
| `INTERNAL_ERROR` | Server error | 500 |

### Error Examples

#### Validation Error
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "name": "Chatbot name is required",
    "email": "Invalid email format"
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

## Performance Optimization

### Caching Strategy

**Application Level**:
- **Chatbot Configs**: Cached chatbot configurations
- **User Sessions**: In-memory session cache
- **Block Templates**: Cached block templates
- **API Responses**: Cached external API responses

**Database Level**:
- **Query Optimization**: Indexed queries and joins
- **Connection Pooling**: Efficient database connections
- **Read Replicas**: Read-only database replicas
- **Query Caching**: Database query result caching

### Response Optimization

**Batch Operations**:
- **Block Updates**: Batch block modifications
- **User Management**: Batch user operations
- **Status Updates**: Batch status updates
- **File Processing**: Batch file operations

**Async Processing**:
- **Document Processing**: Background file processing
- **Crawling Jobs**: Asynchronous crawling operations
- **Email Notifications**: Background email sending
- **Status Updates**: Real-time status updates

## Monitoring & Logging

### Key Metrics

**Performance Metrics**:
- **Response Time**: API endpoint performance
- **Throughput**: Requests per second
- **Error Rate**: Error frequency and types
- **Resource Usage**: CPU, memory, disk usage

**Business Metrics**:
- **Active Admins**: Concurrent admin users
- **Chatbot Count**: Total chatbots created
- **Crawling Jobs**: Active crawling operations
- **Document Uploads**: File processing volume

### Logging Strategy

**Structured Logging**:
```json
{
  "timestamp": "2025-01-01T10:00:00Z",
  "level": "INFO",
  "service": "admin-service",
  "requestId": "req-123",
  "adminId": "admin-456",
  "endpoint": "/api/admin/chatbots",
  "method": "POST",
  "statusCode": 201,
  "responseTime": 250
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
    "crawling-service": "healthy",
    "cron-scheduler": "healthy",
    "weaviate": "healthy"
  }
}
```

## Security Considerations

### Authentication & Authorization

**JWT Token Structure**:
```json
{
  "id": "admin-123",
  "email": "admin@example.com",
  "role": "ADMIN",
  "iat": 1640995200,
  "exp": 1640998800
}
```

**Role-based Access Control**:
- **ADMIN**: Full platform access
- **ARCHITECT**: Limited administrative access
- **Service Level**: Internal service communication
- **API Level**: Rate limiting and throttling

### Input Validation

**Request Validation**:
- **Email Format**: RFC 5322 compliance
- **Password Strength**: Minimum requirements
- **File Uploads**: Type and size validation
- **Block Configuration**: Schema validation

**Security Measures**:
- **SQL Injection Prevention**: Prisma ORM protection
- **XSS Protection**: Input sanitization
- **CSRF Protection**: Token-based protection
- **File Upload Security**: Type and content validation

### Data Protection

**Encryption**:
- **In Transit**: HTTPS/TLS for all communications
- **At Rest**: Database encryption
- **Passwords**: bcrypt hashing with salt
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
- Crawling Service running
- Cron Scheduler running

**Installation**:
```bash
cd admin/backend
npm install
cp .env.example .env
npm run dev
```

**Environment Variables**:
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/citadel_db
JWT_SECRET=your_jwt_secret
CRAWLING_SERVICE_URL=http://localhost:3001
CRON_SCHEDULER_URL=http://localhost:3004
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
EXPOSE 3002
CMD ["npm", "start"]
```

**Docker Compose**:
```yaml
admin-backend:
  build: ./admin/backend
  ports:
    - "3002:3002"
  environment:
    - DATABASE_URL=postgresql://user:pass@db:5432/citadel_db
    - CRAWLING_SERVICE_URL=http://crawling-service:3001
    - CRON_SCHEDULER_URL=http://cron-scheduler:3002
  depends_on:
    - db
    - crawling-service
    - cron-scheduler
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

*This documentation is maintained alongside the codebase and reflects the current state of the Admin Service. For API implementation details, refer to the source code in `admin/backend/src/`.*