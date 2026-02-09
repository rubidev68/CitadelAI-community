/**
 * Generate HTML documentation for API
 */
export function generateApiDocsHtml(chatbotId: string, chatbotName: string, apiBaseUrl: string, baseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Documentation - ${chatbotName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 20px;
      margin-bottom: 30px;
      border-radius: 8px;
    }
    header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    header p {
      font-size: 1.2em;
      opacity: 0.9;
    }
    .content {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h2 {
      color: #667eea;
      margin-top: 30px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #eee;
    }
    h3 {
      color: #764ba2;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
      margin: 15px 0;
    }
    pre code {
      background: none;
      padding: 0;
      color: inherit;
    }
    .endpoint {
      background: #f9f9f9;
      padding: 15px;
      border-left: 4px solid #667eea;
      margin: 15px 0;
      border-radius: 4px;
    }
    .method {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 3px;
      font-weight: bold;
      font-size: 0.9em;
      margin-right: 10px;
    }
    .method.post {
      background: #49cc90;
      color: white;
    }
    .method.get {
      background: #61affe;
      color: white;
    }
    .copy-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 8px 15px;
      border-radius: 4px;
      cursor: pointer;
      margin-left: 10px;
      font-size: 0.9em;
    }
    .copy-btn:hover {
      background: #5568d3;
    }
    .alert {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 15px 0;
      border-radius: 4px;
    }
    .alert strong {
      color: #856404;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 0.85em;
      font-weight: 600;
    }
    .badge.active {
      background: #d4edda;
      color: #155724;
    }
    .badge.expired {
      background: #f8d7da;
      color: #721c24;
    }
    @media (prefers-color-scheme: dark) {
      body {
        background: #1a1a1a;
        color: #e0e0e0;
      }
      .content {
        background: #2d2d2d;
      }
      code {
        background: #3a3a3a;
      }
      th {
        background: #3a3a3a;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${chatbotName} API Documentation</h1>
      <p>Complete guide to accessing your chatbot via REST API</p>
    </header>

    <div class="content">
      <h2>Getting Started</h2>
      <p>This API allows you to interact with your chatbot programmatically using REST endpoints. All requests require authentication using an API token.</p>

      <div class="alert">
        <strong>Base URL:</strong> <code>${apiBaseUrl}</code>
      </div>

      <h2>Authentication</h2>
      <p>All API requests require authentication using a Bearer token in the Authorization header:</p>
      <pre><code>Authorization: Bearer cat_your_token_here</code></pre>

      <h2>Endpoints</h2>

      <div class="endpoint">
        <h3><span class="method post">POST</span> Send Message</h3>
        <p><strong>Endpoint:</strong> <code>${apiBaseUrl}</code></p>
        <p><strong>Description:</strong> Send a message to the chatbot and receive a response.</p>
        <p><strong>Request Body:</strong></p>
        <pre><code>{
  "message": "Hello, chatbot!",
  "sessionId": "optional-session-id"
}</code></pre>
        <p><strong>Response:</strong></p>
        <pre><code>{
  "response": "Hello! How can I help you?",
  "sessionId": "session-123",
  "sources": [...],
  "usage": {
    "token": "cat_abc1",
    "remaining": 950
  }
}</code></pre>
      </div>

      <div class="endpoint">
        <h3><span class="method post">POST</span> Stream Message</h3>
        <p><strong>Endpoint:</strong> <code>${apiBaseUrl}/stream</code></p>
        <p><strong>Description:</strong> Send a message and receive a streaming response using Server-Sent Events (SSE).</p>
        <p><strong>Request Body:</strong></p>
        <pre><code>{
  "message": "Tell me about your products",
  "sessionId": "optional-session-id"
}</code></pre>
        <p><strong>Response:</strong> Server-Sent Events stream</p>
        <pre><code>data: {"type":"metadata","chatSessionId":"session-123"}
data: {"type":"chunk","content":"We"}
data: {"type":"chunk","content":" offer"}
data: {"type":"complete","fullResponse":"We offer..."}
data: {"type":"usage","token":"cat_abc1","remaining":949}</code></pre>
      </div>

      <div class="endpoint">
        <h3><span class="method get">GET</span> Health Check</h3>
        <p><strong>Endpoint:</strong> <code>${apiBaseUrl}/health</code></p>
        <p><strong>Description:</strong> Check if the API is available and your token is valid.</p>
        <p><strong>Response:</strong></p>
        <pre><code>{
  "status": "healthy",
  "chatbotId": "${chatbotId}",
  "token": {
    "prefix": "cat_abc1",
    "type": "USAGE",
    "remaining": 950
  }
}</code></pre>
      </div>

      <div class="endpoint">
        <h3><span class="method get">GET</span> Chatbot Info</h3>
        <p><strong>Endpoint:</strong> <code>${apiBaseUrl}/info</code></p>
        <p><strong>Description:</strong> Get public information about the chatbot (no authentication required).</p>
        <p><strong>Response:</strong></p>
        <pre><code>{
  "id": "${chatbotId}",
  "name": "${chatbotName}",
  "status": "ACTIVE"
}</code></pre>
      </div>

      <h2>Code Examples</h2>

      <h3>JavaScript (Fetch API)</h3>
      <pre><code>async function sendMessage(chatbotId, token, message, sessionId = null) {
  const response = await fetch(\`${apiBaseUrl}\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${token}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: message,
      sessionId: sessionId
    })
  });

  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }

  return await response.json();
}</code></pre>

      <h3>Python (Requests)</h3>
      <pre><code>import requests

def send_message(chatbot_id, token, message, session_id=None):
    url = f"${apiBaseUrl}"
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
    return response.json()</code></pre>

      <h3>cURL</h3>
      <pre><code>curl -X POST "${apiBaseUrl}" \\
  -H "Authorization: Bearer cat_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Hello, chatbot!",
    "sessionId": "session-123"
  }'</code></pre>

      <h2>Error Handling</h2>
      <table>
        <thead>
          <tr>
            <th>Status Code</th>
            <th>Error</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>401</td>
            <td>Unauthorized</td>
            <td>Invalid or missing API token</td>
          </tr>
          <tr>
            <td>403</td>
            <td>Forbidden</td>
            <td>Token expired or usage limit exceeded</td>
          </tr>
          <tr>
            <td>404</td>
            <td>Not Found</td>
            <td>Chatbot not found</td>
          </tr>
          <tr>
            <td>429</td>
            <td>Too Many Requests</td>
            <td>Rate limit exceeded</td>
          </tr>
          <tr>
            <td>500</td>
            <td>Internal Server Error</td>
            <td>Server error - contact support</td>
          </tr>
        </tbody>
      </table>

      <h2>Token Management</h2>
      <p>To generate and manage API tokens, use the API block in your chatbot builder. Tokens support three types:</p>
      <ul style="margin-left: 20px; margin-top: 10px;">
        <li><strong>Duration:</strong> Tokens expire after a specific date</li>
        <li><strong>Usage:</strong> Tokens expire after N requests</li>
        <li><strong>Permanent:</strong> Tokens never expire (use with caution)</li>
      </ul>

      <h2>Session Management</h2>
      <p>For conversation continuity, use the <code>sessionId</code> parameter. The API will return a session ID that you can use for follow-up messages to maintain context.</p>

      <div class="alert">
        <strong>Note:</strong> Always store tokens securely. Never commit them to version control or expose them in client-side code.
      </div>
    </div>
  </div>

  <script>
    // Copy to clipboard functionality
    document.querySelectorAll('pre code').forEach((block) => {
      const button = document.createElement('button');
      button.className = 'copy-btn';
      button.textContent = 'Copy';
      button.onclick = () => {
        navigator.clipboard.writeText(block.textContent);
        button.textContent = 'Copied!';
        setTimeout(() => button.textContent = 'Copy', 2000);
      };
      block.parentElement.style.position = 'relative';
      block.parentElement.appendChild(button);
    });
  </script>
</body>
</html>`;
}
