import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Crown, Zap, Building2, Calendar, AlertCircle, CheckCircle, Check, X } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface SubscriptionStatusProps {
  onManageSubscription: () => void;
}

const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({ onManageSubscription }) => {
  const { subscription, subscriptionStatus, loading } = useSubscription();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>Loading subscription status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subscription || !subscriptionStatus) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>No active subscription</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">You don't have an active subscription</span>
            </div>
            <Button onClick={onManageSubscription} className="w-full">
              Choose a Plan
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getPlanIcon = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'starter':
        return <Zap className="h-5 w-5 text-blue-500" />;
      case 'pro':
        return <Crown className="h-5 w-5 text-purple-500" />;
      case 'enterprise':
        return <Building2 className="h-5 w-5 text-orange-500" />;
      default:
        return <Crown className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string, isActive: boolean) => {
    if (!isActive) return 'destructive';
    if (status === 'TRIAL') return 'secondary';
    return 'default';
  };

  const getStatusText = (status: string, isActive: boolean) => {
    if (!isActive) return 'Inactive';
    if (status === 'TRIAL') return 'Trial';
    return 'Active';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const isTrial = subscription.status === 'TRIAL';
  // Use nextPaymentDate for billing date, fallback to currentPeriodEnd if not available
  const endDate = isTrial ? subscription.trialEndDate : (subscription.nextPaymentDate || subscription.currentPeriodEnd);
  const daysRemaining = endDate ? Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getPlanIcon(subscription.plan.name)}
            <div>
              <CardTitle className="text-lg">{subscription.plan.name} Plan</CardTitle>
              <CardDescription>
                {isTrial ? '14-day trial' : 'Active subscription'}
              </CardDescription>
            </div>
          </div>
          <Badge variant={getStatusColor(subscription.status, subscriptionStatus.isActive)}>
            {getStatusText(subscription.status, subscriptionStatus.isActive)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Max Chatbots:</span>
              <div className="font-medium">
                {subscription.plan.maxChatbots ? subscription.plan.maxChatbots : 'Unlimited'}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Max Users:</span>
              <div className="font-medium">
                {subscription.plan.maxUsers ? subscription.plan.maxUsers : 'Unlimited'}
              </div>
            </div>
          </div>

          {/* Features Section - Show for all plans, especially important for custom plans */}
          {subscription.plan.features && Object.keys(subscription.plan.features).length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Plan Features:</h4>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(subscription.plan.features).map(([key, value]) => (
                  <div key={key} className="flex items-center space-x-2">
                    {value ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="text-sm capitalize">
                      {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Plan Description */}
          {subscription.plan.name.startsWith('CUSTOM Plan') && subscription.plan.description && (
            <div>
              <h4 className="text-sm font-medium mb-2">Plan Description:</h4>
              <p className="text-sm text-muted-foreground">{subscription.plan.description}</p>
            </div>
          )}

          {endDate && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {isTrial ? 'Trial ends:' : 'Next billing:'}
                </span>
                <span className="font-medium">{formatDate(endDate)}</span>
              </div>
              {isTrial && daysRemaining > 0 && (
                <div className="flex items-center space-x-2 text-amber-600">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">
                    {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                  </span>
                </div>
              )}
            </div>
          )}

          {subscription.cancelAtPeriodEnd && (
            <div className="flex items-center space-x-2 text-amber-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Will cancel at period end</span>
            </div>
          )}

          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={onManageSubscription}
              className="flex-1"
            >
              Manage Subscription
            </Button>
            {subscriptionStatus.isActive && !subscription.cancelAtPeriodEnd && (
              <Button
                variant="outline"
                onClick={() => {
                  // This would open a cancel confirmation dialog
                  // For now, just call the manage subscription
                  onManageSubscription();
                }}
                className="text-destructive hover:text-destructive"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SubscriptionStatus;
