import MarkdownRenderer from "@/components/MarkdownRenderer";

const CrawlingServiceAPI = () => {
  const content = `# Crawling Service API

Complete API documentation for the Crawling Service (Port 3001).

## Overview

The Crawling Service handles web crawling and content indexing for chatbot knowledge bases. It extracts content from websites, processes it, and stores it in Weaviate vector database for semantic search.

## Base URL

\`http://localhost:3001\` or \`https://api.citadelai.app/crawl\`

## Architecture Flow

\`\`\`mermaid
graph LR
    A[Admin Backend] -->|Trigger| B[Crawling Service]
    B -->|Fetch| C[Website]
    B -->|Extract| D[Content Processor]
    D -->|Store| E[PostgreSQL]
    D -->|Index| F[Weaviate]
    B -->|Status| A
\`\`\`

## Features

- **Parallel Crawling**: Up to 4 concurrent jobs with 5 crawlers each (20 total)
- **Intelligent Extraction**: Puppeteer-based content extraction
- **Page Type Detection**: Automatically detects SPA, social media, e-commerce
- **Batch Processing**: Efficient content processing and markdown conversion
- **Real-time Status**: Live progress updates via status endpoint

## Primary Endpoints

### Start Crawling Job (Optimized)

Starts an optimized crawling job with parallel processing.

\`\`\`http
POST /crawl
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
  "message": "Optimized crawling job added to the queue",
  "jobId": "job-123",
  "estimatedTime": "5-10 minutes"
}
\`\`\`

**Parameters:**
- \`url\` (string, required) - Starting URL to crawl
- \`chatbotId\` (string, required) - Chatbot ID
- \`blockId\` (string, required) - Block ID for context
- \`recursive\` (boolean, optional) - Enable recursive crawling (default: true)
- \`maxDepth\` (number, optional) - Maximum crawl depth (default: 3)

### Start Crawling Job (Legacy)

Legacy endpoint for backward compatibility.

\`\`\`http
POST /crawl-legacy
Content-Type: application/json

{
  "url": "https://example.com",
  "chatbotId": "chatbot-456",
  "blockId": "block-789",
  "recursive": false,
  "maxDepth": 1
}
\`\`\`

**Response:**
\`\`\`json
{
  "message": "Legacy crawling job added to the queue",
  "jobId": "job-124"
}
\`\`\`

### Get Crawling Status

Get real-time status of a crawling job.

\`\`\`http
GET /status/:blockId
\`\`\`

**Response:**
\`\`\`json
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
\`\`\`

**Status Values:**
- \`pending\` - Job queued, waiting to start
- \`crawling\` - Actively crawling
- \`processing\` - Processing crawled content
- \`completed\` - Job finished successfully
- \`failed\` - Job failed with error
- \`stopped\` - Job stopped by user

### Stop Crawling Job

Stop an active crawling job.

\`\`\`http
POST /stop
Content-Type: application/json

{
  "chatbotId": "chatbot-456",
  "blockId": "block-789"
}
\`\`\`

**Response:**
\`\`\`json
{
  "message": "Crawling stopped for block",
  "blockId": "block-789",
  "stoppedAt": "2025-01-01T10:05:00Z"
}
\`\`\`

### Health Check

Check service health and status.

\`\`\`http
GET /health
\`\`\`

**Response:**
\`\`\`json
{
  "status": "healthy",
  "timestamp": "2025-01-01T10:00:00Z",
  "version": "1.0.0",
  "uptime": "2h 30m 15s"
}
\`\`\`

### Get Concurrency Status

Get current concurrency and resource usage.

\`\`\`http
GET /concurrency-status
\`\`\`

**Response:**
\`\`\`json
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
      "jobId": "job-123",
      "blockId": "block-789",
      "status": "crawling",
      "progress": 5,
      "total": 10
    }
  ]
}
\`\`\`

## Crawling Process

\`\`\`mermaid
sequenceDiagram
    participant Admin
    participant Service
    participant Website
    participant Processor
    participant Weaviate
    
    Admin->>Service: POST /crawl
    Service->>Service: Queue Job
    Service->>Website: Fetch Pages (Parallel)
    Website-->>Service: HTML Content
    Service->>Processor: Extract & Process
    Processor->>Weaviate: Index Vectors
    Service->>Admin: Status Updates
\`\`\`

## Content Processing

The service processes content through several stages:

1. **Fetch**: Download HTML from URLs
2. **Extract**: Use Puppeteer to extract meaningful content
3. **Detect**: Identify page type (SPA, social, e-commerce)
4. **Convert**: Transform to markdown format
5. **Chunk**: Split into semantic chunks
6. **Vectorize**: Generate embeddings
7. **Index**: Store in Weaviate

## Rate Limiting

- **Concurrent Jobs**: Maximum 4 jobs at once
- **Crawlers per Job**: Maximum 5 parallel crawlers per job
- **Total Crawlers**: Maximum 20 total active crawlers
- **Queue**: Jobs beyond limits are queued

## Error Handling

### Common Errors

\`\`\`json
{
  "error": "Invalid URL format",
  "statusCode": 400
}
\`\`\`

\`\`\`json
{
  "error": "Maximum crawl depth exceeded",
  "statusCode": 400
}
\`\`\`

\`\`\`json
{
  "error": "Crawling service unavailable",
  "statusCode": 503
}
\`\`\`

## Best Practices

1. **Start with Shallow Depth**: Begin with \`maxDepth: 1\` to test
2. **Monitor Status**: Poll \`/status/:blockId\` for progress
3. **Respect Rate Limits**: Don't exceed concurrency limits
4. **Handle Errors**: Implement retry logic for failed jobs
5. **Stop Unnecessary Jobs**: Use \`/stop\` to cancel long-running jobs

## Integration Example

\`\`\`javascript
// Start crawling
const response = await fetch('http://localhost:3001/crawl', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://example.com',
    chatbotId: 'chatbot-456',
    blockId: 'block-789',
    recursive: true,
    maxDepth: 3
  })
});

// Poll for status
const pollStatus = async (blockId) => {
  const status = await fetch(\`http://localhost:3001/status/\${blockId}\`);
  const data = await status.json();
  
  if (data.status === 'completed') {
    console.log('Crawling finished!');
  } else if (data.status === 'crawling') {
    console.log(\`Progress: \${data.progress}/\${data.total}\`);
    setTimeout(() => pollStatus(blockId), 5000);
  }
};
\`\`\`

## Next Steps

- [Admin Service API](/api/admin-service) - Admin API that triggers crawling
- [User Service API](/api/user-service) - User API that uses indexed content
- [Services Overview](/services/overview) - Understand service architecture
`;

  return (
    <div>
      <MarkdownRenderer content={content} />
    </div>
  );
};

export default CrawlingServiceAPI;
