import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { adminApiClient } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  interval: string;
  maxChatbots: number | null;
  maxUsers: number | null;
  features: Record<string, boolean>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  adminUserId: string;
  planId: string;
  status: 'TRIAL' | 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'UNPAID';
  trialStartDate: string | null;
  trialEndDate: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextPaymentDate: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
  plan: SubscriptionPlan;
  adminUser: {
    id: string;
    email: string;
    name: string | null;
    company: string | null;
  };
}

export interface SubscriptionStatus {
  hasSubscription: boolean;
  isActive: boolean;
  status: string;
  plan?: SubscriptionPlan;
  trialEndDate?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  // Usage statistics
  currentMonthMessages?: number;
  maxMessages?: number | null;
  totalIndexedPages?: number;
  maxPages?: number | null;
  currentChatbotCount?: number;
  maxChatbots?: number | null;
  canCustomizeAIModel?: boolean;
  canUseProBlocks?: boolean;
  canUseEnterpriseBlocks?: boolean;
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  subscriptionStatus: SubscriptionStatus | null;
  plans: SubscriptionPlan[];
  loading: boolean;
  error: string | null;
  fetchSubscription: () => Promise<void>;
  fetchPlans: () => Promise<void>;
  startTrial: (planId: string) => Promise<void>;
  updateSubscription: (planId: string) => Promise<void>;
  cancelSubscription: (cancelAtPeriodEnd?: boolean) => Promise<void>;
  refreshSubscription: () => Promise<void>;
  createCheckoutSession: (planId: string) => Promise<void>;
  getCustomerPortalUrl: () => Promise<string>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const { user, token } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = async () => {
    // Skip if billing is disabled
    if (!isFeatureEnabled('billing')) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      if (!token) return;

      const response = await adminApiClient.get('/subscription/me', token);
      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
      } else if (response.status === 404) {
        setSubscription(null);
      } else {
        // If API fails (e.g., tables don't exist), treat as no subscription
        console.warn('Subscription API not available, treating as no subscription');
        setSubscription(null);
      }
    } catch (err) {
      console.warn('Error fetching subscription, treating as no subscription:', err);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptionStatus = async () => {
    // Skip if billing is disabled
    if (!isFeatureEnabled('billing')) {
      return;
    }
    try {
      if (!token) return;

      const [statusResponse, usageResponse] = await Promise.all([
        adminApiClient.get('/subscription/status', token),
        adminApiClient.get('/subscription/usage', token).catch(() => null) // Don't fail if usage endpoint doesn't exist
      ]);

      let statusData: SubscriptionStatus = {
        hasSubscription: false,
        isActive: false,
        status: 'none'
      };

      if (statusResponse.ok) {
        statusData = await statusResponse.json();
        // Status endpoint now includes currentChatbotCount and maxChatbots
      }

      // Merge usage data if available (usage endpoint has more detailed stats)
      if (usageResponse && usageResponse.ok) {
        const usageData = await usageResponse.json();
        statusData = {
          ...statusData,
          currentMonthMessages: usageData.currentMonthMessages,
          maxMessages: usageData.maxMessages,
          totalIndexedPages: usageData.totalIndexedPages,
          maxPages: usageData.maxPages,
          // Prefer usage endpoint's currentChatbotCount, but fallback to status if not available
          currentChatbotCount: usageData.currentChatbotCount ?? statusData.currentChatbotCount,
          maxChatbots: usageData.maxChatbots ?? statusData.maxChatbots,
          canCustomizeAIModel: usageData.canCustomizeAIModel,
          canUseProBlocks: usageData.canUseProBlocks,
          canUseEnterpriseBlocks: usageData.canUseEnterpriseBlocks,
        };
      }
      // If usage endpoint fails, statusData already has currentChatbotCount from status endpoint

      setSubscriptionStatus(statusData);
    } catch (err) {
      console.warn('Error fetching subscription status, using defaults:', err);
      setSubscriptionStatus({
        hasSubscription: false,
        isActive: false,
        status: 'none'
      });
    }
  };

  const fetchPlans = async () => {
    // Skip if billing is disabled
    if (!isFeatureEnabled('billing')) {
      setPlans([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      if (!token) return;

      const response = await adminApiClient.get('/subscription/plans', token);
      if (response.ok) {
        const data = await response.json();
        // Only show Pro, Starter, and Enterprise plans
        const allowedPlans = ['Pro', 'Starter', 'Enterprise'];
        const filteredPlans = data.filter((plan: SubscriptionPlan) => 
          allowedPlans.includes(plan.name)
        );
        setPlans(filteredPlans);
      } else {
        // If API fails, use default plans
        console.warn('Plans API not available, using default plans');
        setPlans([
          {
            id: 'starter',
            name: 'Starter',
            description: 'Perfect for small businesses and startups',
            price: 29.00,
            currency: 'USD',
            interval: 'month',
            maxChatbots: 1,
            maxUsers: null,
            features: {
              messagesPerMonth: 1000,
              pagesIndexed: 500,
              emailSupport: true,
              webIntegration: true,
              euDataResidency: true
            },
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'pro',
            name: 'Pro',
            description: 'Ideal for growing teams and businesses',
            price: 49.00,
            currency: 'USD',
            interval: 'month',
            maxChatbots: 5,
            maxUsers: null,
            features: {
              messagesPerMonth: 10000,
              pagesIndexed: 5000,
              prioritySupport: true,
              proAiModels: true,
              teamsSlackIntegration: true,
              apiAccess: true,
              euDataResidency: true
            },
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'enterprise',
            name: 'Enterprise',
            description: 'For large organizations with advanced needs',
            price: 0,
            currency: 'USD',
            interval: 'month',
            maxChatbots: null,
            maxUsers: null,
            features: {
              unlimitedChatbots: true,
              unlimitedMessages: true,
              unlimitedPagesIndexed: true,
              dedicatedSupport: true,
              customIntegrations: true,
              euDataResidency: true,
              slaGuarantee: true,
              dedicatedInstance: true,
              whiteLabelOptions: true
            },
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]);
      }
    } catch (err) {
      console.warn('Error fetching plans, using defaults:', err);
      // Use the same default plans as above
      setPlans([
        {
          id: 'starter',
          name: 'Starter',
          description: 'Perfect for small businesses and startups',
          price: 29.00,
          currency: 'USD',
          interval: 'month',
          maxChatbots: 1,
          maxUsers: null,
          features: {
            messagesPerMonth: 1000,
            pagesIndexed: 500,
            emailSupport: true,
            webIntegration: true,
            euDataResidency: true
          },
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'pro',
          name: 'Pro',
          description: 'Ideal for growing teams and businesses',
          price: 49.00,
          currency: 'USD',
          interval: 'month',
          maxChatbots: 5,
          maxUsers: null,
          features: {
            messagesPerMonth: 10000,
            pagesIndexed: 5000,
            prioritySupport: true,
            proAiModels: true,
            teamsSlackIntegration: true,
            apiAccess: true,
            euDataResidency: true
          },
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'enterprise',
          name: 'Enterprise',
          description: 'Full-featured solution for large organizations',
          price: 0,
          currency: 'USD',
          interval: 'month',
          maxChatbots: null,
          maxUsers: null,
          features: {
            dedicatedSupport: true,
            customTemplates: true,
            advancedAnalytics: true,
            apiAccess: true,
            customIntegrations: true,
            sso: true,
            auditLogs: true,
            customDeployment: true
          },
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const startTrial = async (planId: string) => {
    try {
      setLoading(true);
      setError(null);
      if (!token) throw new Error('No authentication token');

      const response = await adminApiClient.post('/subscription/trial', { planId }, token);
      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
        await fetchSubscriptionStatus();
      } else {
        // If API fails, show a message that the feature is not yet available
        throw new Error('Subscription system is not yet available. Please try again later.');
      }
    } catch (err) {
      console.error('Error starting trial:', err);
      setError(err instanceof Error ? err.message : 'Failed to start trial');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateSubscription = async (planId: string) => {
    try {
      setLoading(true);
      setError(null);
      if (!token) throw new Error('No authentication token');

      const response = await adminApiClient.put('/subscription/update', { planId }, token);
      if (response.ok) {
        const data = await response.json();
        
        // Check if response contains checkoutUrl (Stripe checkout)
        if (data.checkoutUrl) {
          // Redirect to Stripe Checkout
          window.location.href = data.checkoutUrl;
          return; // Don't update state, user will be redirected
        }
        
        // If no checkout URL, it's a direct update (e.g., upgrade/downgrade of existing subscription)
        setSubscription(data);
        await fetchSubscriptionStatus();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update subscription');
      }
    } catch (err) {
      console.error('Error updating subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to update subscription');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const createCheckoutSession = async (planId: string) => {
    try {
      setLoading(true);
      setError(null);
      if (!token) throw new Error('No authentication token');

      const response = await adminApiClient.post('/subscription/checkout', { planId }, token);
      if (response.ok) {
        const data = await response.json();
        if (data.checkoutUrl) {
          // Redirect to Stripe Checkout
          window.location.href = data.checkoutUrl;
        } else {
          throw new Error('No checkout URL received');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }
    } catch (err) {
      console.error('Error creating checkout session:', err);
      setError(err instanceof Error ? err.message : 'Failed to create checkout session');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getCustomerPortalUrl = async (): Promise<string> => {
    try {
      if (!token) throw new Error('No authentication token');

      const response = await adminApiClient.get('/subscription/portal', token);
      if (response.ok) {
        const data = await response.json();
        return data.portalUrl;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get portal URL');
      }
    } catch (err) {
      console.error('Error getting portal URL:', err);
      throw err;
    }
  };

  const cancelSubscription = async (cancelAtPeriodEnd: boolean = true) => {
    try {
      setLoading(true);
      setError(null);
      if (!token) throw new Error('No authentication token');

      const response = await adminApiClient.post('/subscription/cancel', { cancelAtPeriodEnd }, token);
      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
        await fetchSubscriptionStatus();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel subscription');
      }
    } catch (err) {
      console.error('Error canceling subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const refreshSubscription = async () => {
    await Promise.all([fetchSubscription(), fetchSubscriptionStatus()]);
  };

  // Initial data fetch - refetch when user logs in (only if billing is enabled)
  useEffect(() => {
    if (user && token && isFeatureEnabled('billing')) {
      fetchSubscription();
      fetchSubscriptionStatus();
      fetchPlans();
    } else {
      // Clear data when user logs out or billing is disabled
      setSubscription(null);
      setSubscriptionStatus(null);
      setPlans([]);
    }
  }, [user, token, isFeatureEnabled]);

  const value: SubscriptionContextType = {
    subscription,
    subscriptionStatus,
    plans,
    loading,
    error,
    fetchSubscription,
    fetchPlans,
    startTrial,
    updateSubscription,
    cancelSubscription,
    refreshSubscription,
    createCheckoutSession,
    getCustomerPortalUrl,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
