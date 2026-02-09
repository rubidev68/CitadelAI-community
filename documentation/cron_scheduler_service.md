# Cron Scheduler Service Documentation

The Cron Scheduler Service is a dedicated Node.js service that manages scheduled crawling tasks for the CitadelAI platform. It provides comprehensive cron job management, timezone support, and automated crawling job triggering to ensure content stays fresh and up-to-date.

## Overview

**Service**: Cron Scheduler Service  
**Port**: 3004 (external), 3002 (internal)  
**Technology**: Node.js + Express + TypeScript  
**Database**: PostgreSQL with Prisma ORM  
**Scheduling**: node-cron for cron job management  
**Timezone Support**: Full timezone handling with cron-parser  
**External Integration**: Crawling Service API  

## Architecture

### Service Components

```mermaid
graph TD
    A[Admin Service] --> B[Cron Scheduler API]
    B --> C[Cron Manager]
    B --> D[Schedule Controller]
    B --> E[Timezone Handler]
    B --> F[Job Trigger]
    B --> G[Middleware Layer]
    
    C --> H[Cron Job Management]
    D --> I[Schedule CRUD Operations]
    E --> J[Timezone Conversion]
    F --> K[Crawling Service Integration]
    G --> L[Auth Middleware]
    G --> M[Logging Middleware]
    G --> N[Error Handling]
    
    H --> O[PostgreSQL Database]
    I --> O
    J --> P[Timezone Database]
    K --> Q[Crawling Service API]
```

### Key Features

- **Cron Job Management**: Full cron expression support with validation
- **Timezone Support**: Global timezone handling for international deployments
- **Schedule Persistence**: Database-backed schedule storage and retrieval
- **Automatic Triggering**: Background job execution and monitoring
- **Error Handling**: Comprehensive error management and retry logic
- **Status Monitoring**: Real-time schedule status and next execution times
- **Graceful Shutdown**: Clean shutdown with job completion
- **Health Monitoring**: Service health checks and status reporting

## API Endpoints

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

## Cron Expression Support

### Standard Cron Format

The service supports the standard 5-field cron format:

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday = 0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

### Special Characters

| Character | Description | Example |
|-----------|-------------|---------|
| `*` | Any value | `* * * * *` (every minute) |
| `,` | List of values | `0,15,30,45 * * * *` (every 15 minutes) |
| `-` | Range of values | `0 9-17 * * *` (9 AM to 5 PM) |
| `/` | Step values | `*/15 * * * *` (every 15 minutes) |
| `?` | No specific value | `0 0 ? * *` (daily at midnight) |

### Common Cron Patterns

| Pattern | Description | Cron Expression |
|---------|-------------|-----------------|
| Every minute | Every minute | `* * * * *` |
| Every 5 minutes | Every 5 minutes | `*/5 * * * *` |
| Every hour | At minute 0 | `0 * * * *` |
| Every 6 hours | At 0, 6, 12, 18 | `0 */6 * * *` |
| Daily at midnight | Every day at 00:00 | `0 0 * * *` |
| Daily at 9 AM | Every day at 09:00 | `0 9 * * *` |
| Weekly on Monday | Every Monday at 00:00 | `0 0 * * 1` |
| Monthly on 1st | 1st of every month | `0 0 1 * *` |
| Business hours | 9 AM to 5 PM, weekdays | `0 9-17 * * 1-5` |

## Timezone Support

### Supported Timezones

The service supports all IANA timezone identifiers:

**Common Timezones**:
- `UTC`: Coordinated Universal Time
- `America/New_York`: Eastern Time (US)
- `America/Chicago`: Central Time (US)
- `America/Denver`: Mountain Time (US)
- `America/Los_Angeles`: Pacific Time (US)
- `Europe/London`: Greenwich Mean Time
- `Europe/Paris`: Central European Time
- `Asia/Tokyo`: Japan Standard Time
- `Asia/Shanghai`: China Standard Time
- `Australia/Sydney`: Australian Eastern Time

