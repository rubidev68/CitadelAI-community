# API Block Usage Guide

## Overview

The API Block enables your chatbots to be accessed programmatically via REST API endpoints. This allows you to integrate your chatbot into external applications, websites, mobile apps, or any system that can make HTTP requests.

## Features

- **Secure Token Authentication**: Generate API tokens to authenticate requests
- **Flexible Token Types**: 
  - **Duration-based**: Tokens expire after a specific date
  - **Usage-based**: Tokens expire after a certain number of requests
  - **Permanent**: Tokens never expire (admin-only)
- **Usage Tracking**: Monitor how many requests each token has made
- **Rate Limiting**: Configure request rate limits per chatbot
- **Easy Integration**: Simple REST API with JSON responses

---

## Getting Started

### Step 1: Add API Block to Your Chatbot

1. Open your chatbot in the builder
2. Drag the **API** block from the Frontend category onto the canvas
3. Connect it to your System Prompt block (or other logic blocks)
4. Click on the API block to configure it

### Step 2: Configure API Endpoint

In the API block properties panel:

- **Endpoint Path**: Set your custom API endpoint (e.g., `/api/chat`, `/api/v1/chatbot`)
- **HTTP Method**: Choose the method (typically POST for chat endpoints)
- **Rate Limit**: Set maximum requests per minute/hour (optional)

### Step 3: Generate API Token

1. In the API block properties, find the **Token Management** section
2. Click **Generate New Token**
3. Fill in the token details:
   - **Token Name**: A descriptive name (e.g., "Production API Key", "Mobile App Key")
   - **Token Type**: 
     - **Duration**: Token expires on a specific date
     - **Usage**: Token expires after N requests
     - **Permanent**: Token never expires (use with caution)
   - **Expiration Date** (for Duration type): Select when the token should expire
   - **Max Usage** (for Usage type): Enter maximum number of requests
4. Click **Generate Token**

**⚠️ Important**: Copy the token immediately after generation. You won't be able to see the full token again for security reasons. Only the token prefix (first 8 characters) will be displayed.

### Step 4: Use the Token

Include the token in your API requests using the `Authorization` header:

```
Authorization: Bearer cat_abc123def456...
```

---

## API Reference

### Base URL

All API endpoints are available at:
```
https://your-domain.com/api/chat/{chatbotId}
```

Replace `{chatbotId}` with your chatbot's ID (found in the chatbot settings).

### Endpoints

#### Send Message

Send a message to your chatbot and receive a response.

**Endpoint**: `POST /api/chat/{chatbotId}`

**Headers**:
```
Authorization: Bearer {your-api-token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "message": "Hello, chatbot!",
  "sessionId": "optional-session-id",
  "stream": false
}
```

**Note**: For streaming responses, use the `/stream` endpoint instead (see Streaming API section below).

**Parameters**:
- `message` (required): The user's message/question
- `sessionId` (optional): Session identifier for conversation continuity
- `stream` (optional): Set to `true` for streaming responses (default: `false`)

**Response**:
```json
{
  "response": "Hello! How can I help you today?",
  "sessionId": "session-abc123",
  "sources": [
    {
      "url": "https://example.com/page",
      "title": "Example Page",
      "relevance": 0.95
    }
  ],
  "usage": {
    "token": "cat_abc1",
    "remaining": 950
  }
}
```

**Response Fields**:
- `response`: The chatbot's reply
- `sessionId`: Session identifier (use this for follow-up messages)
- `sources`: Array of sources used to generate the response (if applicable)
- `usage`: Token usage information (for usage-based tokens)

**Error Responses**:

```json
// 401 Unauthorized - Invalid or missing token
{
  "error": "Unauthorized",
  "message": "Invalid or missing API token"
}

// 403 Forbidden - Token expired
{
  "error": "Forbidden",
  "message": "Token has expired"
}

// 403 Forbidden - Usage limit exceeded
{
  "error": "Forbidden",
  "message": "Token usage limit exceeded",
  "usage": {
    "current": 1000,
    "limit": 1000
  }
}

// 429 Too Many Requests - Rate limit exceeded
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 60
}

// 404 Not Found - Chatbot not found
{
  "error": "Not Found",
  "message": "Chatbot not found"
}
```

