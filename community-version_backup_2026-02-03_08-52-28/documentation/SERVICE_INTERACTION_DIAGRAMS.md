# CitadelAI Service Interaction Diagrams

This document provides detailed visual diagrams showing the routes, data flow, and interactions between all services in the CitadelAI platform.

## Container Network Architecture

```mermaid
graph TB
    subgraph "Docker Network: citadel-net"
        subgraph "Frontend Containers"
            UF["user-frontend<br/>Port: 8080<br/>Internal: 80"]
            AF["admin-frontend<br/>Port: 8081<br/>Internal: 80"]
            BW["business-website<br/>Port: 8083<br/>Internal: 80"]
            SD["superadmin-dashboard-frontend<br/>Port: 8083<br/>Internal: 80"]
        end
        
        subgraph "Backend Containers"
            UB["user-backend<br/>Port: 3003<br/>Internal: 3003"]
            AB["admin-backend<br/>Port: 3002<br/>Internal: 3002"]
            CS["crawling-service<br/>Port: 3001<br/>Internal: 3001"]
            CRS["cron-scheduler<br/>Port: 3004<br/>Internal: 3002"]
            ES["email-service<br/>Port: 3008<br/>Internal: 3008"]
            SB["superadmin-dashboard-backend<br/>Port: 3007<br/>Internal: 3007"]
            IPS["instance-provisioning-service<br/>Port: 3007<br/>Internal: 3007"]
        end
        
        subgraph "Data Containers"
            PG[("PostgreSQL<br/>Port: 5432<br/>Internal: 5432")]
            WV[("Weaviate<br/>Port: 8082<br/>Internal: 8080")]
        end
    end
    
    subgraph "External Services"
        AI["AI Providers<br/>Gemini, OpenAI,<br/>Claude, Mistral"]
        INTERNET["Internet<br/>Website Crawling"]
    end
    
    UF -.->|HTTP Requests| UB
    AF -.->|HTTP Requests| AB
    BW -.->|HTTP Requests| UB
    BW -.->|HTTP Requests| AB
    SD -.->|HTTP Requests| SB
    
    UB -.->|SQL Queries| PG
    AB -.->|SQL Queries| PG
    CS -.->|SQL Queries| PG
    CRS -.->|SQL Queries| PG
    SB -.->|SQL Queries| PG
    IPS -.->|SQL Queries| PG
    
    UB -.->|Vector Operations| WV
    CS -.->|Content Indexing| WV
    
    AB -.->|Crawling Commands| CS
    CRS -.->|Scheduled Crawling| CS
    
    AB -.->|Email Sending| ES
    SB -.->|Email Sending| ES
    ES -.->|SMTP| SMTP
    
    SB -.->|Admin API| AB
    SB -.->|Instance Management| IPS
    
    UB -.->|AI Processing| AI
    CS -.->|Website Crawling| INTERNET
    
    classDef frontend fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef backend fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef data fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef external fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    
    class UF,AF,BW,SD frontend
    class UB,AB,CS,CRS,ES,SB,IPS backend
    class PG,WV data
    class AI,INTERNET,SMTP external
```

## API Route Mapping

### User Service Routes (Port 3003)

```mermaid
graph LR
    subgraph "User Backend Service :3003"
        subgraph "Authentication Routes /api/auth"
            A1[POST /register]
            A2[POST /login]
            A3[POST /logout]
            A4[GET /me]
        end
        
        subgraph "Chat Routes /api/chat"
            C1[POST /respond]
            C1S[POST /respond-streaming]
            C2[GET /history]
            C3[GET /]
            C4[POST /]
            C5[POST /:id/title]
            C6[DELETE /:id]
        end
        
        subgraph "Chatbot Routes /api/chatbots"
            CB1[GET /]
            CB2[GET /:id]
            CB3[POST /:chatbotId/set-default]
        end
    end
    
    UF[User Frontend] --> A1
    UF --> A2
    UF --> A3
    UF --> A4
    UF --> C1
    UF --> C1S
    UF --> C2
    UF --> C3
    UF --> C4
    UF --> C5
    UF --> C6
    UF --> CB1
    UF --> CB2
    UF --> CB3
    
    classDef route fill:#e1f5fe,stroke:#0277bd,stroke-width:1px
    classDef streaming fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    class A1,A2,A3,A4,C1,C2,C3,C4,C5,C6,CB1,CB2,CB3 route
    class C1S streaming
```

### Admin Service Routes (Port 3002)

