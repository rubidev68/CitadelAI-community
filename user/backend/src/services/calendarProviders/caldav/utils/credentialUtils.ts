import { decryptToken } from '../../../../utils/tokenEncryption';

/**
 * Parse CalDAV credentials from accessToken
 * For CalDAV, we store: serverUrl|username|password (encrypted)
 */
export function parseCalDAVCredentials(accessToken: string): { username: string; password: string; serverUrl: string } {
  // Decrypt token (using same encryption as OAuth tokens)
  const decrypted = decryptToken(accessToken);
  const parts = decrypted.split('|');
  
  if (parts.length < 3) {
    throw new Error('Invalid CalDAV credentials format');
  }
  
  return {
    serverUrl: parts[0],
    username: parts[1],
    password: parts[2],
  };
}
