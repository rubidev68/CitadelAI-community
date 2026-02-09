/**
 * TypeScript types for environment configuration
 */

import type { CleanedEnvAccessors } from 'envalid';

/**
 * Base environment configuration
 */
export interface BaseConfig extends CleanedEnvAccessors {
  NODE_ENV: 'development' | 'test' | 'production';
  VERSION_TYPE: 'opensource' | 'proprietary';
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  DATABASE_URL: string;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_DB: string;
}

/**
 * JWT and security configuration
 */
export interface JwtConfig {
  JWT_SECRET: string;
  SUPERADMIN_JWT_SECRET: string;
  ADMINJS_SESSION_SECRET: string;
  ADMINJS_COOKIE_SECRET: string;
  INTERNAL_SERVICE_TOKEN: string;
  SLACK_ENCRYPTION_KEY: string;
}

/**
 * API keys configuration
 */
export interface ApiKeysConfig {
  GEMINI_API_KEY: string;
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  MISTRAL_API_KEY: string;
  GEMINI_MODEL: string;
  OPENAI_MODEL: string;
  OPENAI_BASE_URL: string;
  ANTHROPIC_MODEL: string;
  MISTRAL_MODEL: string;
  MISTRAL_BASE_URL: string;
}

/**
 * Redis configuration
 */
export interface RedisConfig {
  REDIS_URL: string;
}

/**
 * Stripe configuration
 */
export interface StripeConfig {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
}

/**
 * Email configuration
 */
export interface EmailConfig {
  ZOHO_EMAIL_USER: string;
  ZOHO_EMAIL_PASSWORD: string;
  ZOHO_EMAIL_FROM: string;
  ZOHO_EMAIL_FROM_NAME: string;
  ZOHO_EMAIL_HOST: string;
  ZOHO_EMAIL_PORT: number;
  ZOHO_EMAIL_SECURE: boolean;
}

/**
 * OAuth configuration
 */
export interface OAuthConfig {
  GOOGLE_DRIVE_CLIENT_ID: string;
  GOOGLE_DRIVE_CLIENT_SECRET: string;
  GOOGLE_CALENDAR_CLIENT_ID: string;
  GOOGLE_CALENDAR_CLIENT_SECRET: string;
  ONEDRIVE_CLIENT_ID: string;
  ONEDRIVE_CLIENT_SECRET: string;
}

/**
 * URL configuration
 */
export interface UrlConfig {
  API_URL: string;
  FRONTEND_URL: string;
  USER_FRONTEND_URL: string;
  API_BASE_URL: string;
}

/**
 * Service URLs configuration
 */
export interface ServiceUrlsConfig {
  CRAWLING_SERVICE_URL: string;
  CRON_SCHEDULER_URL: string;
  EMAIL_SERVICE_URL: string;
  INSTANCE_SERVICE_URL: string;
  USER_BACKEND_URL: string;
  ADMIN_BACKEND_URL: string;
  SUPERADMIN_BACKEND_URL: string;
}

/**
 * CORS configuration
 */
export interface CorsConfig {
  CORS_ALLOWED_ORIGINS: string;
  HTTPS_ENABLED: boolean;
}

/**
 * Other configuration
 */
export interface OtherConfig {
  WEAVIATE_URL: string;
  DOCKER_REGISTRY: string;
  CLOUD_INDEXING_CONCURRENT_FILES: number;
  CLOUD_INDEXING_CONCURRENT_FOLDERS: number;
  ALLOW_WEAVIATE_SCHEMA_RECREATION: boolean;
  SUPER_ADMIN_EMAIL: string;
  SUPER_ADMIN_PASSWORD: string;
}

/**
 * Complete configuration for admin backend
 */
export interface AdminConfig extends BaseConfig, DatabaseConfig, JwtConfig, ApiKeysConfig, StripeConfig, EmailConfig, OAuthConfig, UrlConfig, ServiceUrlsConfig, CorsConfig, OtherConfig {}

/**
 * Complete configuration for user backend
 */
export interface UserConfig extends BaseConfig, DatabaseConfig, JwtConfig, ApiKeysConfig, OAuthConfig, UrlConfig, ServiceUrlsConfig, CorsConfig, OtherConfig {}

/**
 * Complete configuration for crawling service
 */
export interface CrawlingConfig extends BaseConfig, DatabaseConfig, ApiKeysConfig, ServiceUrlsConfig, CorsConfig, OtherConfig {}

/**
 * Complete configuration for cron scheduler
 */
export interface CronConfig extends BaseConfig, DatabaseConfig, ServiceUrlsConfig, CorsConfig {}

/**
 * Complete configuration for email service
 */
export interface EmailServiceConfig extends BaseConfig, EmailConfig, ServiceUrlsConfig, CorsConfig {}
