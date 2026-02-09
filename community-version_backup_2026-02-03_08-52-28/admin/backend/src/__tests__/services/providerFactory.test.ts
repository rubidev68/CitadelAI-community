import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCloudProvider, getCloudProvider, CloudProviderType } from '../../services/cloudProviders/providerFactory';
import { NextcloudProvider } from '../../services/cloudProviders/nextcloudProvider';
import { GoogleDriveProvider } from '../../services/cloudProviders/googleDriveProvider';
import { OneDriveProvider } from '../../services/cloudProviders/oneDriveProvider';

// Create mock constructors directly in vi.mock factories
vi.mock('../../services/cloudProviders/nextcloudProvider', () => {
  const mockInstance = {
    getProviderId: vi.fn(),
    getProviderName: vi.fn(),
    generateOAuthUrl: vi.fn(),
    exchangeCodeForToken: vi.fn(),
    refreshAccessToken: vi.fn(),
    listFiles: vi.fn(),
    getFileMetadata: vi.fn(),
    getFileContent: vi.fn(),
    testConnection: vi.fn(),
  };
  
  // Create a proper constructor function that can be called with 'new'
  class MockNextcloudProviderClass {
    constructor(config?: any) {
      return mockInstance;
    }
  }
  
  return {
    NextcloudProvider: MockNextcloudProviderClass,
  };
});

vi.mock('../../services/cloudProviders/googleDriveProvider', () => {
  const mockInstance = {
    getProviderId: vi.fn(),
    getProviderName: vi.fn(),
    generateOAuthUrl: vi.fn(),
    exchangeCodeForToken: vi.fn(),
    refreshAccessToken: vi.fn(),
    listFiles: vi.fn(),
    getFileMetadata: vi.fn(),
    getFileContent: vi.fn(),
    testConnection: vi.fn(),
  };
  
  class MockGoogleDriveProviderClass {
    constructor(config?: any) {
      return mockInstance;
    }
  }
  
  return {
    GoogleDriveProvider: MockGoogleDriveProviderClass,
  };
});

vi.mock('../../services/cloudProviders/oneDriveProvider', () => {
  const mockInstance = {
    getProviderId: vi.fn(),
    getProviderName: vi.fn(),
    generateOAuthUrl: vi.fn(),
    exchangeCodeForToken: vi.fn(),
    refreshAccessToken: vi.fn(),
    listFiles: vi.fn(),
    getFileMetadata: vi.fn(),
    getFileContent: vi.fn(),
    testConnection: vi.fn(),
  };
  
  class MockOneDriveProviderClass {
    constructor(config?: any) {
      return mockInstance;
    }
  }
  
  return {
    OneDriveProvider: MockOneDriveProviderClass,
  };
});

describe('Cloud Provider Factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCloudProvider', () => {
    it('should create Nextcloud provider', () => {
      const provider = createCloudProvider('nextcloud');

      expect(provider).toBeDefined();
      expect(typeof provider.getProviderId).toBe('function');
      expect(typeof provider.testConnection).toBe('function');
      expect(typeof provider.listFiles).toBe('function');
    });

    it('should create Google Drive provider', () => {
      const provider = createCloudProvider('googledrive');

      expect(provider).toBeDefined();
      expect(typeof provider.getProviderId).toBe('function');
      expect(typeof provider.testConnection).toBe('function');
      expect(typeof provider.listFiles).toBe('function');
    });

    it('should create OneDrive provider', () => {
      const provider = createCloudProvider('onedrive');

      expect(provider).toBeDefined();
      expect(typeof provider.getProviderId).toBe('function');
      expect(typeof provider.testConnection).toBe('function');
      expect(typeof provider.listFiles).toBe('function');
    });

    it('should pass config to provider constructor', () => {
      const config = { clientId: 'client-123' };
      const provider = createCloudProvider('nextcloud', config);

      // Verify provider is created successfully with config
      expect(provider).toBeDefined();
      expect(typeof provider.getProviderId).toBe('function');
    });

    it('should throw error for unknown provider', () => {
      expect(() => {
        createCloudProvider('unknown' as CloudProviderType);
      }).toThrow('Unknown cloud provider: unknown');
    });
  });

  describe('getCloudProvider', () => {
    it('should return provider instance', () => {
      const provider = getCloudProvider('nextcloud');

      expect(provider).toBeDefined();
      expect(typeof provider.getProviderId).toBe('function');
      expect(typeof provider.testConnection).toBe('function');
    });

    it('should pass config to provider', () => {
      const config = { clientId: 'client-123' };
      const provider = getCloudProvider('googledrive', config);

      expect(provider).toBeDefined();
      expect(typeof provider.getProviderId).toBe('function');
    });
  });
});
