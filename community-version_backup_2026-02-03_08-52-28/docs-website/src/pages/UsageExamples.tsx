import MarkdownRenderer from "@/components/MarkdownRenderer";

const UsageExamples = () => {
  const content = `# Usage Examples

Practical examples for using CitadelAI APIs and features.

## Quick Start Example

### 1. Register a User

\`\`\`bash
curl -X POST http://localhost:3003/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "securepassword123",
    "name": "John Doe"
  }'
\`\`\`

**Response:**
\`\`\`json
{
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2025-01-01T10:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
\`\`\`

### 2. Create a Chat Session

\`\`\`bash
curl -X POST http://localhost:3003/api/chat/sessions \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "chatbotId": "chatbot-456"
  }'
\`\`\`

### 3. Send a Message

\`\`\`bash
curl -X POST http://localhost:3003/api/chat/respond \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "What is your return policy?",
    "chatSessionId": "session-123"
  }'
\`\`\`

## Complete Workflow Example

### Admin Workflow: Create and Configure a Chatbot

\`\`\`mermaid
sequenceDiagram
    participant Admin
    participant API
    participant DB
    participant Crawler
    
    Admin->>API: Register/Login
    API->>DB: Create Admin
    API-->>Admin: Return Token
    
    Admin->>API: Create Chatbot
    API->>DB: Save Chatbot
    API-->>Admin: Chatbot ID
    
    Admin->>API: Start Crawling
    API->>Crawler: Crawl Website
    Crawler->>DB: Index Content
    Crawler-->>API: Status Updates
    API-->>Admin: Progress
    
    Admin->>API: Grant User Access
    API->>DB: Create Access
    API-->>Admin: Success
\`\`\`

### Step-by-Step: Creating a Customer Support Bot

#### 1. Register as Admin

\`\`\`bash
curl -X POST http://localhost:3002/api/admin/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "admin@company.com",
    "password": "securepassword",
    "name": "Admin User",
    "company": "Acme Corp",
    "role": "ADMIN"
  }'
\`\`\`

#### 2. Create a Chatbot

\`\`\`bash
curl -X POST http://localhost:3002/api/admin/chatbots \\
  -H "Authorization: Bearer ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Customer Support Bot",
    "description": "AI assistant for customer support"
  }'
\`\`\`

**Response includes chatbot ID:**
\`\`\`json
{
  "id": "chatbot-789",
  "name": "Customer Support Bot",
  "status": "INACTIVE",
  ...
}
\`\`\`

#### 3. Configure System Prompt

Update the chatbot with a system prompt block:

\`\`\`bash
curl -X PUT http://localhost:3002/api/admin/chatbots/chatbot-789 \\
  -H "Authorization: Bearer ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "blocks": [
      {
        "type": "LOGIC",
        "subtype": "System Prompt",
        "title": "System Prompt",
        "properties": {
          "botName": "Customer Support Bot",
          "companyName": "Acme Corp",
          "behavior": "helpful",
          "additionalInstructions": "Be friendly and professional. Always provide accurate information from our knowledge base."
        }
      }
    ]
  }'
\`\`\`

#### 4. Add Website Context

Start crawling your website:

\`\`\`bash
curl -X POST http://localhost:3002/api/admin/crawl \\
  -H "Authorization: Bearer ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://yourcompany.com",
    "chatbotId": "chatbot-789",
    "blockId": "block-123",
    "recursive": true,
    "maxDepth": 3
  }'
\`\`\`

#### 5. Check Crawling Status

\`\`\`bash
curl http://localhost:3002/api/admin/status/block-123 \\
  -H "Authorization: Bearer ADMIN_TOKEN"
\`\`\`

**Response:**
\`\`\`json
{
  "status": "crawling",
  "progress": 15,
  "total": 50,
  "currentUrl": "https://yourcompany.com/products"
}
\`\`\`

#### 6. Activate Chatbot

\`\`\`bash
curl -X PUT http://localhost:3002/api/admin/chatbots/chatbot-789 \\
  -H "Authorization: Bearer ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "ACTIVE"
  }'
\`\`\`

#### 7. Grant User Access

\`\`\`bash
curl -X POST http://localhost:3002/api/admin/chatbots/chatbot-789/users \\
  -H "Authorization: Bearer ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com"
  }'
\`\`\`

## User Workflow Example

### Step-by-Step: Using a Chatbot

#### 1. Register as User

\`\`\`bash
curl -X POST http://localhost:3003/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "Jane User"
  }'
\`\`\`

#### 2. Get Available Chatbots

\`\`\`bash
curl http://localhost:3003/api/chatbots \\
  -H "Authorization: Bearer USER_TOKEN"
\`\`\`

**Response:**
\`\`\`json
[
  {
    "id": "chatbot-789",
    "name": "Customer Support Bot",
    "status": "ACTIVE",
    "isDefault": false
  }
]
\`\`\`

#### 3. Create Chat Session

\`\`\`bash
curl -X POST http://localhost:3003/api/chat/sessions \\
  -H "Authorization: Bearer USER_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "chatbotId": "chatbot-789"
  }'
\`\`\`

#### 4. Send Message (Standard)

\`\`\`bash
curl -X POST http://localhost:3003/api/chat/respond \\
  -H "Authorization: Bearer USER_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "What is your return policy?",
    "chatSessionId": "session-456"
  }'
\`\`\`

**Response:**
\`\`\`json
{
  "message": "Our return policy allows returns within 30 days of purchase...",
  "followUps": [
    "What items are eligible for return?",
    "How do I process a return?"
  ],
  "citations": "\\n\\n**Sources:**\\n1. [Return Policy](https://yourcompany.com/returns) (pages: 2)",
  "chatSessionId": "session-456"
}
\`\`\`

#### 5. Send Message (Streaming)

Using Server-Sent Events for real-time streaming:

\`\`\`javascript
const eventSource = new EventSource(
  'http://localhost:3003/api/chat/respond-streaming',
  {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN',
      'Content-Type': 'application/json'
    }
  }
);

// Send message first
fetch('http://localhost:3003/api/chat/respond-streaming', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: "Explain your product features",
    chatSessionId: "session-456"
  })
});

// Listen for streaming events
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'chunk') {
    // Append to UI
    appendToChat(data.content);
  } else if (data.type === 'complete') {
    // Show full response
    showCompleteResponse(data.fullResponse);
  } else if (data.type === 'citations') {
    // Show sources
    showCitations(data.citations);
  } else if (data.type === 'followUps') {
    // Show follow-up suggestions
    showFollowUps(data.followUps);
  }
};
\`\`\`

#### 6. Get Chat History

\`\`\`bash
curl "http://localhost:3003/api/chat/history?sessionId=session-456" \\
  -H "Authorization: Bearer USER_TOKEN"
\`\`\`

## JavaScript/TypeScript Examples

### Complete Chat Integration

\`\`\`typescript
class CitadelAIClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = 'http://localhost:3003/api') {
    this.baseUrl = baseUrl;
  }

  async register(email: string, password: string, name: string) {
    const response = await fetch(\`\${this.baseUrl}/auth/register\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    
    const data = await response.json();
    this.token = data.token;
    return data;
  }

  async login(email: string, password: string) {
    const response = await fetch(\`\${this.baseUrl}/auth/login\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    this.token = data.token;
    return data;
  }

  async getChatbots() {
    const response = await fetch(\`\${this.baseUrl}/chatbots\`, {
      headers: {
        'Authorization': \`Bearer \${this.token}\`
      }
    });
    
    return response.json();
  }

  async createSession(chatbotId: string) {
    const response = await fetch(\`\${this.baseUrl}/chat/sessions\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${this.token}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ chatbotId })
    });
    
    return response.json();
  }

  async sendMessage(message: string, sessionId: string) {
    const response = await fetch(\`\${this.baseUrl}/chat/respond\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${this.token}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, chatSessionId: sessionId })
    });
    
    return response.json();
  }

  async streamMessage(message: string, sessionId: string, onChunk: (chunk: string) => void) {
    // First send the message
    await fetch(\`\${this.baseUrl}/chat/respond-streaming\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${this.token}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, chatSessionId: sessionId })
    });

    // Then listen for SSE stream
    const eventSource = new EventSource(
      \`\${this.baseUrl}/chat/respond-streaming\`,
      {
        headers: {
          'Authorization': \`Bearer \${this.token}\`
        }
      }
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chunk') {
        onChunk(data.content);
      }
    };

    return eventSource;
  }
}

// Usage
const client = new CitadelAIClient('http://localhost:3003/api');

// Register and login
await client.register('user@example.com', 'password', 'John Doe');

// Get chatbots
const chatbots = await client.getChatbots();
const chatbot = chatbots[0];

// Create session
const session = await client.createSession(chatbot.id);

// Send message
const response = await client.sendMessage('Hello!', session.id);
console.log(response.message);

// Stream message
await client.streamMessage('Tell me about your products', session.id, (chunk) => {
  console.log(chunk); // Progressive output
});
\`\`\`

## Python Example

\`\`\`python
import requests
import json

class CitadelAIClient:
    def __init__(self, base_url="http://localhost:3003/api"):
        self.base_url = base_url
        self.token = None
    
    def register(self, email, password, name):
        response = requests.post(
            f"{self.base_url}/auth/register",
            json={"email": email, "password": password, "name": name}
        )
        data = response.json()
        self.token = data["token"]
        return data
    
    def login(self, email, password):
        response = requests.post(
            f"{self.base_url}/auth/login",
            json={"email": email, "password": password}
        )
        data = response.json()
        self.token = data["token"]
        return data
    
    def get_chatbots(self):
        response = requests.get(
            f"{self.base_url}/chatbots",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        return response.json()
    
    def create_session(self, chatbot_id):
        response = requests.post(
            f"{self.base_url}/chat/sessions",
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            },
            json={"chatbotId": chatbot_id}
        )
        return response.json()
    
    def send_message(self, message, session_id):
        response = requests.post(
            f"{self.base_url}/chat/respond",
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            },
            json={"message": message, "chatSessionId": session_id}
        )
        return response.json()

# Usage
client = CitadelAIClient()

# Register
client.register("user@example.com", "password123", "John Doe")

# Get chatbots
chatbots = client.get_chatbots()
chatbot = chatbots[0]

# Create session
session = client.create_session(chatbot["id"])

# Send message
response = client.send_message("Hello!", session["id"])
print(response["message"])
\`\`\`

## Nextcloud Integration Example

### Connect Nextcloud

\`\`\`bash
# Configure Nextcloud in admin backend
# Set environment variables:
NEXTCLOUD_URL=https://your-nextcloud.com
NEXTCLOUD_USERNAME=your_username
NEXTCLOUD_PASSWORD=your_password
\`\`\`

### Use Nextcloud in Chatbot

Once configured, the chatbot can access files from your Nextcloud instance when answering questions.

## Advanced Examples

### Scheduled Crawling

\`\`\`bash
# Update cron settings for a block
curl -X POST http://localhost:3002/api/admin/cron/update \\
  -H "Authorization: Bearer ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "blockId": "block-123",
    "cronEnabled": true,
    "cronSchedule": "0 0 * * *",
    "cronTimezone": "UTC"
  }'
\`\`\`

This will automatically crawl the website every day at midnight UTC.

### Batch Operations

\`\`\`bash
# Get all chatbots
chatbots=$(curl -X GET http://localhost:3002/api/admin/chatbots \\
  -H "Authorization: Bearer ADMIN_TOKEN")

# Update multiple chatbots
for chatbot in $chatbots; do
  curl -X PUT "http://localhost:3002/api/admin/chatbots/\${chatbot.id}" \\
    -H "Authorization: Bearer ADMIN_TOKEN" \\
    -H "Content-Type: application/json" \\
    -d '{"status": "ACTIVE"}'
done
\`\`\`

## Error Handling

### Handling API Errors

\`\`\`typescript
async function sendMessageSafely(client: CitadelAIClient, message: string, sessionId: string) {
  try {
    const response = await client.sendMessage(message, sessionId);
    return response;
  } catch (error) {
    if (error.response?.status === 401) {
      // Token expired, re-authenticate
      await client.login(email, password);
      return client.sendMessage(message, sessionId);
    } else if (error.response?.status === 429) {
      // Rate limited, wait and retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      return client.sendMessage(message, sessionId);
    } else {
      throw error;
    }
  }
}
\`\`\`

## Next Steps

- [API Reference](/api/overview) - Complete API documentation
- [Configuration Reference](/configuration/reference) - Environment setup
- [Troubleshooting Guide](/troubleshooting/guide) - Common issues
`;

  return (
    <div>
      <MarkdownRenderer content={content} />
    </div>
  );
};

export default UsageExamples;
