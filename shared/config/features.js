"use strict";
/**
 * Feature Flags Configuration
 * Controls which features are enabled based on the version type
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFeatureFlags = getFeatureFlags;
exports.isFeatureEnabled = isFeatureEnabled;
exports.getAvailableBlockTypes = getAvailableBlockTypes;
exports.getAvailableBlockSubtypes = getAvailableBlockSubtypes;
/**
 * Get feature flags from environment variables
 */
function getFeatureFlags() {
    const versionType = process.env.VERSION_TYPE || 'opensource';
    return {
        billing: process.env.FEATURE_BILLING === 'true',
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
function isFeatureEnabled(feature) {
    const flags = getFeatureFlags();
    return flags[feature];
}
/**
 * Get available block types based on feature flags
 */
function getAvailableBlockTypes() {
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
function getAvailableBlockSubtypes() {
    const flags = getFeatureFlags();
    const subtypes = {
        CONTEXT: ['Website', 'Document'],
        LOGIC: ['System Prompt', 'If'],
        ACTION: ['Send email', 'Browse internet'],
        FRONTEND: ['Custom interface', 'API']
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
