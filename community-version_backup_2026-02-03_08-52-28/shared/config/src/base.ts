/**
 * Base validators and utilities for environment variable validation
 */

import { cleanEnv, str, url, num, bool, email, makeValidator, port } from 'envalid';

/**
 * Custom validator for hex strings (e.g., encryption keys)
 */
const hexString = makeValidator<string>((input: string) => {
  if (!/^[0-9a-fA-F]+$/.test(input)) {
    throw new Error('Must be a valid hexadecimal string');
  }
  return input;
});

/**
 * Custom validator for 64-character hex strings (e.g., Slack encryption key)
 */
const hex64String = makeValidator<string>((input: string) => {
  if (!/^[0-9a-fA-F]{64}$/.test(input)) {
    throw new Error('Must be exactly 64 hexadecimal characters');
  }
  return input;
});

/**
 * Custom validator for JWT secrets (minimum length)
 */
const jwtSecret = makeValidator<string>((input: string) => {
  if (input.length < 32) {
    throw new Error('JWT secret must be at least 32 characters long');
  }
  return input;
});

/**
 * Custom validator for optional URLs (allows empty string)
 */
const optionalUrl = makeValidator<string>((input: string) => {
  if (!input || input === '') {
    return '';
  }
  try {
    new URL(input);
    return input;
  } catch {
    throw new Error('Invalid URL format');
  }
});

/**
 * Base environment schema - common variables used across all services
 */
export const baseSchema = {
  // Node environment
  NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
  
  // Version type
  VERSION_TYPE: str({ choices: ['opensource', 'proprietary'], default: 'opensource' }),
};

/**
 * Database configuration schema
 */
export const databaseSchema = {
  DATABASE_URL: str({ desc: 'PostgreSQL database connection URL' }),
  POSTGRES_USER: str({ default: 'citadel_user', desc: 'PostgreSQL username' }),
  POSTGRES_PASSWORD: str({ desc: 'PostgreSQL password' }),
  POSTGRES_DB: str({ default: 'citadel_db', desc: 'PostgreSQL database name' }),
};

/**
 * JWT and security configuration schema
 */
export const jwtSchema = {
  JWT_SECRET: jwtSecret({ desc: 'JWT secret for authentication (min 32 chars)' }),
  SUPERADMIN_JWT_SECRET: str({ desc: 'JWT secret for superadmin dashboard' }),
  ADMINJS_SESSION_SECRET: str({ desc: 'AdminJS session secret' }),
  ADMINJS_COOKIE_SECRET: str({ desc: 'AdminJS cookie secret' }),
  INTERNAL_SERVICE_TOKEN: str({ desc: 'Internal service-to-service authentication token' }),
  SLACK_ENCRYPTION_KEY: hex64String({ desc: 'Slack encryption key (64 hex characters)' }),
};

/**
 * API keys configuration schema
 */
export const apiKeysSchema = {
  GEMINI_API_KEY: str({ default: '', desc: 'Google Gemini API key' }),
  OPENAI_API_KEY: str({ default: '', desc: 'OpenAI API key' }),
  ANTHROPIC_API_KEY: str({ default: '', desc: 'Anthropic (Claude) API key' }),
  MISTRAL_API_KEY: str({ default: '', desc: 'Mistral AI API key' }),
  GEMINI_MODEL: str({ default: 'gemini-2.5-flash', desc: 'Gemini model name' }),
  OPENAI_MODEL: str({ default: 'gpt-5-mini', desc: 'OpenAI model name' }),
  OPENAI_BASE_URL: optionalUrl({ default: '', desc: 'OpenAI base URL (optional)' }),
  ANTHROPIC_MODEL: str({ default: 'claude-4.5-sonnet', desc: 'Anthropic model name' }),
  MISTRAL_MODEL: str({ default: 'mistral-large-latest', desc: 'Mistral model name' }),
  MISTRAL_BASE_URL: optionalUrl({ default: '', desc: 'Mistral base URL (optional)' }),
};

/**
 * Redis configuration schema
 */
export const redisSchema = {
  REDIS_URL: optionalUrl({ default: '', desc: 'Redis connection URL (optional, for rate limiting and caching)' }),
};

/**
 * Stripe configuration schema
 */
export const stripeSchema = {
  STRIPE_SECRET_KEY: str({ default: '', desc: 'Stripe secret key' }),
  STRIPE_WEBHOOK_SECRET: str({ default: '', desc: 'Stripe webhook secret' }),
};

/**
 * Email (Zoho) configuration schema
 */
