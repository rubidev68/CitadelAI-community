# How DB Block Works During Chat Conversations

## Overview

The **DB Block** is an **ACTION** block that allows chatbots to query **external databases** during conversations to retrieve context for answering user questions. It's **read-only** - only SELECT queries are allowed, ensuring data safety.

**Key Point:** DB Blocks query **external databases** (customer databases, product databases, etc.), NOT the internal PostgreSQL database used for chatbot configuration.

---

## Current Chat Flow (Without DB Block)

Currently, when a user chats with a chatbot:

```
User sends message
    │
    ├─> PostgreSQL: Get chat session, history, chatbot config
    ├─> Weaviate: Get relevant content (semantic search)
    ├─> Generate system prompt with context
    └─> LLM: Generate response
```

**Context Sources:**
- ✅ Chat history (from PostgreSQL)
- ✅ System prompt block (from PostgreSQL)
- ✅ Context blocks metadata (from PostgreSQL)
- ✅ Weaviate content (crawled websites/documents)

---

## Future Chat Flow (With DB Block)

When DB Blocks are implemented, the flow will be:

```
User sends message
    │
    ├─> PostgreSQL: Get chat session, history, chatbot config
    ├─> Weaviate: Get relevant content (semantic search)
    ├─> **DB Blocks: Execute queries on external databases** ⬅️ NEW
    ├─> Combine all context sources
    ├─> Generate system prompt with all context
    └─> LLM: Generate response using all context
```

**Additional Context Sources:**
- ✅ Chat history (from PostgreSQL)
- ✅ System prompt block (from PostgreSQL)
- ✅ Context blocks metadata (from PostgreSQL)
- ✅ Weaviate content (crawled websites/documents)
- ✅ **DB Block results (from external databases)** ⬅️ NEW

---

## How DB Blocks Are Executed During Chat

### Step 1: Detect DB Blocks

When a user sends a message, the system will:

1. **Get all ACTION blocks** for the chatbot
2. **Filter for DB blocks** (type: `ACTION`, subtype: `DB`)
3. **Check if DB blocks should be executed** (based on user message or block configuration)

**Code (from roadmap):**
```typescript
// In chat controller, after getting context blocks:
const dbBlocks = await prisma.block.findMany({
  where: {
    chatbotId: chatbotId,
    type: BlockType.ACTION,
    subtype: 'DB',
  },
});
```

### Step 2: Determine Which DB Blocks to Execute

**Decision Logic:**
- **Option A: Execute all DB blocks** (always execute)
- **Option B: Conditional execution** (execute only if user message matches certain patterns)
- **Option C: LLM decides** (use LLM to determine if DB query is needed)

**Example:**
```typescript
// Check if DB block should be executed
function shouldExecuteDbBlock(
  dbBlock: Block,
  userMessage: string,
  sessionData: Record<string, any>
): boolean {
  // Option 1: Always execute
  if (dbBlock.properties.alwaysExecute === true) {
    return true;
  }
  
  // Option 2: Check trigger keywords
  const triggerKeywords = dbBlock.properties.triggerKeywords || [];
  if (triggerKeywords.some(keyword => 
    userMessage.toLowerCase().includes(keyword.toLowerCase())
  )) {
    return true;
  }
  
  // Option 3: Use LLM to decide (future enhancement)
  // ...
  
  return false;
}
```

### Step 3: Extract Query Parameters

For each DB block that should be executed:

1. **Parse parameter configuration** from block properties
2. **Extract parameter values** from:
   - User message (using regex or NLP)
   - Session data (stored variables)
   - Static values (defaults)
   - LLM extraction (use LLM to parse user intent)

**Example:**
```typescript
// DB Block Configuration:
{
  sqlQuery: "SELECT * FROM orders WHERE order_id = :orderId",
  parameters: [
    {
      name: "orderId",
      source: "user_message", // or "llm_extracted", "session_data", "static"
      extraction: "extract order number from message",
      type: "string"
    }
  ]
}

// User message: "What's the status of order #12345?"
// Extracted parameter: { orderId: "12345" }
```

**Code (from roadmap):**
```typescript
const parameters = await extractParameters(
  userMessage,           // "What's the status of order #12345?"
  block.properties.parameters, // Parameter config
  sessionData,           // Any stored session variables
  llmService            // For LLM-based extraction
);
// Result: { orderId: "12345" }
```

### Step 4: Build Parameterized Query

Replace placeholders in SQL query with extracted parameters:

