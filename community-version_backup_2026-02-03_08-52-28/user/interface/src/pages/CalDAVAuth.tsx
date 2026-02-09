import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { buildApiUrl, getAuthHeaders } from '@/config/api';

const CalDAVAuth: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const state = searchParams.get('state');
  const serverUrl = searchParams.get('serverUrl') || '';
  const slackUserId = searchParams.get('slackUserId') || '';
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  useEffect(() => {
    if (!state) {
      setError('Invalid authentication request. Missing state parameter.');
    }
  }, [state]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (!state) {
        throw new Error('Invalid authentication request');
      }
      
      // Parse state to get chatbotId, blockId, and slackUserId
      let stateData;
      try {
        stateData = JSON.parse(atob(state));
      } catch (parseError) {
        console.error('Failed to parse state:', parseError);
        throw new Error('Invalid authentication state parameter. Please try again.');
      }
      
      const { chatbotId, blockId, slackUserId: stateSlackUserId } = stateData;
      
      if (!chatbotId) {
        throw new Error('Missing chatbot ID in authentication request');
      }
      
      // Use slackUserId from URL params or state
      const finalSlackUserId = slackUserId || stateSlackUserId;
      
      // Use buildApiUrl to ensure correct API domain (api.citadelai.app)
      const apiUrl = buildApiUrl('/api/user/caldav/auth');
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: getAuthHeaders(), // Optional - may be empty for Slack users
        body: JSON.stringify({
          chatbotId,
          blockId: blockId || null,
          serverUrl,
          username,
          password,
          slackUserId: finalSlackUserId || undefined, // Include Slack user ID if available
        }),
      });
      
      // Read response once
      const responseText = await response.text();
      
      if (!response.ok) {
        // Try to parse JSON error response
        let errorMessage = 'Authentication failed';
        try {
          const contentType = response.headers.get('content-type');
          
          if (contentType && contentType.includes('application/json')) {
            try {
              const data = JSON.parse(responseText);
              errorMessage = data.error || data.details || errorMessage;
            } catch (jsonError) {
              // If JSON parsing fails, use the text as-is
              errorMessage = responseText || errorMessage;
            }
          } else {
            // If not JSON, use the text response
            errorMessage = responseText || errorMessage;
          }
        } catch (parseError) {
          // If parsing fails, use status text
          errorMessage = response.statusText || `Server returned ${response.status}`;
        }
        throw new Error(errorMessage);
      }
      
      setSuccess(true);
      toast({
        title: 'Success!',
        description: 'CalDAV calendar connected successfully',
      });
      
      // Try to communicate with parent window if opened in popup
      try {
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth_success',
            blockId: blockId || '',
          }, window.location.origin);
          
          // Close popup after a short delay
          setTimeout(() => {
            window.close();
          }, 1500);
          return;
        }
      } catch (e) {
        console.error('Error communicating with parent window:', e);
      }
      
      // Redirect back to chat after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to authenticate';
      setError(errorMessage);
      toast({
        title: 'Authentication Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/20">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </div>
              <h2 className="text-2xl font-semibold">Calendar Connected!</h2>
              <p className="text-muted-foreground">
                Your CalDAV calendar has been connected successfully. Redirecting...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/20">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center space-x-2 mb-2">
            <Calendar className="h-6 w-6" />
            <CardTitle>Connect CalDAV Calendar</CardTitle>
          </div>
          <CardDescription>
            Enter your CalDAV server credentials to connect your calendar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="server-url">Server URL</Label>
              <Input
                id="server-url"
                value={serverUrl}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Your CalDAV server URL
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="your-username"
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="your-password"
                disabled={loading}
              />
            </div>
            
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect Calendar'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CalDAVAuth;