export const emailSchema = {
  ZOHO_EMAIL_USER: str({ default: '', desc: 'Zoho email username' }),
  ZOHO_EMAIL_PASSWORD: str({ default: '', desc: 'Zoho email password' }),
  ZOHO_EMAIL_FROM: email({ default: 'noreply@citadelai.app', desc: 'Zoho email from address' }),
  ZOHO_EMAIL_FROM_NAME: str({ default: 'CitadelAI', desc: 'Zoho email from name' }),
  ZOHO_EMAIL_HOST: str({ default: 'smtppro.zoho.eu', desc: 'Zoho email SMTP host' }),
  ZOHO_EMAIL_PORT: port({ default: 587, desc: 'Zoho email SMTP port' }),
  ZOHO_EMAIL_SECURE: bool({ default: false, desc: 'Zoho email secure connection' }),
};

/**
 * OAuth configuration schema
 */
export const oauthSchema = {
  GOOGLE_DRIVE_CLIENT_ID: str({ default: '', desc: 'Google Drive OAuth client ID' }),
  GOOGLE_DRIVE_CLIENT_SECRET: str({ default: '', desc: 'Google Drive OAuth client secret' }),
  GOOGLE_CALENDAR_CLIENT_ID: str({ default: '', desc: 'Google Calendar OAuth client ID' }),
  GOOGLE_CALENDAR_CLIENT_SECRET: str({ default: '', desc: 'Google Calendar OAuth client secret' }),
  ONEDRIVE_CLIENT_ID: str({ default: '', desc: 'OneDrive OAuth client ID' }),
  ONEDRIVE_CLIENT_SECRET: str({ default: '', desc: 'OneDrive OAuth client secret' }),
};

/**
 * URL configuration schema
 */
export const urlSchema = {
  API_URL: url({ default: 'https://api.citadelai.app', desc: 'API base URL' }),
  FRONTEND_URL: url({ default: 'https://admin.citadelai.app', desc: 'Admin frontend URL' }),
  USER_FRONTEND_URL: url({ default: 'https://chat.citadelai.app', desc: 'User frontend URL' }),
  API_BASE_URL: optionalUrl({ default: '', desc: 'API base URL (alternative)' }),
};

/**
 * Service URLs configuration schema
 */
export const serviceUrlsSchema = {
  CRAWLING_SERVICE_URL: url({ default: 'http://crawling-service:3001', desc: 'Crawling service URL' }),
  CRON_SCHEDULER_URL: url({ default: 'http://cron-scheduler:3002', desc: 'Cron scheduler URL' }),
  EMAIL_SERVICE_URL: url({ default: 'http://email-service:3008', desc: 'Email service URL' }),
  INSTANCE_SERVICE_URL: url({ default: 'http://localhost:3006', desc: 'Instance provisioning service URL' }),
  USER_BACKEND_URL: url({ default: 'http://user-backend:3003', desc: 'User backend URL' }),
  ADMIN_BACKEND_URL: url({ default: 'http://admin-backend:3002', desc: 'Admin backend URL' }),
  SUPERADMIN_BACKEND_URL: url({ default: 'http://superadmin-dashboard-backend:3007', desc: 'Superadmin backend URL' }),
};

/**
 * CORS configuration schema
 */
export const corsSchema = {
  CORS_ALLOWED_ORIGINS: str({ 
    default: '', 
    desc: 'Comma-separated list of allowed CORS origins (empty uses defaults based on FRONTEND_URL and USER_FRONTEND_URL)' 
  }),
  HTTPS_ENABLED: bool({ default: false, desc: 'Enable HTTPS (for HSTS header)' }),
};

/**
 * Other configuration schema
 */
export const otherSchema = {
  WEAVIATE_URL: url({ default: 'http://weaviate:8080', desc: 'Weaviate vector database URL' }),
  DOCKER_REGISTRY: str({ default: '', desc: 'Docker registry URL' }),
  CLOUD_INDEXING_CONCURRENT_FILES: num({ default: 15, desc: 'Cloud indexing concurrent files' }),
  CLOUD_INDEXING_CONCURRENT_FOLDERS: num({ default: 8, desc: 'Cloud indexing concurrent folders' }),
  ALLOW_WEAVIATE_SCHEMA_RECREATION: bool({ default: false, desc: 'Allow Weaviate schema recreation' }),
  SUPER_ADMIN_EMAIL: email({ default: 'superadmin@citadelai.com', desc: 'Super admin email' }),
  SUPER_ADMIN_PASSWORD: str({ default: '', desc: 'Super admin password' }),
};

/**
 * Helper function to create validated environment config
 */
export function createValidatedEnv<T extends Record<string, any>>(schema: T) {
  return cleanEnv(process.env, schema);
}
