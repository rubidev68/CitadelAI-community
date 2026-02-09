# AI Pipeline Architecture

This document provides a comprehensive overview of how the CitadelAI system integrates system prompt generation and web crawling to create intelligent, context-aware AI responses.

## System Overview

The CitadelAI platform combines multiple services to deliver personalized AI experiences:

- **System Prompt Generation**: Creates dynamic, context-aware prompts for AI models
- **Web Crawling**: Harvests and indexes web content for knowledge retrieval
- **Vector Search**: Enables semantic search across crawled content
- **AI Response Generation**: Produces intelligent responses with proper citations

## High-Level Architecture

```mermaid
graph TB
    subgraph "User Interface Layer"
        A[User Interface]
        B[Admin Interface]
    end
    
    subgraph "API Services"
        C[User Service API]
        D[Admin Service API]
        E[Crawling Service API]
    end
    
    subgraph "Core Services"
        F[System Prompt Generator]
        G[Web Crawling Service]
        H[AI Response Generator]
        I[Vector Search Engine]
    end
    
    subgraph "Data Layer"
        J[PostgreSQL Database]
        K[Weaviate Vector DB]
        L[File Storage]
    end
    
    subgraph "External Services"
        M[AI Providers<br/>Gemini, OpenAI,<br/>Claude, Mistral]
        N[Target Websites]
    end
    
    A --> C
    B --> D
    C --> F
    C --> H
    D --> G
    G --> K
    F --> J
    H --> I
    I --> K
    H --> M
    G --> N
    F --> J
    G --> J
```

## Data Flow Architecture

### 1. Content Ingestion Flow

```mermaid
sequenceDiagram
    participant Admin as Admin Interface
    participant AdminAPI as Admin API
    participant Crawler as Crawling Service
    participant Weaviate as Vector Database
    participant DB as PostgreSQL

    Admin->>AdminAPI: Configure website context
    AdminAPI->>DB: Store website configuration
    AdminAPI->>Crawler: Start crawling job
    
    loop Parallel Page Processing
        Crawler->>Crawler: Extract page content
        Crawler->>Crawler: Convert to markdown
        Crawler->>Weaviate: Store content chunks
    end
    
    Crawler->>DB: Update crawling status
    Crawler-->>AdminAPI: Crawling completed
```

### 2. AI Response Generation Flow

```mermaid
sequenceDiagram
    participant User as User Interface
    participant UserAPI as User API
    participant PromptGen as System Prompt Generator
    participant Weaviate as Vector Database
    participant AI as OpenAI API
    participant DB as PostgreSQL

    User->>UserAPI: Send message
    UserAPI->>DB: Retrieve chatbot configuration
    UserAPI->>PromptGen: Generate system prompt
    
    PromptGen->>DB: Get system prompt block
    PromptGen->>DB: Get context blocks
    PromptGen->>Weaviate: Search relevant content
    PromptGen-->>UserAPI: Return system prompt + context
    
    UserAPI->>AI: Generate response with prompt
    AI-->>UserAPI: Return AI response
    UserAPI->>DB: Store conversation
    UserAPI-->>User: Return response with citations
```

## System Prompt Generation Pipeline

### Input Sources

1. **User Configuration**
   - Bot name and personality
   - Company information
   - Behavior type selection
   - Custom instructions

2. **Knowledge Sources**
   - Website contexts (crawled content)
   - Document contexts (uploaded files)
   - Real-time context (from Weaviate)

3. **Dynamic Context**
   - User's current message
   - Conversation history
   - Relevant content chunks

### Processing Steps

```mermaid
graph TD
    A[User Message] --> B[Retrieve Chatbot Config]
    B --> C[Get System Prompt Block]
    C --> D[Get Context Blocks]
    D --> E[Search Weaviate]
    E --> F[Generate System Prompt]
    F --> G[Combine with Context]
    G --> H[Send to AI Model]
```

### System Prompt Structure

```
1. Identity Definition
   ├── Bot name and role
   ├── Company context
   └── Behavior description

2. Knowledge Sources
   ├── Website references
   ├── Document references
   └── Usage instructions

3. Additional Instructions
   ├── Custom behaviors
   ├── Response guidelines
   └── Citation requirements

4. Dynamic Context
   ├── Retrieved content
   ├── Source metadata
   └── Contextual information
```

## Web Crawling Pipeline

### Crawling Architecture

```mermaid
graph TD
    A[Crawl Request] --> B[Job Queue]
    B --> C[Concurrency Controller]
    C --> D[Parallel Crawlers]
    D --> E[Page Processors]
    E --> F[Content Extractors]
    F --> G[Batch Processor]
    G --> H[Weaviate Storage]
    H --> I[Status Updates]
```

### Parallelization Levels

#### Level 1: Job Parallelization
- **Concurrent Jobs**: Up to 4 websites simultaneously
- **Job Isolation**: Independent resource allocation
- **Dynamic Scaling**: Automatic capacity management

#### Level 2: Page Parallelization
- **Concurrent Pages**: Up to 5 pages per website
- **Resource Sharing**: Efficient browser instance usage
- **Load Balancing**: Optimal page distribution

#### Level 3: Content Processing
- **Batch Processing**: Groups of 5 content items
- **Async Storage**: Non-blocking Weaviate operations
- **Queue Management**: Memory-efficient processing

### Content Processing Pipeline