#### Health Check

Check if the API is available and your token is valid.

**Endpoint**: `GET /api/chat/{chatbotId}/health`

**Headers**:
```
Authorization: Bearer {your-api-token}
```

**Response**:
```json
{
  "status": "healthy",
  "chatbotId": "chatbot-123",
  "token": {
    "prefix": "cat_abc1",
    "type": "USAGE",
    "remaining": 950,
    "expiresAt": null
  }
}
```

#### Stream Message (Server-Sent Events)

Send a message and receive a streaming response using Server-Sent Events (SSE). This is useful for real-time user experiences where you want to display the response as it's being generated.

**Endpoint**: `POST /api/chat/{chatbotId}/stream`

**Headers**:
```
Authorization: Bearer {your-api-token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "message": "Tell me about your products",
  "sessionId": "optional-session-id"
}
```

**Response**: Server-Sent Events stream (`Content-Type: text/event-stream`)

**Event Types**:

1. **Metadata Event** (sent first):
```json
data: {"type":"metadata","chatSessionId":"session-abc123"}
```

2. **Chunk Events** (sent as response is generated):
```json
data: {"type":"chunk","content":"We"}
data: {"type":"chunk","content":" offer"}
data: {"type":"chunk","content":" a wide"}
data: {"type":"chunk","content":" range"}
```

3. **Complete Event** (sent when response is finished):
```json
data: {"type":"complete","fullResponse":"We offer a wide range of products...","sources":[...]}
```

4. **Usage Event** (sent after completion, for usage-based tokens):
```json
data: {"type":"usage","token":"cat_abc1","remaining":949}
```

5. **Error Event** (sent if an error occurs):
```json
data: {"type":"error","error":"An error occurred while processing your request"}
```

**JavaScript Example**:
```javascript
async function streamMessage(chatbotId, token, message, sessionId = null) {
  const response = await fetch(`https://your-domain.com/api/chat/${chatbotId}/stream`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: message,
      sessionId: sessionId
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullResponse = '';
  let sessionId = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        
        switch (data.type) {
          case 'metadata':
            sessionId = data.chatSessionId;
            break;
          case 'chunk':
            fullResponse += data.content;
            // Update UI with new chunk
            console.log('Chunk:', data.content);
            break;
          case 'complete':
            console.log('Complete response:', data.fullResponse);
            console.log('Sources:', data.sources);
            break;
          case 'usage':
            console.log('Remaining requests:', data.remaining);
            break;
          case 'error':
            throw new Error(data.error);
        }
      }
    }
  }

  return { fullResponse, sessionId };
}
```

**Python Example**:
```python
import requests
import json

def stream_message(chatbot_id, token, message, session_id=None):
    url = f"https://your-domain.com/api/chat/{chatbot_id}/stream"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    data = {
        "message": message,
        "sessionId": session_id
    }
    
    response = requests.post(url, json=data, headers=headers, stream=True)
    response.raise_for_status()
    
    full_response = ""
    current_session_id = None
    
    for line in response.iter_lines():
        if line:
            line = line.decode('utf-8')
            if line.startswith('data: '):
                event_data = json.loads(line[6:])
                
                if event_data['type'] == 'metadata':
                    current_session_id = event_data['chatSessionId']
                elif event_data['type'] == 'chunk':
                    full_response += event_data['content']
                    print(event_data['content'], end='', flush=True)
                elif event_data['type'] == 'complete':
                    print('\n')
                    print('Sources:', event_data.get('sources', []))
                elif event_data['type'] == 'usage':
                    print(f"\nRemaining requests: {event_data['remaining']}")
                elif event_data['type'] == 'error':
                    raise Exception(event_data['error'])
    
    return {'fullResponse': full_response, 'sessionId': current_session_id}
```

**cURL Example**:
```bash
curl -X POST https://your-domain.com/api/chat/chatbot-123/stream \
  -H "Authorization: Bearer cat_abc123def456..." \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","sessionId":"session-123"}' \
  --no-buffer
