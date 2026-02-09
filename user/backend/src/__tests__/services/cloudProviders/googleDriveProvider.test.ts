import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleDriveProvider } from '../../../services/cloudProviders/googleDriveProvider';
import type { drive_v3 } from 'googleapis';

// Hoisted mocks for googleapis and logger
const {
  MockOAuth2Client,
  mockGenerateAuthUrl,
  mockGetToken,
  mockRefreshAccessToken,
  mockSetCredentials,
  mockDrive,
  mockAboutGet,
  mockFilesList,
  mockFilesGet,
  mockFilesExport,
  mockLogger,
} = vi.hoisted(() => {
  const mockGenerateAuthUrl = vi.fn();
  const mockGetToken = vi.fn();
  const mockRefreshAccessToken = vi.fn();
  const mockSetCredentials = vi.fn();

  class MockOAuth2Client {
    constructor(..._args: unknown[]) {}
    generateAuthUrl = mockGenerateAuthUrl;
    getToken = mockGetToken;
    refreshAccessToken = mockRefreshAccessToken;
    setCredentials = mockSetCredentials;
  }

  const mockAboutGet = vi.fn();
  const mockFilesList = vi.fn();
  const mockFilesGet = vi.fn();
  const mockFilesExport = vi.fn();

  const mockDrive = vi.fn(() => ({
    about: {
      get: mockAboutGet,
    },
    files: {
      list: mockFilesList,
      get: mockFilesGet,
      export: mockFilesExport,
    },
  }));

  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return {
    MockOAuth2Client,
    mockGenerateAuthUrl,
    mockGetToken,
    mockRefreshAccessToken,
    mockSetCredentials,
    mockDrive,
    mockAboutGet,
    mockFilesList,
    mockFilesGet,
    mockFilesExport,
    mockLogger,
  };
});

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: MockOAuth2Client,
    },
    drive: mockDrive,
  },
}));

vi.mock('@shared/utils', () => ({
  logger: mockLogger,
}));

