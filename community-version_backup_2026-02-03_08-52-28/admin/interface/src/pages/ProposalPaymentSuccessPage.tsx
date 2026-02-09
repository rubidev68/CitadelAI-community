import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Mail, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const ProposalPaymentSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user, token } = useAuth();
  const proposalId = searchParams.get('proposal_id');
  const paymentLinkId = searchParams.get('payment_link_id');

  // If not authenticated, redirect to login
  useEffect(() => {
    if (!user || !token) {
      window.location.href = '/login';
    }
  }, [user, token]);

  // Show loading or redirect if not authenticated
  if (!user || !token) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          <CardDescription>
            Thank you for your payment. Your dedicated instance is being provisioned.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Loader2 className="h-5 w-5 text-primary animate-spin mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">Instance Provisioning in Progress</h3>
                <p className="text-sm text-muted-foreground">
                  Your dedicated instance is being set up. This process typically takes a few minutes to a few hours.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">You'll Receive an Email</h3>
                <p className="text-sm text-muted-foreground">
                  As soon as your instance is ready, we'll send you an email with your access credentials and connection details.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground space-y-2">
            {proposalId && (
              <div className="mb-2">
                <span className="font-medium">Proposal ID:</span>
                <p className="mt-1 text-xs break-all font-mono">{proposalId}</p>
              </div>
            )}
            {paymentLinkId && (
              <div>
                <span className="font-medium">Payment ID:</span>
                <p className="mt-1 text-xs break-all font-mono">{paymentLinkId}</p>
              </div>
            )}
          </div>

          <div className="pt-2">
            <a
              href="mailto:support@citadelai.com?subject=Instance Provisioning Inquiry"
              className="block"
            >
              <Button
                variant="outline"
                className="w-full"
              >
                Contact Support
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProposalPaymentSuccessPage;
