import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getFeatureFlags,
  isFeatureEnabled,
  getAvailableBlockTypes,
  getAvailableBlockSubtypes,
} from '../../../shared/config/features';

describe('Feature Flags', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    // Reset config cache before each test to ensure clean state
    const { resetConfig } = await import('../../../config');
    resetConfig();
    // Don't reset modules as it interferes with config caching
    // Instead, just reset the config cache
    process.env = { ...originalEnv };
  });

  afterEach(async () => {
    // Reset config cache after each test
    const { resetConfig } = await import('../../../config');
    resetConfig();
    process.env = originalEnv;
  });

  describe('getFeatureFlags', () => {
    it('should return default flags when no environment variables are set', () => {
      delete process.env.VERSION_TYPE;
      delete process.env.FEATURE_BILLING;
      delete process.env.FEATURE_ENTERPRISE;
      delete process.env.FEATURE_ADVANCED_ANALYTICS;
      delete process.env.FEATURE_PREMIUM_AI_MODELS;
      delete process.env.FEATURE_ADMINJS_DASHBOARD;

      const flags = getFeatureFlags();

      expect(flags.versionType).toBe('opensource');
      expect(flags.billing).toBe(false);
      expect(flags.enterprise).toBe(false);
      expect(flags.advancedAnalytics).toBe(false);
      expect(flags.premiumAiModels).toBe(false);
      expect(flags.adminjsDashboard).toBe(false);
    });

    it('should return flags based on environment variables', async () => {
      // Import resetConfig and config
      const configModule = await import('../../../config');
      const { resetConfig, config } = configModule;
      
      // Clear config cache before setting env vars to ensure fresh load
      resetConfig();
      
      // Set environment variables
      process.env.VERSION_TYPE = 'proprietary';
      process.env.FEATURE_BILLING = 'true';
      process.env.FEATURE_ENTERPRISE = 'true';
      process.env.FEATURE_ADVANCED_ANALYTICS = 'true';
      process.env.FEATURE_PREMIUM_AI_MODELS = 'true';
      process.env.FEATURE_ADMINJS_DASHBOARD = 'true';
      
      // Reset config cache again AFTER setting env vars to ensure it reloads with new values
      resetConfig();
      
      // Force config to reload by accessing it
      // This ensures the config is loaded with the new env var values
      void config.VERSION_TYPE;

      const flags = getFeatureFlags();

      expect(flags.versionType).toBe('proprietary');
      expect(flags.billing).toBe(true);
      expect(flags.enterprise).toBe(true);
      expect(flags.advancedAnalytics).toBe(true);
      expect(flags.premiumAiModels).toBe(true);
      expect(flags.adminjsDashboard).toBe(true);
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return false when feature is disabled', () => {
      process.env.FEATURE_BILLING = 'false';
      expect(isFeatureEnabled('billing')).toBe(false);
    });

    it('should return true when feature is enabled', () => {
      process.env.FEATURE_BILLING = 'true';
      expect(isFeatureEnabled('billing')).toBe(true);
    });

    it('should check all feature types', () => {
      process.env.FEATURE_ENTERPRISE = 'true';
      process.env.FEATURE_ADVANCED_ANALYTICS = 'true';
      process.env.FEATURE_PREMIUM_AI_MODELS = 'true';
      process.env.FEATURE_ADMINJS_DASHBOARD = 'true';

      expect(isFeatureEnabled('enterprise')).toBe(true);
      expect(isFeatureEnabled('advancedAnalytics')).toBe(true);
      expect(isFeatureEnabled('premiumAiModels')).toBe(true);
      expect(isFeatureEnabled('adminjsDashboard')).toBe(true);
    });
  });

  describe('getAvailableBlockTypes', () => {
    it('should return base block types', () => {
      process.env.FEATURE_ENTERPRISE = 'false';
      process.env.FEATURE_ADVANCED_ANALYTICS = 'false';

      const types = getAvailableBlockTypes();

      expect(types).toContain('CONTEXT');
      expect(types).toContain('LOGIC');
      expect(types).toContain('ACTION');
      expect(types).toContain('FRONTEND');
      expect(types).not.toContain('ENTERPRISE');
      expect(types).not.toContain('ANALYTICS');
    });

    it('should include enterprise types when enabled', () => {
      process.env.FEATURE_ENTERPRISE = 'true';
      process.env.FEATURE_ADVANCED_ANALYTICS = 'false';

      const types = getAvailableBlockTypes();

      expect(types).toContain('ENTERPRISE');
    });

    it('should include analytics types when enabled', () => {
      process.env.FEATURE_ENTERPRISE = 'false';
      process.env.FEATURE_ADVANCED_ANALYTICS = 'true';

      const types = getAvailableBlockTypes();

      expect(types).toContain('ANALYTICS');
    });
  });

  describe('getAvailableBlockSubtypes', () => {
    it('should return base subtypes', () => {
      process.env.FEATURE_ENTERPRISE = 'false';
      process.env.FEATURE_ADVANCED_ANALYTICS = 'false';
      process.env.FEATURE_PREMIUM_AI_MODELS = 'false';

      const subtypes = getAvailableBlockSubtypes();

      expect(subtypes.CONTEXT).toContain('Website');
      expect(subtypes.CONTEXT).toContain('Document');
      expect(subtypes.LOGIC).toContain('System Prompt');
      expect(subtypes.ACTION).toContain('Send email');
      expect(subtypes.FRONTEND).toContain('Interface');
    });

    it('should include enterprise subtypes when enabled', () => {
      process.env.FEATURE_ENTERPRISE = 'true';

      const subtypes = getAvailableBlockSubtypes();

      expect(subtypes.ENTERPRISE).toBeDefined();
      expect(subtypes.ENTERPRISE).toContain('Billing Integration');
    });

    it('should include analytics subtypes when enabled', () => {
      process.env.FEATURE_ADVANCED_ANALYTICS = 'true';

      const subtypes = getAvailableBlockSubtypes();

      expect(subtypes.ANALYTICS).toBeDefined();
      expect(subtypes.ANALYTICS).toContain('Usage Tracking');
    });

    it('should include premium AI models when enabled', () => {
      process.env.FEATURE_PREMIUM_AI_MODELS = 'true';

      const subtypes = getAvailableBlockSubtypes();

      expect(subtypes.LOGIC).toContain('Premium AI Model');
    });
  });
});