### Timezone Handling

**Timezone Conversion**:
```typescript
// Convert UTC time to specific timezone
const utcTime = new Date('2025-01-01T00:00:00Z');
const timezone = 'America/New_York';
const localTime = convertToTimezone(utcTime, timezone);
// Result: 2025-01-01T19:00:00-05:00 (EST)
```

**Next Execution Calculation**:
```typescript
// Calculate next execution time
const cronExpression = '0 0 * * *'; // Daily at midnight
const timezone = 'America/New_York';
const nextExecution = calculateNextCrawl(cronExpression, timezone);
// Result: Next midnight in New York timezone
```

## Data Models

### WebsiteContext Model (Extended)

```typescript
interface WebsiteContext {
  id: string;
  chatbotId: string;
  blockId: string;
  url: string;
  recursive: boolean;
  maxDepth: number;
  crawlingStatus?: CrawlingStatus;
  lastCrawledAt?: Date;
  crawledPagesCount?: number;
  
  // Cron scheduling fields
  cronEnabled: boolean;
  cronSchedule?: string;        // Cron expression
  cronTimezone: string;         // IANA timezone identifier
  nextCrawlAt?: Date;          // Next scheduled execution
}
```

### Cron Job Model (Internal)

```typescript
interface CronJob {
  id: string;
  blockId: string;
  cronExpression: string;
  timezone: string;
  nextExecution: Date;
  lastExecution?: Date;
  executionCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Crawling Status Model

```typescript
interface CrawlingStatus {
  status: 'queued' | 'crawling' | 'completed' | 'error' | 'idle';
  progress?: number;
  total?: number;
  currentUrl?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}
```

## Cron Job Management

### Job Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: Schedule created
    Created --> Active: Cron enabled
    Active --> Executing: Trigger time reached
    Executing --> Completed: Job finished
    Executing --> Error: Job failed
    Completed --> Active: Next schedule
    Error --> Active: Retry logic
    Active --> Inactive: Cron disabled
    Inactive --> Active: Cron enabled
    Inactive --> [*]: Schedule deleted
    Error --> [*]: Max retries exceeded
```

### Job Execution Flow

1. **Schedule Creation**: Admin creates or updates cron schedule
2. **Validation**: Cron expression and timezone validation
3. **Job Registration**: Job registered with node-cron scheduler
4. **Execution Trigger**: Job triggered at scheduled time
5. **Crawling Service Call**: HTTP request to crawling service
6. **Status Update**: Database status and next execution update
7. **Error Handling**: Error logging and retry logic
8. **Next Schedule**: Calculate and schedule next execution

### Error Handling

**Retry Logic**:
- **Max Retries**: 3 attempts for failed jobs
- **Exponential Backoff**: Increasing delay between retries
- **Error Logging**: Detailed error logging and monitoring
- **Graceful Degradation**: Continue with other jobs on failure

**Error Types**:
- **Validation Errors**: Invalid cron expressions or timezones
- **Network Errors**: Crawling service unavailable
- **Database Errors**: Database connection or query failures
- **Scheduling Errors**: Node-cron scheduling failures

## Crawling Service Integration

### Service Communication

**HTTP Client Configuration**:
```typescript
const CRAWLING_SERVICE_URL = process.env.CRAWLING_SERVICE_URL || 'http://crawling-service:3001';

// Start crawling job
const response = await axios.post(`${CRAWLING_SERVICE_URL}/crawl`, {
  url: websiteContext.url,
  chatbotId: websiteContext.chatbotId,
  blockId: websiteContext.blockId,
  recursive: websiteContext.recursive,
  maxDepth: websiteContext.maxDepth
});
```

**Error Handling**:
```typescript
try {
  const response = await axios.post(crawlingUrl, crawlData);
  // Update status to queued
  await updateCrawlingStatus(blockId, { status: 'queued' });
} catch (error) {
  // Log error and update status
  console.error('Crawling service error:', error);
  await updateCrawlingStatus(blockId, { 
    status: 'error', 
    error: error.message 
  });
}
```

