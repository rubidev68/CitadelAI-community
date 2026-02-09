import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildApiUrl } from '@/config/api';

const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const oauthSuccess = searchParams.get('oauth_success');
      const oauthError = searchParams.get('oauth_error');
      
      // Check for success/error params first (from backend redirect)
      if (oauthSuccess) {
        setStatus('success');
        setMessage('Calendar connected successfully!');
        
        // Try to communicate with parent window if opened in popup
        try {
          if (window.opener) {
            // Get blockId from state if available
            const stateParam = searchParams.get('state');
            let blockId = '';
            if (stateParam) {
              try {
                const stateData = JSON.parse(atob(stateParam));
                blockId = stateData.blockId || '';
              } catch (e) {
                // Ignore parsing errors
              }
            }
            
            window.opener.postMessage({
              type: 'oauth_success',
              blockId: blockId,
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
        
        setTimeout(() => {
          navigate('/');
        }, 2000);
        return;
      }
      
      if (oauthError) {
        setStatus('error');
        setMessage(decodeURIComponent(oauthError));
        return;
      }
      
      // If we have code and state, the backend callback endpoint will handle it
      // and redirect back here with oauth_success or oauth_error
      if (code && state) {
        // The backend route /api/user/oauth/callback will handle this
        // and redirect back to /oauth/callback with success/error
        setStatus('loading');
        setMessage('Processing authentication...');
        return;
      }
      
      if (error) {
        setStatus('error');
        setMessage(error);
        return;
      }
      
      // No parameters - invalid request
      setStatus('error');
      setMessage('Invalid authentication request');
    };
    
    handleCallback();
  }, [searchParams, navigate]);
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/20">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            {status === 'loading' && (
              <>
                <div className="flex justify-center">
                  <Loader2 className="h-16 w-16 animate-spin text-primary" />
                </div>
                <h2 className="text-2xl font-semibold">Connecting Calendar...</h2>
                <p className="text-muted-foreground">
                  Please wait while we connect your calendar account
                </p>
              </>
            )}
            
            {status === 'success' && (
              <>
                <div className="flex justify-center">
                  <CheckCircle2 className="h-16 w-16 text-green-500" />
                </div>
                <h2 className="text-2xl font-semibold">Calendar Connected!</h2>
                <p className="text-muted-foreground">{message}</p>
                <p className="text-sm text-muted-foreground">Redirecting...</p>
              </>
            )}
            
            {status === 'error' && (
              <>
                <div className="flex justify-center">
                  <AlertCircle className="h-16 w-16 text-destructive" />
                </div>
                <h2 className="text-2xl font-semibold">Connection Failed</h2>
                <Alert variant="destructive">
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
                <Button onClick={() => navigate('/')} className="mt-4">
                  Go Back
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OAuthCallback;
