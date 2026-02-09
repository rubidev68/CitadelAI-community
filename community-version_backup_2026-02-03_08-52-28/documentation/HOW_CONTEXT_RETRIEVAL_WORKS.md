# How Context Retrieval Works in Chatbot Conversations

## Overview

When a user chats with a chatbot, the system retrieves relevant context from previously crawled/indexed content stored in Weaviate. **The chatbot does NOT crawl during conversations** - it only queries content that was already crawled and indexed when the admin configured the chatbot.

---

## The Complete Flow

### Phase 1: Admin Configuration (Before Chat)

**1. Admin Adds Context Blocks**

When an admin builds a chatbot, they add **Context Blocks**:
- **Website Context Block**: Configures which websites to crawl
- **Document Context Block**: Uploads documents to index

**Example:**
```
Chatbot: "Customer Support Bot"
├── System Prompt Block (LOGIC)
├── Website Context Block (CONTEXT)
│   └── URL: https://example.com/docs
│   └── Recursive: true
│   └── Max Depth: 3
└── Document Context Block (CONTEXT)
    └── File: product-manual.pdf
```

**2. Crawling/Indexing is Triggered**

When a Website Context block is saved:
- The admin backend sends a crawl request to the `crawling-service`
- The crawling service crawls the website and extracts content
- Content is chunked and stored in **Weaviate** with:
  - `chatbotId`: Links content to the specific chatbot
  - `content`: The actual text content
  - `url`: Source URL (for websites)
  - `title`: Page title
  - Metadata (for documents)

**Storage in Weaviate:**
```json
{
  "class": "WebsiteContent",
  "properties": {
    "chatbotId": "chatbot-123",
    "content": "This is the documentation about our product...",
    "url": "https://example.com/docs/product",
    "title": "Product Documentation"
  }
}
```

**3. Scheduled Crawls (Optional)**

If cron scheduling is enabled:
- The `cron-scheduler` service periodically triggers re-crawls
- Updated content is re-indexed in Weaviate
- Ensures content stays up-to-date

---

### Phase 2: User Chat (During Conversation)

**1. User Sends a Message**

```
User: "How do I reset my password?"
```

**2. Chat Controller Retrieves Context**

The `user/backend/src/controllers/chat.ts` handles the request:

```typescript
// 1. Get chatbotId from chat session
const chatbotId = chatSession.chatbotId;

// 2. Query Weaviate for relevant content
const contextData = await getContextFromWeaviate(message, chatbotId);
```

**3. Semantic Search in Weaviate**

The `getContextFromWeaviate()` function performs semantic search:

```typescript
// Search WebsiteContent using BM25 (keyword + semantic search)
const websiteResponse = await client.graphql
  .get()
  .withClassName('WebsiteContent')
  .withFields('content url title chatbotId')
  .withBm25({
    query: message, // User's message: "How do I reset my password?"
  })
  .withLimit(100)
  .do();

// Search DocumentContent similarly
const documentResponse = await client.graphql
  .get()
  .withClassName('DocumentContent')
  .withFields('content fileName chatbotId ...')
  .withBm25({
    query: message,
  })
  .withLimit(100)
  .do();
```

**Key Points:**
- Uses **BM25** (Best Matching 25) algorithm - combines keyword matching with semantic similarity
- Searches ALL content in Weaviate, then filters by `chatbotId` in code (because Weaviate filtering is broken)
- Returns top 100 results, then filters and limits to top 10-15 most relevant

**4. Filtering by Chatbot**

```typescript
// Filter website content by chatbotId
const websiteContext = websiteResponse.data.Get.WebsiteContent?.filter((item) => {
  // CRITICAL: Filter by chatbotId
  if (item.chatbotId !== chatbotId) return false;
  
  // Filter out malformed content
  if (!item.content || item.content.length < 100) return false;
  
  return true;
}).slice(0, 10); // Top 10 results
```

**Why filter by chatbotId?**
- Each chatbot has its own knowledge base
- Content is tagged with `chatbotId` when crawled
- Ensures chatbot only uses its own context, not other chatbots' content

**5. Context Blocks are Retrieved (Metadata Only)**

```typescript
// Get context blocks from database (for system prompt generation)
const contextBlocks = await prisma.block.findMany({
  where: {
    chatbotId: chatbotId,
    type: BlockType.CONTEXT,
  },
});
```

**Purpose:**
- Context blocks are used to generate the system prompt
- They tell the LLM what knowledge sources are available
- They do NOT determine what content to retrieve - that's done by Weaviate search

**6. System Prompt Generation**

```typescript
const systemPromptWithContext = generateSystemPrompt(
  systemPromptBlock,
  contextBlocks,
  context // Retrieved from Weaviate
);
```

The system prompt includes:
- Bot personality/behavior
- List of knowledge sources (from context blocks)
- **Actual context content** (from Weaviate search results)

**Example Generated Prompt:**
```
You are Customer Support Bot, an AI assistant for Example Corp. 
Friendly, informative, and eager to help with any questions.

You have access to the following knowledge sources:
- Website: https://example.com/docs
- Document: product-manual.pdf

Use this information to provide accurate and helpful responses.

Use the following context to answer the user's question:

[Content from Weaviate search results about password reset...]
```

**7. LLM Generates Response**

The LLM receives:
- System prompt (with context)
- Chat history
- User's message

And generates a response using the retrieved context.

---

## Key Concepts

### 1. Content is Pre-Crawled, Not Real-Time

**Important:** The chatbot does NOT crawl websites during conversations. All content must be:
- Crawled/indexed beforehand (when admin configures blocks)
- Stored in Weaviate with the correct `chatbotId`
- Available for semantic search

### 2. Semantic Search vs Keyword Search

**BM25 Algorithm:**
- Combines keyword matching (exact word matches)
- With semantic similarity (meaning-based matching)
- Example: Query "reset password" matches content about "password recovery" even if exact words don't match

### 3. Chatbot Isolation via chatbotId

Each chatbot only sees content tagged with its own `chatbotId`:
- When content is crawled, it's tagged with the chatbot's ID
- During search, results are filtered by `chatbotId`
- Ensures chatbots don't leak information between each other

### 4. Context Blocks vs Weaviate Content

**Context Blocks (Database):**
- Metadata about knowledge sources
- Used for system prompt generation
- Stored in PostgreSQL

**Weaviate Content:**
- Actual crawled/indexed content
- Used for semantic search
- Stored in Weaviate vector database

---

## Example Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: ADMIN CONFIGURATION (Before Chat)                 │
└─────────────────────────────────────────────────────────────┘

Admin Interface
    │
    ├─> Creates Chatbot: "Support Bot"
    │
    ├─> Adds Website Context Block
    │   └─> URL: https://example.com/docs
    │   └─> Saves block
    │
    └─> Admin Backend
        │
        └─> POST /crawl
            │
            └─> Crawling Service
                │
                ├─> Crawls website
                ├─> Extracts content
                ├─> Chunks content
                │
                └─> Stores in Weaviate
                    │
                    └─> WebsiteContent {
                          chatbotId: "chatbot-123",
                          content: "...",
                          url: "https://example.com/docs/...",
                          title: "..."
                        }

┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: USER CHAT (During Conversation)                   │
└─────────────────────────────────────────────────────────────┘

User
    │
    └─> "How do I reset my password?"
        │
        └─> User Backend (chat.ts)
            │
            ├─> Gets chatbotId from session
            │
            ├─> Calls getContextFromWeaviate(message, chatbotId)
            │   │
            │   └─> Weaviate Query
            │       │
            │       ├─> BM25 Search: "How do I reset my password?"
            │       ├─> Returns top 100 results
            │       │
            │       └─> Filter by chatbotId === "chatbot-123"
            │           │
            │           └─> Top 10 relevant results
            │
            ├─> Gets Context Blocks (metadata)
            │   └─> Website: https://example.com/docs
            │
            ├─> Generates System Prompt
            │   └─> Includes context from Weaviate
            │
            └─> LLM Generates Response
                │
                └─> "To reset your password, go to..."
                    (Uses context from Weaviate search)
```

---

## Code Locations

### Context Retrieval
- **File**: `user/backend/src/controllers/chat.ts`
- **Function**: `getContextFromWeaviate(message, chatbotId)`
- **Lines**: 228-361

### System Prompt Generation
- **File**: `user/backend/src/utils/systemPromptGenerator.ts`
- **Function**: `generateSystemPrompt(systemPromptBlock, contextBlocks, context)`

### Crawling Trigger
- **File**: `admin/backend/src/index.ts`
- **Endpoint**: `/api/admin/chatbots/:id` (POST/PUT)
- **Service**: `crawling-service`

### Scheduled Crawls
- **File**: `cron-scheduler/src/cronScheduler.ts`
- **Function**: `executeCrawl(blockId)`

---

## Important Notes

### 1. Weaviate Filtering is Broken

Currently, Weaviate's `where` filter doesn't work reliably, so:
- The code queries ALL content (limit 100)
- Then filters by `chatbotId` in JavaScript
- This is less efficient but necessary

**Code:**
```typescript
// Get all results, then filter in code
.withLimit(100)
.do();

// Filter by chatbotId
.filter((item) => item.chatbotId !== chatbotId)
```

### 2. Content Must Be Crawled First

If a chatbot has no crawled content:
- Weaviate search returns empty results
- System prompt includes fallback message
- LLM responds without context (general knowledge only)

### 3. Context Blocks Don't Determine What to Crawl

Context blocks are:
- **Configuration metadata** (what sources exist)
- **Not execution logic** (what content to retrieve)

The actual content retrieval is done by:
- Semantic search in Weaviate
- Filtered by `chatbotId`
- Based on user's message

### 4. Multiple Context Sources

A chatbot can have multiple context blocks:
- Multiple websites
- Multiple documents
- All content is stored in Weaviate with the same `chatbotId`
- Search retrieves from all sources, ranks by relevance

---

## Summary

**How the model knows what to crawl:**
- **It doesn't crawl during chat** - content is pre-crawled when admin configures blocks

**How the model knows what content to use:**
1. User sends message
2. System queries Weaviate using semantic search (BM25)
3. Filters results by `chatbotId` (ensures chatbot isolation)
4. Retrieves top relevant content chunks
5. Includes in system prompt for LLM
6. LLM generates response using retrieved context

**The key is:**
- **Crawling** = Admin configuration phase (stores content in Weaviate)
- **Retrieval** = User chat phase (queries Weaviate for relevant content)
- **chatbotId** = Links crawled content to specific chatbot (isolation)
