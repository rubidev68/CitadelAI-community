import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, Download } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { adminApiClient, handleApiResponse } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

const SubscriptionSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { refreshSubscription, subscription, subscriptionStatus } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [subscriptionUpdated, setSubscriptionUpdated] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const sessionId = searchParams.get('session_id');

  // If not authenticated, redirect to login
  useEffect(() => {
    if (!user || !token) {
      navigate('/login', { replace: true });
    }
  }, [user, token, navigate]);

  useEffect(() => {
    let isMounted = true;
    
    // Only proceed if authenticated
    if (!user || !token) {
      return;
    }
    
    // Refresh subscription data after successful payment
    // Add a small delay to allow webhook to process
    const refresh = async () => {
      try {
        // Wait a bit for webhook to process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (!isMounted || !user || !token) return;
        
        // Try refreshing multiple times with delays
        let attempts = 0;
        const maxAttempts = 3; // Reduced from 5 to avoid too many calls
        
        while (attempts < maxAttempts && isMounted && user && token) {
          try {
            await refreshSubscription();
          } catch (error) {
            console.error('Error refreshing subscription (attempt ${attempts + 1}):', error);
            // Continue to next attempt
          }
          
          // Check if subscription was updated
          // Wait a bit for state to update
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          attempts++;
        }
        
        if (isMounted) {
          // Mark as updated (even if webhook is still processing, user can refresh manually)
          setSubscriptionUpdated(true);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error refreshing subscription:', error);
        if (isMounted) {
          // Still mark as updated so user can proceed
          setSubscriptionUpdated(true);
          setLoading(false);
        }
      }
    };

    refresh();

    // Fetch receipt URL if session ID is available and user is authenticated
    if (sessionId && isMounted && user && token) {
      const fetchReceipt = async () => {
        try {
          setLoadingReceipt(true);
          const response = await adminApiClient.get(`/subscription/receipt/${sessionId}`, token);
          const data = await handleApiResponse(response) as { receiptUrl?: string };
          if (data?.receiptUrl && isMounted) {
            setReceiptUrl(data.receiptUrl);
          }
        } catch (error) {
          console.error('Error fetching receipt:', error);
          // Don't show error to user, receipt might not be available yet
        } finally {
          if (isMounted) {
            setLoadingReceipt(false);
          }
        }
      };

      // Wait a bit for invoice to be created
      setTimeout(fetchReceipt, 3000);
    }
    
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]); // Re-run if auth state changes

  // Show loading or redirect if not authenticated
  if (!user || !token) {
    return null; // Will redirect via useEffect
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Processing your subscription...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          <CardDescription>
            {subscriptionUpdated && subscriptionStatus?.isActive
              ? 'Your subscription has been activated successfully.'
              : 'Payment received! Your subscription is being activated...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-muted-foreground">
            {sessionId && (
              <div className="mb-2 break-words">
                <span className="font-medium">Session ID:</span>
                <p className="mt-1 text-xs break-all font-mono">{sessionId}</p>
              </div>
            )}
            {subscriptionUpdated && subscriptionStatus?.isActive ? (
              <p>You can now access all features of your plan.</p>
            ) : (
              <p>If your subscription doesn't update automatically, please refresh the page.</p>
            )}
          </div>
          <div className="space-y-2">
            {receiptUrl && (
              <Button
                onClick={() => window.open(receiptUrl, '_blank')}
                variant="outline"
                className="w-full"
                disabled={loadingReceipt}
              >
                <Download className="h-4 w-4 mr-2" />
                {loadingReceipt ? 'Loading Receipt...' : 'Download Receipt'}
              </Button>
            )}
            <Button
              onClick={() => navigate('/')}
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionSuccessPage;
