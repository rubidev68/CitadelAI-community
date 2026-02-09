import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Crown, Check, X } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import SubscriptionModal from './SubscriptionModal';
import UsageDisplay from './UsageDisplay';

interface SubscriptionSectionProps {
  onReopen?: () => void;
}

const SubscriptionSection: React.FC<SubscriptionSectionProps> = ({ onReopen }) => {
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const { subscription, subscriptionStatus } = useSubscription();
  
  // Modal history state
  const [modalHistory, setModalHistory] = useState<string[]>([]);

  return (
    <>
      <div className="p-6 rounded-lg bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-200/20">
        <h3 className="text-lg font-semibold mb-4 flex items-center text-blue-600">
          <CreditCard className="w-5 h-5 text-blue-600 mr-2" />
          Subscription Management
        </h3>
        
        {subscription && subscriptionStatus ? (
          <div className="space-y-4">
            <UsageDisplay />
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Crown className="w-6 h-6 text-purple-500" />
                  <div>
                    <h4 className="font-semibold">{subscription.plan.name} Plan</h4>
                    <p className="text-sm text-muted-foreground">
                      {subscription.status === 'TRIAL' ? '14-day trial' : 'Active subscription'}
                    </p>
                  </div>
                </div>
                <Badge variant={subscription.status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {subscription.status}
                </Badge>
              </div>
              
              {/* Get plan features - same logic as SubscriptionModal */}
              {(() => {
                const getPlanFeatures = (planName: string, planFeatures: Record<string, boolean> | null | undefined): string[] => {
                  const planLower = planName.toLowerCase();
                  
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
                  
                  if (!planFeatures) return [];
                  return Object.entries(planFeatures).map(([key, value]) => {
                    if (value) {
                      return key.replace(/([A-Z])/g, ' $1').toLowerCase();
                    }
                    return null;
                  }).filter(Boolean) as string[];
                };

                return (
                  <div className="mb-4">
                    <h5 className="text-sm font-medium mb-2">Plan Features:</h5>
                    <div className="space-y-1">
                      {getPlanFeatures(subscription.plan.name, subscription.plan.features).map((feature, index) => (
                        <div key={index} className="flex items-center text-sm">
                          <Check className="w-4 h-4 text-green-500 mr-2" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {subscription.plan.name.startsWith('CUSTOM Plan') && subscription.plan.description && (
                <div className="mb-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">{subscription.plan.description}</p>
                </div>
              )}

              {subscription.status === 'TRIAL' && subscription.trialEndDate && (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center text-yellow-800 dark:text-yellow-200">
                    <Crown className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">
                      Trial ends on {new Date(subscription.trialEndDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )}

              <Button
                onClick={() => {
                  setModalHistory(prev => [...prev, 'settings']);
                  setIsSubscriptionModalOpen(true);
                }}
                className="w-full"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Manage Subscription
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <CreditCard className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h4 className="text-lg font-semibold mb-2">No Active Subscription</h4>
            <p className="text-muted-foreground mb-4">
              Choose a subscription plan to unlock all features and remove limitations.
            </p>
            <Button
              onClick={() => {
                setModalHistory(prev => [...prev, 'settings']);
                setIsSubscriptionModalOpen(true);
              }}
              className="w-full"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Choose a Plan
            </Button>
          </div>
        )}
      </div>

      <SubscriptionModal 
        isOpen={isSubscriptionModalOpen} 
        onClose={() => {
          setIsSubscriptionModalOpen(false);
          // If we have history, reopen the previous modal
          if (modalHistory.length > 0) {
            const previousModal = modalHistory[modalHistory.length - 1];
            if (previousModal === 'settings' && onReopen) {
              onReopen();
            }
            setModalHistory(prev => prev.slice(0, -1));
          }
        }}
        onReopen={() => {
          // This will be called when coming back from enterprise contact form
          setIsSubscriptionModalOpen(true);
        }}
      />
    </>
  );
};

export default SubscriptionSection;