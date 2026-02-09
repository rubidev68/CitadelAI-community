# How the Database (PostgreSQL) is Used in the Chatbot System

## Overview

The system uses **PostgreSQL** (accessed via **Prisma ORM**) as the primary relational database for storing:
- Chatbot configuration and metadata
- User/Admin accounts and authentication
- Chat sessions and message history
- Block configurations and connections
- System metadata (subscriptions, billing, etc.)

**Important distinction:**
- **PostgreSQL** = Stores chatbot configuration, chat history, user data (metadata)
- **Weaviate** = Stores crawled/indexed content for semantic search (actual content)
- **DB Block** (when implemented) = Queries **external databases** for context (not the internal PostgreSQL)

---

## Database Usage During Chat Conversations

### 1. Chat Session Management

When a user sends a message, the system uses PostgreSQL to:

**a) Retrieve or Create Chat Session**
```typescript
// user/backend/src/controllers/chat.ts

// Get existing session or create new one
let chatSession;
if (chatSessionId) {
  chatSession = await prisma.chatSession.findUnique({ 
    where: { id: chatSessionId } 
  });
}

if (!chatSession) {
  chatSession = await prisma.chatSession.create({
    data: {
      userId,
      chatbotId: defaultChatbotId,
    },
  });
}
```

**Purpose:** Links the conversation to a specific user and chatbot.

**b) Save User Message**
```typescript
await prisma.chatMessage.create({
  data: {
    chatSessionId: chatSession.id,
    role: 'USER',
    content: message,
  },
});
```

**Purpose:** Persists user messages for chat history.

**c) Retrieve Chat History**
```typescript
const history = await prisma.chatMessage.findMany({
  where: { chatSessionId: chatSession.id },
  orderBy: { createdAt: 'asc' },
});
```

**Purpose:** Provides conversation context to the LLM (previous messages).

**d) Save Assistant Response**
```typescript
const assistantMessage = await prisma.chatMessage.create({
  data: {
    chatSessionId: chatSession.id,
    role: 'ASSISTANT',
    content: responseWithCitations,
  },
});
```

**Purpose:** Persists assistant responses for future context.

---

### 2. Chatbot Configuration Retrieval

The system queries PostgreSQL to get chatbot configuration:

**a) Get System Prompt Block**
```typescript
const systemPromptBlock = await prisma.block.findFirst({
  where: {
    chatbotId: chatbotId,
    type: BlockType.LOGIC,
    subtype: 'System Prompt',
  },
});
```

**Purpose:** Retrieves the chatbot's personality, behavior, and LLM settings.

**b) Get Context Blocks (Metadata)**
```typescript
const contextBlocks = await prisma.block.findMany({
  where: {
    chatbotId: chatbotId,
    type: BlockType.CONTEXT,
  },
});
```

**Purpose:** Gets metadata about knowledge sources (websites, documents) - used for system prompt generation.

**Note:** Context blocks don't contain the actual content. They're just metadata (URLs, filenames). The actual content is stored in Weaviate.

**c) Get User Information**
```typescript
const user = await prisma.user.findUnique({
  where: { id: userId },
});
```

**Purpose:** Retrieves user preferences, default chatbot, etc.

---

### 3. What PostgreSQL Does NOT Store

**PostgreSQL does NOT store:**
- ❌ Crawled website content (stored in Weaviate)
- ❌ Document content (stored in Weaviate)
- ❌ Vector embeddings (stored in Weaviate)
- ❌ Searchable text content (stored in Weaviate)

**PostgreSQL DOES store:**
- ✅ Chatbot configuration (blocks, connections)
- ✅ Website context metadata (URLs, crawl settings)
- ✅ Chat sessions and messages
- ✅ User/admin accounts
- ✅ System metadata (subscriptions, billing, etc.)

---

## Database Schema Overview

### Core Chat Models

**`ChatSession`**
```prisma
model ChatSession {
  id           String        @id @default(cuid())
  title        String        @default("New Chat")
  user         User          @relation(fields: [userId], references: [id])
  userId       String
  chatbotId    String        // Links to which chatbot
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  chatMessages ChatMessage[]
}
```

**`ChatMessage`**
```prisma
model ChatMessage {
  id            String      @id @default(cuid())
  chatSession   ChatSession @relation(fields: [chatSessionId], references: [id])
  chatSessionId String
  role          String      // 'USER' or 'ASSISTANT'
  content       String      // The actual message text
  createdAt     DateTime    @default(now())
}
```