**Example:**
```typescript
// Original query: "SELECT * FROM orders WHERE order_id = :orderId"
// Parameters: { orderId: "12345" }
// Result: "SELECT * FROM orders WHERE order_id = $1" (parameterized)
// Values: ["12345"]
```

**Security:** Uses parameterized queries to prevent SQL injection.

### Step 5: Validate Query (Read-Only Enforcement)

**Critical Security Step:** Validate that query is SELECT-only:

```typescript
const validation = validateSelectQuery(query);
if (!validation.valid) {
  throw new Error('Only SELECT queries are allowed');
}
```

**Validation checks:**
- ✅ Must start with SELECT
- ❌ Blocks INSERT, UPDATE, DELETE, DROP, TRUNCATE, etc.
- ❌ Blocks dangerous patterns (EXEC, CALL, etc.)
- ❌ Blocks string interpolation (must use parameters)

### Step 6: Execute Query on External Database

Connect to external database and execute SELECT query:

```typescript
// Get database connection (with connection pooling)
const connection = await getDbConnection(block.properties);

// Execute SELECT query (read-only)
const result = await executeSelectQuery(
  connection,
  query,      // "SELECT * FROM orders WHERE order_id = $1"
  parameters  // ["12345"]
);
```

**Result:**
```typescript
{
  rows: [
    { order_id: "12345", status: "shipped", total: 99.99, created_at: "2024-01-01" }
  ],
  rowCount: 1,
  executionTime: 0.05 // seconds
}
```

### Step 7: Format Results for LLM Context

Format database results for inclusion in LLM context:

**Format Options:**
- **JSON**: `{"order_id": "12345", "status": "shipped", ...}`
- **Table**: Markdown table format
- **Text**: Natural language: "Order #12345 is shipped, total $99.99"
- **Custom**: Using template: "Found order: {order_id}, status: {status}"

**Code (from roadmap):**
```typescript
const formattedResult = formatResults(
  result,
  block.properties.resultFormat,  // 'json', 'table', 'text', 'custom'
  block.properties.resultTemplate  // Custom template if format is 'custom'
);
```

### Step 8: Add DB Results to Context

Combine DB block results with other context sources:

```typescript
// Existing context from Weaviate
let context = weaviateContext;

// Add DB block results
for (const dbBlock of dbBlocks) {
  if (shouldExecuteDbBlock(dbBlock, message, sessionData)) {
    try {
      const dbResult = await executeDbBlock(
        dbBlock,
        message,
        sessionData,
        llmService
      );
      
      // Add formatted result to context
      context += `\n\nDatabase Query Results:\n${formatDbResult(dbResult)}`;
    } catch (error) {
      // Handle error based on block configuration
      if (block.properties.errorHandling === 'fallback_message') {
        context += `\n\n${block.properties.fallbackMessage}`;
      }
      // else: fail silently or return empty
    }
  }
}
```

### Step 9: Generate System Prompt with All Context

Combine all context sources:

```typescript
const systemPromptWithContext = generateSystemPrompt(
  systemPromptBlock,    // From PostgreSQL
  contextBlocks,        // From PostgreSQL (metadata)
  context               // Combined: Weaviate + DB Block results
);
```

**Final Context Includes:**
- Weaviate content (crawled websites/documents)
- **DB Block results (from external databases)** ⬅️ NEW
- Chat history (from PostgreSQL)
- System prompt configuration

### Step 10: LLM Generates Response

LLM receives:
- System prompt (with all context)
- Chat history
- User message

LLM generates response using:
- General knowledge
- Weaviate content (crawled content)
- **DB Block results (external database data)** ⬅️ NEW

---

## Complete Example Flow

### Scenario: User asks about order status

**User:** "What's the status of order #12345?"

**Chatbot Configuration:**
- Has a DB Block configured:
  - Database: Customer orders database (PostgreSQL)
  - Query: `SELECT status, total, created_at FROM orders WHERE order_id = :orderId`
  - Parameter: `orderId` extracted from user message

**Execution Flow:**

