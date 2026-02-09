import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useBlockEditor } from '@/contexts/BlockEditorContext';
import { useToast } from '@/hooks/use-toast';
import { Block } from '@/types/block';
import { adminApiClient } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Cloud, CheckCircle2, XCircle, AlertCircle, ExternalLink, RefreshCw, Loader2, Folder, X, File } from 'lucide-react';
import {
  startCloudOAuth,
  getCloudIntegration,
  updateCloudIntegration,
  testCloudConnection,
  disconnectCloudIntegration,
  triggerCloudIndexing,
  cancelCloudIndexing,
  CloudIntegration,
} from '@/lib/api';
import NextcloudFolderPicker from './NextcloudFolderPicker';
import SSHFolderPicker from './SSHFolderPicker';
import CronFrequencySelector from '@/components/ui/CronFrequencySelector';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CloudBlockPropertiesProps {
  block: Block;
}

interface CloudBlockProperties {
  provider?: 'nextcloud' | 'googledrive' | 'onedrive' | 'ssh';
  // Authentication method
  authMethod?: 'oauth' | 'app_password' | 'ssh_key'; // OAuth, App Password, or SSH Key
  // OAuth credentials (encrypted, stored in backend)
  accessToken?: string; // Encrypted token (OAuth) or App Password (not encrypted)
  refreshToken?: string; // Encrypted refresh token
  tokenExpiresAt?: string; // ISO date string
  // Provider-specific config
  baseUrl?: string; // For Nextcloud: server URL
  clientId?: string; // OAuth Client ID (not encrypted, stored in block properties)
  clientSecret?: string; // OAuth Client Secret (not encrypted, stored in block properties)
  username?: string; // For App Password: Nextcloud username; For SSH: SSH username
  accountId?: string; // Provider account/user ID
  // SSH-specific fields
  host?: string; // SSH hostname/IP
  port?: number; // SSH port (default: 22)
  privateKey?: string; // SSH private key (encrypted) - stored in accessToken, but kept here for clarity
  passphrase?: string; // SSH key passphrase (encrypted, optional)
  password?: string; // SSH password (encrypted, optional - for key+password authentication)
  basePath?: string; // Base path on remote server (default: /)
  // Indexing configuration
  selectedPaths?: string[]; // Array of folder paths to index (Nextcloud) or IDs (Google Drive)
  selectedItems?: Array<{ id: string; name: string; type: 'folder' | 'file' }>; // For Google Drive: store IDs with names for display
  fileTypeFilters?: string[]; // Array of allowed file extensions (e.g., ['pdf', 'docx'])
  autoRefresh?: boolean;
  // Scheduled crawling (similar to WebsiteContext)
  cronEnabled?: boolean;
  cronSchedule?: string;
  cronTimezone?: string;
  nextCrawlAt?: string;
  // Indexing status
  lastIndexedAt?: string; // ISO date string
  indexedFileCount?: number;
  filesDiscovered?: number; // Number of files discovered during listing (for progress tracking)
  indexingStatus?: 'idle' | 'indexing' | 'completed' | 'error';
  indexingError?: string;
  // Connection status
  isConnected?: boolean;
  connectedAt?: string; // ISO date string
}

