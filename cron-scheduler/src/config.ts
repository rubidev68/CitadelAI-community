/**
 * Cron Scheduler Configuration
 * Centralized configuration access point
 * 
 * This module provides type-safe access to all environment variables
 * for the cron-scheduler service.
 */

import { getCronConfig } from '@shared/config';
import type { CronConfig } from '@shared/config';

// Lazy-load configuration to allow tests to set up environment variables first
let _config: CronConfig | null = null;

function getConfig(): CronConfig {
  if (!_config) {
    _config = getCronConfig();
  }
  return _config;
}

// Export config as a getter to allow lazy loading
export const config = new Proxy({} as CronConfig, {
  get(_target, prop) {
    return getConfig()[prop as keyof CronConfig];
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
        value: config[prop as keyof CronConfig],
      };
    }
    return undefined;
  },
});