```
1. User sends message: "What's the status of order #12345?"
   │
2. System detects DB Block (ACTION type, DB subtype)
   │
3. Extract parameter: orderId = "12345"
   │
4. Build query: "SELECT status, total, created_at FROM orders WHERE order_id = $1"
   │
5. Validate query: ✅ SELECT-only, safe
   │
6. Execute on external database:
   │   └─> Connect to customer orders database
   │   └─> Execute SELECT query
   │   └─> Result: { status: "shipped", total: 99.99, created_at: "2024-01-01" }
   │
7. Format result: "Order #12345: Status is 'shipped', Total: $99.99, Created: 2024-01-01"
   │
8. Add to context:
   │   Context = Weaviate content + DB Block result
   │
9. Generate system prompt with context
   │
10. LLM generates response:
    "Order #12345 is currently shipped. The total amount is $99.99, 
     and it was created on January 1, 2024."
```

---

## Integration Points in Code

### Current Chat Controller Structure

**File:** `user/backend/src/controllers/chat.ts`

**Current flow (lines 363-511):**
```typescript
export const respond = async (req: AuthRequest, res: Response) => {
  // 1. Get/create chat session
  // 2. Save user message
  // 3. Get chat history
  // 4. Get context from Weaviate
  // 5. Get system prompt block
  // 6. Get context blocks
  // 7. Generate system prompt
  // 8. Generate LLM response
  // 9. Save assistant response
}
```

### Future Integration (After DB Block Implementation)

**Modified flow:**
```typescript
export const respond = async (req: AuthRequest, res: Response) => {
  // 1. Get/create chat session
  // 2. Save user message
  // 3. Get chat history
  // 4. Get context from Weaviate
  // 5. Get system prompt block
  // 6. Get context blocks
  // 7. **Get DB blocks** ⬅️ NEW
  // 8. **Execute DB blocks** ⬅️ NEW
  // 9. **Combine context: Weaviate + DB results** ⬅️ NEW
  // 10. Generate system prompt with all context
  // 11. Generate LLM response
  // 12. Save assistant response
}
```

**Code Addition (from roadmap):**
```typescript
// After getting context blocks (line 432-437)
const contextBlocks = await prisma.block.findMany({
  where: {
    chatbotId: chatbotId,
    type: BlockType.CONTEXT,
  },
});

// NEW: Get DB blocks
const dbBlocks = await prisma.block.findMany({
  where: {
    chatbotId: chatbotId,
    type: BlockType.ACTION,
    subtype: 'DB',
  },
});

// NEW: Execute DB blocks and get results
let dbContext = '';
for (const dbBlock of dbBlocks) {
  if (shouldExecuteDbBlock(dbBlock, message, sessionData)) {
    try {
      const dbResult = await executeDbBlock(
        dbBlock,
        message,
        sessionData,
        llmService
      );
      dbContext += `\n\nDatabase Query Results:\n${formatDbResult(dbResult)}`;
    } catch (error) {
      // Handle error based on block configuration
      console.error('DB Block execution error:', error);
    }
  }
}

// Combine Weaviate context with DB context
const combinedContext = context + dbContext;

// Generate system prompt with combined context
const systemPromptWithContext = generateSystemPrompt(
  systemPromptBlock,
  contextBlocks,
  combinedContext  // Now includes DB results
);
```

---

## DB Block Execution Service

**File:** `admin/backend/src/services/dbBlockExecutionService.ts` (to be created)

**Key Function:**
```typescript
async function executeDbBlock(
  block: Block,
  userMessage: string,
  sessionData: Record<string, any>,
  llmService: LLMService
): Promise<DbBlockResult> {
  // 1. Extract parameters from user message
  const parameters = await extractParameters(
    userMessage,
    block.properties.parameters,
    sessionData,
    llmService
  );
  
  // 2. Build parameterized query
  const query = buildParameterizedQuery(
    block.properties.sqlQuery,
    parameters
  );
  
  // 3. Validate query (READ-ONLY: Only SELECT allowed)
  const validation = validateSelectQuery(query);
  if (!validation.valid) {
    throw new Error(validation.error || 'Only SELECT queries are allowed');
  }
  
  // 4. Get or create database connection
  const connection = await getDbConnection(block.properties);
  
  // 5. Execute SELECT query only
  const result = await executeSelectQuery(connection, query, parameters);
  
  // 6. Enforce result limit
  if (result.rows.length > (block.properties.maxResultRows || 1000)) {
    result.rows = result.rows.slice(0, block.properties.maxResultRows || 1000);
  }
  
  // 7. Format results
  const formattedResult = formatResults(
    result,
    block.properties.resultFormat,
    block.properties.resultTemplate
  );
  
  return {
    data: formattedResult,
    metadata: {
      rowCount: result.rowCount,
      executionTime: result.executionTime
    }
  };
}
```

---

## Multiple DB Blocks

