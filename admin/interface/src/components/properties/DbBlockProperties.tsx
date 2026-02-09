import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useBlockEditor } from '@/contexts/BlockEditorContext';
import { useToast } from '@/hooks/use-toast';
import { Block } from '@/types/block';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, Database, AlertCircle, Search, Upload, Trash2, Save, Download } from 'lucide-react';
import { adminApiClient, handleApiResponse } from '@/lib/apiClient';
import { listCredentials, createCredential, updateCredential, deleteCredential, IntegrationCredential } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface DbBlockPropertiesProps {
  block: Block;
}

const DbBlockProperties: React.FC<DbBlockPropertiesProps> = ({ block }) => {
  const { id: chatbotId } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { updateBlock, blocks } = useBlockEditor();
  const { toast } = useToast();

  interface DatabaseSchema {
    tables?: Array<{
      name: string;
      columns?: Array<{ name: string; type: string }>;
      rowCount?: number;
    }>;
    discoveredAt?: string;
  }

  // Get the latest block from context to ensure we have the most up-to-date properties
  const latestBlock = blocks.find(b => b.id === block.id) || block;
  const properties = useMemo(() => (latestBlock.properties || {}) as {
    connectionMode?: 'server' | 'file';
    dbType?: 'postgresql' | 'mysql' | 'sqlite' | 'mssql';
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    ssl?: boolean;
    // File-based connection
    fileId?: string;
    fileName?: string;
    fileSize?: number;
    uploadedAt?: string;
    schema?: DatabaseSchema;
    schemaDiscoveredAt?: string;
    exampleQueries?: Array<{
      question: string;
      description?: string;
    }>;
    lastTestedAt?: string;
    lastTestStatus?: 'success' | 'failed' | 'not_tested';
    lastTestError?: string;
  }, [latestBlock.properties]);

  const [testingConnection, setTestingConnection] = useState(false);
  const [discoveringSchema, setDiscoveringSchema] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [useConnectionString, setUseConnectionString] = useState(!!properties.connectionString);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const [credentials, setCredentials] = useState<IntegrationCredential[]>([]);
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>('');
  const [credentialName, setCredentialName] = useState('');
  const [loadingCredentials, setLoadingCredentials] = useState(false);

  const loadCredentials = useCallback(async () => {
    if (!token) return;
    setLoadingCredentials(true);
    try {
      const data = await listCredentials(token, 'DATABASE');
      setCredentials(data);
    } catch (error) {
      console.error('Failed to load credentials', error);
    } finally {
      setLoadingCredentials(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadCredentials();
    }
  }, [token, loadCredentials]);

  // Ref to hold current state for saveCredential to access without dependency
  const stateRef = useRef({ credentialName, properties, useConnectionString });
  useEffect(() => {
    stateRef.current = { credentialName, properties, useConnectionString };
  }, [credentialName, properties, useConnectionString]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saveCredential = useCallback(async (overrides?: any) => {
    if (!selectedCredentialId || !token) return;
    const { credentialName, properties, useConnectionString: refUseConnStr } = stateRef.current;
    
    // Use overrides if provided
    const props = { ...properties, ...overrides };
    const useConnStr = overrides?.useConnectionString ?? refUseConnStr;
    
    // Don't save if name is empty
    if (!credentialName.trim()) return;

    const connectionData = {
      dbType: props.dbType,
      connectionString: useConnStr ? props.connectionString : undefined,
      host: useConnStr ? undefined : props.host,
      port: useConnStr ? undefined : props.port,
      database: useConnStr ? undefined : props.database,
      username: useConnStr ? undefined : props.username,
      password: useConnStr ? undefined : props.password,
      ssl: props.ssl,
    };

    try {
      if (selectedCredentialId === 'new') {
        // Create new credential
        const newCred = await createCredential(token, {
          name: credentialName,
          type: 'DATABASE',
          data: connectionData,
        });
        
        setCredentials(prev => [newCred, ...prev]);
        setSelectedCredentialId(newCred.id);
        toast({
          title: 'Credential Saved',
          description: `Created new credential: ${newCred.name}`,
        });
      } else {
        // Update existing credential
        await updateCredential(token, selectedCredentialId, {
          name: credentialName,
          data: connectionData,
        });
        
        // Update local list
        setCredentials(prev => prev.map(c => 
          c.id === selectedCredentialId 
            ? { ...c, name: credentialName, data: connectionData } 
            : c
        ));
      }
    } catch (error) {
      console.error('Failed to save credential', error);
    }
  }, [selectedCredentialId, token, toast]);

  const handleDeleteCredential = async () => {
    if (!selectedCredentialId || selectedCredentialId === 'new' || !token) return;
    
    if (!confirm('Are you sure you want to delete this credential? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteCredential(token, selectedCredentialId);
      
      // Update local list
      setCredentials(prev => prev.filter(c => c.id !== selectedCredentialId));
      setSelectedCredentialId('');
      setCredentialName('');
      
      toast({
        title: 'Credential Deleted',
        description: 'The credential has been successfully removed.',
      });
    } catch (error) {
      console.error('Failed to delete credential', error);
      toast({
        title: 'Error',
        description: 'Failed to delete credential',
        variant: 'destructive',
      });
    }
  };

  // Auto-save removed - explicit save only
  /* 
  useEffect(() => { ... }) 
  */

  const handleCredentialSelect = (value: string) => {
    setSelectedCredentialId(value);
    
    if (value === 'new') {
      setCredentialName('New Credential');
    } else {
      const cred = credentials.find(c => c.id === value);
      if (cred) {
        setCredentialName(cred.name);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = cred.data as any;
        
        // Update block properties with loaded data
        updateBlock(block.id, {
          properties: {
            ...properties,
            dbType: data.dbType || properties.dbType,
            connectionString: data.connectionString,
            host: data.host,
            port: data.port,
            database: data.database,
            username: data.username,
            password: data.password,
            ssl: data.ssl,
            connectionMode: 'server',
          }
        });
        
        // Also update local state
        if (data.connectionString) setUseConnectionString(true);
        else setUseConnectionString(false);
      }
    }
  };
  
  // Determine connection mode - prefer file if fileId exists
  const connectionMode = properties.fileId ? 'file' : (properties.connectionMode || 'server');
  
  // Sync properties to local state when they change externally
  useEffect(() => {
    if (properties.connectionString !== undefined) setUseConnectionString(!!properties.connectionString);
  }, [properties.connectionString]);

  const updateProperty = useCallback((key: string, value: string | boolean | number | undefined) => {
    updateBlock(block.id, {
      properties: {
        ...properties,
        [key]: value,
      },
    });
  }, [block.id, properties, updateBlock]);

  const testConnection = async () => {
    if (!chatbotId || !token) return;

    setTestingConnection(true);
    try {
      const config = {
        dbType: properties.dbType || 'postgresql',
        connectionString: useConnectionString ? properties.connectionString : undefined,
        host: useConnectionString ? undefined : properties.host,
        port: useConnectionString ? undefined : properties.port,
        database: useConnectionString ? undefined : properties.database,
        username: useConnectionString ? undefined : properties.username,
        password: useConnectionString ? undefined : properties.password,
        ssl: properties.ssl || false,
      };

      const response = await adminApiClient.post(
        `/chatbots/${chatbotId}/blocks/${block.id}/test-connection`,
        config,
        token
      );

      const data = await handleApiResponse(response);

      if (data.success) {
        updateProperty('lastTestStatus', 'success');
        updateProperty('lastTestedAt', new Date().toISOString());
        toast({
          title: 'Success',
          description: 'Connection test successful',
        });
      } else {
        updateProperty('lastTestStatus', 'failed');
        updateProperty('lastTestError', data.error);
        toast({
          title: 'Connection Failed',
          description: data.error || 'Connection test failed',
          variant: 'destructive',
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
      updateProperty('lastTestStatus', 'failed');
      updateProperty('lastTestError', errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!chatbotId || !token) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await adminApiClient.post(
        `/chatbots/${chatbotId}/blocks/${block.id}/upload-db-file`,
        formData,
        token,
        {
          'Content-Type': 'multipart/form-data',
        }
      );

      const data = await handleApiResponse(response);

      // Update all properties at once to ensure they're all set together
      // Schema is auto-discovered on backend, so include it if present
      updateBlock(block.id, {
        properties: {
          ...properties,
          connectionMode: 'file',
          dbType: 'sqlite',
          fileId: data.fileId,
          fileName: data.fileName,
          fileSize: data.fileSize,
          uploadedAt: data.uploadedAt,
          lastTestStatus: 'success',
          lastTestedAt: new Date().toISOString(),
          ...(data.schema && {
            schema: data.schema,
            schemaDiscoveredAt: data.schema.discoveredAt,
          }),
          ...(data.exampleQueries && {
            exampleQueries: data.exampleQueries,
          }),
        },
      });

      const message = data.tablesCount 
        ? `Database file uploaded successfully. Discovered ${data.tablesCount} tables.`
        : 'Database file uploaded successfully.';
      
      toast({
        title: 'Success',
        description: message,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'File upload failed';
      toast({
        title: 'Upload Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteFile = async () => {
    if (!chatbotId || !token) return;

    try {
      await adminApiClient.delete(
        `/chatbots/${chatbotId}/blocks/${block.id}/db-file`,
        token
      );

      // Update all properties at once to ensure UI updates
      // Create a new properties object without file-related fields
      const updatedProperties = { ...properties };
      delete updatedProperties.fileId;
      delete updatedProperties.fileName;
      delete updatedProperties.fileSize;
      delete updatedProperties.uploadedAt;
      delete updatedProperties.schema;
      delete updatedProperties.schemaDiscoveredAt;
      delete updatedProperties.exampleQueries;
      updatedProperties.connectionMode = 'server';
      updatedProperties.lastTestStatus = undefined;
      updatedProperties.lastTestedAt = undefined;

      updateBlock(block.id, {
        properties: updatedProperties,
      });

      toast({
        title: 'Success',
        description: 'Database file deleted',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete file';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleReplaceFile = async (file: File) => {
    if (!chatbotId || !token) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await adminApiClient.post(
        `/chatbots/${chatbotId}/blocks/${block.id}/upload-db-file`,
        formData,
        token,
        {
          'Content-Type': 'multipart/form-data',
        }
      );

      const data = await handleApiResponse(response);

      // Update all properties at once to ensure they're all set together
      // Schema is auto-discovered on backend, so include it if present
      updateBlock(block.id, {
        properties: {
          ...properties,
          connectionMode: 'file',
          dbType: 'sqlite',
          fileId: data.fileId,
          fileName: data.fileName,
          fileSize: data.fileSize,
          uploadedAt: data.uploadedAt,
          lastTestStatus: 'success',
          lastTestedAt: new Date().toISOString(),
          ...(data.schema && {
            schema: data.schema,
            schemaDiscoveredAt: data.schema.discoveredAt,
          }),
          ...(data.exampleQueries && {
            exampleQueries: data.exampleQueries,
          }),
        },
      });

      const message = data.tablesCount 
        ? `Database file replaced successfully. Discovered ${data.tablesCount} tables.`
        : 'Database file replaced successfully.';
      
      toast({
        title: 'Success',
        description: message,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'File replacement failed';
      toast({
        title: 'Replacement Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const discoverSchema = async () => {
    if (!chatbotId || !token) return;

    // For file-based connections, fileId is sufficient (file was validated on upload)
    // For server-based connections, require successful connection test
    if (connectionMode === 'server' && properties.lastTestStatus !== 'success') {
      toast({
        title: 'Connection Required',
        description: 'Please test the connection first before discovering schema',
        variant: 'destructive',
      });
      return;
    }

    if (connectionMode === 'file' && !properties.fileId) {
      toast({
        title: 'File Required',
        description: 'Please upload a database file first',
        variant: 'destructive',
      });
      return;
    }

    setDiscoveringSchema(true);
    try {
      const response = await adminApiClient.post(
        `/chatbots/${chatbotId}/blocks/${block.id}/discover-schema`,
        {},
        token
      );

      const data = await handleApiResponse(response);

      if (data.success && data.schema) {
        updateBlock(block.id, {
          properties: {
            ...properties,
            schema: data.schema,
            schemaDiscoveredAt: data.schema.discoveredAt,
            ...(data.exampleQueries && {
              exampleQueries: data.exampleQueries,
            }),
          },
        });
        toast({
          title: 'Success',
          description: `Discovered ${data.schema.tables?.length || 0} tables${data.exampleQueries ? ` with ${data.exampleQueries.length} example queries` : ''}`,
        });
      } else {
        toast({
          title: 'Discovery Failed',
          description: data.error || 'Schema discovery failed',
          variant: 'destructive',
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Schema discovery failed';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setDiscoveringSchema(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Credential Selection - Only for server mode */}
      {connectionMode === 'server' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Credential
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedCredentialId} onValueChange={handleCredentialSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select credential..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">+ Create New Credential</SelectItem>
                {credentials.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedCredentialId && (
              <div className="space-y-2">
                <Label>Credential Name</Label>
                <div className="flex gap-2">
                  <Input 
                    value={credentialName} 
                    onChange={(e) => setCredentialName(e.target.value)} 
                    onBlur={() => saveCredential()}
                    placeholder="e.g. Production Database"
                    className="flex-1"
                  />
                  {selectedCredentialId !== 'new' && (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={handleDeleteCredential}
                      title="Delete Credential"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Changes to this credential will be saved automatically.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Connection Mode Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Connection Method
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={connectionMode}
            onValueChange={(value) => {
              updateProperty('connectionMode', value as 'server' | 'file');
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="server">Database Server</SelectItem>
              <SelectItem value="file">Database File (SQLite)</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Server-based Connection */}
      {connectionMode === 'server' && selectedCredentialId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dbType">Database Type</Label>
              <Select
                value={properties.dbType || 'postgresql'}
                onValueChange={(value) => {
                  updateProperty('dbType', value);
                  saveCredential({ dbType: value });
                }}
              >
                <SelectTrigger id="dbType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="postgresql">PostgreSQL</SelectItem>
                  <SelectItem value="mysql">MySQL</SelectItem>
                  <SelectItem value="sqlite" disabled>SQLite (Use File Mode)</SelectItem>
                  <SelectItem value="mssql" disabled>MSSQL (Coming Soon)</SelectItem>
                </SelectContent>
              </Select>
            </div>

          <div className="space-y-2">
            <Label>Connection Method</Label>
            <Select
              value={useConnectionString ? 'string' : 'fields'}
              onValueChange={(value) => {
                setUseConnectionString(value === 'string');
                saveCredential({ useConnectionString: value === 'string' });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="string">Connection String</SelectItem>
                <SelectItem value="fields">Individual Fields</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {useConnectionString ? (
            <div className="space-y-2">
              <Label htmlFor="connectionString">Connection String</Label>
              <Input
                id="connectionString"
                type="password"
                value={properties.connectionString || ''}
                onChange={(e) => updateProperty('connectionString', e.target.value)}
                onBlur={() => saveCredential()}
                placeholder="postgresql://user:password@host:port/database"
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="host">Host</Label>
                  <Input
                    id="host"
                    value={properties.host || ''}
                    onChange={(e) => updateProperty('host', e.target.value)}
                    onBlur={() => saveCredential()}
                    placeholder="localhost"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={properties.port || ''}
                    onChange={(e) => updateProperty('port', parseInt(e.target.value) || undefined)}
                    onBlur={() => saveCredential()}
                    placeholder="5432"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="database">Database</Label>
                <Input
                  id="database"
                  value={properties.database || ''}
                  onChange={(e) => updateProperty('database', e.target.value)}
                  onBlur={() => saveCredential()}
                  placeholder="mydb"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={properties.username || ''}
                    onChange={(e) => updateProperty('username', e.target.value)}
                    onBlur={() => saveCredential()}
                    placeholder="user"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={properties.password || ''}
                    onChange={(e) => updateProperty('password', e.target.value)}
                    onBlur={() => saveCredential()}
                    placeholder="password"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="ssl"
                  checked={properties.ssl || false}
                  onChange={(e) => {
                    updateProperty('ssl', e.target.checked);
                    saveCredential({ ssl: e.target.checked });
                  }}
                  className="rounded"
                />
                <Label htmlFor="ssl">Use SSL</Label>
              </div>
            </>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Recommendation:</strong> Use read-only database user credentials for additional security.
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-2">
            <Button
              onClick={testConnection}
              disabled={testingConnection}
              variant="outline"
            >
              {testingConnection ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>
            {properties.lastTestStatus === 'success' && (
              <div className="flex items-center text-green-600 text-sm">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Connection successful
              </div>
            )}
            {properties.lastTestStatus === 'failed' && (
              <div className="flex items-center text-red-600 text-sm">
                <XCircle className="h-4 w-4 mr-1" />
                Connection failed
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* File-based Connection */}
      {connectionMode === 'file' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database File Upload
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Upload a SQLite database file (.db, .sqlite, .sqlite3). Maximum file size: 100MB.
              </AlertDescription>
            </Alert>

            {!properties.fileId ? (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  id="db-file-upload"
                  accept=".db,.sqlite,.sqlite3"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="hidden"
                  disabled={uploadingFile}
                />
                <label
                  htmlFor="db-file-upload"
                  className={`cursor-pointer flex flex-col items-center gap-2 ${uploadingFile ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {uploadingFile ? (
                    <>
                      <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                      <span className="text-sm text-muted-foreground">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Click to upload or drag and drop
                      </span>
                      <span className="text-xs text-muted-foreground">
                        SQLite files only (.db, .sqlite, .sqlite3)
                      </span>
                    </>
                  )}
                </label>
              </div>
            ) : (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium truncate">{properties.fileName || 'database.db'}</span>
                </div>
                {properties.fileSize && (
                  <div className="text-sm text-muted-foreground">
                    Size: {(properties.fileSize / 1024 / 1024).toFixed(2)} MB
                  </div>
                )}
                {properties.uploadedAt && (
                  <div className="text-sm text-muted-foreground">
                    Uploaded: {new Date(properties.uploadedAt).toLocaleString()}
                  </div>
                )}
                {properties.schema && (
                  <div className="pt-2 border-t">
                    <div className="text-sm font-medium text-green-600">
                      ✓ Schema discovered: {properties.schema.tables?.length || 0} tables found
                    </div>
                    {properties.schemaDiscoveredAt && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Discovered {new Date(properties.schemaDiscoveredAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-2 pt-2 border-t">
                  <input
                    ref={replaceFileInputRef}
                    type="file"
                    id="db-file-replace"
                    accept=".db,.sqlite,.sqlite3"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleReplaceFile(file);
                      // Reset input so same file can be selected again
                      e.target.value = '';
                    }}
                    className="hidden"
                    disabled={uploadingFile}
                  />
                  <Button
                    disabled={uploadingFile}
                    type="button"
                    onClick={() => replaceFileInputRef.current?.click()}
                    className="flex-[3] bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {uploadingFile ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Replacing...
                      </>
                    ) : (
                      'Replace'
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteFile}
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      )}

      {/* Schema Discovery Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Database Schema Discovery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {connectionMode === 'file' && properties.fileId && !properties.schema && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Schema discovery is in progress... This happens automatically after file upload.
              </AlertDescription>
            </Alert>
          )}

          {properties.schema && (
            <>
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <strong>Schema Discovered:</strong> {properties.schema.tables?.length || 0} tables found. 
                  SQL queries will be automatically generated based on user messages.
                </AlertDescription>
              </Alert>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Discovered Tables</Label>
                  {properties.schemaDiscoveredAt && (
                    <span className="text-sm text-muted-foreground">
                      {new Date(properties.schemaDiscoveredAt).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="max-h-48 overflow-auto space-y-2">
                  {properties.schema.tables?.map((table, index: number) => (
                    <div key={index} className="text-sm p-2 bg-muted rounded">
                      <span className="font-medium">{table.name}</span>
                      {table.rowCount !== undefined && (
                        <span className="text-muted-foreground ml-2">
                          ({table.rowCount} rows)
                        </span>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {table.columns?.length || 0} columns
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {properties.exampleQueries && properties.exampleQueries.length > 0 && (
                <div className="border rounded-lg p-4 space-y-3">
                  <div>
                    <Label className="text-base font-semibold">Example User Questions</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      These are example questions users might ask your chatbot. The chatbot will automatically generate SQL queries to answer them.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {properties.exampleQueries.map((example, index) => (
                      <div key={index} className="p-3 bg-muted rounded-lg border-l-2 border-l-primary">
                        <div className="text-sm font-medium text-foreground">
                          "{example.question}"
                        </div>
                        {example.description && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {example.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {connectionMode === 'server' && (
            <Button
              onClick={discoverSchema}
              disabled={discoveringSchema || properties.lastTestStatus !== 'success'}
              variant="outline"
              className="w-full"
            >
              {discoveringSchema ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Discovering Schema...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  {properties.schema ? 'Rediscover Schema' : 'Discover Schema'}
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DbBlockProperties;
