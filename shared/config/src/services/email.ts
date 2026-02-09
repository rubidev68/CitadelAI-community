/**
 * Email Service Configuration
 * Centralized environment variable management for email-service
 */

import { createValidatedEnv } from '../base';
import {
  baseSchema,
  emailSchema,
  serviceUrlsSchema,
  corsSchema,
} from '../base';
import type { EmailServiceConfig } from '../types';

/**
 * Get validated email service configuration
 * This function validates all environment variables at startup
 * and provides type-safe access to configuration values.
 *
 * @returns Validated email service configuration
 * @throws Error if required environment variables are missing or invalid
 */
export function getEmailServiceConfig(): EmailServiceConfig {
  const schema = {
    ...baseSchema,
    ...emailSchema,
    ...serviceUrlsSchema,
    ...corsSchema,
  };

  return createValidatedEnv(schema) as EmailServiceConfig;
}
