/**
 * Cron Scheduler Configuration
 * Centralized environment variable management for cron-scheduler service
 */

import { createValidatedEnv } from '../base';
import {
  baseSchema,
  databaseSchema,
  serviceUrlsSchema,
  corsSchema,
} from '../base';
import type { CronConfig } from '../types';

/**
 * Get validated cron scheduler configuration
 * This function validates all environment variables at startup
 * and provides type-safe access to configuration values.
 *
 * @returns Validated cron scheduler configuration
 * @throws Error if required environment variables are missing or invalid
 */
export function getCronConfig(): CronConfig {
  const schema = {
    ...baseSchema,
    ...databaseSchema,
    ...serviceUrlsSchema,
    ...corsSchema,
  };

  return createValidatedEnv(schema) as CronConfig;
}