A chatbot can have **multiple DB blocks**, each querying different databases:

**Example:**
- **DB Block 1:** Query customer orders database
- **DB Block 2:** Query product inventory database
- **DB Block 3:** Query user profiles database

**Execution:**
- All matching DB blocks are executed
- Results are combined and added to context
- LLM uses all results to generate response

**Code:**
```typescript
// Execute all DB blocks
for (const dbBlock of dbBlocks) {
  if (shouldExecuteDbBlock(dbBlock, message, sessionData)) {
    const dbResult = await executeDbBlock(dbBlock, message, sessionData, llmService);
    dbContext += `\n\n[${dbBlock.title}] Database Results:\n${formatDbResult(dbResult)}`;
  }
}
```

---

## Error Handling

DB Block execution can fail for various reasons:
- Database connection error
- Query timeout
- Invalid query
- No results found

**Error Handling Strategies (configurable per block):**

1. **`fail`**: Throw error, stop execution
2. **`return_empty`**: Return empty result, continue
3. **`fallback_message`**: Return configured fallback message

**Code:**
```typescript
try {
  const dbResult = await executeDbBlock(dbBlock, message, sessionData, llmService);
  dbContext += formatDbResult(dbResult);
} catch (error) {
  if (block.properties.errorHandling === 'fallback_message') {
    dbContext += `\n\n${block.properties.fallbackMessage}`;
  } else if (block.properties.errorHandling === 'return_empty') {
    // Continue without DB context
  } else {
    // fail: throw error
    throw error;
  }
}
```

---

## Performance Considerations

**Query Execution:**
- DB queries are executed **synchronously** before LLM call
- Each DB block adds latency (database connection + query execution)
- Multiple DB blocks = sequential execution (can be parallelized in future)

**Optimization Strategies:**
- Connection pooling (reuse database connections)
- Query timeout (default: 30 seconds)
- Result limits (default: 1000 rows)
- Conditional execution (only execute when needed)

**Example Timeline:**
```
User sends message: 0ms
Get chat session: 5ms
Get Weaviate context: 50ms
Execute DB Block 1: 100ms  ⬅️ Database query
Execute DB Block 2: 80ms   ⬅️ Database query
Generate LLM response: 500ms
Total: ~735ms
```

---

## Security Considerations

**During Chat Execution:**

1. **Read-Only Enforcement:**
   - All queries validated before execution
   - Only SELECT queries allowed
   - Write operations blocked

2. **SQL Injection Prevention:**
   - Parameterized queries only
   - No string interpolation
   - Input validation

3. **Access Control:**
   - Database credentials encrypted
   - Connection limits per chatbot
   - Query rate limiting

4. **Data Privacy:**
   - Results only used for context
   - Not stored permanently
   - Limited result set size

---

## Summary

**How DB Block Works During Chat:**

1. **Detection:** System finds DB blocks (ACTION type, DB subtype) for chatbot
2. **Decision:** Determines which DB blocks to execute (always, conditional, or LLM-decided)
3. **Parameter Extraction:** Extracts query parameters from user message
4. **Query Building:** Builds parameterized SELECT query
5. **Validation:** Validates query is SELECT-only (read-only enforcement)
6. **Execution:** Connects to external database and executes query
7. **Formatting:** Formats results for LLM consumption
8. **Context Integration:** Adds DB results to context (alongside Weaviate content)
9. **LLM Generation:** LLM uses all context (Weaviate + DB results) to generate response

**Key Points:**
- ✅ DB Blocks query **external databases** (not internal PostgreSQL)
- ✅ **Read-only** - only SELECT queries allowed
- ✅ Results are used as **context** for LLM (like Weaviate content)
- ✅ Multiple DB blocks can be executed per conversation
- ✅ Results are **not stored** - only used for generating response

---

## Code Locations (When Implemented)

**DB Block Execution:**
- **File:** `admin/backend/src/services/dbBlockExecutionService.ts`
- **Function:** `executeDbBlock()`

**Chat Integration:**
- **File:** `user/backend/src/controllers/chat.ts`
- **Function:** `respond()`, `respondStreaming()`, `respondApiToken()`
- **Location:** After getting context blocks, before generating system prompt

**Parameter Extraction:**
- **File:** `admin/backend/src/services/queryParameterService.ts`
- **Function:** `extractParameters()`

**Query Validation:**
- **File:** `admin/backend/src/services/dbConnectionService.ts`
- **Function:** `validateSelectQuery()`
