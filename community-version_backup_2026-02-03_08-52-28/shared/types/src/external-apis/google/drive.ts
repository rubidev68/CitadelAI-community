/**
 * Google Drive API Type Definitions
 */

/**
 * Google Drive file metadata
 */
export interface GoogleDriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  parents?: string[];
  shared?: boolean;
  owners?: Array<{
    displayName?: string;
    emailAddress?: string;
    photoLink?: string;
  }>;
  permissions?: Array<{
    id: string;
    type: 'user' | 'group' | 'domain' | 'anyone';
    role: 'owner' | 'organizer' | 'fileOrganizer' | 'writer' | 'commenter' | 'reader';
    emailAddress?: string;
  }>;
}

/**
 * Google Drive file list response
 */
export interface GoogleDriveFileListResponse {
  kind: 'drive#fileList';
  nextPageToken?: string;
  incompleteSearch?: boolean;
  files: GoogleDriveFileMetadata[];
}

/**
 * Google Drive about response (user info)
 */
export interface GoogleDriveAboutResponse {
  kind: 'drive#about';
  user?: {
    kind: 'drive#user';
    displayName?: string;
    emailAddress?: string;
    photoLink?: string;
    me?: boolean;
    permissionId?: string;
  };
  storageQuota?: {
    limit?: string;
    usage?: string;
    usageInDrive?: string;
    usageInDriveTrash?: string;
  };
}

/**
 * Google Drive OAuth token response
 */
export interface GoogleDriveOAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

/**
 * Google Drive API error response
 */
export interface GoogleDriveApiError {
  error: {
    code: number;
    message: string;
    errors?: Array<{
      message: string;
      domain: string;
      reason: string;
    }>;
    status: string;
  };
}
