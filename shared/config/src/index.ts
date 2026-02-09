/**
 * Shared Configuration Package
 * Centralized environment variable management and validation
 *
 * @example
 * ```typescript
 * import { getAdminConfig } from '@shared/config';
 *
 * const config = getAdminConfig();
 * console.log(config.DATABASE_URL);
 * ```
 */

// Export service-specific configs
export { getAdminConfig } from './services/admin';
export { getUserConfig } from './services/user';
export { getCrawlingConfig } from './services/crawling';
export { getCronConfig } from './services/cron';
export { getEmailServiceConfig } from './services/email';

// Export types
export type {
  BaseConfig,
  DatabaseConfig,
  JwtConfig,
  ApiKeysConfig,
  StripeConfig,
  EmailConfig,
  OAuthConfig,
  UrlConfig,
  ServiceUrlsConfig,
  OtherConfig,
  AdminConfig,
  UserConfig,
  CrawlingConfig,
  CronConfig,
  EmailServiceConfig,
} from './types';

// Export base utilities (for advanced use cases)
export {
  createValidatedEnv,
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
} from './base';
