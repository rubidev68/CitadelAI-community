import React, { createContext, useContext, ReactNode } from 'react';

// Extend Window interface to include __ENV__ with feature flags
declare global {
  interface Window {
    __ENV__?: {
      ADMIN_API_URL?: string;
      USER_API_URL?: string;
      USER_INTERFACE_URL?: string;
      FEATURE_BILLING?: string;
      FEATURE_ENTERPRISE?: string;
      FEATURE_ADVANCED_ANALYTICS?: string;
      FEATURE_PREMIUM_AI_MODELS?: string;
      FEATURE_ADMINJS_DASHBOARD?: string;
    };
  }
}

export interface FeatureFlags {
  billing: boolean;
  enterprise: boolean;
  advancedAnalytics: boolean;
  premiumAiModels: boolean;
  adminjsDashboard: boolean;
  versionType: 'opensource' | 'proprietary';
}

interface FeatureFlagsContextType {
  features: FeatureFlags;
  isFeatureEnabled: (feature: keyof Omit<FeatureFlags, 'versionType'>) => boolean;
  getAvailableBlockTypes: () => string[];
  getAvailableBlockSubtypes: () => Record<string, string[]>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(undefined);

interface FeatureFlagsProviderProps {
  children: ReactNode;
}

export const FeatureFlagsProvider: React.FC<FeatureFlagsProviderProps> = ({ children }) => {
  // Get feature flags from runtime config (window.__ENV__) or build-time environment variables
  const getFeatureFlag = (key: string, defaultValue: boolean): boolean => {
    // Convert key to env var format (e.g., 'advancedAnalytics' -> 'ADVANCED_ANALYTICS')
    const envKey = key.replace(/([A-Z])/g, '_$1').toUpperCase();
    
    // Check runtime config first (from docker-compose env vars)
    if (typeof window !== 'undefined' && window.__ENV__) {
      const runtimeKey = `FEATURE_${envKey}`;
      const envObj = window.__ENV__ as Record<string, string | undefined>;
      const value = envObj[runtimeKey];
      if (value !== undefined) {
        return value === 'true' || value === true;
      }
    }
    // Fallback to build-time environment variables
    const viteKey = `VITE_FEATURE_${envKey}`;
    const envValue = import.meta.env[viteKey];
    if (envValue !== undefined) {
      return envValue === 'true' || envValue === true;
    }
    return defaultValue;
  };

  const features: FeatureFlags = {
    billing: getFeatureFlag('billing', true), // Default true for proprietary builds, but can be overridden
    enterprise: getFeatureFlag('enterprise', true),
    advancedAnalytics: getFeatureFlag('advancedAnalytics', true),
    premiumAiModels: getFeatureFlag('premiumAiModels', true),
    adminjsDashboard: getFeatureFlag('adminjsDashboard', true),
    versionType: 'opensource', // Community Edition
  };




  const isFeatureEnabled = (feature: keyof Omit<FeatureFlags, 'versionType'>): boolean => {
    return features[feature];
  };

  const getAvailableBlockTypes = (): string[] => {
    const baseTypes = ['CONTEXT', 'LOGIC', 'ACTION', 'FRONTEND'];
    
    if (features.enterprise) {
      baseTypes.push('ENTERPRISE');
    }
    
    if (features.advancedAnalytics) {
      baseTypes.push('ANALYTICS');
    }
    
    return baseTypes;
  };

  const getAvailableBlockSubtypes = (): Record<string, string[]> => {
    const subtypes: Record<string, string[]> = {
      CONTEXT: ['Website', 'Document'],
      LOGIC: ['System Prompt', 'If'],
      ACTION: ['Send email', 'Browse internet'],
      FRONTEND: ['Interface', 'API']
    };
    
    if (features.enterprise) {
      subtypes.ENTERPRISE = ['Billing Integration', 'User Management', 'Advanced Permissions'];
    }
    
    if (features.advancedAnalytics) {
      subtypes.ANALYTICS = ['Usage Tracking', 'Performance Metrics', 'User Analytics'];
    }
    
    if (features.premiumAiModels) {
      subtypes.LOGIC.push('Premium AI Model', 'Custom AI Configuration');
    }
    
    return subtypes;
  };

  const value: FeatureFlagsContextType = {
    features,
    isFeatureEnabled,
    getAvailableBlockTypes,
    getAvailableBlockSubtypes
  };

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

export const useFeatureFlags = (): FeatureFlagsContextType => {
  const context = useContext(FeatureFlagsContext);
  if (context === undefined) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
  }
  return context;
};