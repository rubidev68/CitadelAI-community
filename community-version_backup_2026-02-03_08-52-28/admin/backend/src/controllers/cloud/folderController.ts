import { Response } from 'express';
import { logger } from '@shared/utils';
import { AdminAuthRequest } from '../../middleware/adminAuth';
import { getCloudIntegration } from '../../services/cloudIntegrationService';
import { getCloudAccessToken } from '../../services/cloudOAuthService';
import { createCloudProvider, CloudProviderType } from '../../services/cloudProviders/providerFactory';
import prisma from '../../lib/prisma';
import { config } from '../../config';

const cloudLogger = logger.child({ service: 'admin-backend', component: 'cloud-controller' });

interface FolderNode {
  path: string;
  name: string;
  children: FolderNode[];
}

/**
 * List folders from cloud storage up to 3 levels deep (for Nextcloud folder selection)
 */
export async function handleListFolderTree(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    const { blockId } = req.params;
    const { maxDepth = '3' } = req.query;
    const depthLimit = parseInt(maxDepth as string, 10);

    const block = await prisma.block.findUnique({
      where: { id: blockId },
      include: {
        chatbot: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!block) {
      res.status(404).json({ error: 'Block not found' });
      return;
    }

    // Verify ownership
    if (block.chatbot.ownerId !== req.adminUser?.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const properties = getCloudIntegration(block);
    const provider = properties.provider;

    if (!provider) {
      res.status(400).json({ error: 'Cloud provider not configured' });
      return;
    }

    // OneDrive temporarily disabled
    if (provider === 'onedrive') {
      res.status(400).json({ error: 'OneDrive integration is currently disabled. Please use Nextcloud or Google Drive instead.' });
      return;
    }

    if (!properties.isConnected) {
      res.status(400).json({ error: 'Cloud storage not connected' });
      return;
    }

    // Only support Nextcloud for now
    if (provider !== 'nextcloud') {
      res.status(400).json({ error: 'Folder tree endpoint only supports Nextcloud' });
      return;
    }

    // Get access token
    const authMethod = properties.authMethod || 'oauth';
    let accessToken: string;
    let username: string | undefined;

    if (authMethod === 'app_password') {
      accessToken = properties.accessToken as string | undefined || '';
      username = properties.username as string | undefined;
      
      if (!username || !accessToken) {
        res.status(400).json({ 
          error: 'Authentication not configured',
        });
        return;
      }
    } else {
      accessToken = await getCloudAccessToken(block);
    }

    // Create provider instance
    const providerConfig = {
      baseUrl: properties.baseUrl,
      clientId: properties.clientId,
      clientSecret: properties.clientSecret,
    };
    const providerInstance = createCloudProvider(provider, providerConfig);

    // Recursively build folder tree up to depthLimit
    const buildFolderTree = async (currentPath: string, currentDepth: number): Promise<FolderNode[]> => {
      if (currentDepth >= depthLimit) {
        return [];
      }

      try {
        const files = await providerInstance.listFiles(accessToken, currentPath, false, username);
        const folders = files.filter(file => file.type === 'folder');
        
        const folderNodes: FolderNode[] = [];
        
        for (const folder of folders) {
          const children = await buildFolderTree(folder.path, currentDepth + 1);
          folderNodes.push({
            path: folder.path,
            name: folder.name,
            children,
          });
        }
        
        return folderNodes;
      } catch (error) {
        cloudLogger.error('Error listing folder', { currentPath, error: error instanceof Error ? error : new Error(String(error)) });
        return [];
      }
    };

    const tree = await buildFolderTree('', 0);

    res.json({ tree });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    cloudLogger.error('Error listing folder tree', {
      blockId: req.params.blockId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    res.status(500).json({ error: errorMessage });
  }
}

/**
 * List folders from cloud storage
 */
export async function handleListFolders(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    const { blockId } = req.params;
    const { path = '' } = req.query;

    const block = await prisma.block.findUnique({
      where: { id: blockId },
      include: {
        chatbot: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!block) {
      res.status(404).json({ error: 'Block not found' });
      return;
    }

    // Verify ownership
    if (block.chatbot.ownerId !== req.adminUser?.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const properties = getCloudIntegration(block);
    const provider = properties.provider;

    if (!provider) {
      res.status(400).json({ error: 'Cloud provider not configured' });
      return;
    }

    // OneDrive temporarily disabled
    if (provider === 'onedrive') {
      res.status(400).json({ error: 'OneDrive integration is currently disabled. Please use Nextcloud or Google Drive instead.' });
      return;
    }

    if (!properties.isConnected) {
      res.status(400).json({ error: 'Cloud storage not connected' });
      return;
    }

    // Get access token
    const authMethod = properties.authMethod || 'oauth';
    let accessToken: string;
    let username: string | undefined;

    cloudLogger.debug('Folder listing - auth check', {
      authMethod,
      hasUsername: !!properties.username,
      hasAccessToken: !!properties.accessToken,
      username: properties.username,
      accessTokenLength: properties.accessToken?.length,
    });

    if (authMethod === 'app_password') {
      accessToken = properties.accessToken as string | undefined || '';
      username = properties.username as string | undefined;
      
      if (!username || !accessToken) {
        cloudLogger.error('App Password auth missing', {
          username: properties.username,
          accessToken: properties.accessToken ? 'present' : 'missing',
        });
        res.status(400).json({ 
          error: 'Authentication not configured',
          details: `Username: ${!!username}, AccessToken: ${!!accessToken}`,
        });
        return;
      }
    } else if (authMethod === 'ssh_key') {
      // SSH key-based authentication
      const encryptedPrivateKey = properties.accessToken as string | undefined;
      const encryptedPassphrase = properties.passphrase as string | undefined;
      const encryptedPassword = properties.password as string | undefined;
      
      if (!encryptedPrivateKey) {
        res.status(400).json({ error: 'SSH private key is required' });
        return;
      }
      
      // Decrypt SSH credentials
      const { decryptToken } = await import('../../services/cloudOAuthService');
      try {
        accessToken = decryptToken(encryptedPrivateKey);
        username = properties.username as string | undefined;
      } catch (decryptError) {
        cloudLogger.error('Failed to decrypt SSH private key', {
          error: decryptError instanceof Error ? decryptError : new Error(String(decryptError)),
        });
        res.status(400).json({ error: 'Failed to decrypt SSH private key' });
        return;
      }
    } else {
      accessToken = await getCloudAccessToken(block);
    }

    // Create provider instance
    const providerType = provider as CloudProviderType;
    let providerConfig;
    if (providerType === 'googledrive') {
      providerConfig = {
        clientId: config.GOOGLE_DRIVE_CLIENT_ID,
        clientSecret: config.GOOGLE_DRIVE_CLIENT_SECRET,
      };
    } else if (providerType === 'onedrive') {
      providerConfig = {
        clientId: config.ONEDRIVE_CLIENT_ID,
        clientSecret: config.ONEDRIVE_CLIENT_SECRET,
      };
    } else if (providerType === 'ssh') {
      // SSH provider configuration
      const encryptedPassphrase = properties.passphrase as string | undefined;
      const encryptedPassword = properties.password as string | undefined;
      const { decryptToken } = await import('../../services/cloudOAuthService');
      
      let passphrase: string | undefined;
      let password: string | undefined;
      
      if (encryptedPassphrase) {
        try {
          passphrase = decryptToken(encryptedPassphrase);
        } catch (decryptError) {
          cloudLogger.warn('Failed to decrypt SSH passphrase', {
            error: decryptError instanceof Error ? decryptError : new Error(String(decryptError)),
          });
        }
      }
      
      if (encryptedPassword) {
        try {
          password = decryptToken(encryptedPassword);
        } catch (decryptError) {
          cloudLogger.warn('Failed to decrypt SSH password', {
            error: decryptError instanceof Error ? decryptError : new Error(String(decryptError)),
          });
        }
      }
      
      // Validate required SSH properties
      if (!properties.host) {
        res.status(400).json({ error: 'SSH host is required. Please configure the SSH connection first.' });
        return;
      }
      
      providerConfig = {
        host: properties.host,
        port: properties.port || 22,
        username: username || properties.username, // Use username from auth or properties
        privateKey: accessToken, // Already decrypted above
        passphrase: passphrase,
        password: password,
        basePath: properties.basePath || '/',
      };
    } else {
      providerConfig = {
        baseUrl: properties.baseUrl,
        clientId: properties.clientId,
        clientSecret: properties.clientSecret,
      };
    }
    const providerInstance = createCloudProvider(providerType, providerConfig);

    // For Google Drive and OneDrive, use folderId instead of path
    const folderId = (providerType === 'googledrive' || providerType === 'onedrive') ? (path as string || 'root') : (path as string);
    
    // List folders (non-recursive)
    const skipPathBuilding = providerType === 'googledrive' || providerType === 'onedrive';
    const files = await providerInstance.listFiles(accessToken, folderId, false, username, skipPathBuilding);
    
    // Filter to only folders and map to response format
    const folders = files
      .filter(file => file.type === 'folder')
      .map(f => {
        const folderPath = (providerType === 'googledrive' || providerType === 'onedrive') ? f.id : f.path;
        const name = (providerType === 'googledrive' || providerType === 'onedrive') ? f.name : (() => {
          const pathParts = f.path.split('/').filter(p => p);
          return pathParts.length > 0 ? pathParts[pathParts.length - 1] : 'Root';
        })();
        return {
          path: folderPath,
          name: name,
          id: f.id,
        };
      });

    cloudLogger.debug('Listed folders', {
      requestedPath: path,
      foundFolders: folders.length,
    });

    res.json({ folders });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    cloudLogger.error('Error listing folders', {
      blockId: req.params.blockId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    res.status(500).json({ error: errorMessage });
  }
}

/**
 * List shared folders from Google Drive
 */
export async function handleListSharedFolders(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    const { blockId } = req.params;

    const block = await prisma.block.findUnique({
      where: { id: blockId },
      include: {
        chatbot: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!block) {
      res.status(404).json({ error: 'Block not found' });
      return;
    }

    // Verify ownership
    if (block.chatbot.ownerId !== req.adminUser?.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const properties = getCloudIntegration(block);
    const provider = properties.provider;

    if (!provider || (provider !== 'googledrive' && provider !== 'onedrive')) {
      res.status(400).json({ error: 'Shared folders only supported for Google Drive and OneDrive' });
      return;
    }

    if (!properties.isConnected) {
      res.status(400).json({ error: 'Cloud storage not connected' });
      return;
    }

    // Get access token
    const authMethod = properties.authMethod || 'oauth';
    let accessToken: string;

    if (authMethod === 'app_password') {
      res.status(400).json({ error: 'Shared folders not supported with App Password auth' });
      return;
    } else {
      accessToken = await getCloudAccessToken(block);
    }

    // Create provider instance
    const providerConfig = {
      clientId: config.GOOGLE_DRIVE_CLIENT_ID,
      clientSecret: config.GOOGLE_DRIVE_CLIENT_SECRET,
    };
    const providerInstance = createCloudProvider(provider, providerConfig);

    // List shared folders (only Google Drive supports this)
    const sharedFolders = provider === 'googledrive' && 'listSharedFolders' in providerInstance
      ? await (providerInstance as { listSharedFolders: (token: string) => Promise<Array<{ id: string; name: string; path: string }>> }).listSharedFolders(accessToken)
      : [];
    
    const folders = sharedFolders.map((f: { id: string; name: string; path: string }) => ({
      id: f.id,
      name: f.name,
      path: f.id,
    }));

    res.json({ folders });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    cloudLogger.error('Error listing shared folders', {
      blockId: req.params.blockId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    res.status(500).json({ error: errorMessage });
  }
}

/**
 * List files and folders from cloud storage (for picker)
 */
export async function handleListFiles(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    const { blockId } = req.params;
    const { folderId, path } = req.query;

    const block = await prisma.block.findUnique({
      where: { id: blockId },
      include: {
        chatbot: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!block) {
      res.status(404).json({ error: 'Block not found' });
      return;
    }

    // Verify ownership
    if (block.chatbot.ownerId !== req.adminUser?.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const properties = getCloudIntegration(block);
    const provider = properties.provider;

    if (!provider) {
      res.status(400).json({ error: 'Cloud provider not configured' });
      return;
    }

    // OneDrive temporarily disabled
    if (provider === 'onedrive') {
      res.status(400).json({ error: 'OneDrive integration is currently disabled. Please use Nextcloud or Google Drive instead.' });
      return;
    }

    if (!properties.isConnected) {
      res.status(400).json({ error: 'Cloud storage not connected' });
      return;
    }

    // Get access token
    const authMethod = properties.authMethod || 'oauth';
    let accessToken: string;
    let username: string | undefined;

    if (authMethod === 'app_password') {
      accessToken = properties.accessToken as string | undefined || '';
      username = properties.username as string | undefined;
      
      if (!username || !accessToken) {
        res.status(400).json({ 
          error: 'Authentication not configured',
        });
        return;
      }
    } else if (authMethod === 'ssh_key') {
      // SSH key-based authentication
      const encryptedPrivateKey = properties.accessToken as string | undefined;
      const encryptedPassphrase = properties.passphrase as string | undefined;
      const encryptedPassword = properties.password as string | undefined;
      
      if (!encryptedPrivateKey) {
        res.status(400).json({ error: 'SSH private key is required' });
        return;
      }
      
      // Decrypt SSH credentials
      const { decryptToken } = await import('../../services/cloudOAuthService');
      try {
        accessToken = decryptToken(encryptedPrivateKey);
        username = properties.username as string | undefined;
      } catch (decryptError) {
        cloudLogger.error('Failed to decrypt SSH private key', {
          error: decryptError instanceof Error ? decryptError : new Error(String(decryptError)),
        });
        res.status(400).json({ error: 'Failed to decrypt SSH private key' });
        return;
      }
    } else {
      accessToken = await getCloudAccessToken(block);
    }

    // Create provider instance
    const providerType = provider as CloudProviderType;
    let providerConfig;
    if (providerType === 'googledrive') {
      providerConfig = {
        clientId: config.GOOGLE_DRIVE_CLIENT_ID,
        clientSecret: config.GOOGLE_DRIVE_CLIENT_SECRET,
      };
    } else if (providerType === 'onedrive') {
      providerConfig = {
        clientId: config.ONEDRIVE_CLIENT_ID,
        clientSecret: config.ONEDRIVE_CLIENT_SECRET,
      };
    } else if (providerType === 'ssh') {
      // SSH provider configuration
      const encryptedPassphrase = properties.passphrase as string | undefined;
      const encryptedPassword = properties.password as string | undefined;
      const { decryptToken } = await import('../../services/cloudOAuthService');
      
      let passphrase: string | undefined;
      let password: string | undefined;
      
      if (encryptedPassphrase) {
        try {
          passphrase = decryptToken(encryptedPassphrase);
        } catch (decryptError) {
          cloudLogger.warn('Failed to decrypt SSH passphrase', {
            error: decryptError instanceof Error ? decryptError : new Error(String(decryptError)),
          });
        }
      }
      
      if (encryptedPassword) {
        try {
          password = decryptToken(encryptedPassword);
        } catch (decryptError) {
          cloudLogger.warn('Failed to decrypt SSH password', {
            error: decryptError instanceof Error ? decryptError : new Error(String(decryptError)),
          });
        }
      }
      
      // Validate required SSH properties first
      if (!properties.host) {
        cloudLogger.error('SSH host missing in properties', {
          blockId,
          propertiesKeys: Object.keys(properties),
          hasHost: !!properties.host,
          provider: properties.provider,
        });
        res.status(400).json({ 
          error: 'SSH host is required. Please configure the SSH connection first.',
          details: 'The SSH host was not found in the block properties. Please reconnect to SSH.',
        });
        return;
      }
      
      providerConfig = {
        host: properties.host,
        port: properties.port || 22,
        username: username || properties.username, // Use username from auth or properties
        privateKey: accessToken, // Already decrypted above
        passphrase: passphrase,
        password: password,
        basePath: properties.basePath || '/',
      };
    } else {
      providerConfig = {
        baseUrl: properties.baseUrl,
        clientId: properties.clientId,
        clientSecret: properties.clientSecret,
      };
    }
    const providerInstance = createCloudProvider(providerType, providerConfig);

    // For Google Drive and OneDrive, use folderId; for Nextcloud, use path
    const folderIdentifier = (providerType === 'googledrive' || providerType === 'onedrive')
      ? (folderId as string || 'root')
      : (path as string || '');

    // List files and folders (non-recursive)
    const skipPathBuilding = providerType === 'googledrive' || providerType === 'onedrive';
    const items = await providerInstance.listFiles(accessToken, folderIdentifier, false, username, skipPathBuilding);
    
    // Separate folders and files
    const folders = items
      .filter(item => item.type === 'folder')
      .map(f => ({
        id: f.id,
        name: f.name,
        path: (providerType === 'googledrive' || providerType === 'onedrive') ? f.id : f.path,
      }));

    const files = items
      .filter(item => item.type === 'file')
      .map(f => ({
        id: f.id,
        name: f.name,
        path: (providerType === 'googledrive' || providerType === 'onedrive') ? f.id : f.path,
        mimeType: f.mimeType,
        size: f.size,
      }));

    res.json({ folders, files });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    cloudLogger.error('Error listing files', {
      blockId: req.params.blockId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    res.status(500).json({ error: errorMessage });
  }
}
