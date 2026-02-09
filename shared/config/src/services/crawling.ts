/**
 * Crawling Service Configuration
 * Centralized environment variable management for crawling-service
 */

import { createValidatedEnv } from '../base';
import {
  baseSchema,
  databaseSchema,
  apiKeysSchema,
  serviceUrlsSchema,
  corsSchema,
  otherSchema,
} from '../base';
import type { CrawlingConfig } from '../types';

/**
 * Get validated crawling service configuration
 * This function validates all environment variables at startup
 * and provides type-safe access to configuration values.
 *
 * @returns Validated crawling service configuration
 * @throws Error if required environment variables are missing or invalid
 */
export function getCrawlingConfig(): CrawlingConfig {
  const schema = {
    ...baseSchema,
    ...databaseSchema,
    ...apiKeysSchema,
    ...serviceUrlsSchema,
    ...corsSchema,
    ...otherSchema,
  };

  return createValidatedEnv(schema) as CrawlingConfig;
}
