import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Crown, Zap, Building2, AlertCircle, CheckCircle } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface SubscriptionButtonProps {
  onManageSubscription: () => void;
}

const SubscriptionButton: React.FC<SubscriptionButtonProps> = ({ onManageSubscription }) => {
  const { subscription, subscriptionStatus, loading } = useSubscription();

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <CreditCard className="w-4 h-4 mr-2" />
        Loading...
      </Button>
    );
  }

  if (!subscription || !subscriptionStatus) {
    return (
      <Button variant="outline" size="sm" onClick={onManageSubscription}>
        <CreditCard className="w-4 h-4 mr-2" />
        Subscribe
      </Button>
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

  const isTrial = subscription.status === 'TRIAL';
  const endDate = isTrial ? subscription.trialEndDate : subscription.currentPeriodEnd;
  const daysRemaining = endDate ? Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="flex items-center space-x-2">
      {getPlanIcon(subscription.plan.name)}
      <div 
        className="flex flex-col items-end cursor-pointer hover:opacity-80 transition-opacity"
        onClick={onManageSubscription}
      >
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">{subscription.plan.name}</span>
          <Badge variant={getStatusColor(subscription.status, subscriptionStatus.isActive)} className="text-xs">
            {getStatusText(subscription.status, subscriptionStatus.isActive)}
          </Badge>
        </div>
        {isTrial && daysRemaining > 0 && (
          <span className="text-xs text-amber-600">
            {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
          </span>
        )}
      </div>
    </div>
  );
};

export default SubscriptionButton;
