/**
 * Feature Flags Configuration
 * Controls which features are enabled based on the version type
 */

import { config } from '../../config';

export interface FeatureFlags {
  billing: boolean;
  enterprise: boolean;
  advancedAnalytics: boolean;
  premiumAiModels: boolean;
  adminjsDashboard: boolean;
  versionType: 'opensource' | 'proprietary';
}

/**
 * Get feature flags from environment variables
 */
export function getFeatureFlags(): FeatureFlags {
  const versionType = config.VERSION_TYPE;
  
  return {
    billing: process.env.FEATURE_BILLING === 'true', // Keep process.env for feature flags as they're optional
    enterprise: process.env.FEATURE_ENTERPRISE === 'true',
    advancedAnalytics: process.env.FEATURE_ADVANCED_ANALYTICS === 'true',
    premiumAiModels: process.env.FEATURE_PREMIUM_AI_MODELS === 'true',
    adminjsDashboard: process.env.FEATURE_ADMINJS_DASHBOARD === 'true',
    versionType
  };
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: keyof Omit<FeatureFlags, 'versionType'>): boolean {
  const flags = getFeatureFlags();
  return flags[feature];
}

/**
 * Get available block types based on feature flags
 */
export function getAvailableBlockTypes(): string[] {
  const flags = getFeatureFlags();
  const baseTypes = ['CONTEXT', 'LOGIC', 'ACTION', 'FRONTEND'];
  
  if (flags.enterprise) {
    baseTypes.push('ENTERPRISE');
  }
  
  if (flags.advancedAnalytics) {
    baseTypes.push('ANALYTICS');
  }
  
  return baseTypes;
}

/**
 * Get available block subtypes based on feature flags
 */
export function getAvailableBlockSubtypes(): Record<string, string[]> {
  const flags = getFeatureFlags();
  
  const subtypes: Record<string, string[]> = {
    CONTEXT: ['Website', 'Document'],
    LOGIC: ['System Prompt', 'If'],
    ACTION: ['Send email', 'Browse internet'],
    FRONTEND: ['Interface', 'API']
  };
  
  if (flags.enterprise) {
    subtypes.ENTERPRISE = ['Billing Integration', 'User Management', 'Advanced Permissions'];
  }
  
  if (flags.advancedAnalytics) {
    subtypes.ANALYTICS = ['Usage Tracking', 'Performance Metrics', 'User Analytics'];
  }
  
  if (flags.premiumAiModels) {
    subtypes.LOGIC.push('Premium AI Model', 'Custom AI Configuration');
  }
  
  return subtypes;
}