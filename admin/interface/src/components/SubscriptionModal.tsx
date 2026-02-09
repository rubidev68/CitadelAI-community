import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Check, X, Crown, Zap, Building2, Calendar, Users, Bot, AlertCircle } from 'lucide-react';
import { useSubscription, SubscriptionPlan } from '@/contexts/SubscriptionContext';
import { useToast } from '@/hooks/use-toast';
import EnterpriseContactForm from './EnterpriseContactForm';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReopen?: () => void; // Callback to reopen this modal when coming back from enterprise contact
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose, onReopen }) => {
  const { subscription, subscriptionStatus, plans, loading, startTrial, updateSubscription, cancelSubscription, createCheckoutSession } = useSubscription();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showEnterpriseForm, setShowEnterpriseForm] = useState(false);
  const [modalHistory, setModalHistory] = useState<string[]>([]);

  const handleStartTrial = async (planId: string) => {
    try {
      setActionLoading(true);
      await startTrial(planId);
      toast({
        title: "Trial Started",
        description: "Your 14-day trial has been activated successfully!",
      });
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to start trial";
      
      // Check if it's an enterprise restriction error
      if (errorMessage.includes('Enterprise plan requires approval')) {
        setModalHistory(prev => [...prev, 'subscription']);
        onClose(); // Close subscription modal
        setShowEnterpriseForm(true);
        return;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateSubscription = async (planId: string) => {
    try {
      setActionLoading(true);
      // This will redirect to Stripe Checkout if needed
      await updateSubscription(planId);
      // If we get here, it means the subscription was updated directly (no redirect)
      toast({
        title: "Subscription Updated",
        description: "Your subscription has been updated successfully!",
      });
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update subscription";
      
      // Check if it's an enterprise restriction error
      if (errorMessage.includes('Enterprise plan requires approval')) {
        setModalHistory(prev => [...prev, 'subscription']);
        onClose(); // Close subscription modal
        setShowEnterpriseForm(true);
        return;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setActionLoading(true);
      await cancelSubscription(true);
      toast({
        title: "Subscription Canceled",
        description: "Your subscription will be canceled at the end of the current period.",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel subscription",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getPlanIcon = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'starter':
        return <Zap className="h-6 w-6 text-blue-500" />;
      case 'pro':
      case 'professional':
        return <Crown className="h-6 w-6 text-purple-500" />;
      case 'enterprise':
        return <Building2 className="h-6 w-6 text-orange-500" />;
      default:
        return <Bot className="h-6 w-6 text-gray-500" />;
    }
  };

  const formatPrice = (price: number, currency: string, interval: string) => {
    return `$${price.toFixed(2)}/${interval}`;
  };

  const getFeatureIcon = (feature: boolean) => {
    return feature ? (
      <Check className="h-4 w-4 text-green-500" />
    ) : (
      <X className="h-4 w-4 text-gray-400" />
    );
  };

  // Get plan features - use database features directly, format them nicely
  const getPlanFeatures = (planName: string, planFeatures: Record<string, boolean> | null | undefined): string[] => {
    const planLower = planName.toLowerCase();
    
    // For standard plans, return formatted features
    if (planLower === 'starter') {
      return [
        '1 AI Chatbot',
        '1,000 messages/month',
        'Up to 500 pages indexed',
        'Email support',
        'Web integration',
        'EU data residency'
      ];
    } else if (planLower === 'professional' || planLower === 'pro') {
      return [
        '5 AI Chatbots',
        '10,000 messages/month',
        'Up to 5,000 pages indexed',
        'Priority support',
        'Access to pro AI models',
        'Teams/Slack integration',
        'API access',
        'EU data residency'
      ];
    } else if (planLower === 'enterprise') {
      return [
        'Unlimited chatbots',
        'Unlimited messages',
        'Unlimited pages indexed',
        'Dedicated support',
        'Custom integrations',
        'EU data residency',
        'SLA guarantee',
        'Dedicated instance',
        'White-label options'
      ];
    }
    
    // For custom plans, format database features
    if (!planFeatures) return [];
    return Object.entries(planFeatures).map(([key, value]) => {
      if (value) {
        return key.replace(/([A-Z])/g, ' $1').toLowerCase();
      }
      return null;
    }).filter(Boolean) as string[];
  };

  const renderCurrentSubscription = () => {
    if (!subscription || !subscriptionStatus) return null;

    const isTrial = subscription.status === 'TRIAL';
    const isActive = subscriptionStatus.isActive;
    // Use nextPaymentDate for billing date, fallback to currentPeriodEnd if not available
    const endDate = isTrial ? subscription.trialEndDate : (subscription.nextPaymentDate || subscription.currentPeriodEnd);

    return (
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getPlanIcon(subscription.plan.name)}
              <div>
                <CardTitle className="text-lg">{subscription.plan.name} Plan</CardTitle>
                <CardDescription>
                  {isTrial ? '14-day trial' : 'Active subscription'}
                </CardDescription>
              </div>
            </div>
            <Badge variant={isActive ? 'default' : 'destructive'}>
              {isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status:</span>
                <span className="text-sm font-medium">{subscription.status}</span>
              </div>
              {endDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {isTrial ? 'Trial ends:' : 'Next billing:'}
                  </span>
                  <span className="text-sm font-medium">
                    {new Date(endDate).toLocaleDateString()}
                  </span>
                </div>
              )}
              {subscription.cancelAtPeriodEnd && (
                <div className="flex items-center space-x-2 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Will cancel at period end</span>
                </div>
              )}
            </div>

            {/* Plan Details */}
            <div className="space-y-3">
              {/* Only show Max Chatbots for Enterprise (unlimited) or custom plans */}
              {(subscription.plan.name.toLowerCase() === 'enterprise' || 
                (subscription.plan.maxChatbots && subscription.plan.name.toLowerCase() !== 'starter' && subscription.plan.name.toLowerCase() !== 'professional' && subscription.plan.name.toLowerCase() !== 'pro')) && (
                <div className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Max Chatbots:</span>
                    <span className="font-medium">
                      {subscription.plan.maxChatbots ? subscription.plan.maxChatbots : 'Unlimited'}
                    </span>
                  </div>
                </div>
              )}

              {/* Features Section - Use same logic as plan cards */}
              <div>
                <h4 className="text-sm font-medium mb-2">Plan Features:</h4>
                <div className="space-y-2">
                  {getPlanFeatures(subscription.plan.name, subscription.plan.features).map((feature, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Plan Description */}
              {subscription.plan.name.startsWith('CUSTOM Plan') && subscription.plan.description && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Plan Description:</h4>
                  <p className="text-sm text-muted-foreground">{subscription.plan.description}</p>
                </div>
              )}
            </div>
          </div>
          {isTrial && (
            <Button
              onClick={async () => {
                try {
                  setActionLoading(true);
                  // Subscribe to current plan - billing starts after trial ends
                  await createCheckoutSession(subscription.plan.id);
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : "Failed to subscribe";
                  toast({
                    title: "Error",
                    description: errorMessage,
                    variant: "destructive",
                  });
                  setActionLoading(false);
                }
              }}
              disabled={actionLoading}
              className="mt-4 w-full"
            >
              {actionLoading ? 'Processing...' : 'Subscribe Now (Billing starts after trial)'}
            </Button>
          )}
          {isActive && !subscription.cancelAtPeriodEnd && !isTrial && (
            <Button
              variant="outline"
              onClick={handleCancelSubscription}
              disabled={actionLoading}
              className="mt-4 w-full"
            >
              Cancel Subscription
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderPlanCard = (plan: SubscriptionPlan) => {
    const isCurrentPlan = subscription?.planId === plan.id;
    const isSelected = selectedPlan === plan.id;

    // Update pricing based on business requirements (matching business-website)
    const getDisplayPrice = (planName: string) => {
      switch (planName.toLowerCase()) {
        case 'starter':
          return '$29/month';
        case 'professional':
        case 'pro':
          return '$49/month';
        case 'enterprise':
          return 'Contact us';
        default:
          return formatPrice(plan.price, plan.currency, plan.interval);
      }
    };

    return (
      <Card
        key={plan.id}
        className={`transition-all duration-200 ${
          isSelected ? 'ring-2 ring-primary' : ''
        } ${isCurrentPlan ? 'opacity-75' : ''} ${
          !subscription ? 'hover:shadow-lg' : ''
        }`}
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {getPlanIcon(plan.name)}
              <div>
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {getDisplayPrice(plan.name)}
              </div>
              {isCurrentPlan && (
                <Badge variant="secondary" className="mt-1">
                  Current Plan
                </Badge>
              )}
            </div>
          </div>

          {/* Plan limits - only show maxChatbots if specified */}
          {plan.maxChatbots && (
            <div className="mt-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Max Chatbots:</span>
                <span className="font-medium">{plan.maxChatbots}</span>
              </div>
            </div>
          )}

          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Features:</h4>
            <div className="space-y-2">
              {getPlanFeatures(plan.name, plan.features).map((feature, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <Button
              className="w-full"
              onClick={async () => {
                if (plan.name.toLowerCase() === 'enterprise') {
                  setShowEnterpriseForm(true);
                } else if (subscription) {
                  const isTrial = subscription.status === 'TRIAL';
                  if (isCurrentPlan && isTrial) {
                    // Subscribe to current plan during trial - billing starts after trial
                    await createCheckoutSession(plan.id);
                  } else if (!isCurrentPlan) {
                    // Switch plan - redirects to Stripe checkout
                    await handleUpdateSubscription(plan.id);
                  }
                } else {
                  // No subscription - start trial
                  await handleStartTrial(plan.id);
                }
              }}
              disabled={actionLoading || (subscription && subscription.status !== 'TRIAL' && isCurrentPlan)}
              variant={plan.name.toLowerCase() === 'enterprise' ? 'outline' : 'default'}
            >
              {subscription 
                ? (subscription.status === 'TRIAL' && isCurrentPlan 
                    ? 'Subscribe Now (Billing starts after trial)' 
                    : isCurrentPlan 
                      ? 'Current Plan' 
                      : 'Switch Plan') 
                : (plan.name.toLowerCase() === 'enterprise' ? 'Contact Sales' : 'Start 14-Day Trial')
              }
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Subscription Management</DialogTitle>
          <DialogDescription>
            Manage your subscription plan and billing preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {renderCurrentSubscription()}

          <div>
            <h3 className="text-lg font-semibold mb-4">
              {subscription ? 'Change Plan' : 'Choose a Plan'}
            </h3>
            <div className="space-y-4">
              {plans
                .filter(plan => {
                  // Only show Pro, Starter, and Enterprise plans
                  const allowedPlans = ['Pro', 'Starter', 'Enterprise'];
                  return allowedPlans.includes(plan.name);
                })
                .map(renderPlanCard)}
            </div>
          </div>
        </div>
      </DialogContent>
      
      <EnterpriseContactForm 
        isOpen={showEnterpriseForm} 
        onClose={() => {
          setShowEnterpriseForm(false);
          // If we have history, reopen the previous modal
          if (modalHistory.length > 0) {
            const previousModal = modalHistory[modalHistory.length - 1];
            if (previousModal === 'subscription' && onReopen) {
              onReopen();
            }
            setModalHistory(prev => prev.slice(0, -1));
          }
        }}
        onReopen={() => {
          // This will be called when coming back from enterprise contact form
          setShowEnterpriseForm(true);
        }}
      />
    </Dialog>
  );
};

export default SubscriptionModal;