```

**Benefits of Streaming**:
- Better user experience with real-time response display
- Perceived faster response times
- Ability to cancel long-running requests
- Lower latency for first token display

#### Chatbot Info

Get public information about the chatbot.

**Endpoint**: `GET /api/chat/{chatbotId}/info`

**Headers**: None required (public endpoint)

**Response**:
```json
{
  "id": "chatbot-123",
  "name": "Customer Support Bot",
  "status": "ACTIVE",
  "description": "Helps customers with common questions"
}
```

---

## Code Examples

### cURL

```bash
# Send a message
curl -X POST https://your-domain.com/api/chat/chatbot-123 \
  -H "Authorization: Bearer cat_abc123def456..." \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are your business hours?",
    "sessionId": "user-session-123"
  }'

# Health check
curl -X GET https://your-domain.com/api/chat/chatbot-123/health \
  -H "Authorization: Bearer cat_abc123def456..."
```

### JavaScript (Fetch API)

```javascript
async function sendMessage(chatbotId, token, message, sessionId = null) {
  const response = await fetch(`https://your-domain.com/api/chat/${chatbotId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: message,
      sessionId: sessionId
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'API request failed');
  }

  return await response.json();
}

// Usage
const result = await sendMessage(
  'chatbot-123',
  'cat_abc123def456...',
  'Hello, chatbot!',
  'session-123'
);
console.log(result.response);
```

### Python (Requests)

```python
import requests

def send_message(chatbot_id, token, message, session_id=None):
    url = f"https://your-domain.com/api/chat/{chatbot_id}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    data = {
        "message": message,
        "sessionId": session_id
    }
    
    response = requests.post(url, json=data, headers=headers)
    response.raise_for_status()
    return response.json()

# Usage
result = send_message(
    "chatbot-123",
    "cat_abc123def456...",
    "Hello, chatbot!",
    "session-123"
)
print(result["response"])
```

### Node.js (Axios)

```javascript
const axios = require('axios');

async function sendMessage(chatbotId, token, message, sessionId = null) {
  try {
    const response = await axios.post(
      `https://your-domain.com/api/chat/${chatbotId}`,
      {
        message: message,
        sessionId: sessionId
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.message || 'API request failed');
    }
    throw error;
  }
}

// Usage
const result = await sendMessage(
  'chatbot-123',
  'cat_abc123def456...',
  'Hello, chatbot!',
  'session-123'
);
console.log(result.response);
```

### PHP

```php
<?php
function sendMessage($chatbotId, $token, $message, $sessionId = null) {
    $url = "https://your-domain.com/api/chat/{$chatbotId}";
    $data = [
        'message' => $message,
        'sessionId' => $sessionId
    ];
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        throw new Exception('API request failed');
    }
    
    return json_decode($response, true);
}

// Usage
$result = sendMessage(
    'chatbot-123',
    'cat_abc123def456...',
    'Hello, chatbot!',
    'session-123'
);
echo $result['response'];
?>
```

---

## Token Management

### Viewing Tokens

In the API block properties panel, you can see all tokens for your chatbot:
- Token name
- Token prefix (first 8 characters)
- Token type
- Status (Active/Expired/Exhausted)
- Usage statistics
- Expiration date
- Last used date

### Revoking Tokens

To revoke a token:
1. Find the token in the token list
2. Click the **Revoke** button
3. Confirm the action

Revoked tokens cannot be used again. You'll need to generate a new token.

### Updating Tokens

You can update token properties:
- Token name
- Expiration date (for Duration tokens)
- Max usage (for Usage tokens)

Note: You cannot change a token's type after creation.

### Best Practices

1. **Use Descriptive Names**: Name your tokens clearly (e.g., "Production API", "Mobile App v1")
2. **Set Appropriate Expiration**: Use Duration tokens for temporary access, Usage tokens for limited trials
3. **Rotate Tokens Regularly**: Generate new tokens periodically and revoke old ones
4. **Monitor Usage**: Check token usage regularly to detect unusual activity
5. **Store Tokens Securely**: Never commit tokens to version control or expose them in client-side code
6. **Use Environment Variables**: Store tokens in environment variables or secure secret management systems
7. **One Token Per Application**: Use separate tokens for different applications/environments

---

## Token Types Explained

### Duration Tokens

- **Use Case**: Temporary access, scheduled access, time-limited integrations
- **Expiration**: Token becomes invalid after the specified date/time
- **Example**: "Give access for 30 days", "Expires at end of month"

### Usage Tokens

- **Use Case**: Limited trials, pay-per-use scenarios, controlled access
- **Expiration**: Token becomes invalid after N requests
- **Example**: "Allow 1000 requests", "Trial with 50 messages"

### Permanent Tokens

- **Use Case**: Long-term integrations, trusted applications
- **Expiration**: Never expires (use with caution)
- **Example**: "Production API key", "Internal service integration"
- **Note**: Only available to admin users. Consider using Duration tokens with long expiration instead.

---

## Error Handling

### Common Errors

| Status Code | Error | Description | Solution |
|------------|-------|-------------|----------|
| 401 | Unauthorized | Invalid or missing token | Check token is correct and included in Authorization header |
| 403 | Forbidden | Token expired or exhausted | Generate a new token |
| 404 | Not Found | Chatbot not found | Verify chatbot ID is correct |
| 429 | Too Many Requests | Rate limit exceeded | Wait before retrying, check rate limit settings |
| 500 | Internal Server Error | Server error | Contact support if issue persists |

### Retry Logic

For transient errors (429, 500), implement exponential backoff:

```javascript
async function sendMessageWithRetry(chatbotId, token, message, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await sendMessage(chatbotId, token, message);
    } catch (error) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Security Considerations

