/**
 * Cloud Provider Factory
 * Creates provider instances based on provider type
 */

import { CloudProvider, CloudProviderConfig } from './types';
import { CloudProviderType } from './types';
import { NextcloudProvider } from './nextcloudProvider';
import { SSHProvider } from './sshProvider';

// Re-export CloudProviderType for convenience
export type { CloudProviderType };

export function createCloudProvider(
  providerType: CloudProviderType,
  config?: CloudProviderConfig
): CloudProvider {
  switch (providerType) {
    case 'nextcloud':
      return new NextcloudProvider(config);
    case 'ssh':
      return new SSHProvider(config);
    default:
      throw new Error(`Unknown cloud provider: ${providerType}`);
  }
}

export function getCloudProvider(
  providerType: CloudProviderType,
  config?: CloudProviderConfig
): CloudProvider {
  return createCloudProvider(providerType, config);
}
