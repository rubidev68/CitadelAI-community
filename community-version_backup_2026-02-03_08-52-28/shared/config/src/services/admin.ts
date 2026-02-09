/**
 * Admin Backend Configuration
 * Centralized environment variable management for admin-backend service
 */

import { createValidatedEnv } from '../base';
import {
  baseSchema,
  databaseSchema,
  jwtSchema,
  apiKeysSchema,
  stripeSchema,
  emailSchema,
  oauthSchema,
  urlSchema,
  serviceUrlsSchema,
  corsSchema,
  otherSchema,
} from '../base';
import type { AdminConfig } from '../types';

/**
 * Get validated admin backend configuration
 * This function validates all environment variables at startup
 * and provides type-safe access to configuration values.
 *
 * @returns Validated admin backend configuration
 * @throws Error if required environment variables are missing or invalid
 */
export function getAdminConfig(): AdminConfig {
  const schema = {
    ...baseSchema,
    ...databaseSchema,
    ...jwtSchema,
    ...apiKeysSchema,
    ...stripeSchema,
    ...emailSchema,
    ...oauthSchema,
    ...urlSchema,
    ...serviceUrlsSchema,
    ...corsSchema,
    ...otherSchema,
  };

  return createValidatedEnv(schema) as AdminConfig;
}