```mermaid
sequenceDiagram
    participant Page as Web Page
    participant Scraper as Advanced Scraper
    participant Converter as Markdown Converter
    participant Batcher as Batch Processor
    participant Weaviate as Vector Database

    Page->>Scraper: Load page content
    Scraper->>Scraper: Detect page type
    Scraper->>Scraper: Extract clean content
    Scraper->>Converter: Convert to markdown
    Converter->>Batcher: Add to processing batch
    
    loop Batch Processing
        Batcher->>Weaviate: Store content chunks
        Weaviate-->>Batcher: Storage confirmed
    end
```

## Vector Search Integration

### Content Indexing

```mermaid
graph TD
    A[Crawled Content] --> B[Content Chunking]
    B --> C[Text Preprocessing]
    C --> D[Vector Generation]
    D --> E[Weaviate Storage]
    E --> F[Index Optimization]
```

### Search Process

```mermaid
sequenceDiagram
    participant Query as User Query
    participant Vectorizer as Text Vectorizer
    participant Weaviate as Vector Database
    participant Ranker as Result Ranker
    participant Formatter as Citation Formatter

    Query->>Vectorizer: Convert to vector
    Vectorizer->>Weaviate: Semantic search
    Weaviate-->>Ranker: Return similar chunks
    Ranker->>Ranker: Rank by relevance
    Ranker->>Formatter: Format with citations
    Formatter-->>Query: Return context + sources
```

## Service Integration Patterns

### 1. Synchronous Integration
- **System Prompt Generation**: Immediate response required
- **Context Retrieval**: Real-time search for relevant content
- **Response Generation**: Direct AI model interaction

### 2. Asynchronous Integration
- **Web Crawling**: Background processing with status updates
- **Content Indexing**: Batch processing for efficiency
- **Status Monitoring**: Real-time progress tracking

### 3. Event-Driven Integration
- **Crawling Completion**: Triggers content availability
- **Status Updates**: Real-time progress notifications
- **Error Handling**: Automatic retry and fallback

## Performance Characteristics

### System Prompt Generation
- **Latency**: < 100ms for prompt generation
- **Throughput**: 100+ requests/second
- **Cache Hit Rate**: 80%+ for repeated configurations

### Web Crawling
- **Concurrency**: 4 websites × 5 pages = 20 concurrent operations
- **Throughput**: 50+ pages/minute per website
- **Storage**: 4000-character chunks in Weaviate

### Vector Search
- **Query Latency**: < 200ms for semantic search
- **Index Size**: Scales to millions of content chunks
- **Relevance**: 90%+ accuracy for relevant content

## Error Handling and Resilience

### System Prompt Generation
- **Fallback Prompts**: Default prompts for missing configuration
- **Context Recovery**: Graceful handling of missing context
- **Validation**: Input sanitization and validation

### Web Crawling
- **Retry Logic**: Exponential backoff for failed operations
- **Graceful Degradation**: Partial success handling
- **Resource Cleanup**: Automatic cleanup of browser instances

### Vector Search
- **Query Fallback**: Alternative search strategies
- **Index Recovery**: Automatic index rebuilding
- **Timeout Handling**: Graceful timeout management

## Monitoring and Observability

### Key Metrics

#### System Prompt Generation
- **Generation Time**: Time to create system prompts
- **Context Retrieval Time**: Weaviate query performance
- **Cache Hit Rate**: Configuration caching effectiveness
- **Error Rate**: Failed prompt generations

#### Web Crawling
- **Active Jobs**: Number of concurrent crawl jobs
- **Pages Processed**: Total pages crawled per job
- **Processing Time**: Average time per page
- **Success Rate**: Percentage of successful operations

#### Vector Search
- **Query Latency**: Time to retrieve relevant content
- **Index Size**: Total content chunks indexed
- **Relevance Score**: Quality of search results
- **Storage Usage**: Weaviate storage consumption

### Monitoring Tools

```mermaid
graph TD
    A[Application Logs] --> B[Log Aggregation]
    C[Metrics Collection] --> D[Time Series DB]
    E[Health Checks] --> F[Alerting System]
    B --> G[Dashboard]
    D --> G
    F --> G
```

## Security Considerations

### Data Protection
- **Content Sanitization**: Remove sensitive information from crawled content
- **Access Control**: User-based access to chatbot configurations
- **Encryption**: Encrypted storage and transmission

### Privacy Compliance
- **Data Retention**: Configurable content retention policies
- **User Consent**: Clear consent for data collection
- **Right to Deletion**: User data removal capabilities

## Scalability Patterns

### Horizontal Scaling
- **Service Replication**: Multiple instances of each service
- **Load Balancing**: Distribute requests across instances
- **Database Sharding**: Partition data across multiple databases

### Vertical Scaling
- **Resource Allocation**: Increase CPU/memory for services
- **Concurrency Tuning**: Adjust parallel processing limits
- **Cache Sizing**: Increase cache capacity for better performance

## Future Architecture Evolution

### Planned Enhancements
1. **Microservices Architecture**: Further service decomposition
2. **Event Sourcing**: Event-driven architecture for better scalability
3. **Performance Optimization**: Query optimization and caching strategies
4. **GraphQL API**: More flexible API for frontend integration

### Integration Improvements
1. **Real-time Updates**: WebSocket-based status updates
2. **Content Versioning**: Track content changes over time
3. **Advanced Analytics**: Detailed usage and performance analytics
4. **Multi-tenant Architecture**: Better isolation and resource management