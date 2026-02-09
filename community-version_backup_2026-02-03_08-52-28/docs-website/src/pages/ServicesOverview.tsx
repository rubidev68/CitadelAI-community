import MarkdownRenderer from "@/components/MarkdownRenderer";

const ServicesOverview = () => {
  const content = `# Services Overview

Complete overview of all microservices in CitadelAI.

## Architecture Overview

CitadelAI follows a microservices architecture with clear separation of concerns. All services communicate through the \`citadel-net\` Docker network.

\`\`\`mermaid
graph TB
    subgraph "Frontend Services"
        UF[User Frontend<br/>Port 80]
        AF[Admin Frontend<br/>Port 80]
    end
    
    subgraph "Backend Services"
        UB[User Backend<br/>Port 3003]
        AB[Admin Backend<br/>Port 3002]
        CS[Crawling Service<br/>Port 3001]
        CR[Cron Scheduler<br/>Port 3004]
    end
    
    subgraph "Data Services"
        PG[(PostgreSQL<br/>Port 5432)]
        WV[(Weaviate<br/>Port 8080)]
    end
    
    UF --> UB
    AF --> AB
    UB --> PG
    UB --> WV
    AB --> PG
    AB --> CS
    CS --> PG
    CS --> WV
    CR --> PG
    CR --> WV
\`\`\`

## Service Details

### User Service (Port 3003)

**Purpose**: Handles user-facing chatbot interactions and authentication.

**Key Features:**
- User registration and authentication
- Chat session management
- Real-time AI responses with streaming (SSE)
- Chatbot access control
- Message history and persistence

**API Endpoints:**
- \`POST /api/auth/register\` - User registration
- \`POST /api/auth/login\` - User login
- \`POST /api/chat/respond\` - Send message (standard)
- \`POST /api/chat/respond-streaming\` - Send message (streaming)
- \`GET /api/chat/history\` - Get chat history
- \`GET /api/chatbots\` - List accessible chatbots

**Dependencies:**
- PostgreSQL (user data, chat history)
- Weaviate (semantic search for context)
- AI Providers (Gemini, OpenAI, Anthropic, Mistral)

[View User Service API →](/api/user-service)

### Admin Service (Port 3002)

**Purpose**: Provides administrative interface for chatbot management.

**Key Features:**
- Admin user management
- Chatbot creation and configuration
- Block-based visual editor API
- User access management
- Website context configuration
- Document processing
- Performance monitoring

**API Endpoints:**
- \`POST /api/admin/auth/register\` - Admin registration
- \`POST /api/admin/chatbots\` - Create chatbot
- \`PUT /api/admin/chatbots/:id\` - Update chatbot
- \`POST /api/admin/crawl\` - Start crawling job
- \`GET /api/admin/dashboard/stats\` - Dashboard statistics

**Dependencies:**
- PostgreSQL (admin data, chatbot configs)
- Crawling Service (web content indexing)
- User Service (user access management)

[View Admin Service API →](/api/admin-service)

### Crawling Service (Port 3001)

**Purpose**: Handles web crawling and content indexing.

**Key Features:**
- Multi-level parallelization (4 jobs × 5 pages = 20 concurrent operations)
- Intelligent content extraction with Puppeteer
- Advanced page type detection (SPA, social media, e-commerce)
- Batch content processing and markdown conversion
- Weaviate integration for vector storage
- Real-time status updates and health monitoring

**API Endpoints:**
- \`POST /crawl\` - Start crawling job
- \`GET /status/:blockId\` - Get crawling status
- \`POST /stop\` - Stop crawling job
- \`GET /health\` - Health check

**Dependencies:**
- PostgreSQL (crawling status, job queue)
- Weaviate (vector storage for indexed content)

[View Crawling Service API →](/api/crawling-service)

### Cron Scheduler Service (Port 3004)

**Purpose**: Handles scheduled tasks and automated crawling.

**Key Features:**
- Scheduled crawling jobs
- Automated content updates
- Task queue management
- Health monitoring

**Dependencies:**
- PostgreSQL (scheduled tasks)
- Weaviate (content updates)
- Crawling Service (triggering crawls)

## Data Services

### PostgreSQL (Port 5432)

**Purpose**: Primary relational database for all structured data.

**Stores:**
- User accounts and authentication
- Admin accounts
- Chatbot configurations
- Chat sessions and messages
- Crawling job status
- User access permissions
- Document metadata

**Connection:**
- Connection string: \`postgresql://user:password@postgres:5432/citadel_db\`
- Connection pooling enabled
- Automatic reconnection on failure

### Weaviate (Port 8080)

**Purpose**: Vector database for semantic search and AI context.

**Stores:**
- Vectorized website content
- Document embeddings
- Semantic search indices

**Features:**
- OpenAI text2vec for embeddings
- Semantic similarity search
- Automatic schema management

## Service Communication Flow

\`\`\`mermaid
sequenceDiagram
    participant User
    participant UF as User Frontend
    participant UB as User Backend
    participant PG as PostgreSQL
    participant WV as Weaviate
    participant AI as AI Provider
    
    User->>UF: Send Message
    UF->>UB: POST /api/chat/respond
    UB->>PG: Get Chat History
    UB->>WV: Semantic Search
    WV-->>UB: Relevant Context
    UB->>AI: Generate Response
    AI-->>UB: Stream Response
    UB-->>UF: SSE Stream
    UF-->>User: Display Response
\`\`\`

## Admin Workflow

\`\`\`mermaid
sequenceDiagram
    participant Admin
    participant AF as Admin Frontend
    participant AB as Admin Backend
    participant CS as Crawling Service
    participant PG as PostgreSQL
    participant WV as Weaviate
    
    Admin->>AF: Create Chatbot
    AF->>AB: POST /api/admin/chatbots
    AB->>PG: Save Config
    Admin->>AF: Start Crawling
    AF->>AB: POST /api/admin/crawl
    AB->>CS: POST /crawl
    CS->>PG: Update Status
    CS->>WV: Index Content
    CS-->>AB: Status Updates
    AB-->>AF: Progress
\`\`\`

## Network Architecture

All services run in the same Docker network (\`citadel-net\`) and communicate using service names:

- \`user-backend:3003\`
- \`admin-backend:3002\`
- \`crawling-service:3001\`
- \`cron-scheduler:3004\`
- \`postgres:5432\`
- \`weaviate:8080\`

## Service Ports

| Service | Internal Port | External Port | Purpose |
|---------|--------------|---------------|---------|
| User Frontend | 80 | - | User-facing React app |
| Admin Frontend | 80 | - | Admin-facing React app |
| User Backend | 3003 | - | User API |
| Admin Backend | 3002 | - | Admin API |
| Crawling Service | 3001 | - | Web crawling |
| Cron Scheduler | 3004 | - | Scheduled tasks |
| PostgreSQL | 5432 | - | Database |
| Weaviate | 8080 | - | Vector DB |

## Health Checks

All services implement health check endpoints:

- **User Backend**: \`GET /health\`
- **Admin Backend**: \`GET /health\`
- **Crawling Service**: \`GET /health\`
- **Cron Scheduler**: \`GET /health\`

## Environment Variables

Each service requires specific environment variables:

### Common Variables
- \`DATABASE_URL\` - PostgreSQL connection string
- \`WEAVIATE_URL\` - Weaviate connection URL
- \`JWT_SECRET\` - JWT signing secret
- \`NODE_ENV\` - Environment (production/development)

### Service-Specific
- **User Backend**: \`OPENAI_API_KEY\`, \`GEMINI_API_KEY\`, \`ANTHROPIC_API_KEY\`
- **Admin Backend**: \`CRAWLING_SERVICE_URL\`, \`USER_API_INTERNAL_URL\`
- **Crawling Service**: \`OPENAI_API_KEY\`, \`GEMINI_API_KEY\`

## Deployment

Services are deployed using Docker Compose:

\`\`\`yaml
services:
  user-backend:
    image: ghcr.io/user/citadelai/user-backend:latest
    ports:
      - "3003:3003"
    environment:
      DATABASE_URL: postgresql://...
      WEAVIATE_URL: http://weaviate:8080
\`\`\`

## Monitoring

- **Logs**: All services output structured JSON logs
- **Health Checks**: Docker health checks for all services
- **Metrics**: Service-level metrics available via health endpoints

## Next Steps

- [API Reference](/api/overview) - Complete API documentation
- [Architecture Overview](/architecture/overview) - System architecture details
- [Contributing Guide](/contributing/guide) - How to contribute
`;

  return (
    <div>
      <MarkdownRenderer content={content} />
    </div>
  );
};

export default ServicesOverview;
