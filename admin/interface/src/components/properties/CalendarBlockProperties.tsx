import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBlockEditor } from '@/contexts/BlockEditorContext';
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
import { Calendar, Info } from 'lucide-react';

interface CalendarBlockPropertiesProps {
  block: Block;
}

const CalendarBlockProperties: React.FC<CalendarBlockPropertiesProps> = ({ block }) => {
  const { updateBlock, blocks, addConnection, connections, deleteConnection } = useBlockEditor();

  // Get the latest block from context
  const latestBlock = blocks.find(b => b.id === block.id) || block;
  // Block types are stored as uppercase ('CONTEXT', 'ACTION'), normalize for comparison
  const blockType = (latestBlock.type || block.type || '').toUpperCase();
  const isContextBlock = blockType === 'CONTEXT';
  const isActionBlock = blockType === 'ACTION';
  const properties = (latestBlock.properties || {}) as {
    provider?: 'caldav';
    requiresUserAuth?: boolean;
    shareCredentialsWithBlockId?: string; // ID of CONTEXT block to share credentials with
    caldavConfig?: {
      serverUrl?: string;
      username?: string;
      useBasicAuth?: boolean;
      calendarPath?: string;
    };
    actionConfig?: {
      defaultCalendar?: string;
      defaultDuration?: number;
      defaultReminders?: Array<{
        method: 'email' | 'popup';
        minutes: number;
      }>;
      requireConfirmation?: boolean;
      allowUserOverride?: boolean;
      template?: {
        title?: string;
        description?: string;
        location?: string;
        variables?: string[];
      };
      allowedActions?: ('create' | 'update' | 'delete')[];
    };
  };
  
  // Get available Calendar context blocks for credential sharing
  const availableContextBlocks = blocks.filter(
    b => b.type === 'CONTEXT' && b.subtype === 'Calendar' && b.id !== block.id
  );

  const updateProperty = (key: string, value: string | number | boolean | undefined) => {
    updateBlock(block.id, {
      properties: {
        ...properties,
        [key]: value,
      },
    });
  };

  const updateNestedProperty = (path: string[], value: string | number | boolean | string[] | undefined) => {
    const newProperties = { ...properties };
    let current: Record<string, unknown> = newProperties;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    updateBlock(block.id, { properties: newProperties });
  };

  // Sync visual connection when shareCredentialsWithBlockId changes
  useEffect(() => {
    if (!isActionBlock) return;
    
    const contextBlockId = properties.shareCredentialsWithBlockId;
    
    if (contextBlockId) {
      const contextBlock = blocks.find(b => b.id === contextBlockId);
      
      if (contextBlock) {
        // Check if connection already exists
        const existingConnection = connections.find(
          conn => conn.fromBlockId === contextBlockId && 
                  conn.toBlockId === block.id &&
                  (conn.fromDirection === 'RIGHT' || conn.fromDirection === 'right') &&
                  (conn.toDirection === 'LEFT' || conn.toDirection === 'left')
        );
        
        if (!existingConnection) {
          // Create visual connection: context block (RIGHT) -> action block (LEFT)
          addConnection({
            fromBlockId: contextBlockId,
            toBlockId: block.id,
            fromHandle: 'RIGHT',
            toHandle: 'LEFT',
          });
        }
      }
    } else {
      // Remove connection if credential sharing is removed
      const connectionToRemove = connections.find(
        conn => conn.toBlockId === block.id &&
                (conn.fromDirection === 'RIGHT' || conn.fromDirection === 'right') &&
                (conn.toDirection === 'LEFT' || conn.toDirection === 'left') &&
                blocks.find(b => b.id === conn.fromBlockId && b.type === 'CONTEXT' && b.subtype === 'Calendar')
      );
      
      if (connectionToRemove) {
        deleteConnection(connectionToRemove.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties.shareCredentialsWithBlockId, block.id, isActionBlock, blocks.length, connections.length]);

  return (
    <div className="space-y-4">
      {/* User Authentication Alert - Show for context blocks */}
      {isContextBlock && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>User Authentication Required:</strong> Users will need to authenticate with their calendar account
            (Google Calendar or CalDAV) when they first use this feature. Credentials are stored securely and encrypted.
          </AlertDescription>
        </Alert>
      )}

      {/* Provider Selection - Only show for context blocks or action blocks not sharing credentials */}
      {isContextBlock || !properties.shareCredentialsWithBlockId ? (
        <div className="space-y-2">
          <Label htmlFor="provider">Calendar Provider</Label>
          <Select
            value={properties.provider || 'caldav'}
            onValueChange={(value) => updateProperty('provider', value)}
          >
            <SelectTrigger id="provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              
              <SelectItem value="caldav">CalDAV (Nextcloud, ownCloud, etc.)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* CalDAV Configuration */}
      {properties.provider === 'caldav' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">CalDAV Server Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="caldav-server-url">Server URL</Label>
              <Input
                id="caldav-server-url"
                value={properties.caldavConfig?.serverUrl || ''}
                onChange={(e) => updateNestedProperty(['caldavConfig', 'serverUrl'], e.target.value)}
                placeholder="https://nextcloud.example.com/remote.php/dav"
              />
              <p className="text-xs text-muted-foreground">
                Enter your CalDAV server URL. Common examples:
                <br />• Nextcloud: https://yourdomain.com/remote.php/dav
                <br />• ownCloud: https://yourdomain.com/remote.php/dav
                <br />• Baikal: https://yourdomain.com/baikal/cal.php/calendars
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="caldav-calendar-path">Calendar Path (Optional)</Label>
              <Input
                id="caldav-calendar-path"
                value={properties.caldavConfig?.calendarPath || ''}
                onChange={(e) => updateNestedProperty(['caldavConfig', 'calendarPath'], e.target.value)}
                placeholder="/calendars/{username}/"
              />
              <p className="text-xs text-muted-foreground">
                Custom calendar path. Leave empty to use default: /calendars/{'{username}'}/
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Note:</strong> Users will be prompted to enter their CalDAV server credentials
                (username and password) when they first use this feature. Credentials are encrypted and stored securely.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Credential Sharing - Only show for action blocks */}
      {isActionBlock && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Credential Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {availableContextBlocks.length > 0 ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="share-credentials" className="text-sm font-semibold">Link to Calendar Context Block</Label>
                  <Select
                    value={properties.shareCredentialsWithBlockId || ''}
                    onValueChange={(value) => {
                      const previousContextBlockId = properties.shareCredentialsWithBlockId;
                      
                      // Remove old connection if it existed
                      if (previousContextBlockId) {
                        const oldConnection = connections.find(
                          conn => conn.fromBlockId === previousContextBlockId && 
                                  conn.toBlockId === block.id &&
                                  (conn.fromDirection === 'RIGHT' || conn.fromDirection === 'right') &&
                                  (conn.toDirection === 'LEFT' || conn.toDirection === 'left')
                        );
                        if (oldConnection) {
                          deleteConnection(oldConnection.id);
                        }
                      }
                      
                      updateProperty('shareCredentialsWithBlockId', value || undefined);
                      
                      // Clear provider when sharing credentials (will inherit from context block)
                      if (value) {
                        updateProperty('provider', undefined);
                        
                        // Create visual connection between context block and action block
                        const contextBlock = blocks.find(b => b.id === value);
                        if (contextBlock) {
                          // Create connection: context block (RIGHT) -> action block (LEFT)
                          addConnection({
                            fromBlockId: contextBlock.id,
                            toBlockId: block.id,
                            fromHandle: 'RIGHT',
                            toHandle: 'LEFT',
                          });
                        }
                      }
                    }}
                  >
                    <SelectTrigger id="share-credentials">
                      <SelectValue placeholder="Select a Calendar context block..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableContextBlocks.map((contextBlock) => (
                        <SelectItem key={contextBlock.id} value={contextBlock.id}>
                          {contextBlock.title || `Calendar Block ${contextBlock.id.slice(0, 8)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {properties.shareCredentialsWithBlockId ? (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>✓ Linked:</strong> This action block will use credentials from the linked context block.
                      Configure calendar provider and authentication settings in the context block.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="warning">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>⚠ No credentials configured:</strong> Please link this action block to a Calendar context block above.
                      Calendar provider and authentication settings should be configured in the context block, not here.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <Alert variant="warning">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>⚠ No Calendar context block found:</strong> You need to create a Calendar context block first.
                  Configure calendar provider and authentication in the context block, then link this action block to it.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
};

export default CalendarBlockProperties;
