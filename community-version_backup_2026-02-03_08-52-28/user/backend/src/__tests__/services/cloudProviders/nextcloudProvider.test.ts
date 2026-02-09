import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextcloudProvider } from '../../../services/cloudProviders/nextcloudProvider';

// Hoisted mocks for axios and logger
const {
  mockAxiosCreate,
  mockAxiosInstance,
  mockRequest,
  mockGet,
  mockPost,
  mockLogger,
} = vi.hoisted(() => {
  const mockRequest = vi.fn();
  const mockGet = vi.fn();
  const mockPost = vi.fn();

  const mockAxiosInstance = {
    request: mockRequest,
    get: mockGet,
    post: mockPost,
  };

  const mockAxiosCreate = vi.fn(() => mockAxiosInstance);

  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return {
    mockAxiosCreate,
    mockAxiosInstance,
    mockRequest,
    mockGet,
    mockPost,
    mockLogger,
  };
});

vi.mock('axios', () => {
  const defaultExport = {
    create: mockAxiosCreate,
  };
  return {
    __esModule: true,
    default: defaultExport,
    create: mockAxiosCreate,
  };
});

vi.mock('@shared/utils', () => ({
  logger: mockLogger,
}));

describe('NextcloudProvider', () => {
  let provider: NextcloudProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new NextcloudProvider({ baseUrl: 'https://cloud.example.com/' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('basic info', () => {
    it('getProviderId should return nextcloud', () => {
      expect(provider.getProviderId()).toBe('nextcloud');
    });

    it('getProviderName should return Nextcloud', () => {
      expect(provider.getProviderName()).toBe('Nextcloud');
    });
  });

  describe('refreshAccessToken', () => {
    it('refreshes token and returns OAuthTokenData', async () => {
      // token endpoint response
      mockPost.mockResolvedValue({
        data: {
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 3600,
        },
      });
      // getUserId call
      mockGet.mockResolvedValue({
        data: '<ocs><data><id>user1</id></data></ocs>',
      });

      const result = await provider.refreshAccessToken('old-refresh', {
        baseUrl: 'https://cloud.example.com/',
        clientId: 'client',
        clientSecret: 'secret',
      });

      expect(mockPost).toHaveBeenCalledWith(
        'https://cloud.example.com/index.php/apps/oauth2/api/v1/token',
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
      const params = mockPost.mock.calls[0][1] as URLSearchParams;
      expect(params.get('grant_type')).toBe('refresh_token');
      expect(params.get('refresh_token')).toBe('old-refresh');
      expect(params.get('client_id')).toBe('client');
      expect(params.get('client_secret')).toBe('secret');

      expect(result.accessToken).toBe('new-access');
      expect(result.refreshToken).toBe('new-refresh');
      expect(result.accountId).toBe('user1');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('falls back to old refresh token when new one missing', async () => {
      mockPost.mockResolvedValue({
        data: {
          access_token: 'new-access',
          expires_in: 3600,
        },
      });
      mockGet.mockResolvedValue({
        data: '<ocs><data><id>user1</id></data></ocs>',
      });

      const result = await provider.refreshAccessToken('old-refresh', {
        baseUrl: 'https://cloud.example.com/',
        clientId: 'client',
        clientSecret: 'secret',
      });

      expect(result.refreshToken).toBe('old-refresh');
    });

    it('throws when baseUrl is missing', async () => {
      await expect(
        provider.refreshAccessToken('token', {
          clientId: 'client',
          clientSecret: 'secret',
        }),
      ).rejects.toThrow('Nextcloud baseUrl is required');
    });

    it('throws when clientId or clientSecret is missing', async () => {
      await expect(
        provider.refreshAccessToken('token', {
          baseUrl: 'https://cloud.example.com/',
          clientSecret: 'secret',
        }),
      ).rejects.toThrow('Nextcloud clientId and clientSecret are required');
    });

    it('wraps error with error_description when available', async () => {
      const error: any = new Error('Request failed');
      error.response = {
        data: {
          error_description: 'invalid_grant',
        },
      };
      mockPost.mockRejectedValue(error);

      await expect(
        provider.refreshAccessToken('token', {
          baseUrl: 'https://cloud.example.com/',
          clientId: 'client',
          clientSecret: 'secret',
        }),
      ).rejects.toThrow('Nextcloud token refresh error: invalid_grant');
    });
  });

  describe('listFiles', () => {
    it('lists files for OAuth (Bearer) auth', async () => {
      const xml = `
<d:multistatus xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns" xmlns:nc="http://nextcloud.org/ns">
  <d:response>
    <d:href>/remote.php/dav/files/user1/Documents/</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype><d:collection/></d:resourcetype>
        <oc:fileid>folder-id</oc:fileid>
        <d:getlastmodified>Wed, 01 Jan 2025 00:00:00 GMT</d:getlastmodified>
      </d:prop>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/user1/Documents/file.txt</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype></d:resourcetype>
        <oc:fileid>file-id</oc:fileid>
        <d:getcontentlength>123</d:getcontentlength>
        <d:getcontenttype>text/plain</d:getcontenttype>
        <d:getlastmodified>Wed, 01 Jan 2025 01:00:00 GMT</d:getlastmodified>
        <d:getetag>\"etag-value\"</d:getetag>
      </d:prop>
    </d:propstat>
  </d:response>
</d:multistatus>`;

      // getUserId call
      mockGet.mockResolvedValueOnce({
        data: '<ocs><data><id>user1</id></data></ocs>',
      });
      mockRequest.mockResolvedValueOnce({ data: xml });

      const result = await provider.listFiles('access-token', 'Documents', false);

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PROPFIND',
          url: 'https://cloud.example.com/remote.php/dav/files/user1/Documents/',
          headers: expect.objectContaining({
            Authorization: 'Bearer access-token',
            Depth: '1',
          }),
        }),
      );

      expect(result).toHaveLength(2);
      const folder = result.find(f => f.type === 'folder')!;
      const file = result.find(f => f.type === 'file')!;
      expect(folder.path).toBe('Documents/');
      expect(file.name).toBe('file.txt');
      expect(file.size).toBe(123);
      expect(file.mimeType).toBe('text/plain');
      expect(file.etag).toBe('etag-value');
    });

    it('uses Basic auth for app password', async () => {
      mockRequest.mockResolvedValueOnce({ data: '<d:multistatus></d:multistatus>' });

      await provider.listFiles('app-pass', '', false, 'user1');

      const headers = mockRequest.mock.calls[0][0].headers;
      expect(headers.Authorization).toMatch(/^Basic /);
    });

    it('wraps errors with status and response data', async () => {
      const error: any = new Error('Request failed');
      error.response = { status: 500, data: 'Server error' };
      mockGet.mockResolvedValueOnce({
        data: '<ocs><data><id>user1</id></data></ocs>',
      });
      mockRequest.mockRejectedValueOnce(error);

      await expect(
        provider.listFiles('access-token', 'Documents'),
      ).rejects.toThrow('Nextcloud listFiles error: Server error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Nextcloud listFiles error',
        error,
        expect.objectContaining({
          url: 'https://cloud.example.com/remote.php/dav/files/user1/Documents/',
          status: 500,
          service: 'nextcloudProvider',
        }),
      );
    });
  });

  describe('getFileMetadata', () => {
    it('parses metadata from PROPFIND response', async () => {
      const xml = `
<d:multistatus xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
  <d:response>
    <d:href>/remote.php/dav/files/user1/file.txt</d:href>
    <d:propstat>
      <d:prop>
        <d:getcontentlength>456</d:getcontentlength>
        <d:getcontenttype>text/plain</d:getcontenttype>
        <d:getlastmodified>Wed, 01 Jan 2025 02:00:00 GMT</d:getlastmodified>
        <oc:fileid>file-id</oc:fileid>
      </d:prop>
    </d:propstat>
  </d:response>
</d:multistatus>`;

      mockGet.mockResolvedValueOnce({
        data: '<ocs><data><id>user1</id></data></ocs>',
      });
      mockRequest.mockResolvedValueOnce({ data: xml });

      const result = await provider.getFileMetadata('access-token', 'file.txt');

      expect(result.id).toBe('file-id');
      expect(result.name).toBe('file.txt');
      expect(result.path).toBe('file.txt');
      expect(result.size).toBe(456);
      expect(result.mimeType).toBe('text/plain');
    });

    it('wraps errors from PROPFIND', async () => {
      const error: any = new Error('Not found');
      error.response = { status: 404, data: 'Not found' };
      mockGet.mockResolvedValueOnce({
        data: '<ocs><data><id>user1</id></data></ocs>',
      });
      mockRequest.mockRejectedValueOnce(error);

      await expect(
        provider.getFileMetadata('access-token', 'file.txt'),
      ).rejects.toThrow('Nextcloud getFileMetadata error: Not found');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Nextcloud getFileMetadata error',
        error,
        expect.objectContaining({
          url: 'https://cloud.example.com/remote.php/dav/files/user1/file.txt/',
          status: 404,
          service: 'nextcloudProvider',
        }),
      );
    });
  });

  describe('getFileContent', () => {
    it('downloads file content with Bearer token', async () => {
      mockGet
        .mockResolvedValueOnce({
          data: '<ocs><data><id>user1</id></data></ocs>',
        })
        .mockResolvedValueOnce({
          data: new ArrayBuffer(4),
        });

      const buffer = await provider.getFileContent('access-token', 'file.txt');

      expect(Buffer.isBuffer(buffer)).toBe(true);
      const secondCall = mockGet.mock.calls[1][0];
      expect(secondCall).toBe('https://cloud.example.com/remote.php/dav/files/user1/file.txt');
    });

    it('throws friendly error when file too large', async () => {
      mockGet.mockResolvedValueOnce({
        data: '<ocs><data><id>user1</id></data></ocs>',
      });
      const error: any = new Error('maxContentLength exceeded');
      error.response = { status: 413 };
      mockGet.mockRejectedValueOnce(error);

      await expect(
        provider.getFileContent('access-token', 'big-file'),
      ).rejects.toThrow('File size exceeds 10MB limit');
    });

    it('throws specific error for self-signed certificate problems', async () => {
      mockGet.mockResolvedValueOnce({
        data: '<ocs><data><id>user1</id></data></ocs>',
      });
      const error: any = new Error('self-signed certificate');
      error.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
      mockGet.mockRejectedValueOnce(error);

      await expect(
        provider.getFileContent('access-token', 'file.txt'),
      ).rejects.toThrow('Self-signed certificate error - SSL verification failed');
    });

    it('wraps other errors with generic message', async () => {
      mockGet.mockResolvedValueOnce({
        data: '<ocs><data><id>user1</id></data></ocs>',
      });
      const error: any = new Error('Network failure');
      error.response = { status: 500, data: 'Server error' };
      mockGet.mockRejectedValueOnce(error);

      await expect(
        provider.getFileContent('access-token', 'file.txt'),
      ).rejects.toThrow('Nextcloud getFileContent error: Server error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Nextcloud getFileContent error',
        error,
        expect.objectContaining({
          url: 'https://cloud.example.com/remote.php/dav/files/user1/file.txt',
          status: 500,
          service: 'nextcloudProvider',
        }),
      );
    });
  });

  describe('testConnection', () => {
    it('returns true when listFiles succeeds', async () => {
      const spy = vi.spyOn(provider, 'listFiles').mockResolvedValueOnce([]);

      const result = await provider.testConnection('access-token', 'user1');

      expect(result).toBe(true);
      expect(spy).toHaveBeenCalled();
    });

    it('logs error and returns false when listFiles throws', async () => {
      const error = new Error('Connection failed');
      const spy = vi.spyOn(provider, 'listFiles').mockRejectedValueOnce(error);

      const result = await provider.testConnection('access-token', 'user1');

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Nextcloud connection test failed',
        error,
        expect.objectContaining({ service: 'nextcloudProvider' }),
      );
      expect(spy).toHaveBeenCalled();
    });
  });
});

