/**
 * Crawling Service Configuration
 * Centralized configuration access point
 * 
 * This module provides type-safe access to all environment variables
 * for the crawling-service.
 */

import { getCrawlingConfig } from '@shared/config';
import type { CrawlingConfig } from '@shared/config';

// Lazy-load configuration to allow tests to set up environment variables first
let _config: CrawlingConfig | null = null;

function getConfig(): CrawlingConfig {
  if (!_config) {
    _config = getCrawlingConfig();
  }
  return _config;
}

// Export config as a getter to allow lazy loading
export const config = new Proxy({} as CrawlingConfig, {
  get(_target, prop) {
    return getConfig()[prop as keyof CrawlingConfig];
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
        value: config[prop as keyof CrawlingConfig],
      };
    }
    return undefined;
  },
});