### Chatbot Configuration Models

**`Chatbot`**
```prisma
model Chatbot {
  id              String           @id @default(cuid())
  name            String
  status          ChatbotStatus    @default(INACTIVE)
  ownerId         String           // AdminUser who owns it
  blocks          Block[]          // All blocks in this chatbot
  connections     Connection[]     // Block connections
  websiteContexts WebsiteContext[] // Website crawl configs
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
}
```

**`Block`**
```prisma
model Block {
  id              String       @id @default(cuid())
  chatbot         Chatbot      @relation(fields: [chatbotId], references: [id])
  chatbotId       String
  type            BlockType    // CONTEXT, LOGIC, ACTION, FRONTEND, TEST
  subtype         String       // 'System Prompt', 'Website', 'Document', etc.
  title           String
  position        Json         // UI position
  properties      Json         // Block-specific configuration
  fromConnections Connection[] @relation("FromConnections")
  toConnections   Connection[] @relation("ToConnections")
}
```

**`WebsiteContext`**
```prisma
model WebsiteContext {
  id                String    @id @default(cuid())
  chatbot           Chatbot   @relation(fields: [chatbotId], references: [id])
  chatbotId         String
  blockId           String    @unique // Links to CONTEXT block
  url               String    // URL to crawl
  recursive         Boolean   @default(false)
  maxDepth          Int       @default(3)
  crawlingStatus    Json?     // Crawl progress
  lastCrawledAt     DateTime?
  crawledPagesCount Int?
  cronEnabled       Boolean   @default(false)
  cronSchedule      String?   // Cron expression
}
```

---

## Complete Chat Flow: Database Queries

Here's the complete flow of database queries during a chat conversation:

```
User sends message: "How do I reset my password?"
    │
    ├─> 1. PostgreSQL: Get/Create ChatSession
    │   └─> prisma.chatSession.findUnique() or create()
    │
    ├─> 2. PostgreSQL: Save User Message
    │   └─> prisma.chatMessage.create({ role: 'USER', content: message })
    │
    ├─> 3. PostgreSQL: Get Chat History
    │   └─> prisma.chatMessage.findMany({ chatSessionId })
    │
    ├─> 4. PostgreSQL: Get System Prompt Block
    │   └─> prisma.block.findFirst({ type: LOGIC, subtype: 'System Prompt' })
    │
    ├─> 5. PostgreSQL: Get Context Blocks (metadata)
    │   └─> prisma.block.findMany({ type: CONTEXT })
    │
    ├─> 6. Weaviate: Get Relevant Content (NOT PostgreSQL!)
    │   └─> Semantic search for content matching user message
    │
    ├─> 7. Generate System Prompt
    │   └─> Combine system prompt block + context blocks metadata + Weaviate content
    │
    ├─> 8. LLM: Generate Response
    │   └─> Uses system prompt + chat history + user message
    │
    └─> 9. PostgreSQL: Save Assistant Response
        └─> prisma.chatMessage.create({ role: 'ASSISTANT', content: response })
```

---

## Database vs Weaviate: Key Differences

| Aspect | PostgreSQL | Weaviate |
|--------|-----------|----------|
| **Purpose** | Metadata & configuration | Content & semantic search |
| **Stores** | Blocks, sessions, messages, users | Crawled content, embeddings |
| **Query Type** | SQL (relational queries) | GraphQL (semantic/vector search) |
| **Use Case** | "Get chatbot config", "Save message" | "Find relevant content about X" |
| **Speed** | Fast for structured queries | Fast for semantic similarity |
| **Content** | Configuration data | Actual text content |

---

## Example: What Happens When User Asks a Question

**User:** "What are your business hours?"

**Database Queries (PostgreSQL):**
1. ✅ Get chat session: `SELECT * FROM ChatSession WHERE id = '...'`
2. ✅ Save user message: `INSERT INTO ChatMessage (role, content) VALUES ('USER', '...')`
3. ✅ Get chat history: `SELECT * FROM ChatMessage WHERE chatSessionId = '...' ORDER BY createdAt`
4. ✅ Get system prompt block: `SELECT * FROM Block WHERE chatbotId = '...' AND type = 'LOGIC' AND subtype = 'System Prompt'`
5. ✅ Get context blocks: `SELECT * FROM Block WHERE chatbotId = '...' AND type = 'CONTEXT'`
6. ✅ Save assistant response: `INSERT INTO ChatMessage (role, content) VALUES ('ASSISTANT', '...')`