const CloudBlockProperties: React.FC<CloudBlockPropertiesProps> = ({ block }) => {
  const { id: chatbotId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token } = useAuth();
  const { updateBlock } = useBlockEditor();
  const { toast } = useToast();

  // Get API base URL from current location
  const getApiBaseUrl = () => {
    if (typeof window === 'undefined') return 'https://api.citadelai.app';
    const protocol = window.location.protocol;
    const host = window.location.host;
    const apiHost = host.includes('admin.') ? host.replace('admin.', 'api.') : host;
    return `${protocol}//${apiHost}`;
  };

  const apiBaseUrl = getApiBaseUrl();

  const properties = (block.properties || {}) as CloudBlockProperties;

  const [provider, setProvider] = useState<CloudBlockProperties['provider']>(
    properties.provider || undefined
  );
  const [baseUrl, setBaseUrl] = useState<string>(properties.baseUrl || '');
  const [authMethod, setAuthMethod] = useState<'oauth' | 'app_password'>(
    (properties.authMethod as 'oauth' | 'app_password') || 'app_password'
  );
  const [clientId, setClientId] = useState<string>(properties.clientId || '');
  const [clientSecret, setClientSecret] = useState<string>(properties.clientSecret || '');
  const [username, setUsername] = useState<string>(properties.username || '');
  const [appPassword, setAppPassword] = useState<string>(''); // Not stored in properties until saved
  // SSH-specific state
  const [sshHost, setSSHHost] = useState<string>(properties.host || '');
  const [sshPort, setSSHPort] = useState<number>(properties.port || 22);
  const [sshUsername, setSSHUsername] = useState<string>(properties.username || '');
  const [privateKey, setPrivateKey] = useState<string>(''); // Not stored until saved (will be encrypted)
  const [sshPassphrase, setSSHPassphrase] = useState<string>(''); // Not stored until saved (will be encrypted)
  const [sshPassword, setSSHPassword] = useState<string>(''); // Not stored until saved (will be encrypted) - for key+password auth
  const [basePath, setBasePath] = useState<string>(properties.basePath || '/');
  const [isConnected, setIsConnected] = useState<boolean>(properties.isConnected || false);
  
  // Update state when properties change (e.g., after loading integration)
  useEffect(() => {
    if (properties.clientId !== undefined) {
      setClientId(properties.clientId);
    }
    if (properties.clientSecret !== undefined) {
      setClientSecret(properties.clientSecret);
    }
    if (properties.baseUrl !== undefined) {
      setBaseUrl(properties.baseUrl);
    }
    if (properties.provider !== undefined) {
      setProvider(properties.provider);
    }
    if (properties.isConnected !== undefined) {
      setIsConnected(properties.isConnected);
    }
  }, [properties.clientId, properties.clientSecret, properties.baseUrl, properties.provider, properties.isConnected]);
  const [indexingStatus, setIndexingStatus] = useState<CloudBlockProperties['indexingStatus']>(
    properties.indexingStatus || 'idle'
  );
  const [indexedFileCount, setIndexedFileCount] = useState<number>(
    properties.indexedFileCount || 0
  );
  const [filesDiscovered, setFilesDiscovered] = useState<number>(
    properties.filesDiscovered || 0
  );
  const [lastIndexedAt, setLastIndexedAt] = useState<string | undefined>(
    properties.lastIndexedAt
  );
  const [autoRefresh, setAutoRefresh] = useState<boolean>(properties.autoRefresh || false);
  const [cronSchedule, setCronSchedule] = useState<string>(properties.cronSchedule || '0 0 * * *');
  const [cronTimezone, setCronTimezone] = useState<string>(properties.cronTimezone || 'UTC');
  const [selectedPaths, setSelectedPaths] = useState<string[]>(
    (properties.selectedPaths && Array.isArray(properties.selectedPaths)) ? properties.selectedPaths : []
  );
  const [selectedItems, setSelectedItems] = useState<Array<{ id: string; name: string; type: 'folder' | 'file' }>>(
    (properties.selectedItems && Array.isArray(properties.selectedItems)) ? properties.selectedItems : []
  );
  const [connecting, setConnecting] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [loadingIntegration, setLoadingIntegration] = useState(true);
  const [googleDrivePickerOpen, setGoogleDrivePickerOpen] = useState(false);
  const [oneDrivePickerOpen, setOneDrivePickerOpen] = useState(false);
  const [nextcloudFolderPickerOpen, setNextcloudFolderPickerOpen] = useState(false);
  const [sshFolderPickerOpen, setSSHFolderPickerOpen] = useState(false);
  const [shouldStartIndexingAfterSelection, setShouldStartIndexingAfterSelection] = useState(false);

  // Update block properties when state changes
  const updateProperties = (updates: Partial<CloudBlockProperties>) => {
    updateBlock(block.id, {
      properties: {
        ...properties,
        ...updates,
      },
    });
  };

  // Handle provider selection
  const handleProviderChange = (newProvider: CloudBlockProperties['provider']) => {
    setProvider(newProvider);
    updateProperties({ provider: newProvider });
    // Reset connection when provider changes
    setIsConnected(false);
    updateProperties({ isConnected: false });
  };

  // Load integration on mount
  useEffect(() => {
    if (chatbotId && token && block.id) {
      loadIntegration();
    }
  }, [chatbotId, token, block.id]);

  const loadIntegration = async () => {
    if (!chatbotId || !token || !block.id) return;
    try {
      setLoadingIntegration(true);
      const response = await getCloudIntegration(block.id, token);
      const integration = response.integration;
      
      if (integration.provider) {
        setProvider(integration.provider);
      }
      if (integration.baseUrl) {
        setBaseUrl(integration.baseUrl);
      }
      if (integration.provider) {
        setProvider(integration.provider);
      }
      if (properties.authMethod) {
        setAuthMethod(properties.authMethod as 'oauth' | 'app_password');
      }
      if (integration.clientId) {
        setClientId(integration.clientId);
      }
      // Note: clientSecret is not returned from API for security
      if (properties.clientSecret) {
        setClientSecret(properties.clientSecret);
      }
      if (properties.username) {
        setUsername(properties.username);
      }
      // Note: appPassword is not returned from API for security
      setIsConnected(integration.isConnected || false);
      setIndexingStatus(integration.indexingStatus || 'idle');
      setIndexedFileCount(integration.indexedFileCount || 0);
      setFilesDiscovered(integration.filesDiscovered || 0);
      setLastIndexedAt(integration.lastIndexedAt);
      setAutoRefresh(integration.autoRefresh || false);
      setCronSchedule(integration.cronSchedule || '0 0 * * *');
      setCronTimezone(integration.cronTimezone || 'UTC');
      // Preserve selectedPaths from database, or use empty array if not set
      // Don't default to [''] - let user explicitly select folders
      setSelectedPaths(
        (integration.selectedPaths && Array.isArray(integration.selectedPaths)) 
          ? integration.selectedPaths 
          : []
      );
      setSelectedItems(
        (integration.selectedItems && Array.isArray(integration.selectedItems))
          ? integration.selectedItems
          : []
      );
    } catch (error) {
      console.error('Error loading cloud integration:', error);
    } finally {
      setLoadingIntegration(false);
    }
  };

  // Handle connection (OAuth or App Password)
  const handleConnect = async () => {
    if (!provider) {
      toast({
        title: 'Error',
        description: 'Please select a cloud provider first.',
        variant: 'destructive',
      });
      return;
    }

    if (provider === 'googledrive' || provider === 'onedrive') {
      // Google Drive and OneDrive: Simple OAuth flow with global credentials
      // Ensure provider is saved to block properties first
      await updateCloudIntegration(
        block.id,
        { provider: provider },
        token || ''
      );
      
      setConnecting(true);
      try {
        const response = await startCloudOAuth(provider, chatbotId || '', block.id, token || '');
        
        // Open OAuth URL in new popup window
        const popup = window.open(response.oauthUrl, '_blank', 'width=600,height=700');
        
        if (!popup) {
          throw new Error('Popup blocked. Please allow popups for this site.');
        }
        
        // Listen for message from callback page
        const handleMessage = (event: MessageEvent) => {
          // Verify origin for security
          const frontendUrl = window.location.origin;
          if (event.origin !== frontendUrl) {
            return;
          }
          
          if (event.data.type === 'cloud_oauth_success') {
            window.removeEventListener('message', handleMessage);
            popup.close();
            setIsConnected(true);
            updateProperties({
              isConnected: true,
              connectedAt: new Date().toISOString(),
            });
            toast({
              title: 'Connected',
              description: 'Successfully connected to Google Drive.',
            });
            
            // Start indexing automatically after successful connection
            triggerCloudIndexing(block.id, token || '').catch((indexError) => {
              console.error('Error starting automatic indexing:', indexError);
            });
            
            setConnecting(false);
          } else if (event.data.type === 'cloud_oauth_error') {
            window.removeEventListener('message', handleMessage);
            popup.close();
            toast({
              title: 'Connection Failed',
              description: event.data.error || 'Failed to connect to Google Drive.',
              variant: 'destructive',
            });
            setConnecting(false);
          }
        };
        
        window.addEventListener('message', handleMessage);
        
        // Poll for popup closure (fallback)
        const checkPopupClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkPopupClosed);
            window.removeEventListener('message', handleMessage);
            setConnecting(false);
          }
        }, 500);
        
        // Timeout after 5 minutes
        setTimeout(() => {
          if (!popup.closed) {
            popup.close();
            window.removeEventListener('message', handleMessage);
            clearInterval(checkPopupClosed);
            toast({
              title: 'Connection Timeout',
              description: 'OAuth flow timed out. Please try again.',
              variant: 'destructive',
            });
            setConnecting(false);
          }
        }, 5 * 60 * 1000);
      } catch (error: unknown) {
        console.error('Error connecting:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to connect to Google Drive.';
        toast({
          title: 'Connection Failed',
          description: errorMessage,
          variant: 'destructive',
        });
        setConnecting(false);
      }
    } else if (provider === 'ssh') {
      // SSH connection flow
      if (!sshHost.trim()) {
        toast({
          title: 'Error',
          description: 'Please enter the SSH host.',
          variant: 'destructive',
        });
        return;
      }

      if (!sshUsername.trim()) {
        toast({
          title: 'Error',
          description: 'Please enter the SSH username.',
          variant: 'destructive',
        });
        return;
      }

      if (!privateKey.trim()) {
        toast({
          title: 'Error',
          description: 'Please enter your SSH private key.',
          variant: 'destructive',
        });
        return;
      }

      // Save configuration and test connection
      setConnecting(true);
      try {
        // Encrypt the private key and passphrase before storing
        // The backend will handle encryption via updateCloudIntegration
        await updateCloudIntegration(
          block.id,
          {
            provider: 'ssh',
            authMethod: 'ssh_key',
            host: sshHost.trim(),
            port: sshPort || 22,
            username: sshUsername.trim(),
            basePath: basePath || '/',
            // Private key and passphrase will be encrypted by backend
            accessToken: privateKey, // Backend will encrypt this
            passphrase: sshPassphrase || undefined, // Backend will encrypt this if provided
            password: sshPassword || undefined, // Backend will encrypt this if provided (for key+password auth)
          },
          token || ''
        );

        // Test connection
        const testResult = await testCloudConnection(block.id, token || '');
        if (testResult.connected) {
          setIsConnected(true);
          updateProperties({
            isConnected: true,
            connectedAt: new Date().toISOString(),
          });
          toast({
            title: 'Connected',
            description: 'Successfully connected to SSH server.',
          });
          
          // Clear sensitive fields from local state after successful connection
          setPrivateKey('');
          setSSHPassphrase('');
          setSSHPassword('');
        } else {
          throw new Error('Connection test failed');
        }
      } catch (error: unknown) {
        console.error('Error connecting:', error);
        let errorMessage = 'Failed to connect to SSH server.';
        
        // Try to extract error message from response
        if (error && typeof error === 'object' && 'response' in error) {
          const apiError = error as { response?: { data?: { error?: string; details?: string } } };
          if (apiError.response?.data?.error) {
            errorMessage = apiError.response.data.error;
          } else if (apiError.response?.data?.details) {
            errorMessage = apiError.response.data.details;
          }
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        toast({
          title: 'Connection Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      } finally {
        setConnecting(false);
      }
    } else if (provider === 'nextcloud') {
      if (!baseUrl.trim()) {
        toast({
          title: 'Error',
          description: 'Please enter your Nextcloud server URL.',
          variant: 'destructive',
        });
        return;
      }

      if (authMethod === 'app_password') {
        // App Password flow - direct connection
        if (!username.trim() || !appPassword.trim()) {
          toast({
            title: 'Error',
            description: 'Please enter your Nextcloud username and App Password.',
            variant: 'destructive',
          });
          return;
        }

        // Save configuration and test connection
        setConnecting(true);
        try {
          await updateCloudIntegration(
            block.id,
            {
              provider,
              baseUrl,
              authMethod: 'app_password',
              username,
              accessToken: appPassword, // Store app password as accessToken (not encrypted for app passwords)
            },
            token || ''
          );

          // Test connection
          const testResult = await testCloudConnection(block.id, token || '');
          if (testResult.connected) {
            setIsConnected(true);
            updateProperties({
              isConnected: true,
              connectedAt: new Date().toISOString(),
            });
            toast({
              title: 'Connected',
              description: 'Successfully connected to Nextcloud using App Password.',
            });
            
            // For Nextcloud, don't start indexing automatically - user needs to select folders first
            // For other providers, indexing can start automatically if needed
          } else {
            throw new Error('Connection test failed');
          }
        } catch (error: unknown) {
          console.error('Error connecting:', error);
          let errorMessage = 'Failed to connect to Nextcloud.';
          
          // Try to extract error message from response
          if (error && typeof error === 'object' && 'response' in error) {
            const apiError = error as { response?: { data?: { error?: string; details?: string } } };
            if (apiError.response?.data?.error) {
              errorMessage = apiError.response.data.error;
            } else if (apiError.response?.data?.details) {
              errorMessage = apiError.response.data.details;
            }
          } else if (error instanceof Error) {
            errorMessage = error.message;
          }
          
          toast({
            title: 'Connection Failed',
            description: errorMessage,
            variant: 'destructive',
          });
        } finally {
          setConnecting(false);
        }
      } else {
        // OAuth flow
        if (!clientId.trim() || !clientSecret.trim()) {
          toast({
            title: 'Error',
            description: 'Please enter your OAuth Client ID and Client Secret. See the setup guide for help.',
            variant: 'destructive',
          });
          return;
        }

        // Save configuration first
        await updateCloudIntegration(
          block.id,
          { provider, baseUrl, authMethod: 'oauth', clientId, clientSecret },
          token || ''
        );

        setConnecting(true);
        try {
          const response = await startCloudOAuth(provider, chatbotId || '', block.id, token || '');
          
          // Open OAuth URL in new popup window
          const popup = window.open(response.oauthUrl, '_blank', 'width=600,height=700');
          
          if (!popup) {
            throw new Error('Popup blocked. Please allow popups for this site.');
          }
          
          // Listen for message from callback page
          const handleMessage = (event: MessageEvent) => {
            // Verify origin for security
            const frontendUrl = window.location.origin;
            if (event.origin !== frontendUrl) {
              return;
            }
            
            if (event.data.type === 'cloud_oauth_success') {
              window.removeEventListener('message', handleMessage);
              popup.close();
              setIsConnected(true);
              updateProperties({
                isConnected: true,
                connectedAt: new Date().toISOString(),
              });
              toast({
                title: 'Connected',
                description: 'Successfully connected to Nextcloud using OAuth.',
              });
              
              // For Nextcloud, don't start indexing automatically - user needs to select folders first
              // User will click "Index Now" button which will show the folder selection modal
              
              setConnecting(false);
            } else if (event.data.type === 'cloud_oauth_error') {
              window.removeEventListener('message', handleMessage);
              popup.close();
              toast({
                title: 'Connection Failed',
                description: event.data.error || 'Failed to connect to cloud storage.',
                variant: 'destructive',
              });
              setConnecting(false);
            }
          };
          
          window.addEventListener('message', handleMessage);
          
          // Poll for popup closure (fallback)
          const checkPopupClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkPopupClosed);
              window.removeEventListener('message', handleMessage);
              setConnecting(false);
            }
          }, 500);
          
          // Timeout after 5 minutes
          setTimeout(() => {
            if (!popup.closed) {
              popup.close();
              window.removeEventListener('message', handleMessage);
              clearInterval(checkPopupClosed);
              toast({
                title: 'Connection Timeout',
                description: 'OAuth flow timed out. Please try again.',
                variant: 'destructive',
              });
              setConnecting(false);
            }
          }, 5 * 60 * 1000);
        } catch (error: unknown) {
          console.error('Error connecting:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to connect to cloud storage.';
          toast({
            title: 'Connection Failed',
            description: errorMessage,
            variant: 'destructive',
          });
          setConnecting(false);
        }
      }
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    try {
      await disconnectCloudIntegration(block.id, token || '');
      setIsConnected(false);
      updateProperties({
        isConnected: false,
        accessToken: undefined,
        refreshToken: undefined,
        accountId: undefined,
      });
      toast({
        title: 'Disconnected',
        description: 'Cloud storage connection has been removed.',
      });
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect.',
        variant: 'destructive',
      });
    }
  };

  // Ref to track polling interval
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef<boolean>(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      isPollingRef.current = false;
    };
  }, []);

  // Start polling if indexing is already in progress when component loads
  useEffect(() => {
    if (indexingStatus === 'indexing' && !isPollingRef.current && token) {
      isPollingRef.current = true;
      
      const pollStatus = async () => {
        if (!isPollingRef.current) return;
        
        try {
          const statusResponse = await getCloudIntegration(block.id, token);
          
          // Handle both response structures (wrapped or direct) for backward compatibility
          const integration: CloudIntegration = statusResponse.integration || (statusResponse as unknown as CloudIntegration);
          
          if (!integration) {
            console.warn('Invalid response structure from getCloudIntegration');
            // Retry after delay
            if (isPollingRef.current) {
              pollIntervalRef.current = setTimeout(pollStatus, 5000);
            }
            return;
          }
          
          const status = integration.indexingStatus;
          const currentCount = integration.indexedFileCount || 0;
          const currentDiscovered = integration.filesDiscovered || 0;
          
          // Update state with latest values
          setIndexedFileCount(currentCount);
          setFilesDiscovered(currentDiscovered);
          
          if (status === 'indexing') {
            setIndexingStatus('indexing');
            pollIntervalRef.current = setTimeout(pollStatus, 5000); // Poll every 5 seconds
          } else if (status === 'completed') {
            setIndexingStatus('completed');
            setIndexedFileCount(currentCount);
            setFilesDiscovered(currentDiscovered);
            setLastIndexedAt(integration.lastIndexedAt);
            setIndexing(false);
            isPollingRef.current = false;
            if (pollIntervalRef.current) {
              clearTimeout(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          } else if (status === 'error') {
            setIndexingStatus('error');
            setIndexing(false);
            isPollingRef.current = false;
            if (pollIntervalRef.current) {
              clearTimeout(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          } else {
            isPollingRef.current = false;
            if (pollIntervalRef.current) {
              clearTimeout(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
        } catch (pollError) {
          console.error('Error polling indexing status:', pollError);
          // Continue polling even on error (might be temporary network issue)
          if (isPollingRef.current) {
            pollIntervalRef.current = setTimeout(pollStatus, 5000);
          }
        }
      };
      
      pollIntervalRef.current = setTimeout(pollStatus, 5000); // Poll every 5 seconds
    }
    
    return () => {
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [indexingStatus, block.id, token]);

  // Handle indexing trigger
  const handleIndexNow = async () => {
    if (!isConnected) {
      toast({
        title: 'Not Connected',
        description: 'Please connect to cloud storage first.',
        variant: 'destructive',
      });
      return;
    }

    // For Nextcloud, SSH, and Google Drive, always show picker modal first
    // Indexing will start when modal closes after selection
    if (provider === 'nextcloud') {
      setShouldStartIndexingAfterSelection(true);
      setNextcloudFolderPickerOpen(true);
      return;
    }

    if (provider === 'ssh') {
      setShouldStartIndexingAfterSelection(true);
      setSSHFolderPickerOpen(true);
      return;
    }

    if (provider === 'googledrive') {
      setShouldStartIndexingAfterSelection(true);
      setGoogleDrivePickerOpen(true);
      return;
    }

    if (provider === 'onedrive') {
      setShouldStartIndexingAfterSelection(true);
      setOneDrivePickerOpen(true);
      return;
    }

    // For other providers, start indexing directly
    await startIndexing();
  };

  // Start indexing with selected paths
  const startIndexing = async () => {
    // Stop any existing polling
    if (pollIntervalRef.current) {
      clearTimeout(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    isPollingRef.current = false;

    setIndexing(true);
    setIndexingStatus('indexing');
    setIndexedFileCount(0); // Reset counter when starting new indexing
    setFilesDiscovered(0); // Reset discovered counter
    updateProperties({ indexingStatus: 'indexing', indexedFileCount: 0, filesDiscovered: 0 });

    try {
      await triggerCloudIndexing(block.id, token || '');
      
      toast({
        title: 'Indexing Started',
        description: 'File indexing has started. This may take a few minutes.',
      });
      
      // Start polling for indexing status with live progress updates
      isPollingRef.current = true;
      
      const pollStatus = async () => {
        if (!isPollingRef.current) return;
        
        try {
          const statusResponse = await getCloudIntegration(block.id, token || '');
          
          // Handle both response structures (wrapped or direct) for backward compatibility
          const integration: CloudIntegration = statusResponse.integration || (statusResponse as unknown as CloudIntegration);
          
          if (!integration) {
            console.warn('Invalid response structure from getCloudIntegration');
            // Retry after delay
            if (isPollingRef.current) {
              pollIntervalRef.current = setTimeout(pollStatus, 5000);
            }
            return;
          }
          
          const status = integration.indexingStatus;
          const currentCount = integration.indexedFileCount || 0;
          const currentDiscovered = integration.filesDiscovered || 0;
          
          // Update state with latest values - this will trigger re-render
          setIndexedFileCount(currentCount);
          setFilesDiscovered(currentDiscovered);
          
          // Update live counter during indexing
          if (status === 'indexing') {
            setIndexingStatus('indexing');
            // Continue polling every 5 seconds
            pollIntervalRef.current = setTimeout(pollStatus, 5000); // Poll every 5 seconds
          } else if (status === 'completed') {
            setIndexingStatus('completed');
            setIndexedFileCount(currentCount);
            setFilesDiscovered(currentDiscovered);
            setLastIndexedAt(integration.lastIndexedAt);
            setIndexing(false);
            isPollingRef.current = false;
            if (pollIntervalRef.current) {
              clearTimeout(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          } else if (status === 'error') {
            setIndexingStatus('error');
            setIndexing(false);
            isPollingRef.current = false;
            if (pollIntervalRef.current) {
              clearTimeout(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            toast({
              title: 'Indexing Failed',
              description: integration.indexingError || 'Unknown error',
              variant: 'destructive',
            });
          } else {
            // Status changed to idle or unknown - stop polling
            isPollingRef.current = false;
            if (pollIntervalRef.current) {
              clearTimeout(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
        } catch (pollError) {
          console.error('Error polling indexing status:', pollError);
          // Continue polling even on error (might be temporary network issue)
          if (isPollingRef.current) {
            pollIntervalRef.current = setTimeout(pollStatus, 5000); // Poll every 5 seconds on error
          }
        }
      };
      
      // Start polling after 5 seconds
      pollIntervalRef.current = setTimeout(pollStatus, 5000); // Poll every 5 seconds
    } catch (error: unknown) {
      console.error('Error indexing:', error);
      setIndexingStatus('error');
      
      let errorMessage = 'Failed to start indexing.';
      if (error && typeof error === 'object' && 'response' in error) {
        const apiError = error as { response?: { data?: { error?: string; details?: string } } };
        if (apiError.response?.data?.error) {
          errorMessage = apiError.response.data.error;
        } else if (apiError.response?.data?.details) {
          errorMessage = apiError.response.data.details;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      updateProperties({
        indexingStatus: 'error',
        indexingError: errorMessage,
      });
      toast({
        title: 'Indexing Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      setIndexing(false);
    }
  };

  // Check for OAuth callback success/error in URL params
  useEffect(() => {
    const cloudSuccess = searchParams.get('cloud_success');
    const cloudError = searchParams.get('cloud_error');

    if (cloudSuccess === 'true') {
      toast({
        title: 'Success',
        description: 'Cloud storage connected successfully!',
      });
      setSearchParams({}, { replace: true });
      // Reload connection status
      setIsConnected(true);
      updateProperties({ isConnected: true, connectedAt: new Date().toISOString() });
    }

    if (cloudError) {
      toast({
        title: 'Connection Failed',
        description: decodeURIComponent(cloudError),
        variant: 'destructive',
      });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, toast, updateProperties]);

  return (
    <div className="space-y-4">
      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Cloud Storage Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label htmlFor="provider">Cloud Provider</Label>
            <Select
              value={provider || ''}
              onValueChange={(value) => handleProviderChange(value as CloudBlockProperties['provider'])}
              disabled={isConnected}
            >
              <SelectTrigger id="provider">
                <SelectValue placeholder="Select a cloud provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nextcloud">Nextcloud</SelectItem>
                
                <SelectItem value="ssh">SSH/SFTP</SelectItem>
                {/* OneDrive temporarily disabled */}
                {/*  */}
              </SelectContent>
            </Select>
          </div>

          {/* Google Drive-specific: Simplified connection */}
          {provider === 'googledrive' && (
            <>
              {!isConnected && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Click "Connect to Google Drive" to authorize access to your Google Drive. 
                    You'll be able to select specific folders and files to index after connecting.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {/* OneDrive-specific: Simplified connection */}
          {provider === 'onedrive' && (
            <>
              {!isConnected && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Click "Connect to OneDrive" to authorize access to your OneDrive. 
                    You'll be able to select specific folders and files to index after connecting.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {/* Nextcloud-specific: Base URL and Authentication */}
          {provider === 'nextcloud' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="baseUrl">Nextcloud Server URL</Label>
                <Input
                  id="baseUrl"
                  type="url"
                  placeholder="https://cloud.example.com"
                  value={baseUrl}
                  onChange={(e) => {
                    setBaseUrl(e.target.value);
                    updateProperties({ baseUrl: e.target.value });
                  }}
                  disabled={isConnected}
                />
                <p className="text-xs text-muted-foreground">
                  Enter your Nextcloud server URL (e.g., https://cloud.example.com)
                </p>
              </div>
              
              {!isConnected && (
                <>
                  {/* Authentication Method Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="authMethod">Authentication Method</Label>
                    <Select
                      value={authMethod}
                      onValueChange={(value) => {
                        setAuthMethod(value as 'oauth' | 'app_password');
                        updateProperties({ authMethod: value as 'oauth' | 'app_password' });
                      }}
                      disabled={isConnected}
                    >
                      <SelectTrigger id="authMethod">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="app_password">App Password (Recommended - No OAuth setup needed)</SelectItem>
                        <SelectItem value="oauth">OAuth 2.0 (Requires OAuth app setup)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {authMethod === 'app_password' 
                        ? 'Use App Password for simple authentication without OAuth setup'
                        : 'Use OAuth 2.0 for more secure token-based authentication'}
                    </p>
                  </div>

                  {/* App Password Fields */}
                  {authMethod === 'app_password' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="username">Nextcloud Username</Label>
                        <Input
                          id="username"
                          type="text"
                          placeholder="your-username"
                          value={username}
                          onChange={(e) => {
                            setUsername(e.target.value);
                            updateProperties({ username: e.target.value });
                          }}
                          disabled={isConnected}
                        />
                        <p className="text-xs text-muted-foreground">
                          Your Nextcloud username
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="appPassword">App Password</Label>
                        <Input
                          id="appPassword"
                          type="password"
                          placeholder="xxxx-xxxx-xxxx-xxxx"
                          value={appPassword}
                          onChange={(e) => setAppPassword(e.target.value)}
                          disabled={isConnected}
                        />
                        <p className="text-xs text-muted-foreground">
                          Generate this in Nextcloud: Settings → Security → Devices & sessions → Create new app password
                        </p>
                      </div>
                      
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>How to get App Password:</strong>
                          <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                            <li>Go to your Nextcloud Settings → Security</li>
                            <li>Scroll to "Devices & sessions"</li>
                            <li>Click "Create new app password"</li>
                            <li>Copy the generated password (format: xxxx-xxxx-xxxx-xxxx)</li>
                          </ol>
                        </AlertDescription>
                      </Alert>
                    </>
                  )}

                  {/* OAuth Fields */}
                  {authMethod === 'oauth' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="clientId">OAuth Client ID</Label>
                        <Input
                          id="clientId"
                          type="text"
                          placeholder="Your OAuth Client ID"
                          value={clientId}
                          onChange={(e) => {
                            setClientId(e.target.value);
                            updateProperties({ clientId: e.target.value });
                          }}
                          disabled={isConnected}
                        />
                        <p className="text-xs text-muted-foreground">
                          Get this from your Nextcloud OAuth app settings
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="clientSecret">OAuth Client Secret</Label>
                        <Input
                          id="clientSecret"
                          type="password"
                          placeholder="Your OAuth Client Secret"
                          value={clientSecret}
                          onChange={(e) => {
                            setClientSecret(e.target.value);
                            updateProperties({ clientSecret: e.target.value });
                          }}
                          disabled={isConnected}
                        />
                        <p className="text-xs text-muted-foreground">
                          Get this from your Nextcloud OAuth app settings
                        </p>
                      </div>
                      
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Need help setting up OAuth?</strong> See the{' '}
                          <a
                            href="/cloud-block-docs#authentication"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Authentication section
                          </a>
                          {' '}in the documentation.
                        </AlertDescription>
                      </Alert>
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* SSH-specific: Connection Configuration */}
          {provider === 'ssh' && (
            <>
              {!isConnected && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="sshHost">SSH Host</Label>
                    <Input
                      id="sshHost"
                      type="text"
                      placeholder="example.com or 192.168.1.1"
                      value={sshHost}
                      onChange={(e) => {
                        setSSHHost(e.target.value);
                        updateProperties({ host: e.target.value });
                      }}
                      disabled={isConnected}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the SSH server hostname or IP address
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sshPort">SSH Port</Label>
                    <Input
                      id="sshPort"
                      type="number"
                      placeholder="22"
                      value={sshPort}
                      onChange={(e) => {
                        const port = parseInt(e.target.value) || 22;
                        setSSHPort(port);
                        updateProperties({ port: port });
                      }}
                      disabled={isConnected}
                    />
                    <p className="text-xs text-muted-foreground">
                      SSH port (default: 22)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sshUsername">SSH Username</Label>
                    <Input
                      id="sshUsername"
                      type="text"
                      placeholder="username"
                      value={sshUsername}
                      onChange={(e) => {
                        setSSHUsername(e.target.value);
                        updateProperties({ username: e.target.value });
                      }}
                      disabled={isConnected}
                    />
                    <p className="text-xs text-muted-foreground">
                      Your SSH username
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="privateKey">SSH Private Key</Label>
                    <textarea
                      id="privateKey"
                      className="w-full min-h-[200px] font-mono text-sm p-2 border rounded-md"
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                      disabled={isConnected}
                    />
                    <p className="text-xs text-muted-foreground">
                      Paste your SSH private key (OpenSSH format)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sshPassphrase">Key Passphrase (Optional)</Label>
                    <Input
                      id="sshPassphrase"
                      type="password"
                      placeholder="Leave empty if key has no passphrase"
                      value={sshPassphrase}
                      onChange={(e) => setSSHPassphrase(e.target.value)}
                      disabled={isConnected}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter passphrase if your SSH key is encrypted
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sshPassword">SSH Password (Optional)</Label>
                    <Input
                      id="sshPassword"
                      type="password"
                      placeholder="Enter password if server requires key+password authentication"
                      value={sshPassword}
                      onChange={(e) => setSSHPassword(e.target.value)}
                      disabled={isConnected}
                    />
                    <p className="text-xs text-muted-foreground">
                      Some SSH servers require both a key and a password. Enter the password here if needed.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="basePath">Base Path</Label>
                    <Input
                      id="basePath"
                      type="text"
                      placeholder="/home/username/documents"
                      value={basePath}
                      onChange={(e) => {
                        setBasePath(e.target.value);
                        updateProperties({ basePath: e.target.value });
                      }}
                      disabled={isConnected}
                    />
                    <p className="text-xs text-muted-foreground">
                      Base directory path on the remote server (default: /)
                    </p>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>SSH Key Setup:</strong>
                      <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                        <li>Generate an SSH key pair if you don't have one: <code className="bg-muted px-1 rounded">ssh-keygen -t ed25519</code></li>
                        <li>Copy your public key to the server: <code className="bg-muted px-1 rounded">ssh-copy-id user@host</code></li>
                        <li>Paste your private key above (the content of ~/.ssh/id_ed25519 or similar)</li>
                      </ol>
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </>
          )}

          {/* Documentation Link */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('/cloud-block-docs', '_blank')}
              className="w-full text-xs"
            >
              <ExternalLink className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate">View Documentation</span>
            </Button>
          </div>

          {/* Connection Status */}
          {isConnected ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Connected to {provider === 'nextcloud' ? 'Nextcloud' : provider}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  className="ml-2"
                >
                  Disconnect
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={
                connecting ||
                !provider ||
                (provider === 'nextcloud' &&
                  (!baseUrl.trim() ||
                    (authMethod === 'oauth' && (!clientId.trim() || !clientSecret.trim())) ||
                    (authMethod === 'app_password' && (!username.trim() || !appPassword.trim()))))
              }
              className="w-full"
            >
              {connecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Connect to {provider === 'nextcloud' ? 'Nextcloud' : provider === 'ssh' ? 'SSH/SFTP' : provider || 'Cloud Storage'}
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Indexing Configuration */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Indexing Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Indexing Status */}
            <div className="space-y-2">
              <Label>Indexing Status</Label>
              <div className="flex items-center gap-2">
                {indexingStatus === 'completed' && (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Completed
                  </Badge>
                )}
                {indexingStatus === 'indexing' && (
                  <Badge variant="default" className="bg-blue-500">
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Indexing...
                  </Badge>
                )}
                {indexingStatus === 'error' && (
                  <Badge variant="destructive">
                    <XCircle className="mr-1 h-3 w-3" />
                    Error
                  </Badge>
                )}
                {indexingStatus === 'idle' && (
                  <Badge variant="secondary">Not Indexed</Badge>
                )}
              </div>
              {/* Live progress counter during indexing */}
              {indexingStatus === 'indexing' && (
                <div className="space-y-1">
                  {/* Show listing progress ONLY when files are being discovered but not yet indexed */}
                  {filesDiscovered > 0 && indexedFileCount === 0 ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        Discovering files... {filesDiscovered} {filesDiscovered === 1 ? 'file' : 'files'} found
                      </p>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-amber-500 h-2 rounded-full transition-all duration-500 ease-out"
                          style={{ 
                            width: `${Math.min(10 + (filesDiscovered * 0.5), 50)}%` // Show up to 50% during listing
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Scanning folders and discovering files...
                      </p>
                    </div>
                  ) : (
                    /* Show indexing progress when files are being indexed */
                    <>
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {indexedFileCount > 0 ? (
                          <>Indexed {indexedFileCount} {indexedFileCount === 1 ? 'file' : 'files'}...</>
                        ) : filesDiscovered > 0 ? (
                          <>Found {filesDiscovered} {filesDiscovered === 1 ? 'file' : 'files'}, starting to index...</>
                        ) : (
                          <>Starting indexing...</>
                        )}
                      </p>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
                          style={{ 
                            width: indexedFileCount > 0 
                              ? `${Math.min(50 + (indexedFileCount * 1), 90)}%` // Start at 50% if files were discovered, grow with indexing
                              : filesDiscovered > 0
                              ? '50%' // Show 50% during listing phase
                              : '10%' // Show 10% at start
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {indexedFileCount > 0 
                          ? 'Files are being processed and indexed...'
                          : filesDiscovered > 0
                          ? 'Files discovered, starting to index...'
                          : 'Initializing...'}
                      </p>
                    </>
                  )}
                </div>
              )}
              {lastIndexedAt && indexingStatus !== 'indexing' && (
                <p className="text-xs text-muted-foreground">
                  Last indexed: {new Date(lastIndexedAt).toLocaleString()}
                </p>
              )}
              {indexedFileCount > 0 && indexingStatus !== 'indexing' && (
                <p className="text-xs text-muted-foreground">
                  {indexedFileCount} {indexedFileCount === 1 ? 'file' : 'files'} indexed
                </p>
              )}
            </div>

            {/* Index Now / Stop Indexing Buttons */}
            <div className="flex gap-2">
              {indexingStatus === 'indexing' ? (
                <Button
                  onClick={async () => {
                    try {
                      await cancelCloudIndexing(block.id, token || '');
                      toast({
                        title: 'Indexing Cancelled',
                        description: 'Indexing will stop after processing the current file.',
                      });
                      setIndexing(false);
                      setIndexingStatus('idle');
                    } catch (error: unknown) {
                      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel indexing';
                      toast({
                        title: 'Error',
                        description: errorMessage,
                        variant: 'destructive',
                      });
                    }
                  }}
                  variant="destructive"
                  className="flex-1"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Stop Indexing
                </Button>
              ) : (
                <Button
                  onClick={handleIndexNow}
                  disabled={indexing || indexingStatus === 'indexing'}
                  className="flex-1"
                >
                  {indexing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Indexing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Index Now
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Folder Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Folders/Files to Index</Label>
                {provider === 'googledrive' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGoogleDrivePickerOpen(true)}
                  >
                    <Folder className="mr-2 h-4 w-4" />
                    Select Folders/Files
                  </Button>
                ) : provider === 'onedrive' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOneDrivePickerOpen(true)}
                  >
                    <Folder className="mr-2 h-4 w-4" />
                    Select Folders/Files
                  </Button>
                ) : provider === 'nextcloud' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNextcloudFolderPickerOpen(true)}
                  >
                    <Folder className="mr-2 h-4 w-4" />
                    Select Folders
                  </Button>
                ) : provider === 'ssh' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSSHFolderPickerOpen(true)}
                  >
                    <Folder className="mr-2 h-4 w-4" />
                    Select Folders
                  </Button>
                ) : null}
              </div>
              
              <div className="text-xs text-muted-foreground">
                {(provider === 'googledrive' || provider === 'onedrive')
                  ? (selectedItems.length === 0
                      ? 'No items selected - select folders/files to index'
                      : `Indexing ${selectedItems.length} item(s)`)
                  : (provider === 'nextcloud' || provider === 'ssh')
                  ? (selectedPaths.length === 0
                      ? 'No folders selected - select folders to index'
                      : (selectedPaths.length === 1 && selectedPaths[0] === ''
                          ? 'Indexing root folder (all files)'
                          : `Indexing ${selectedPaths.length} folder(s)`))
                  : 'Select folders/files to index'}
              </div>

              {/* Selected Paths/Items List */}
              {((provider === 'googledrive' && selectedItems.length > 0) || 
                (provider === 'onedrive' && selectedItems.length > 0) ||
                (provider === 'nextcloud' && selectedPaths.length > 0)) && (
                <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2">
                  {(provider === 'googledrive' || provider === 'onedrive') ? (
                    // Google Drive and OneDrive: Show items with names
                    selectedItems.map((item, idx) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {item.type === 'folder' ? (
                            <Folder className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <File className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className="truncate">{item.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newItems = selectedItems.filter((_, i) => i !== idx);
                            const newIds = newItems.map(item => item.id);
                            setSelectedItems(newItems);
                            setSelectedPaths(newIds.length > 0 ? newIds : ['']);
                            updateProperties({ 
                              selectedPaths: newIds.length > 0 ? newIds : [''],
                              selectedItems: newItems
                            });
                          }}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    // Nextcloud: Show paths
                    selectedPaths.map((path, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Folder className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{path || '(Root)'}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newPaths = selectedPaths.filter((_, i) => i !== idx);
                            setSelectedPaths(newPaths.length > 0 ? newPaths : ['']);
                            updateProperties({ selectedPaths: newPaths.length > 0 ? newPaths : [''] });
                          }}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Auto-Refresh */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoRefresh">Auto-Refresh</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically re-index files periodically
                </p>
              </div>
              <Switch
                id="autoRefresh"
                checked={autoRefresh}
                onCheckedChange={(checked) => {
                  setAutoRefresh(checked);
                  setCronEnabled(checked);
                  updateProperties({ 
                    autoRefresh: checked,
                    cronEnabled: checked,
                  });
                }}
              />
            </div>

            {autoRefresh && (
              <div className="space-y-3">
                <CronFrequencySelector
                  value={cronSchedule}
                  onChange={(value) => {
                    setCronSchedule(value);
                    updateProperties({ cronSchedule: value });
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}



      {/* Google Drive Picker Modal */}
      {/* Google Drive Picker Removed for Community Edition */}

      {/* OneDrive Picker Modal */}
      {/* OneDrive Picker Removed for Community Edition */}

      {/* Nextcloud Folder Picker Modal */}
      {provider === 'nextcloud' && isConnected && (
        <NextcloudFolderPicker
          blockId={block.id}
          token={token || ''}
          open={nextcloudFolderPickerOpen}
          onOpenChange={(open) => {
            setNextcloudFolderPickerOpen(open);
            if (!open && shouldStartIndexingAfterSelection) {
              // Modal was closed without selecting folders (user clicked Cancel or X)
              // Reset the flag and show a message
              setShouldStartIndexingAfterSelection(false);
              toast({
                title: 'Indexing Cancelled',
                description: 'Folder selection was cancelled. Select folders and click "Index Now" to start indexing.',
              });
            }
          }}
          initialSelectedPaths={selectedPaths}
          onSelect={async (selectedFolderPaths) => {
            // Update selected paths - persist to database first
            // Keep the paths as-is (can be empty array, or contain paths including empty string for root)
            setSelectedPaths(selectedFolderPaths);
            
            // Persist to database using updateCloudIntegration API
            try {
              await updateCloudIntegration(
                block.id,
                { selectedPaths: selectedFolderPaths },
                token || ''
              );
              
              // Also update local block properties for immediate UI update
              updateProperties({ selectedPaths: selectedFolderPaths });
            } catch (error) {
              console.error('Error saving selected paths:', error);
              toast({
                title: 'Error',
                description: 'Failed to save folder selection. Please try again.',
                variant: 'destructive',
              });
              setShouldStartIndexingAfterSelection(false);
              return;
            }
            
            // Check if we should start indexing after selection
            const shouldStart = shouldStartIndexingAfterSelection;
            setShouldStartIndexingAfterSelection(false);
            
            // Close modal first
            setNextcloudFolderPickerOpen(false);
            
            if (shouldStart && selectedFolderPaths.length > 0) {
              // Start indexing after a short delay to ensure modal is closed and state is updated
              setTimeout(() => {
                startIndexing();
              }, 500);
            } else if (selectedFolderPaths.length > 0) {
              // Show success message if not starting indexing
              toast({
                title: 'Folders Selected',
                description: `${selectedFolderPaths.length} folder(s) selected and saved.`,
              });
            } else if (shouldStart) {
              // User closed modal without selecting folders, but "Index Now" was clicked
              toast({
                title: 'No Folders Selected',
                description: 'Please select at least one folder to index.',
                variant: 'destructive',
              });
            }
          }}
        />
      )}

      {/* SSH Folder Picker Modal */}
      {provider === 'ssh' && isConnected && (
        <SSHFolderPicker
          blockId={block.id}
          token={token || ''}
          open={sshFolderPickerOpen}
          onOpenChange={(open) => {
            setSSHFolderPickerOpen(open);
            if (!open && shouldStartIndexingAfterSelection) {
              // Modal was closed without selecting folders (user clicked Cancel or X)
              // Reset the flag and show a message
              setShouldStartIndexingAfterSelection(false);
              toast({
                title: 'Indexing Cancelled',
                description: 'Folder selection was cancelled. Select folders and click "Index Now" to start indexing.',
              });
            }
          }}
          initialSelectedPaths={selectedPaths}
          onSelect={async (selectedFolderPaths) => {
            // Update selected paths - persist to database first
            setSelectedPaths(selectedFolderPaths);
            
            // Persist to database using updateCloudIntegration API
            try {
              await updateCloudIntegration(
                block.id,
                { selectedPaths: selectedFolderPaths },
                token || ''
              );
              
              // Also update local block properties for immediate UI update
              updateProperties({ selectedPaths: selectedFolderPaths });
            } catch (error) {
              console.error('Error saving selected paths:', error);
              toast({
                title: 'Error',
                description: 'Failed to save folder selection. Please try again.',
                variant: 'destructive',
              });
              setShouldStartIndexingAfterSelection(false);
              return;
            }
            
            // Check if we should start indexing after selection
            const shouldStart = shouldStartIndexingAfterSelection;
            setShouldStartIndexingAfterSelection(false);
            
            // Close modal first
            setSSHFolderPickerOpen(false);
            
            if (shouldStart && selectedFolderPaths.length > 0) {
              // Start indexing after a short delay to ensure modal is closed and state is updated
              setTimeout(() => {
                startIndexing();
              }, 500);
            } else if (selectedFolderPaths.length > 0) {
              // Show success message if not starting indexing
              toast({
                title: 'Folders Selected',
                description: `${selectedFolderPaths.length} folder(s) selected and saved.`,
              });
            } else if (shouldStart) {
              // User closed modal without selecting folders, but "Index Now" was clicked
              toast({
                title: 'No Folders Selected',
                description: 'Please select at least one folder to index.',
                variant: 'destructive',
              });
            }
          }}
        />
      )}
    </div>
  );
};

export default CloudBlockProperties;