```mermaid
graph LR
    subgraph "Admin Backend Service :3002"
        subgraph "Admin Auth Routes /api/admin/auth"
            AA1[POST /register]
            AA2[POST /login]
            AA3[POST /login-as-test-user]
            AA4[GET /me]
        end
        
        subgraph "Dashboard Routes /api/admin/dashboard"
            D1[GET /stats]
        end
        
        subgraph "Chatbot Management /api/admin/chatbots"
            AC1[POST /]
            AC2[GET /]
            AC3[GET /:id]
            AC4[PUT /:id]
            AC5[DELETE /:id]
            AC6[DELETE /:chatbotId/blocks/:blockId]
        end
        
        subgraph "User Access /api/admin/chatbots/:id/users"
            UA1[GET /]
            UA2[POST /]
            UA3[DELETE /:accessId]
        end
        
        subgraph "Crawling Proxy /api/admin"
            CR1[POST /crawl]
            CR2[GET /status/:blockId]
            CR3[POST /stop]
        end
    end
    
    AF[Admin Frontend] --> AA1
    AF --> AA2
    AF --> AA3
    AF --> AA4
    AF --> D1
    AF --> AC1
    AF --> AC2
    AF --> AC3
    AF --> AC4
    AF --> AC5
    AF --> AC6
    AF --> UA1
    AF --> UA2
    AF --> UA3
    AF --> CR1
    AF --> CR2
    AF --> CR3
    
    classDef route fill:#f3e5f5,stroke:#7b1fa2,stroke-width:1px
    class AA1,AA2,AA3,AA4,D1,AC1,AC2,AC3,AC4,AC5,AC6,UA1,UA2,UA3,CR1,CR2,CR3 route
```

### Crawling Service Routes (Port 3001)

```mermaid
graph LR
    subgraph "Crawling Service :3001"
        CR1[POST /crawl]
        CR2[GET /status/:blockId]
        CR3[POST /stop]
    end
    
    AB[Admin Backend] -.->|Proxy Requests| CR1
    AB -.->|Proxy Requests| CR2
    AB -.->|Proxy Requests| CR3
    
    classDef route fill:#e8f5e8,stroke:#388e3c,stroke-width:1px
    class CR1,CR2,CR3 route
```

### Cron Scheduler Routes (Port 3004)

```mermaid
graph LR
    subgraph "Cron Scheduler Service :3004"
        CRON1[POST /api/admin/cron/update]
        CRON2[GET /api/admin/cron/status/:blockId]
        CRON3[DELETE /api/admin/cron/:blockId]
    end
    
    AF[Admin Frontend] --> CRON1
    AF --> CRON2
    AF --> CRON3
    
    classDef route fill:#fff3e0,stroke:#f57c00,stroke-width:1px
    class CRON1,CRON2,CRON3 route
```

## Data Flow Patterns

### User Registration and Authentication Flow

```mermaid
sequenceDiagram
    participant U as User Frontend
    participant UB as User Backend :3003
    participant PG as PostgreSQL :5432
    
    Note over U,PG: User Registration Flow
    U->>UB: POST /api/auth/register<br/>{email, password, name}
    UB->>UB: Validate input
    UB->>UB: Hash password
    UB->>PG: INSERT INTO users
    PG-->>UB: User created
    UB->>UB: Generate JWT
    UB-->>U: 201 Created<br/>{token, user}
    
    Note over U,PG: User Login Flow
    U->>UB: POST /api/auth/login<br/>{email, password}
    UB->>PG: SELECT user WHERE email
    PG-->>UB: User data
    UB->>UB: Verify password
    UB->>UB: Generate JWT
    UB-->>U: 200 OK<br/>{token, user}
```

### Real-time Streaming Chat Flow

```mermaid
sequenceDiagram
    participant U as User Frontend
    participant UB as User Backend :3003
    participant PG as PostgreSQL :5432
    participant WV as Weaviate :8082
    participant AI as AI Model
    
    U->>UB: POST /api/chat/respond-streaming<br/>{message, chatSessionId}
    UB->>UB: Validate JWT token
    UB->>PG: INSERT user message
    UB->>PG: SELECT chat history
    PG-->>UB: Chat context
    UB->>WV: Query relevant context<br/>for chatbotId
    WV-->>UB: Relevant documents
    UB->>UB: Set SSE headers
    UB-->>U: SSE metadata event
    UB->>AI: Process with streaming<br/>{message, history, context}
    
    loop Streaming chunks
        AI-->>UB: Text chunk
        UB-->>U: SSE chunk event
    end
    
    UB-->>U: SSE complete event
    UB->>PG: INSERT complete AI response
```

### Traditional Chat Flow (Fallback)

```mermaid
sequenceDiagram
    participant U as User Frontend
    participant UB as User Backend :3003
    participant PG as PostgreSQL :5432
    participant WV as Weaviate :8082
    participant AI as AI Model
    
    U->>UB: POST /api/chat/respond<br/>{message, sessionId, chatbotId}
    UB->>UB: Validate JWT token
    UB->>PG: INSERT user message
    UB->>PG: SELECT chat history
    PG-->>UB: Chat context
    UB->>WV: Query relevant context<br/>for chatbotId
    WV-->>UB: Relevant documents
    UB->>AI: Process message with context<br/>{message, history, context}
    AI-->>UB: AI response
    UB->>PG: INSERT AI response
    UB-->>U: 200 OK<br/>{response, sessionId}
```