### Status Monitoring

**Real-time Status Updates**:
- **Job Initiation**: Status updated to 'queued'
- **Job Progress**: Periodic status checks
- **Job Completion**: Status updated to 'completed'
- **Job Failure**: Status updated to 'error'

**Status Polling**:
```typescript
// Poll crawling service for status updates
const pollStatus = async (blockId: string) => {
  try {
    const response = await axios.get(`${CRAWLING_SERVICE_URL}/status/${blockId}`);
    await updateCrawlingStatus(blockId, response.data);
  } catch (error) {
    console.error('Status polling error:', error);
  }
};
```

## Database Operations

### Schedule Management

**Create Schedule**:
```sql
INSERT INTO website_context (
  id, chatbot_id, block_id, url, recursive, max_depth,
  cron_enabled, cron_schedule, cron_timezone, next_crawl_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
);
```

**Update Schedule**:
```sql
UPDATE website_context 
SET cron_enabled = $1, cron_schedule = $2, cron_timezone = $3, next_crawl_at = $4
WHERE block_id = $5;
```

**Get Active Schedules**:
```sql
SELECT * FROM website_context 
WHERE cron_enabled = true 
AND cron_schedule IS NOT NULL
ORDER BY next_crawl_at ASC;
```

### Status Updates

**Update Crawling Status**:
```sql
UPDATE website_context 
SET crawling_status = $1, last_crawled_at = $2, crawled_pages_count = $3
WHERE block_id = $4;
```

**Update Next Execution**:
```sql
UPDATE website_context 
SET next_crawl_at = $1
WHERE block_id = $2;
```

## Performance Optimization

### Job Scheduling

**Efficient Scheduling**:
- **Single Scheduler**: One node-cron instance for all jobs
- **Job Queuing**: Queue management for high-frequency jobs
- **Memory Management**: Efficient job storage and cleanup
- **CPU Optimization**: Minimal CPU usage during idle periods

**Batch Operations**:
- **Batch Status Updates**: Group database updates
- **Batch Job Creation**: Multiple job creation in single transaction
- **Batch Cleanup**: Periodic cleanup of old jobs and logs

### Database Optimization

**Query Optimization**:
- **Indexed Queries**: Proper indexing on frequently queried fields
- **Connection Pooling**: Efficient database connection management
- **Query Caching**: Cache frequently accessed data
- **Batch Updates**: Group database operations

**Performance Monitoring**:
- **Query Performance**: Monitor slow queries
- **Connection Usage**: Track database connections
- **Memory Usage**: Monitor memory consumption
- **Job Execution Time**: Track job performance

## Monitoring & Logging

### Key Metrics

**Scheduling Metrics**:
- **Active Jobs**: Number of currently scheduled jobs
- **Execution Rate**: Jobs executed per hour/day
- **Success Rate**: Percentage of successful executions
- **Error Rate**: Percentage of failed executions

**Performance Metrics**:
- **Job Execution Time**: Average time per job
- **Database Query Time**: Database performance
- **Memory Usage**: Service memory consumption
- **CPU Usage**: Service CPU utilization

### Logging Strategy

**Structured Logging**:
```json
{
  "timestamp": "2025-01-01T10:00:00Z",
  "level": "INFO",
  "service": "cron-scheduler",
  "jobId": "job-123",
  "blockId": "block-789",
  "action": "job_executed",
  "status": "success",
  "executionTime": 1500,
  "nextExecution": "2025-01-02T00:00:00Z"
}
```

**Log Levels**:
- **DEBUG**: Detailed job execution information
- **INFO**: General job lifecycle events
- **WARN**: Warning conditions and retries
- **ERROR**: Error conditions and failures

### Health Monitoring