describe('GoogleDriveProvider', () => {
  let provider: GoogleDriveProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GoogleDriveProvider();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('basic info', () => {
    it('getProviderId should return googledrive', () => {
      expect(provider.getProviderId()).toBe('googledrive');
    });

    it('getProviderName should return Google Drive', () => {
      expect(provider.getProviderName()).toBe('Google Drive');
    });
  });

  describe('generateOAuthUrl', () => {
    it('should generate OAuth URL with correct config', () => {
      mockGenerateAuthUrl.mockReturnValue('https://auth.example.com');

      const url = provider.generateOAuthUrl(
        { clientId: 'id', clientSecret: 'secret' },
        'https://callback',
        'state-123',
      );

      expect(mockGenerateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive.readonly'],
        state: 'state-123',
        prompt: 'consent',
      });
      expect(url).toBe('https://auth.example.com');
    });

    it('should throw if clientId is missing', () => {
      expect(() =>
        provider.generateOAuthUrl(
          { clientSecret: 'secret' },
          'https://callback',
          'state',
        ),
      ).toThrow('Google Drive clientId is required');
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should exchange code for token and return OAuthTokenData', async () => {
      const tokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expiry_date: Date.now() + 3600 * 1000,
      };
      mockGetToken.mockResolvedValue({ tokens });
      mockAboutGet.mockResolvedValue({
        data: {
          user: {
            emailAddress: 'user@example.com',
            displayName: 'User',
          },
        },
      });

      const result = await provider.exchangeCodeForToken('code-123', 'https://callback', {
        clientId: 'id',
        clientSecret: 'secret',
      });

      expect(mockGetToken).toHaveBeenCalledWith('code-123');
      expect(mockAboutGet).toHaveBeenCalledWith({ fields: 'user' });
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.accountId).toBe('user@example.com');
      expect(result.accountName).toBe('User');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should throw if access token is missing', async () => {
      mockGetToken.mockResolvedValue({ tokens: {} });

      await expect(
        provider.exchangeCodeForToken('code', 'https://cb', {
          clientId: 'id',
          clientSecret: 'secret',
        }),
      ).rejects.toThrow('Google Drive OAuth error: No access token received from Google');
    });

    it('should wrap Google OAuth error with description', async () => {
      const error = {
        response: { data: { error_description: 'bad_grant' } },
      };
      mockGetToken.mockRejectedValue(error);

      await expect(
        provider.exchangeCodeForToken('code', 'https://cb', {
          clientId: 'id',
          clientSecret: 'secret',
        }),
      ).rejects.toThrow('Google Drive OAuth error: bad_grant');
    });

    it('should throw when clientId or clientSecret is missing', async () => {
      await expect(
        provider.exchangeCodeForToken('code', 'https://cb', {
          clientSecret: 'secret',
        }),
      ).rejects.toThrow('Google Drive clientId and clientSecret are required');
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh token and return OAuthTokenData', async () => {
      const credentials = {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expiry_date: Date.now() + 3600 * 1000,
      };
      mockRefreshAccessToken.mockResolvedValue({ credentials });
      mockAboutGet.mockResolvedValue({
        data: {
          user: {
            emailAddress: 'user@example.com',
            displayName: 'User',
          },
        },
      });

      const result = await provider.refreshAccessToken('old-refresh', {
        clientId: 'id',
        clientSecret: 'secret',
      });

      expect(mockRefreshAccessToken).toHaveBeenCalled();
      expect(result.accessToken).toBe('new-access');
      expect(result.refreshToken).toBe('new-refresh');
      expect(result.accountId).toBe('user@example.com');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should fall back to old refresh token when new one missing', async () => {
      const credentials = {
        access_token: 'new-access',
        expiry_date: Date.now() + 3600 * 1000,
      };
      mockRefreshAccessToken.mockResolvedValue({ credentials });
      mockAboutGet.mockResolvedValue({
        data: { user: { emailAddress: 'user@example.com' } },
      });

      const result = await provider.refreshAccessToken('old-refresh', {
        clientId: 'id',
        clientSecret: 'secret',
      });

      expect(result.refreshToken).toBe('old-refresh');
    });

    it('should wrap refresh error with description', async () => {
      const error = {
        response: { data: { error_description: 'invalid_grant' } },
      };
      mockRefreshAccessToken.mockRejectedValue(error);

      await expect(
        provider.refreshAccessToken('refresh', {
          clientId: 'id',
          clientSecret: 'secret',
        }),
      ).rejects.toThrow('Google Drive token refresh error: invalid_grant');
    });

    it('should throw when clientId or clientSecret is missing', async () => {
      await expect(
        provider.refreshAccessToken('refresh', {
          clientId: 'id',
        }),
      ).rejects.toThrow('Google Drive clientId and clientSecret are required');
    });
  });

  describe('listFilesPaginated (indirect via listSharedFolders)', () => {
    it('listSharedFolders maps folders correctly', async () => {
      const files: drive_v3.Schema$File[] = [
        {
          id: 'folder1',
          name: 'Shared Folder',
          mimeType: 'application/vnd.google-apps.folder',
          modifiedTime: '2025-01-01T00:00:00Z',
          webViewLink: 'https://drive.google.com/folder1',
        },
      ];
      mockFilesList.mockResolvedValue({
        data: { files, nextPageToken: undefined },
      });

      // Spy on private method via any
      const anyProvider = provider as any;
      const result = await anyProvider.listSharedFolders('access-token');

      expect(mockFilesList).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'folder1',
        name: 'Shared Folder',
        path: 'folder1',
        type: 'folder',
      });
    });
  });

  describe('getFileContent', () => {
    it('downloads regular file via files.get alt=media', async () => {
      const metaResponse = { data: { mimeType: 'text/plain' } };
      const contentResponse = { data: new ArrayBuffer(4) };
      mockFilesGet
        .mockResolvedValueOnce(metaResponse)
        .mockResolvedValueOnce(contentResponse);

      const buffer = await provider.getFileContent('access-token', 'file1');

      expect(mockFilesGet).toHaveBeenNthCalledWith(
        1,
        { fileId: 'file1', fields: 'mimeType' },
      );
      expect(mockFilesGet).toHaveBeenNthCalledWith(
        2,
        { fileId: 'file1', alt: 'media' },
        { responseType: 'arraybuffer' },
      );
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    it('exports Google Doc as text', async () => {
      const metaResponse = { data: { mimeType: 'application/vnd.google-apps.document' } };
      const exportResponse = { data: new ArrayBuffer(8) };
      mockFilesGet.mockResolvedValueOnce(metaResponse);
      mockFilesExport.mockResolvedValueOnce(exportResponse);

      const buffer = await provider.getFileContent('access-token', 'file-doc');

      expect(mockFilesExport).toHaveBeenCalledWith(
        { fileId: 'file-doc', mimeType: 'text/plain' },
        { responseType: 'arraybuffer' },
      );
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    it('throws specific error for file size limit (413)', async () => {
      const metaResponse = { data: { mimeType: 'text/plain' } };
      const error: any = new Error('Request failed');
      error.response = { status: 413 };
      mockFilesGet.mockResolvedValueOnce(metaResponse);
      mockFilesGet.mockRejectedValueOnce(error);

      await expect(
        provider.getFileContent('access-token', 'big-file'),
      ).rejects.toThrow('File size exceeds 10MB limit');
    });

    it('wraps other errors with generic message', async () => {
      const metaResponse = { data: { mimeType: 'text/plain' } };
      const error = new Error('Network failure');
      mockFilesGet.mockResolvedValueOnce(metaResponse);
      mockFilesGet.mockRejectedValueOnce(error);

      await expect(
        provider.getFileContent('access-token', 'file1'),
      ).rejects.toThrow('Google Drive getFileContent error: Network failure');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Google Drive getFileContent error',
        error,
        expect.objectContaining({ fileId: 'file1', service: 'googleDriveProvider' }),
      );
    });
  });

  describe('testConnection', () => {
    it('returns true when about.get succeeds', async () => {
      mockAboutGet.mockResolvedValue({ data: { user: {} } });

      const result = await provider.testConnection('access-token');

      expect(result).toBe(true);
      expect(mockAboutGet).toHaveBeenCalledWith({ fields: 'user' });
    });

    it('logs and rethrows error when connection fails', async () => {
      const error: any = new Error('Invalid token');
      error.response = { status: 401 };
      mockAboutGet.mockRejectedValue(error);

      await expect(
        provider.testConnection('bad-token'),
      ).rejects.toThrow('Invalid token');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Google Drive connection test failed',
        error,
        expect.objectContaining({ status: 401, service: 'googleDriveProvider' }),
      );
    });
  });
});

