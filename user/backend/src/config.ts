/**
 * User Backend Configuration
 * Centralized configuration access point
 * 
 * This module provides type-safe access to all environment variables
 * for the user-backend service.
 */

import { getUserConfig } from '@shared/config';
import type { UserConfig } from '@shared/config';

// Lazy-load configuration to allow tests to set up environment variables first
let _config: UserConfig | null = null;

function getConfig(): UserConfig {
  if (!_config) {
    _config = getUserConfig();
  }
  return _config;
}

// Reset config cache (for testing)
export function resetConfig(): void {
  _config = null;
}

// Export config as a getter to allow lazy loading
// This allows tests to set up environment variables before config is validated
export const config = new Proxy({} as UserConfig, {
  get(_target, prop) {
    return getConfig()[prop as keyof UserConfig];
  },
  ownKeys() {
    return Object.keys(getConfig());
  },
  getOwnPropertyDescriptor(_target, prop) {
    const config = getConfig();
    if (prop in config) {
      return {
        enumerable: true,
        configurable: true,
        value: config[prop as keyof UserConfig],
      };
    }
    return undefined;
  },
});
