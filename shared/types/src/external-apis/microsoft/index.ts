/**
 * Microsoft Services API Type Definitions
 * 
 * Types for Microsoft Graph API (OneDrive, Outlook, etc.)
 */

/**
 * Microsoft OAuth token response
 */
export interface MicrosoftOAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

/**
 * Microsoft user information
 */
export interface MicrosoftUser {
  id: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  officeLocation?: string;
  photo?: string;
}

/**
 * OneDrive file/drive item
 */
export interface OneDriveDriveItem {
  id: string;
  name: string;
  size?: number;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  webUrl?: string;
  downloadUrl?: string;
  '@microsoft.graph.downloadUrl'?: string;
  file?: {
    mimeType: string;
    hashes?: {
      quickXorHash?: string;
      sha1Hash?: string;
      sha256Hash?: string;
    };
  };
  folder?: {
    childCount?: number;
  };
  parentReference?: {
    driveId?: string;
    driveType?: string;
    id?: string;
    path?: string;
  };
  createdBy?: {
    user?: {
      displayName?: string;
      email?: string;
    };
  };
  lastModifiedBy?: {
    user?: {
      displayName?: string;
      email?: string;
    };
  };
}

/**
 * OneDrive drive item list response
 */
export interface OneDriveDriveItemListResponse {
  value: OneDriveDriveItem[];
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
}

/**
 * OneDrive drive information
 */
export interface OneDriveDrive {
  id: string;
  driveType: 'personal' | 'business' | 'documentLibrary';
  name: string;
  owner?: {
    user?: {
      displayName?: string;
      email?: string;
    };
  };
  quota?: {
    deleted?: number;
    remaining?: number;
    state?: string;
    total?: number;
    used?: number;
  };
  webUrl?: string;
}

/**
 * Microsoft Graph API error response
 */
export interface MicrosoftGraphApiError {
  error: {
    code: string;
    message: string;
    innerError?: {
      'request-id'?: string;
      date?: string;
    };
  };
}

/**
 * Microsoft OAuth configuration
 */
export interface MicrosoftOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  tenant?: string; // 'common', 'organizations', 'consumers', or tenant ID
}

/**
 * Microsoft OAuth token data
 */
export interface MicrosoftOAuthTokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  accountId: string;
  accountName: string;
  scope?: string;
  tokenType?: string;
}