### Admin Chatbot Creation Flow

```mermaid
sequenceDiagram
    participant AF as Admin Frontend
    participant AB as Admin Backend :3002
    participant PG as PostgreSQL :5432
    
    AF->>AB: POST /api/admin/chatbots<br/>{name}
    AB->>AB: Validate admin JWT
    AB->>PG: BEGIN TRANSACTION
    AB->>PG: INSERT chatbot
    AB->>PG: INSERT system prompt block
    AB->>PG: INSERT custom interface block
    AB->>PG: INSERT connection between blocks
    AB->>PG: INSERT chatbot access for test user
    AB->>PG: COMMIT TRANSACTION
    PG-->>AB: Chatbot created
    AB-->>AF: 201 Created<br/>{chatbot}
```

### Website Crawling Flow

```mermaid
sequenceDiagram
    participant AF as Admin Frontend
    participant AB as Admin Backend :3002
    participant CS as Crawling Service :3001
    participant PG as PostgreSQL :5432
    participant WV as Weaviate :8082
    participant WEB as External Website
    
    AF->>AB: POST /api/admin/crawl<br/>{url, chatbotId, blockId}
    AB->>AB: Validate admin JWT
    AB->>CS: POST /crawl<br/>{url, chatbotId, blockId}
    CS->>PG: UPDATE website_context<br/>SET status='queued'
    CS->>CS: Add job to queue
    CS-->>AB: 202 Accepted
    AB-->>AF: Crawling started
    
    Note over CS,WEB: Asynchronous Processing
    CS->>CS: Process queue job
    CS->>PG: UPDATE status='crawling'
    CS->>WEB: Crawl website pages
    WEB-->>CS: HTML content
    CS->>CS: Convert HTML to Markdown
    CS->>CS: Store content in shared volume
    CS->>WV: Index content for chatbotId
    WV-->>CS: Content indexed
    CS->>PG: UPDATE status='completed'<br/>SET crawledPagesCount
```

### Cron Scheduled Crawling Flow

```mermaid
sequenceDiagram
    participant AF as Admin Frontend
    participant AB as Admin Backend :3002
    participant CRS as Cron Scheduler :3004
    participant CS as Crawling Service :3001
    participant PG as PostgreSQL :5432
    participant WV as Weaviate :8082
    participant WEB as External Website
    
    Note over AF,CRS: Setting up scheduled crawling
    AF->>AB: POST /api/admin/cron/update<br/>{blockId, cronEnabled, cronSchedule, cronTimezone}
    AB->>AB: Validate admin JWT
    AB->>CRS: POST /cron/update<br/>{blockId, cronEnabled, cronSchedule, cronTimezone}
    CRS->>PG: SELECT website_context<br/>WHERE blockId
    PG-->>CRS: Website context data
    CRS->>CRS: Validate cron expression<br/>Calculate nextCrawlAt
    CRS->>PG: UPDATE website_context<br/>SET cronEnabled, cronSchedule, cronTimezone, nextCrawlAt
    CRS->>CRS: Schedule cron job<br/>with node-cron
    CRS-->>AB: 200 OK<br/>{nextCrawlAt}
    AB-->>AF: Cron settings updated
    
    Note over CRS,WEB: Scheduled execution
    CRS->>CRS: Cron job triggers<br/>at scheduled time
    CRS->>PG: UPDATE website_context<br/>SET status='queued'
    CRS->>CS: POST /crawl<br/>{url, chatbotId, blockId, recursive, maxDepth}
    CS->>CS: Add job to queue
    CS-->>CRS: 202 Accepted
    
    Note over CS,WEB: Crawling execution (same as manual crawl)
    CS->>CS: Process crawling job
    CS->>WEB: HTTP GET requests<br/>to crawl pages
    WEB-->>CS: HTML content
    CS->>CS: Convert HTML to Markdown<br/>Chunk content
    CS->>WV: Store content chunks<br/>with embeddings
    CS->>PG: UPDATE status='completed'<br/>SET crawledPagesCount, lastCrawledAt
    CRS->>CRS: Calculate next crawl time<br/>Update cron job
```

### Real-time Status Monitoring

```mermaid
sequenceDiagram
    participant AF as Admin Frontend
    participant AB as Admin Backend :3002
    participant CS as Crawling Service :3001
    participant PG as PostgreSQL :5432
    
    loop Every 5 seconds
        AF->>AB: GET /api/admin/status/:blockId
        AB->>AB: Validate admin JWT
        AB->>CS: GET /status/:blockId
        CS->>PG: SELECT crawling_status<br/>WHERE blockId
        PG-->>CS: Status data
        CS-->>AB: {status, progress, pagesCount}
        AB-->>AF: Status response
    end
```