1. **Never Expose Tokens**: Keep tokens secret. Never include them in:
   - Client-side JavaScript code
   - Public repositories
   - Logs or error messages
   - URLs or query parameters

2. **Use HTTPS**: Always use HTTPS in production to encrypt requests

3. **Rotate Tokens**: Regularly rotate tokens, especially if compromised

4. **Monitor Usage**: Watch for unusual usage patterns that might indicate token theft

5. **Least Privilege**: Use the most restrictive token type that meets your needs

6. **Environment Separation**: Use different tokens for development, staging, and production

---

## Rate Limiting

Rate limits can be configured per chatbot in the API block properties. When a rate limit is exceeded, you'll receive a `429 Too Many Requests` response with a `Retry-After` header indicating when to retry.

Default rate limits:
- Per token: 60 requests per minute
- Per chatbot: 1000 requests per hour

These can be customized in the API block configuration.

---

## Session Management

For conversation continuity, use the `sessionId` parameter:

```javascript
// First message
const session1 = await sendMessage(chatbotId, token, "Hello", null);
const sessionId = session1.sessionId; // Save this

// Follow-up message (chatbot remembers context)
const session2 = await sendMessage(chatbotId, token, "What did I just ask?", sessionId);
```

Session IDs are generated automatically if not provided. Use the same session ID for related messages to maintain conversation context.

---

## Troubleshooting

### Token Not Working

1. Verify token is correct (check for typos)
2. Check token hasn't expired (for Duration tokens)
3. Check usage limit hasn't been reached (for Usage tokens)
4. Verify token hasn't been revoked
5. Check Authorization header format: `Bearer {token}`

### Getting 404 Errors

1. Verify chatbot ID is correct
2. Ensure chatbot status is ACTIVE
3. Check API endpoint URL is correct

### Slow Responses

1. Check network connectivity
2. Verify chatbot is not overloaded
3. Consider implementing request queuing
4. Check rate limits aren't being hit

### Token Usage Not Updating

Usage counters update asynchronously. There may be a slight delay before usage statistics reflect the latest requests.

---

## Viewing API Documentation

The API block properties panel includes a **"View API Documentation"** link that opens comprehensive HTML documentation for your chatbot's API. The documentation includes:

- Interactive code examples with copy-to-clipboard
- Chatbot-specific endpoint URLs
- Token management instructions
- Streaming API guide
- Error handling reference
- Code snippets in multiple programming languages

You can also access the documentation directly at:
```
https://your-domain.com/api-docs/{chatbotId}
```

## Support

For additional help:
- Check the API block properties panel for token status
- Click "View API Documentation" for detailed guides
- Review error messages for specific issues
- Contact support with your chatbot ID and token prefix

---

## Changelog

### Version 1.0 (Initial Release)
- Basic token authentication
- Duration and Usage token types
- Public API endpoints
- Streaming API support (Server-Sent Events)
- Token management UI
- HTML documentation with interface link
- Rate limiting support
