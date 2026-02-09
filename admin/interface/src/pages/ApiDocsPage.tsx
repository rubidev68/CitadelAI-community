import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getChatbot } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AlertCircle, Code, BookOpen, Key, MessageSquare, Activity, Info, ChevronRight, Play, Loader2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface ChatbotInfo {
  id: string;
  name: string;
  status: string;
}

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
}

const ApiDocsPage = () => {
  const { chatbotId } = useParams<{ chatbotId: string }>();
  const { token } = useAuth();
  const [chatbot, setChatbot] = useState<ChatbotInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('getting-started');

  const sections: Section[] = [
    { id: 'getting-started', title: 'Getting Started', icon: <Info className="h-4 w-4" /> },
    { id: 'authentication', title: 'Authentication', icon: <Key className="h-4 w-4" /> },
    { id: 'endpoints', title: 'Endpoints', icon: <Code className="h-4 w-4" /> },
    { id: 'playground', title: 'Playground', icon: <Play className="h-4 w-4" /> },
    { id: 'code-examples', title: 'Code Examples', icon: <Code className="h-4 w-4" /> },
    { id: 'error-handling', title: 'Error Handling', icon: <AlertCircle className="h-4 w-4" /> },
    { id: 'token-management', title: 'Token Management', icon: <Key className="h-4 w-4" /> },
    { id: 'session-management', title: 'Session Management', icon: <MessageSquare className="h-4 w-4" /> },
  ];

  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    const fetchChatbot = async () => {
      if (!chatbotId || !token) {
        setError('Chatbot ID or authentication token missing');
        setLoading(false);
        return;
      }

      try {
        const data = await getChatbot(chatbotId, token);
        setChatbot(data as ChatbotInfo);
      } catch (err) {
        setError('Failed to load chatbot information');
        console.error('Error fetching chatbot:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChatbot();
  }, [chatbotId, token]);

  // Handle scroll to update active section
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 150; // Offset for header

      for (const section of sections) {
        const element = sectionRefs.current[section.id];
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections]);

  const scrollToSection = (sectionId: string) => {
    const element = sectionRefs.current[sectionId];
    if (element) {
      const offset = 80; // Offset for sticky header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 text-lg text-muted-foreground">Loading API documentation...</div>
        </div>
      </div>
    );
  }

  if (error || !chatbot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              404
            </CardTitle>
            <CardDescription>{error || 'Chatbot not found'}</CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/" className="text-primary hover:underline">
              Return to Home
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get base URL from current location
  // API is hosted on api.citadelai.app, so we need to construct the correct URL
  const protocol = window.location.protocol;
  const host = window.location.host;
  // Replace admin.citadelai.app with api.citadelai.app for API calls
  const apiHost = host.replace('admin.', 'api.');
  const apiBaseUrl = `${protocol}//${apiHost}/api/chat/${chatbotId}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="sticky top-0 h-screen w-64 border-r border-border bg-card/50 backdrop-blur-sm">
          <ScrollArea className="h-full">
            <div className="p-4">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">Navigation</h2>
                </div>
                <p className="text-xs text-muted-foreground">{chatbot.name}</p>
              </div>
              <nav className="space-y-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors',
                      'hover:bg-primary/10 hover:text-foreground',
                      activeSection === section.id
                        ? 'bg-primary/20 text-primary font-medium'
                        : 'text-muted-foreground'
                    )}
                  >
                    <span className={cn(activeSection === section.id ? 'text-primary' : 'text-muted-foreground')}>
                      {section.icon}
                    </span>
                    <span className="flex-1 text-left">{section.title}</span>
                    {activeSection === section.id && (
                      <ChevronRight className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </ScrollArea>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <div className="container mx-auto max-w-5xl px-8 py-8">
            {/* Header */}
            <Card className="mb-8 border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-3xl font-bold text-foreground">{chatbot.name} API Documentation</CardTitle>
                </div>
                <CardDescription className="text-base">Complete guide to accessing your chatbot via REST API</CardDescription>
              </CardHeader>
            </Card>

            <div className="space-y-6">
              {/* Getting Started */}
              <div ref={(el) => (sectionRefs.current['getting-started'] = el)}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Info className="h-5 w-5 text-primary" />
                      Getting Started
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      This API allows you to interact with your chatbot programmatically using REST endpoints. All requests require authentication using an API token.
                    </p>
                    <Alert className="border-primary/20 bg-primary/5">
                      <AlertCircle className="h-4 w-4 text-primary" />
                      <AlertDescription>
                        <strong className="text-foreground">Base URL:</strong>{' '}
                        <code className="rounded bg-muted px-2 py-1 text-sm font-mono text-foreground">{apiBaseUrl}</code>
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </div>

              {/* Authentication */}
              <div ref={(el) => (sectionRefs.current['authentication'] = el)}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5 text-primary" />
                      Authentication
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      All API requests require authentication using a Bearer token in the Authorization header:
                    </p>
                    <div className="rounded-lg bg-muted p-4">
                      <code className="text-sm font-mono text-foreground">Authorization: Bearer cat_your_token_here</code>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Endpoints */}
              <div ref={(el) => (sectionRefs.current['endpoints'] = el)}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Code className="h-5 w-5 text-primary" />
                      Endpoints
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Send Message */}
                    <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-6">
                      <div className="mb-3 flex items-center gap-2">
                        <Badge className="bg-green-600 text-white">POST</Badge>
                        <h3 className="text-xl font-semibold text-foreground">Send Message</h3>
                      </div>
                      <p className="mb-2 text-sm text-muted-foreground">
                        <strong>Endpoint:</strong>{' '}
                        <code className="rounded bg-muted px-2 py-1 text-xs font-mono">{apiBaseUrl}</code>
                      </p>
                      <p className="mb-4 text-muted-foreground">Send a message to the chatbot and receive a response.</p>
                      <div className="space-y-3">
                        <div>
                          <p className="mb-2 text-sm font-semibold text-foreground">Request Body:</p>
                          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs font-mono text-foreground">
                            <code>{`{
  "message": "Hello, chatbot!",
  "sessionId": "optional-session-id"
}`}</code>
                          </pre>
                        </div>
                        <div>
                          <p className="mb-2 text-sm font-semibold text-foreground">Response:</p>
                          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs font-mono text-foreground">
                            <code>{`{
  "response": "Hello! How can I help you?",
  "sessionId": "session-123",
  "sources": [...],
  "usage": {
    "token": "cat_abc1",
    "remaining": 950
  }
}`}</code>
                          </pre>
                        </div>
                      </div>
                    </div>

                    {/* Stream Message */}
                    <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-6">
                      <div className="mb-3 flex items-center gap-2">
                        <Badge className="bg-green-600 text-white">POST</Badge>
                        <h3 className="text-xl font-semibold text-foreground">Stream Message</h3>
                      </div>
                      <p className="mb-2 text-sm text-muted-foreground">
                        <strong>Endpoint:</strong>{' '}
                        <code className="rounded bg-muted px-2 py-1 text-xs font-mono">{apiBaseUrl}/stream</code>
                      </p>
                      <p className="mb-4 text-muted-foreground">
                        Send a message and receive a streaming response using Server-Sent Events (SSE).
                      </p>
                      <div className="space-y-3">
                        <div>
                          <p className="mb-2 text-sm font-semibold text-foreground">Request Body:</p>
                          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs font-mono text-foreground">
                            <code>{`{
  "message": "Tell me about your products",
  "sessionId": "optional-session-id"
}`}</code>
                          </pre>
                        </div>
                        <div>
                          <p className="mb-2 text-sm font-semibold text-foreground">Response:</p>
                          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs font-mono text-foreground">
                            <code>{`data: {"type":"metadata","chatSessionId":"session-123"}
data: {"type":"chunk","content":"We"}
data: {"type":"chunk","content":" offer"}
data: {"type":"complete","fullResponse":"We offer..."}
data: {"type":"usage","token":"cat_abc1","remaining":949}`}</code>
                          </pre>
                        </div>
                      </div>
                    </div>

                    {/* Health Check */}
                    <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-6">
                      <div className="mb-3 flex items-center gap-2">
                        <Badge className="bg-blue-600 text-white">GET</Badge>
                        <h3 className="text-xl font-semibold text-foreground">Health Check</h3>
                      </div>
                      <p className="mb-2 text-sm text-muted-foreground">
                        <strong>Endpoint:</strong>{' '}
                        <code className="rounded bg-muted px-2 py-1 text-xs font-mono">{apiBaseUrl}/health</code>
                      </p>
                      <p className="mb-4 text-muted-foreground">Check if the API is available and your token is valid.</p>
                      <div>
                        <p className="mb-2 text-sm font-semibold text-foreground">Response:</p>
                        <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs font-mono text-foreground">
                          <code>{`{
  "status": "healthy",
  "chatbotId": "${chatbotId}",
  "token": {
    "prefix": "cat_abc1",
    "type": "USAGE",
    "remaining": 950
  }
}`}</code>
                        </pre>
                      </div>
                    </div>

                    {/* Chatbot Info */}
                    <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-6">
                      <div className="mb-3 flex items-center gap-2">
                        <Badge className="bg-blue-600 text-white">GET</Badge>
                        <h3 className="text-xl font-semibold text-foreground">Chatbot Info</h3>
                      </div>
                      <p className="mb-2 text-sm text-muted-foreground">
                        <strong>Endpoint:</strong>{' '}
                        <code className="rounded bg-muted px-2 py-1 text-xs font-mono">{apiBaseUrl}/info</code>
                      </p>
                      <p className="mb-4 text-muted-foreground">
                        Get public information about the chatbot (no authentication required).
                      </p>
                      <div>
                        <p className="mb-2 text-sm font-semibold text-foreground">Response:</p>
                        <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs font-mono text-foreground">
                          <code>{`{
  "id": "${chatbotId}",
  "name": "${chatbot.name}",
  "status": "${chatbot.status}"
}`}</code>
                        </pre>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Playground */}
              <div ref={(el) => (sectionRefs.current['playground'] = el)}>
                <PlaygroundSection apiBaseUrl={apiBaseUrl} chatbotId={chatbotId || ''} />
              </div>

              {/* Code Examples */}
              <div ref={(el) => (sectionRefs.current['code-examples'] = el)}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Code className="h-5 w-5 text-primary" />
                      Code Examples
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h3 className="mb-3 text-lg font-semibold text-foreground">JavaScript (Fetch API)</h3>
                      <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs font-mono text-foreground">
                        <code>{`async function sendMessage(chatbotId, token, message, sessionId = null) {
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
}`}</code>
                      </pre>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="mb-3 text-lg font-semibold text-foreground">Python (Requests)</h3>
                      <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs font-mono text-foreground">
                        <code>{`import requests

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
    return response.json()`}</code>
                      </pre>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="mb-3 text-lg font-semibold text-foreground">cURL</h3>
                      <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs font-mono text-foreground">
                        <code>{`curl -X POST "${apiBaseUrl}" \\\\
  -H "Authorization: Bearer cat_your_token_here" \\\\
  -H "Content-Type: application/json" \\\\
  -d '{
    "message": "Hello, chatbot!",
    "sessionId": "session-123"
  }'`}</code>
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Error Handling */}
              <div ref={(el) => (sectionRefs.current['error-handling'] = el)}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-primary" />
                      Error Handling
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-muted">
                            <th className="border-b border-border px-4 py-3 text-left text-sm font-semibold text-foreground">Status Code</th>
                            <th className="border-b border-border px-4 py-3 text-left text-sm font-semibold text-foreground">Error</th>
                            <th className="border-b border-border px-4 py-3 text-left text-sm font-semibold text-foreground">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border-b border-border px-4 py-3 text-sm">401</td>
                            <td className="border-b border-border px-4 py-3 text-sm">Unauthorized</td>
                            <td className="border-b border-border px-4 py-3 text-sm text-muted-foreground">Invalid or missing API token</td>
                          </tr>
                          <tr>
                            <td className="border-b border-border px-4 py-3 text-sm">403</td>
                            <td className="border-b border-border px-4 py-3 text-sm">Forbidden</td>
                            <td className="border-b border-border px-4 py-3 text-sm text-muted-foreground">Token expired or usage limit exceeded</td>
                          </tr>
                          <tr>
                            <td className="border-b border-border px-4 py-3 text-sm">404</td>
                            <td className="border-b border-border px-4 py-3 text-sm">Not Found</td>
                            <td className="border-b border-border px-4 py-3 text-sm text-muted-foreground">Chatbot not found</td>
                          </tr>
                          <tr>
                            <td className="border-b border-border px-4 py-3 text-sm">429</td>
                            <td className="border-b border-border px-4 py-3 text-sm">Too Many Requests</td>
                            <td className="border-b border-border px-4 py-3 text-sm text-muted-foreground">Rate limit exceeded</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-sm">500</td>
                            <td className="px-4 py-3 text-sm">Internal Server Error</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">Server error - contact support</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Token Management */}
              <div ref={(el) => (sectionRefs.current['token-management'] = el)}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5 text-primary" />
                      Token Management
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 text-muted-foreground">
                      To generate and manage API tokens, use the API block in your chatbot builder. Tokens support three types:
                    </p>
                    <ul className="ml-6 list-disc space-y-2 text-muted-foreground">
                      <li>
                        <strong className="text-foreground">Duration:</strong> Tokens expire after a specific date
                      </li>
                      <li>
                        <strong className="text-foreground">Usage:</strong> Tokens expire after N requests
                      </li>
                      <li>
                        <strong className="text-foreground">Permanent:</strong> Tokens never expire (use with caution)
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Session Management */}
              <div ref={(el) => (sectionRefs.current['session-management'] = el)}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      Session Management
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                      For conversation continuity, use the <code className="rounded bg-muted px-2 py-1 text-sm font-mono text-foreground">sessionId</code> parameter. The API will return a session ID that you can use for follow-up messages to maintain context.
                    </p>
                    <Alert className="border-secondary/20 bg-secondary/5">
                      <AlertCircle className="h-4 w-4 text-secondary" />
                      <AlertDescription>
                        <strong className="text-foreground">Note:</strong>{' '}
                        <span className="text-muted-foreground">
                          Always store tokens securely. Never commit them to version control or expose them in client-side code.
                        </span>
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