**Service Health**:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T10:00:00Z",
  "scheduler": {
    "activeJobs": 3,
    "totalSchedules": 15,
    "nextExecution": "2025-01-01T12:00:00Z",
    "lastExecution": "2025-01-01T06:00:00Z"
  },
  "database": "healthy",
  "crawlingService": "healthy"
}
```

## Error Handling

### Error Types

**Validation Errors**:
- **Invalid Cron Expression**: Malformed cron syntax
- **Invalid Timezone**: Unsupported timezone identifier
- **Missing Required Fields**: Required parameters not provided
- **Invalid Date Range**: Invalid date calculations

**Runtime Errors**:
- **Database Connection**: Database connectivity issues
- **Crawling Service**: External service communication errors
- **Memory Issues**: Out of memory conditions
- **Scheduling Errors**: Node-cron scheduling failures

### Error Recovery

**Automatic Recovery**:
- **Database Reconnection**: Automatic database reconnection
- **Service Retry**: Retry failed service calls
- **Job Rescheduling**: Reschedule failed jobs
- **Graceful Degradation**: Continue operation with reduced functionality

**Manual Recovery**:
- **Job Restart**: Manual job restart capability
- **Schedule Reset**: Reset corrupted schedules
- **Service Restart**: Complete service restart
- **Data Recovery**: Database backup and recovery

## Security Considerations

### Access Control

**API Security**:
- **Input Validation**: Comprehensive input validation
- **Rate Limiting**: API rate limiting and throttling
- **Error Sanitization**: Sanitize error messages
- **Request Logging**: Log all API requests

**Data Security**:
- **Database Encryption**: Encrypted database connections
- **Sensitive Data**: Secure handling of sensitive information
- **Audit Logging**: Comprehensive audit trail
- **Access Logging**: Track all data access

### Input Validation

**Cron Expression Validation**:
```typescript
const validateCronExpression = (expression: string): boolean => {
  try {
    cronParser.parseExpression(expression);
    return true;
  } catch (error) {
    return false;
  }
};
```

**Timezone Validation**:
```typescript
const validateTimezone = (timezone: string): boolean => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
};
```

## Development & Testing

### Development Setup

**Prerequisites**:
- Node.js >= 18.0.0
- PostgreSQL database
- Crawling Service running
- Admin Service running

**Installation**:
```bash
cd cron-scheduler
npm install
cp .env.example .env
npm run dev
```

**Environment Variables**:
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/citadel_db
CRAWLING_SERVICE_URL=http://localhost:3001
PORT=3002
NODE_ENV=development
```

### Testing

**Test Types**:
- **Unit Tests**: Individual function testing
- **Integration Tests**: API endpoint testing
- **Cron Tests**: Cron expression and scheduling tests
- **Timezone Tests**: Timezone conversion and handling tests

**Test Commands**:
```bash
npm test                    # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:cron          # Cron-specific tests
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
cron-scheduler:
  build: ./cron-scheduler
  ports:
    - "3004:3002"
  environment:
    - DATABASE_URL=postgresql://user:pass@db:5432/citadel_db
    - CRAWLING_SERVICE_URL=http://crawling-service:3001
  depends_on:
    - db
    - crawling-service
```

### Production Considerations

**Scaling**:
- **Single Instance**: One scheduler instance to avoid conflicts
- **Database Scaling**: Read replicas for status queries
- **Monitoring**: Comprehensive monitoring and alerting
- **Backup**: Regular database backups

**High Availability**:
- **Health Checks**: Regular health check endpoints
- **Graceful Shutdown**: Clean shutdown with job completion
- **Restart Strategy**: Automatic restart on failure
- **Data Persistence**: Persistent schedule storage

**Performance**:
- **Resource Limits**: CPU and memory limits
- **Job Optimization**: Efficient job scheduling
- **Database Optimization**: Query and connection optimization
- **Monitoring**: Performance monitoring and alerting

---

*This documentation is maintained alongside the codebase and reflects the current state of the Cron Scheduler Service. For API implementation details, refer to the source code in `cron-scheduler/src/`.*