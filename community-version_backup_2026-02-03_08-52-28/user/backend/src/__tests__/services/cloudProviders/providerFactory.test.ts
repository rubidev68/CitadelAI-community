import { describe, it, expect } from 'vitest';
import {
  createCloudProvider,
  getCloudProvider,
} from '../../../services/cloudProviders/providerFactory';
import { NextcloudProvider } from '../../../services/cloudProviders/nextcloudProvider';
import { GoogleDriveProvider } from '../../../services/cloudProviders/googleDriveProvider';
import { CloudProviderConfig } from '../../../services/cloudProviders/types';

describe('cloudProviders/providerFactory', () => {
  describe('createCloudProvider', () => {
    it('should return NextcloudProvider for nextcloud', () => {
      const config: CloudProviderConfig = {
        baseUrl: 'https://nextcloud.example.com',
      };
      const provider = createCloudProvider('nextcloud', config);
      expect(provider).toBeInstanceOf(NextcloudProvider);
      expect(provider.getProviderId()).toBe('nextcloud');
      expect(provider.getProviderName()).toBe('Nextcloud');
    });

    it('should return NextcloudProvider for nextcloud without config', () => {
      const provider = createCloudProvider('nextcloud');
      expect(provider).toBeInstanceOf(NextcloudProvider);
      expect(provider.getProviderId()).toBe('nextcloud');
    });

    it('should return GoogleDriveProvider for googledrive', () => {
      const config: CloudProviderConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      };
      const provider = createCloudProvider('googledrive', config);
      expect(provider).toBeInstanceOf(GoogleDriveProvider);
      expect(provider.getProviderId()).toBe('googledrive');
      expect(provider.getProviderName()).toBe('Google Drive');
    });

    it('should return GoogleDriveProvider for googledrive without config', () => {
      const provider = createCloudProvider('googledrive');
      expect(provider).toBeInstanceOf(GoogleDriveProvider);
      expect(provider.getProviderId()).toBe('googledrive');
    });

    it('should throw error for onedrive (not implemented)', () => {
      expect(() => {
        createCloudProvider('onedrive');
      }).toThrow('OneDrive provider not yet implemented');
    });

    it('should throw error for unknown provider', () => {
      expect(() => {
        createCloudProvider('unknown_provider' as any);
      }).toThrow('Unknown cloud provider: unknown_provider');
    });
  });

  describe('getCloudProvider', () => {
    it('should return provider instance (alias for createCloudProvider)', () => {
      const provider = getCloudProvider('nextcloud');
      expect(provider).toBeInstanceOf(NextcloudProvider);
      expect(provider.getProviderId()).toBe('nextcloud');
    });

    it('should pass config to provider', () => {
      const config: CloudProviderConfig = {
        baseUrl: 'https://custom.nextcloud.com',
        clientId: 'test-id',
      };
      const provider = getCloudProvider('nextcloud', config);
      expect(provider).toBeInstanceOf(NextcloudProvider);
    });

    it('should throw error for unsupported providers', () => {
      expect(() => {
        getCloudProvider('onedrive');
      }).toThrow('OneDrive provider not yet implemented');
    });
  });
});
