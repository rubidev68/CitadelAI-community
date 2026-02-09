/**
 * User Backend Configuration
 * Centralized environment variable management for user-backend service
 */

import { createValidatedEnv } from '../base';
import {
  baseSchema,
  databaseSchema,
  jwtSchema,
  apiKeysSchema,
  oauthSchema,
  urlSchema,
  serviceUrlsSchema,
  corsSchema,
  otherSchema,
} from '../base';
import type { UserConfig } from '../types';

/**
 * Get validated user backend configuration
 * This function validates all environment variables at startup
 * and provides type-safe access to configuration values.
 *
 * @returns Validated user backend configuration
 * @throws Error if required environment variables are missing or invalid
 */
export function getUserConfig(): UserConfig {
  const schema = {
    ...baseSchema,
    ...databaseSchema,
    ...jwtSchema,
    ...apiKeysSchema,
    ...oauthSchema,
    ...urlSchema,
    ...serviceUrlsSchema,
    ...corsSchema,
    ...otherSchema,
  };

  return createValidatedEnv(schema) as UserConfig;
}
