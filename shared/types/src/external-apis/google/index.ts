/**
 * Google Services API Type Definitions
 */

export * from './drive';
export * from './calendar';

/**
 * Google OAuth configuration
 */
export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * Google OAuth token data
 */
export interface GoogleOAuthTokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  accountId: string;
  accountName: string;
  scope?: string;
  tokenType?: string;
}

/**
 * Google API error response
 */
export interface GoogleApiError {
  error: {
    code: number;
    message: string;
    errors?: Array<{
      message: string;
      domain: string;
      reason: string;
      location?: string;
      locationType?: string;
    }>;
    status: string;
  };
}