// Playground Component
interface PlaygroundSectionProps {
  apiBaseUrl: string;
  chatbotId: string;
}

interface RequestDetails {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

const PlaygroundSection = ({ apiBaseUrl, chatbotId }: PlaygroundSectionProps) => {
  const [apiToken, setApiToken] = useState('');
  const [endpoint, setEndpoint] = useState<'send' | 'stream' | 'health' | 'info'>('send');
  const [message, setMessage] = useState('Hello! How can you help me?');
  const [sessionId, setSessionId] = useState('');
  const [response, setResponse] = useState<string>('');
  const [requestDetails, setRequestDetails] = useState<RequestDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSend = async () => {
    if (!apiToken.trim()) {
      setError('Please enter an API token');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResponse('');

    try {
      if (endpoint === 'info') {
        // No auth required
        const res = await fetch(`${apiBaseUrl}/info`);
        const data = await res.json();
        setResponse(JSON.stringify(data, null, 2));
        setIsLoading(false);
        return;
      }

      if (endpoint === 'health') {
        const res = await fetch(`${apiBaseUrl}/health`, {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
          },
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(errorData.message || errorData.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setResponse(JSON.stringify(data, null, 2));
        setIsLoading(false);
        return;
      }

      if (endpoint === 'stream') {
        // Handle SSE streaming using fetch with ReadableStream
        const requestBodyData: { message: string; sessionId?: string } = { message };
        if (sessionId.trim()) {
          requestBodyData.sessionId = sessionId.trim();
        }
        const bodyJson = JSON.stringify(requestBodyData, null, 2);
        const url = `${apiBaseUrl}/stream`;
        const headers = {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        };
        setRequestDetails({
          method: 'POST',
          url,
          headers,
          body: bodyJson,
        });

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: bodyJson,
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(errorData.message || errorData.error || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        let streamedContent = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.type === 'metadata') {
                    fullResponse += `[Metadata] Session ID: ${data.chatSessionId}\n\n`;
                  } else if (data.type === 'chunk') {
                    streamedContent += data.content;
                    setResponse(fullResponse + `[Streaming Response]\n${streamedContent}`);
                  } else if (data.type === 'complete') {
                    fullResponse += `[Complete Response]\n${data.fullResponse}\n\n`;
                    if (data.sources) {
                      fullResponse += `[Sources]\n${JSON.stringify(data.sources, null, 2)}\n\n`;
                    }
                    setResponse(fullResponse);
                  } else if (data.type === 'usage') {
                    fullResponse += `[Usage] Token: ${data.token}, Remaining: ${data.remaining}\n`;
                    setResponse(fullResponse);
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
          }
        }

        setIsLoading(false);
        return;
      }

      // Regular send message endpoint
      if (endpoint === 'send') {
        const requestBodyData: { message: string; sessionId?: string } = { message };
        if (sessionId.trim()) {
          requestBodyData.sessionId = sessionId.trim();
        }
        const bodyJson = JSON.stringify(requestBodyData, null, 2);
        const url = `${apiBaseUrl}`;
        const headers = {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        };
        setRequestDetails({
          method: 'POST',
          url,
          headers,
          body: bodyJson,
        });

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: bodyJson,
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(errorData.message || errorData.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        setResponse(JSON.stringify(data, null, 2));
        setIsLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsLoading(false);
    }
  };

  const copyResponse = () => {
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5 text-primary" />
          API Playground
        </CardTitle>
        <CardDescription>Test the API endpoints directly from your browser</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* API Token */}
        <div className="space-y-2">
          <Label htmlFor="api-token">API Token *</Label>
          <Input
            id="api-token"
            type="password"
            placeholder="cat_your_token_here"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Enter your API token. Get one from the API block in your chatbot builder.
          </p>
        </div>

        {/* Endpoint Selector */}
        <div className="space-y-2">
          <Label htmlFor="endpoint">Endpoint</Label>
          <Select value={endpoint} onValueChange={(value: 'send' | 'stream' | 'health' | 'info') => setEndpoint(value)}>
            <SelectTrigger id="endpoint">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="send">Send Message (POST)</SelectItem>
              <SelectItem value="stream">Stream Message (POST - SSE)</SelectItem>
              <SelectItem value="health">Health Check (GET)</SelectItem>
              <SelectItem value="info">Chatbot Info (GET - No Auth)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Message Input (for send/stream endpoints) */}
        {(endpoint === 'send' || endpoint === 'stream') && (
          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              placeholder="Enter your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>
        )}

        {/* Session ID Input (for send/stream endpoints) */}
        {(endpoint === 'send' || endpoint === 'stream') && (
          <div className="space-y-2">
            <Label htmlFor="session-id">Session ID (Optional)</Label>
            <Input
              id="session-id"
              placeholder="Leave empty to create a new session"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Use a session ID to maintain conversation context across multiple messages.
            </p>
          </div>
        )}

        {/* Send Button */}
        <Button onClick={handleSend} disabled={isLoading || !apiToken.trim() || (endpoint !== 'info' && !message.trim())}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Send Request
            </>
          )}
        </Button>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Request Details Display */}
        {requestDetails && (
          <div className="space-y-2">
            <Label>Request Details</Label>
            <div className="rounded-lg border border-border bg-muted p-4">
              <div className="space-y-3">
                <div>
                  <span className="text-xs font-semibold text-foreground">Method:</span>
                  <span className="ml-2 rounded bg-primary/10 px-2 py-1 text-xs font-mono text-primary">
                    {requestDetails.method}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-foreground">URL:</span>
                  <pre className="mt-1 overflow-x-auto text-xs font-mono text-foreground">
                    {requestDetails.url}
                  </pre>
                </div>
                <div>
                  <span className="text-xs font-semibold text-foreground">Headers:</span>
                  <pre className="mt-1 overflow-x-auto rounded bg-background p-2 text-xs font-mono text-foreground">
                    {JSON.stringify(requestDetails.headers, null, 2)}
                  </pre>
                </div>
                {requestDetails.body && (
                  <div>
                    <span className="text-xs font-semibold text-foreground">Body:</span>
                    <pre className="mt-1 overflow-x-auto rounded bg-background p-2 text-xs font-mono text-foreground whitespace-pre-wrap">
                      {requestDetails.body}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Response Display */}
        {response && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Response</Label>
              <Button variant="outline" size="sm" onClick={copyResponse}>
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <pre className="overflow-x-auto text-xs font-mono text-foreground whitespace-pre-wrap">
                {response}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ApiDocsPage;