## Service Dependencies

### Container Startup Dependencies

```mermaid
graph TD
    DB[("PostgreSQL")] --> UB["User Backend"]
    DB --> AB["Admin Backend"]
    DB --> CS["Crawling Service"]
    DB --> CRS["Cron Scheduler"]
    
    UB --> UF["User Frontend"]
    AB --> AF["Admin Frontend"]
    
    WV[("Weaviate")] --> UB
    WV --> CS
    
    AB --> CS
    AB --> CRS
    CRS --> CS
    
    classDef database fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef service fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef frontend fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    
    class DB,WV database
    class UB,AB,CS,CRS service
    class UF,AF frontend
```

### Health Check Dependencies

```mermaid
graph LR
    subgraph "Health Checks"
        PG_HC["PostgreSQL Health<br/>pg_isready every 5s"]
        UB_HC["User Backend<br/>HTTP endpoint"]
        AB_HC["Admin Backend<br/>HTTP endpoint"]
        CS_HC["Crawling Service<br/>HTTP endpoint"]
        WV_HC["Weaviate<br/>HTTP endpoint"]
    end
    
    PG_HC --> UB_HC
    PG_HC --> AB_HC
    PG_HC --> CS_HC
    
    classDef health fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    class PG_HC,UB_HC,AB_HC,CS_HC,WV_HC health
```

## Network Communication Patterns

### Internal Service Communication

```mermaid
graph TB
    subgraph "Docker Network: citadel-net"
        subgraph "HTTP Communication"
            UF["User Frontend"] -.->|HTTP/HTTPS| UB["User Backend"]
            AF["Admin Frontend"] -.->|HTTP/HTTPS| AB["Admin Backend"]
            AB["Admin Backend"] -.->|HTTP/HTTPS| CS["Crawling Service"]
            CRS["Cron Scheduler"] -.->|HTTP/HTTPS| CS["Crawling Service"]
        end
        
        subgraph "Database Communication"
            UB["User Backend"] -.->|PostgreSQL Protocol| PG["PostgreSQL"]
            AB["Admin Backend"] -.->|PostgreSQL Protocol| PG["PostgreSQL"]
            CS["Crawling Service"] -.->|PostgreSQL Protocol| PG["PostgreSQL"]
            CRS["Cron Scheduler"] -.->|PostgreSQL Protocol| PG["PostgreSQL"]
        end
        
        subgraph "Vector Database Communication"
            UB["User Backend"] -.->|HTTP/GraphQL| WV["Weaviate"]
            CS["Crawling Service"] -.->|HTTP/GraphQL| WV["Weaviate"]
        end
    end
    
    subgraph "External Communication"
        CS["Crawling Service"] -.->|HTTP/HTTPS| INTERNET["External Websites"]
        UB["User Backend"] -.->|HTTP/HTTPS| AI["AI Services"]
    end
    
    classDef internal fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef external fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    
    class UF,AF,UB,AB,CS,CRS,PG,WV internal
    class INTERNET,AI external
```

### Port Exposure and Access

```mermaid
graph TB
    subgraph "Host Machine"
        subgraph "Exposed Ports"
            P8080["8080 - User Frontend"]
            P8081["8081 - Admin Frontend"]
            P3003["3003 - User Backend"]
            P3002["3002 - Admin Backend"]
            P3004["3004 - Cron Scheduler"]
            P3001["3001 - Crawling Service"]
            P5432["5432 - PostgreSQL"]
            P8082["8082 - Weaviate"]
        end
        
        subgraph "Internal Network"
            UF["user-frontend:80"]
            AF["admin-frontend:80"]
            UB["user-backend:3003"]
            AB["admin-backend:3002"]
            CRS["cron-scheduler:3002"]
            CS["crawling-service:3001"]
            PG["db:5432"]
            WV["weaviate:8080"]
        end
    end
    
    P8080 -.->|Port Forward| UF
    P8081 -.->|Port Forward| AF
    P3003 -.->|Port Forward| UB
    P3002 -.->|Port Forward| AB
    P3004 -.->|Port Forward| CRS
    P3001 -.->|Port Forward| CS
    P5432 -.->|Port Forward| PG
    P8082 -.->|Port Forward| WV
    
    classDef exposed fill:#ffebee,stroke:#d32f2f,stroke-width:2px
    classDef internal fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    
    class P8080,P8081,P3003,P3002,P3004,P3001,P5432,P8082 exposed
    class UF,AF,UB,AB,CRS,CS,PG,WV internal
```

This comprehensive set of diagrams provides a complete visual representation of how all services interact, communicate, and depend on each other within the CitadelAI platform. The diagrams show both the static architecture and dynamic data flows that occur during normal operation.