**Weaviate Queries (NOT PostgreSQL):**
1. ✅ Semantic search: `GET { WebsiteContent(nearText: {concepts: ["business hours"]}) { content url } }`
2. ✅ Filter by chatbotId (in code, because Weaviate filtering is broken)

**Result:**
- PostgreSQL provides: Chat history, chatbot config, system prompt
- Weaviate provides: Relevant content about business hours
- LLM combines both to generate response

---

## Future: DB Block (External Database Queries)

When the **DB Block** is implemented, it will:

**Purpose:** Query **external databases** (not the internal PostgreSQL) to retrieve context for chatbot responses.

**Example:**
- Chatbot needs to answer: "What's the status of order #12345?"
- DB Block executes: `SELECT * FROM orders WHERE order_id = $1` (on external database)
- Results are formatted and added to context
- LLM uses this context to answer the question

**Key Points:**
- DB Block queries **external databases** (customer databases, product databases, etc.)
- It does NOT query the internal PostgreSQL (that's handled by Prisma)
- Results are used as **context** (like Weaviate content), not stored
- **Read-only** - only SELECT queries allowed

**Flow:**
```
User: "What's order #12345 status?"
    │
    ├─> PostgreSQL: Get chat session, history, blocks (as usual)
    │
    ├─> Weaviate: Get relevant content (as usual)
    │
    ├─> DB Block: Query external database
    │   └─> Execute SELECT query on customer's order database
    │   └─> Get order status, details, etc.
    │
    ├─> Combine: System prompt + Weaviate content + DB Block results
    │
    └─> LLM: Generate response using all context
```

---

## Summary

### PostgreSQL is Used For:

1. **Chat Session Management**
   - Creating/retrieving chat sessions
   - Storing user and assistant messages
   - Retrieving chat history

2. **Chatbot Configuration**
   - Storing block configurations (System Prompt, Context blocks, etc.)
   - Storing block connections
   - Storing website context metadata (URLs, crawl settings)

3. **User/Admin Management**
   - User accounts and authentication
   - Admin accounts and permissions
   - Chatbot ownership and access control

4. **System Metadata**
   - Subscriptions and billing
   - API tokens
   - System metrics

### PostgreSQL is NOT Used For:

1. **Content Storage**
   - Crawled website content → Stored in Weaviate
   - Document content → Stored in Weaviate
   - Vector embeddings → Stored in Weaviate

2. **Semantic Search**
   - Finding relevant content → Done by Weaviate
   - Content retrieval → Done by Weaviate

### DB Block (Future):

- Queries **external databases** (customer databases, product databases, etc.)
- Provides additional context for chatbot responses
- **Read-only** - only SELECT queries
- Results are used as context, not stored

---

## Code Locations

### Database Queries During Chat
- **File**: `user/backend/src/controllers/chat.ts`
- **Functions**: `respond()`, `respondStreaming()`, `respondInternal()`
- **Lines**: 363-511, 1084-1202, etc.

### Database Schema
- **File**: `admin/backend/prisma/schema.prisma`
- **Models**: `ChatSession`, `ChatMessage`, `Chatbot`, `Block`, `WebsiteContext`, etc.

### Prisma Client Usage
- **File**: `user/backend/src/controllers/chat.ts`
- **Import**: `import { PrismaClient, BlockType } from '@prisma/client'`
- **Usage**: `prisma.chatSession.findUnique()`, `prisma.chatMessage.create()`, etc.

---

## Key Takeaways

1. **PostgreSQL stores metadata** (chatbot config, chat history, user data)
2. **Weaviate stores content** (crawled websites, documents, embeddings)
3. **During chat**, PostgreSQL is queried for:
   - Chat session and history
   - Chatbot configuration (blocks)
   - User information
4. **During chat**, Weaviate is queried for:
   - Relevant content matching user's message
5. **DB Block** (when implemented) will query **external databases** for additional context
6. **The internal PostgreSQL is NOT queried for content** - it's only for configuration and chat history
