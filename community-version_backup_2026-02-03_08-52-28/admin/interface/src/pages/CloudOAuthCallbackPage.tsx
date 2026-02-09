import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const CloudOAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const chatbotId = searchParams.get('chatbotId');
  const blockId = searchParams.get('blockId');

  useEffect(() => {
    // Send message to parent window (opener) if this is a popup
    if (window.opener) {
      if (success === 'true') {
        window.opener.postMessage(
          {
            type: 'cloud_oauth_success',
            chatbotId,
            blockId,
          },
          window.location.origin
        );
      } else if (error) {
        window.opener.postMessage(
          {
            type: 'cloud_oauth_error',
            error: decodeURIComponent(error),
          },
          window.location.origin
        );
      }
      
      // Close popup after a short delay
      setTimeout(() => {
        window.close();
      }, 1000);
    } else {
      // Not in a popup - redirect to chatbot page
      if (success === 'true' && chatbotId) {
        window.location.href = `/chatbot/${chatbotId}`;
      } else {
        window.location.href = '/';
      }
    }
  }, [success, error, chatbotId, blockId]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {success === 'true' ? (
            <>
              <div className="flex justify-center mb-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <CardTitle>Connection Successful!</CardTitle>
              <CardDescription>
                Your Nextcloud account has been connected successfully.
              </CardDescription>
            </>
          ) : error ? (
            <>
              <div className="flex justify-center mb-4">
                <XCircle className="h-16 w-16 text-red-500" />
              </div>
              <CardTitle>Connection Failed</CardTitle>
              <CardDescription>
                {decodeURIComponent(error)}
              </CardDescription>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <Loader2 className="h-16 w-16 text-primary animate-spin" />
              </div>
              <CardTitle>Processing...</CardTitle>
              <CardDescription>
                Please wait while we complete the connection.
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="text-center">
          {window.opener ? (
            <p className="text-sm text-muted-foreground">
              This window will close automatically.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Redirecting...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CloudOAuthCallbackPage;
