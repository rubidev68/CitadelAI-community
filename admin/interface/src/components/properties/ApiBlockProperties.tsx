import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useBlockEditor } from '@/contexts/BlockEditorContext';
import { useToast } from '@/hooks/use-toast';
import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
  updateApiToken,
  ApiToken,
  CreateApiTokenData,
} from '@/lib/api';
import { Block } from '@/types/block';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, Trash2, ExternalLink, Key, Calendar, Hash, Infinity as InfinityIcon, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ApiBlockPropertiesProps {
  block: Block;
}

const ApiBlockProperties: React.FC<ApiBlockPropertiesProps> = ({ block }) => {
  const { id: chatbotId } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { updateBlock, chatbot } = useBlockEditor();
  const { toast } = useToast();

  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [newToken, setNewToken] = useState<ApiToken | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  // Token creation form state
  const [tokenName, setTokenName] = useState('');
  const [tokenType, setTokenType] = useState<'DURATION' | 'USAGE' | 'PERMANENT'>('DURATION');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxUsage, setMaxUsage] = useState('');

  // Load tokens on mount and when chatbotId changes
  useEffect(() => {
    if (chatbotId && token) {
      loadTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatbotId, token]);

  const loadTokens = async () => {
    if (!chatbotId || !token) return;
    try {
      setLoading(true);
      const allTokens = await listApiTokens(chatbotId, token);
      // Filter tokens for this block
      const blockTokens = allTokens.filter(t => t.blockId === block.id);
      setTokens(blockTokens);
    } catch (error) {
      console.error('Error loading tokens:', error);
      toast({
        title: 'Error',
        description: 'Failed to load API tokens',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateToken = async () => {
    if (!chatbotId || !token) return;
    if (!tokenName.trim()) {
      toast({
        title: 'Error',
        description: 'Token name is required',
        variant: 'destructive',
      });
      return;
    }

    if (tokenType === 'DURATION' && !expiresAt) {
      toast({
        title: 'Error',
        description: 'Expiration date is required for duration tokens',
        variant: 'destructive',
      });
      return;
    }

    if (tokenType === 'USAGE' && (!maxUsage || parseInt(maxUsage) < 1)) {
      toast({
        title: 'Error',
        description: 'Max usage must be at least 1 for usage tokens',
        variant: 'destructive',
      });
      return;
    }

    try {
      const data: CreateApiTokenData = {
        name: tokenName,
        tokenType,
        blockId: block.id,
      };

      if (tokenType === 'DURATION') {
        data.expiresAt = expiresAt;
      } else if (tokenType === 'USAGE') {
        data.maxUsage = parseInt(maxUsage);
      }

      const createdToken = await createApiToken(chatbotId, data, token);
      setNewToken(createdToken);
      setShowCreateModal(false);
      setShowTokenModal(true);
      
      // Reset form
      setTokenName('');
      setTokenType('DURATION');
      setExpiresAt('');
      setMaxUsage('');
      
      // Reload tokens
      await loadTokens();
    } catch (error: unknown) {
      console.error('Error creating token:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create API token';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to revoke this token? It will no longer work.')) {
      return;
    }

    try {
      await revokeApiToken(tokenId, token);
      toast({
        title: 'Success',
        description: 'Token revoked successfully',
      });
      await loadTokens();
    } catch (error: unknown) {
      console.error('Error revoking token:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to revoke token';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = (text: string, tokenId?: string) => {
    navigator.clipboard.writeText(text);
    if (tokenId) {
      setCopiedTokenId(tokenId);
      setTimeout(() => setCopiedTokenId(null), 2000);
    }
    toast({
      title: 'Copied',
      description: 'Copied to clipboard',
    });
  };

  const getTokenStatus = (token: ApiToken): { label: string; variant: 'default' | 'destructive' | 'secondary' } => {
    if (!token.isActive) {
      return { label: 'Revoked', variant: 'destructive' };
    }
    if (token.tokenType === 'DURATION' && token.expiresAt) {
      const expires = new Date(token.expiresAt);
      if (expires < new Date()) {
        return { label: 'Expired', variant: 'destructive' };
      }
    }
    if (token.tokenType === 'USAGE' && token.maxUsage) {
      if (token.currentUsage >= token.maxUsage) {
        return { label: 'Exhausted', variant: 'destructive' };
      }
    }
    return { label: 'Active', variant: 'default' };
  };

  const getDocumentationUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/api-docs/${chatbotId}`;
  };

  const allowedOrigins = (block.properties.allowedOrigins as string[]) || [];
  const [newOrigin, setNewOrigin] = useState('');

  const handleAddOrigin = () => {
    if (newOrigin.trim() && !allowedOrigins.includes(newOrigin.trim())) {
      updateBlock(block.id, {
        properties: {
          ...block.properties,
          allowedOrigins: [...allowedOrigins, newOrigin.trim()]
        }
      });
      setNewOrigin('');
    }
  };

  const handleRemoveOrigin = (originToRemove: string) => {
    updateBlock(block.id, {
      properties: {
        ...block.properties,
        allowedOrigins: allowedOrigins.filter(orig => orig !== originToRemove)
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* API Endpoint Configuration */}
      <div className="space-y-2">
        <Label htmlFor="endpoint">API Endpoint</Label>
        <div className="flex items-center gap-2">
          <Input
            id="endpoint"
            value={String(block.properties.endpoint || `/api/chat/${chatbotId}`)}
            onChange={(e) => updateBlock(block.id, {
              properties: { ...block.properties, endpoint: e.target.value }
            })}
            placeholder="/api/chat/{chatbotId}"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Your chatbot API endpoint. Use this URL with your API tokens to access the chatbot programmatically.
        </p>
      </div>

      {/* CORS Configuration */}
      <div className="space-y-2">
        <Label>CORS Allowed Origins</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Configure which domains can access your API. Add origins (e.g., https://example.com) or use * to allow all origins.
          <br />
          <strong>Note:</strong> The admin frontend origin ({window.location.origin}) is automatically allowed for testing the playground.
        </p>
        <div className="flex items-center gap-2">
          <Input
            placeholder="https://example.com or * for all"
            value={newOrigin}
            onChange={(e) => setNewOrigin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddOrigin();
              }
            }}
          />
          <Button type="button" size="sm" onClick={handleAddOrigin}>
            Add
          </Button>
        </div>
        {allowedOrigins.length > 0 && (
          <div className="mt-2 space-y-1">
            {allowedOrigins.map((origin) => (
              <div key={origin} className="flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2 text-sm">
                <code className="text-xs">{origin}</code>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemoveOrigin(origin)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {allowedOrigins.length === 0 && (
          <Alert>
            <AlertDescription className="text-xs">
              No allowed origins configured. API requests from browsers will be blocked by CORS. Add origins to allow cross-origin requests.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Documentation Link */}
      <div className="space-y-2">
        <Button
          variant="outline"
          onClick={() => window.open(getDocumentationUrl(), '_blank')}
          className="w-full"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          View API Documentation
        </Button>
      </div>

      {/* Token Management */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>API Tokens</Label>
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
          >
            <Key className="mr-2 h-4 w-4" />
            Generate Token
          </Button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading tokens...</div>
        ) : tokens.length === 0 ? (
          <Alert>
            <AlertDescription>
              No API tokens created yet. Click "Generate Token" to create your first token.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {/* Active Tokens */}
            {tokens.filter(t => t.isActive).length > 0 && (
              <div className="space-y-2">
                {tokens.filter(t => t.isActive).map((tokenItem) => {
                  const status = getTokenStatus(tokenItem);
                  return (
                    <Card key={tokenItem.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">{tokenItem.name}</CardTitle>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Token:</span>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {tokenItem.tokenPrefix}****
                          </code>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Type:</span>
                          <div className="flex items-center gap-1">
                            {tokenItem.tokenType === 'DURATION' && <Calendar className="h-3 w-3" />}
                            {tokenItem.tokenType === 'USAGE' && <Hash className="h-3 w-3" />}
                            {tokenItem.tokenType === 'PERMANENT' && <InfinityIcon className="h-3 w-3" />}
                            <span>{tokenItem.tokenType}</span>
                          </div>
                        </div>
                        {tokenItem.tokenType === 'DURATION' && tokenItem.expiresAt && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Expires:</span>
                            <span>{new Date(tokenItem.expiresAt).toLocaleDateString()}</span>
                          </div>
                        )}
                        {tokenItem.tokenType === 'USAGE' && tokenItem.maxUsage && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Usage:</span>
                            <span>{tokenItem.currentUsage} / {tokenItem.maxUsage}</span>
                          </div>
                        )}
                        {tokenItem.lastUsedAt && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Last used:</span>
                            <span>{new Date(tokenItem.lastUsedAt).toLocaleDateString()}</span>
                          </div>
                        )}
                        <div className="flex justify-end pt-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRevokeToken(tokenItem.id)}
                            disabled={!tokenItem.isActive}
                          >
                            <Trash2 className="mr-2 h-3 w-3" />
                            Revoke
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Revoked Tokens (Collapsible) */}
            {tokens.filter(t => !t.isActive).length > 0 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="text-muted-foreground">
                      Revoked Tokens ({tokens.filter(t => !t.isActive).length})
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {tokens.filter(t => !t.isActive).map((tokenItem) => {
                    const status = getTokenStatus(tokenItem);
                    return (
                      <Card key={tokenItem.id} className="opacity-60">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium">{tokenItem.name}</CardTitle>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Token:</span>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {tokenItem.tokenPrefix}****
                            </code>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Type:</span>
                            <div className="flex items-center gap-1">
                              {tokenItem.tokenType === 'DURATION' && <Calendar className="h-3 w-3" />}
                              {tokenItem.tokenType === 'USAGE' && <Hash className="h-3 w-3" />}
                              {tokenItem.tokenType === 'PERMANENT' && <InfinityIcon className="h-3 w-3" />}
                              <span>{tokenItem.tokenType}</span>
                            </div>
                          </div>
                          {tokenItem.tokenType === 'DURATION' && tokenItem.expiresAt && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Expires:</span>
                              <span>{new Date(tokenItem.expiresAt).toLocaleDateString()}</span>
                            </div>
                          )}
                          {tokenItem.tokenType === 'USAGE' && tokenItem.maxUsage && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Usage:</span>
                              <span>{tokenItem.currentUsage} / {tokenItem.maxUsage}</span>
                            </div>
                          )}
                          {tokenItem.lastUsedAt && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Last used:</span>
                              <span>{new Date(tokenItem.lastUsedAt).toLocaleDateString()}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}
      </div>

      {/* Create Token Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate API Token</DialogTitle>
            <DialogDescription>
              Create a new API token to access your chatbot programmatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token-name">Token Name</Label>
              <Input
                id="token-name"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="e.g., Production API Key"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token-type">Token Type</Label>
              <Select value={tokenType} onValueChange={(value: 'DURATION' | 'USAGE' | 'PERMANENT') => setTokenType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DURATION">Duration (expires on date)</SelectItem>
                  <SelectItem value="USAGE">Usage (expires after N requests)</SelectItem>
                  <SelectItem value="PERMANENT">Permanent (never expires)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tokenType === 'DURATION' && (
              <div className="space-y-2">
                <Label htmlFor="expires-at">Expiration Date</Label>
                <Input
                  id="expires-at"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            )}
            {tokenType === 'USAGE' && (
              <div className="space-y-2">
                <Label htmlFor="max-usage">Max Usage</Label>
                <Input
                  id="max-usage"
                  type="number"
                  min="1"
                  value={maxUsage}
                  onChange={(e) => setMaxUsage(e.target.value)}
                  placeholder="e.g., 1000"
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateToken}>Generate Token</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Token Display Modal */}
      <Dialog open={showTokenModal} onOpenChange={setShowTokenModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Token Created Successfully</DialogTitle>
            <DialogDescription>
              Copy this token now. You won't be able to see it again!
            </DialogDescription>
          </DialogHeader>
          {newToken && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  <strong>Important:</strong> This is the only time you'll see the full token. Make sure to copy it now.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label>Your API Token</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={newToken.token || ''}
                    readOnly
                    className="font-mono"
                  />
                  <Button
                    onClick={() => copyToClipboard(newToken.token || '')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setShowTokenModal(false)}>Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApiBlockProperties;
