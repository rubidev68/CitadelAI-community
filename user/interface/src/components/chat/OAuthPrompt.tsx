import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, ExternalLink, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { buildApiUrl, getAuthHeaders } from '@/config/api';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface OAuthPromptProps {
  provider: 'google_calendar' | 'caldav';
  chatbotId: string;
  blockId: string;
  authUrl?: string;
  serverUrl?: string; // For CalDAV
  isSlackOrAPI?: boolean; // If true, show link instead of button
  onAuthenticated?: () => void;
  open?: boolean; // Control modal open state
  onOpenChange?: (open: boolean) => void; // Handle modal state changes
}

export const OAuthPrompt: React.FC<OAuthPromptProps> = ({
  provider,
  chatbotId,
  blockId,
  authUrl,
  serverUrl,
  isSlackOrAPI = false,
  onAuthenticated,
  open: controlledOpen,
  onOpenChange,
}) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const { toast } = useToast();
  
  // Use controlled open state if provided, otherwise use internal state
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;
  
  const providerName = provider === 'google_calendar' ? 'Google Calendar' : 'CalDAV';
  
  // Listen for OAuth success from callback page
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'oauth_success' && event.data?.blockId === blockId) {
        setSuccess(true);
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(false);
          onAuthenticated?.();
        }, 2000); // Close after 2 seconds
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [blockId, setIsOpen, onAuthenticated]);
  
  // Check for OAuth success in URL (for popup windows)
  useEffect(() => {
    const checkOAuthSuccess = () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('oauth_success') === 'true') {
        setSuccess(true);
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(false);
          onAuthenticated?.();
        }, 2000);
      }
    };
    
    checkOAuthSuccess();
  }, [setIsOpen, onAuthenticated]);
  
  const handleConnect = async () => {
    if (isSlackOrAPI) {
      // For Slack/API, just show the link
      return;
    }
    
    setLoading(true);
    try {
      if (provider === 'google_calendar') {
        // Get OAuth URL from backend
        const response = await fetch(
          buildApiUrl(`/api/user/oauth/start?provider=GOOGLE_CALENDAR&chatbotId=${chatbotId}&blockId=${blockId}`),
          {
            headers: getAuthHeaders(),
          }
        );
        
        if (!response.ok) {
          throw new Error('Failed to get OAuth URL');
        }
        
        const data = await response.json();
        // Open OAuth URL in popup window
        const popup = window.open(
          data.oauthUrl,
          'oauth',
          'width=600,height=700,scrollbars=yes,resizable=yes'
        );
        
        // Poll for popup closure or success
        const checkPopup = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkPopup);
            setLoading(false);
            // Check if auth was successful by polling the backend
            setTimeout(() => {
              checkAuthStatus();
            }, 1000);
          }
        }, 500);
      } else if (provider === 'caldav') {
        // For CalDAV, open form in popup
        const state = btoa(JSON.stringify({
          userId: 'current', // Will be resolved on backend
          chatbotId,
          blockId,
          provider: 'CALDAV',
          redirectUri: `${window.location.origin}/caldav/auth`,
        }));
        
        const caldavUrl = `/caldav/auth?state=${encodeURIComponent(state)}&serverUrl=${encodeURIComponent(serverUrl || '')}`;
        const popup = window.open(
          caldavUrl,
          'caldav_auth',
          'width=600,height=700,scrollbars=yes,resizable=yes'
        );
        
        // Poll for popup closure or success
        const checkPopup = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkPopup);
            setLoading(false);
            // Check if auth was successful
            setTimeout(() => {
              checkAuthStatus();
            }, 1000);
          }
        }, 500);
      }
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start authentication',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };
  
  const checkAuthStatus = async () => {
    try {
      const response = await fetch(
        buildApiUrl(`/api/user/oauth/connections?chatbotId=${chatbotId}`),
        {
          headers: getAuthHeaders(),
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const hasConnection = data.connections?.some(
          (conn: { blockId: string | null; isActive: boolean }) => conn.blockId === blockId && conn.isActive
        );
        
        if (hasConnection) {
          setSuccess(true);
          setTimeout(() => {
            setIsOpen(false);
            setSuccess(false);
            onAuthenticated?.();
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    }
  };
  
  // For Slack/API users, show a link they can click
  if (isSlackOrAPI) {
    // Build auth link based on provider
    let authLink = '';
    if (provider === 'google_calendar') {
      // For Google Calendar, use the authUrl from backend or construct it
      authLink = authUrl || `${window.location.origin}/oauth/callback?chatbotId=${chatbotId}&blockId=${blockId}`;
    } else if (provider === 'caldav') {
      // For CalDAV, construct the form URL with state
      const state = btoa(JSON.stringify({
        userId: 'current', // Will be resolved on backend
        chatbotId,
        blockId,
        provider: 'CALDAV',
        redirectUri: `${window.location.origin}/caldav/auth`,
      }));
      authLink = `${window.location.origin}/caldav/auth?state=${encodeURIComponent(state)}&serverUrl=${encodeURIComponent(serverUrl || '')}`;
    }
    
    return (
      <Alert className="my-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="space-y-2">
          <p>
            <strong>Calendar Authentication Required</strong>
          </p>
          <p>
            To use calendar features, please connect your {providerName} account.
          </p>
          {authLink && (
            <p>
              <a 
                href={authLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Click here to authenticate <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          )}
        </AlertDescription>
      </Alert>
    );
  }
  
  // For web users, show a modal
  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {success ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Connected Successfully!
                </>
              ) : (
                <>
                  <Calendar className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  Connect Your {providerName} Account
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {success ? (
                'Your calendar account has been connected. The response will continue shortly...'
              ) : (
                `To use calendar features, please connect your ${providerName} account. Each user connects their own calendar account.`
              )}
            </DialogDescription>
          </DialogHeader>
          
          {!success && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  A popup window will open for authentication. Please complete the login process.
                </AlertDescription>
              </Alert>
              
              <Button
                onClick={handleConnect}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Calendar className="mr-2 h-4 w-4" />
                    Connect {providerName}
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Fallback card for non-modal display (when open prop is not provided) */}
      {controlledOpen === undefined && (
        <Card className="my-4 border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <Calendar className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                  Connect Your {providerName} Account
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  To use calendar features, please connect your {providerName} account. 
                  Each user connects their own calendar account.
                </p>
                <Button
                  onClick={() => setIsOpen(true)}
                  disabled={loading}
                  className="mt-2"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Connect {providerName}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};
