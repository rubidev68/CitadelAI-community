import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useBlockEditor } from '@/contexts/BlockEditorContext';
import { useToast } from '@/hooks/use-toast';
import {
  getSlackIntegration,
  startSlackOAuth,
  updateSlackIntegration,
  revokeSlackIntegration,
  SlackIntegration,
} from '@/lib/api';
import { Block } from '@/types/block';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { MessageSquare, ExternalLink, Trash2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { SlackGuidedInstall } from './SlackGuidedInstall';

interface SlackBlockPropertiesProps {
  block: Block;
}

const SlackBlockProperties: React.FC<SlackBlockPropertiesProps> = ({ block }) => {
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
    // Replace admin. with api. for API calls, or use current host if no admin prefix
    const apiHost = host.includes('admin.') ? host.replace('admin.', 'api.') : host;
    return `${protocol}//${apiHost}`;
  };

  const apiBaseUrl = getApiBaseUrl();

  const [integration, setIntegration] = useState<SlackIntegration | null>(null);
  const [loading, setLoading] = useState(true); // Start as true to prevent tutorial from opening before integration loads
  const [installing, setInstalling] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorialManuallyClosedRef = useRef(false); // Track if user manually closed tutorial
  const savingCredentialsRef = useRef(false); // Track if credentials are being saved
  const inTutorialFlowRef = useRef(false); // Track if user is actively going through tutorial
  
  // Type guard for Slack block properties
  interface SlackBlockProperties {
    botName?: string;
  }
  
  const getBotName = (properties: Record<string, unknown>): string => {
    if (properties && typeof properties === 'object' && 'botName' in properties) {
      const botNameValue = properties.botName;
      if (typeof botNameValue === 'string') {
        return botNameValue;
      }
    }
    return 'CitadelAI Bot';
  };
  
  const [botName, setBotName] = useState<string>(getBotName(block.properties));

  // Update bot name in block properties when changed
  const handleBotNameChange = (newBotName: string) => {
    setBotName(newBotName);
    updateBlock(block.id, {
      properties: {
        ...block.properties,
        botName: newBotName,
      },
    });
  };

  // Load integration on mount
  useEffect(() => {
    if (chatbotId && token) {
      loadIntegration();
    }
    // Reset tutorial closed ref when block changes
    tutorialManuallyClosedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatbotId, token, block.id]);

  // Track if integration has been loaded at least once
  const integrationLoadedRef = useRef(false);
  
  // Check if tutorial should be shown (only after integration has loaded)
  const prevIntegrationRef = useRef<SlackIntegration | null>(null);
  
  useEffect(() => {
    if (!chatbotId || !block.id) return;
    
    // CRITICAL: Wait for loading to complete AND integration to be loaded at least once
    // This prevents tutorial from opening when integration is null (before first load)
    if (loading || !integrationLoadedRef.current) {
      return;
    }
    
    // CRITICAL: If modal is currently open, NEVER run this logic - it will interfere
    // This is the key fix - don't touch anything if modal is open
    // Check this FIRST before any other logic
    if (showTutorial) {
      // Just update the ref and return - don't do anything else
      // This prevents any state changes that could cause the modal to close
      if (integration) {
        prevIntegrationRef.current = integration;
      }
      return;
    }
    
    // Don't auto-open if user manually closed it
    if (tutorialManuallyClosedRef.current) {
      if (integration) {
        prevIntegrationRef.current = integration;
      }
      return;
    }
    
    // Don't interfere if credentials are being saved or user is in tutorial flow
    // This is critical during the step 3->4 transition
    if (savingCredentialsRef.current || inTutorialFlowRef.current) {
      if (integration) {
        prevIntegrationRef.current = integration;
      }
      return;
    }
    
    // CRITICAL FIX: If app is already installed, NEVER show tutorial
    const isInstalled = integration && integration.teamId;
    if (isInstalled) {
      // App is installed - mark tutorial as completed and don't show it
      localStorage.setItem(`slack_tutorial_completed_${block.id}`, 'true');
      tutorialManuallyClosedRef.current = true; // Prevent it from opening
      if (integration) {
        prevIntegrationRef.current = integration;
      }
      return;
    }
    
    // Don't auto-open if integration just changed from having no credentials to having credentials
    // This prevents reopening when credentials are saved during the tutorial
    const prevHadCredentials = prevIntegrationRef.current && prevIntegrationRef.current.clientId;
    const nowHasCredentials = integration && integration.clientId;
    if (!prevHadCredentials && nowHasCredentials) {
      // Credentials were just added - don't auto-open tutorial (user is in the middle of setup)
      // Also mark tutorial as in progress to prevent reopening
      tutorialManuallyClosedRef.current = true;
      if (integration) {
        prevIntegrationRef.current = integration;
      }
      return;
    }
    
    const tutorialCompleted = localStorage.getItem(`slack_tutorial_completed_${block.id}`);
    const hasCredentials = integration && integration.clientId;
    
    // Show tutorial if:
    // 1. Tutorial hasn't been completed for this block, OR
    // 2. No credentials are set up yet
    // BUT only if app is NOT installed (double check)
    // AND modal is NOT currently open (triple check)
    // AND we're not saving credentials or in tutorial flow
    if (!isInstalled && !showTutorial && !savingCredentialsRef.current && !inTutorialFlowRef.current && (!tutorialCompleted || !hasCredentials)) {
      setShowTutorial(true);
    }
    
    // Update ref after checking (only if integration exists)
    if (integration) {
      prevIntegrationRef.current = integration;
    }
  }, [block.id, chatbotId, loading, integration, showTutorial]); // Include loading and integration to wait for load completion

  // Sync bot name from block properties when block changes
  useEffect(() => {
    const blockBotName = getBotName(block.properties);
    if (blockBotName !== botName) {
      setBotName(blockBotName);
    }
  }, [block.properties, botName]);

  // Check for OAuth callback success/error in URL params
  useEffect(() => {
    const slackSuccess = searchParams.get('slack_success');
    const slackError = searchParams.get('slack_error');
    
    if (slackSuccess === 'true') {
      toast({
        title: 'Success',
        description: 'Slack integration installed successfully!',
      });
      // Remove query param from URL first
      searchParams.delete('slack_success');
      setSearchParams(searchParams, { replace: true });
      // Reload integration once
      loadIntegration();
    } else if (slackError) {
      toast({
        title: 'Installation Failed',
        description: `Slack installation failed: ${decodeURIComponent(slackError)}`,
        variant: 'destructive',
      });
      // Remove query param from URL
      searchParams.delete('slack_error');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);

  // Periodic refresh disabled - integration is only loaded on mount and when explicitly requested

  const loadIntegration = async () => {
    if (!chatbotId || !token) return;
    try {
      setLoading(true);
      const data = await getSlackIntegration(chatbotId, token);
      
      // CRITICAL: If app is installed, mark tutorial as completed and prevent it from opening
      // BUT: Only close modal if we're NOT currently in the tutorial flow (saving credentials)
      if (data.integration && data.integration.teamId) {
        localStorage.setItem(`slack_tutorial_completed_${block.id}`, 'true');
        tutorialManuallyClosedRef.current = true;
        inTutorialFlowRef.current = false;
        // Only close tutorial if we're NOT saving credentials (which means user completed installation)
        // If savingCredentialsRef is true, we're in the middle of step 3->4 transition, so keep modal open
        if (showTutorial && !savingCredentialsRef.current) {
          setShowTutorial(false);
        }
      }
      
      // CRITICAL: Update prevIntegrationRef BEFORE updating integration state
      // This prevents the useEffect from seeing a "new" integration and reopening the modal
      if (data.integration) {
        prevIntegrationRef.current = { ...data.integration };
      }
      
      // Update integration state AFTER all checks and ref updates
      setIntegration(data.integration);
      // Mark that integration has been loaded at least once
      integrationLoadedRef.current = true;
      
      // Return data for use in callbacks
      return data;
    } catch (error: unknown) {
      console.error('Error loading Slack integration:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load Slack integration';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      // Even on error, mark as loaded so tutorial logic can run
      integrationLoadedRef.current = true;
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    if (!chatbotId || !token) return;
    
    // Mark tutorial as completed when user starts installation from properties panel
    localStorage.setItem(`slack_tutorial_completed_${block.id}`, 'true');
    try {
      setInstalling(true);
      const data = await startSlackOAuth(chatbotId, block.id, token);
      // Open OAuth URL in new window/popup
      const popup = window.open(data.oauthUrl, '_blank', 'width=600,height=700');
      
      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }
      
      // Check if popup was closed manually or navigated to callback URL
      const checkPopupClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopupClosed);
          clearInterval(pollInterval);
          setInstalling(false);
          return;
        }
        
        // Try to detect if popup navigated to our callback URL
        try {
          // Check if popup location contains our callback path
          if (popup.location && popup.location.href) {
            const href = popup.location.href;
            if (href.includes('/api/admin/slack/oauth/callback') || 
                href.includes('slack_success') || 
                href.includes('slack_error')) {
              // Popup navigated to callback - close it
              popup.close();
              clearInterval(checkPopupClosed);
              clearInterval(pollInterval);
              // Don't set installing to false yet - let polling detect success
            }
          }
        } catch (e) {
          // Cross-origin error is expected - popup might be on Slack's domain
          // This is normal and we'll detect success via polling
        }
      }, 500);
      
      // Poll for integration status (check every 2 seconds for up to 60 seconds)
      let attempts = 0;
      const maxAttempts = 30; // Increased to 60 seconds total
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const data = await getSlackIntegration(chatbotId, token);
          if (data.integration && data.integration.teamId) {
            // Installation successful - close popup and update UI
            if (popup && !popup.closed) {
              try {
                popup.close();
              } catch (e) {
                // Popup might be blocked from closing, that's okay
                console.log('Could not close popup:', e);
              }
            }
            setIntegration(data.integration);
            clearInterval(pollInterval);
            clearInterval(checkPopupClosed);
            setInstalling(false);
            toast({
              title: 'Success',
              description: 'Slack integration installed successfully!',
            });
            // Mark tutorial as completed
            localStorage.setItem(`slack_tutorial_completed_${block.id}`, 'true');
            // Reload integration to ensure UI is updated
            loadIntegration();
            return;
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            clearInterval(checkPopupClosed);
            setInstalling(false);
            toast({
              title: 'Timeout',
              description: 'Installation timed out. Please check if the installation completed.',
              variant: 'destructive',
            });
            return;
          }
        } catch (error) {
          // Ignore errors during polling
        }
      }, 2000);

      // Cleanup intervals after 30 seconds
      setTimeout(() => {
        clearInterval(pollInterval);
        clearInterval(checkPopupClosed);
        // Close popup if still open after timeout
        if (popup && !popup.closed) {
          popup.close();
        }
        setInstalling(false);
      }, 30000);
    } catch (error: unknown) {
      console.error('Error starting Slack OAuth:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start Slack installation';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      setInstalling(false);
    }
  };

  const handleUninstall = async () => {
    if (!chatbotId || !token) return;
    if (!confirm('Are you sure you want to uninstall the Slack integration? The bot will stop responding in Slack.')) {
      return;
    }

    try {
      await revokeSlackIntegration(chatbotId, token);
      setIntegration(null);
      toast({
        title: 'Success',
        description: 'Slack integration uninstalled successfully',
      });
    } catch (error: unknown) {
      console.error('Error uninstalling Slack integration:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to uninstall Slack integration';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleConfigUpdate = async (field: keyof SlackIntegration, value: boolean) => {
    if (!chatbotId || !token || !integration) return;

    try {
      const updates: Partial<Pick<SlackIntegration, 'respondToMentions' | 'respondInThreads' | 'respondInDMs' | 'respondInChannels'>> = { [field]: value };
      const data = await updateSlackIntegration(chatbotId, updates, token);
      setIntegration(data.integration);
      toast({
        title: 'Success',
        description: 'Configuration updated',
      });
    } catch (error: unknown) {
      console.error('Error updating Slack integration:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update configuration';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  const hasCredentials = integration && integration.clientId;
  const isInstalled = integration && integration.teamId;
  const tutorialCompleted = localStorage.getItem(`slack_tutorial_completed_${block.id}`);

  // Show blocking message if app is not installed AND (tutorial not completed or credentials not set)
  // If app is installed, setup is considered complete regardless of tutorial status
  const isSetupIncomplete = !isInstalled && (!tutorialCompleted || !hasCredentials);

  return (
    <div className="space-y-4">
      {/* Guided Installation Modal */}
      <SlackGuidedInstall
        open={showTutorial}
        onOpenChange={(open) => {
          // CRITICAL: Don't allow closing if credentials are being saved OR if we're in tutorial flow
          // This prevents the modal from closing when integration reloads after saving credentials
          if (!open && (savingCredentialsRef.current || inTutorialFlowRef.current)) {
            // Keep modal open if credentials are being saved or user is in tutorial flow
            // This is critical during step 3->4 transition
            return;
          }
          
          // Only update state if this is a real user action, not a state update side effect
          setShowTutorial(open);
          
          // Track if user manually closed the modal
          if (open) {
            // Modal is opening - mark that user is in tutorial flow
            inTutorialFlowRef.current = true;
            // Clear the manually closed flag when opening
            tutorialManuallyClosedRef.current = false;
          } else {
            // Modal is closing
            // Only mark as manually closed if credentials aren't being saved AND we're not in tutorial flow
            // This prevents the flag from being set during credential save flow
            if (!savingCredentialsRef.current && !inTutorialFlowRef.current) {
              tutorialManuallyClosedRef.current = true;
              inTutorialFlowRef.current = false; // User exited tutorial flow
              // Don't clear the step from localStorage - allow user to resume later
              // Step will be cleared when tutorial is completed or when user starts fresh
            }
            // Only reset savingCredentialsRef if we're actually closing (not prevented above)
            if (!savingCredentialsRef.current) {
              savingCredentialsRef.current = false;
            }
          }
        }}
        blockId={block.id}
        chatbotId={chatbotId || ''}
        apiBaseUrl={apiBaseUrl}
        botName={botName}
        token={token}
        onComplete={async () => {
          // Mark tutorial as completed FIRST
          localStorage.setItem(`slack_tutorial_completed_${block.id}`, 'true');
          // Clear the step from localStorage when tutorial is completed
          localStorage.removeItem(`slack_tutorial_step_${block.id}`);
          // Mark that we're completing (not saving credentials, but similar protection needed)
          tutorialManuallyClosedRef.current = true;
          // Exit tutorial flow
          inTutorialFlowRef.current = false;
          // Close modal FIRST before reloading integration
          // This prevents any state updates from interfering with modal state
          setShowTutorial(false);
          // Then reload integration (this will update state but modal is already closed)
          await loadIntegration();
        }}
        onCredentialsSaved={async () => {
          // CRITICAL: Mark that we're saving credentials to prevent modal from closing/reopening
          // Set these flags IMMEDIATELY before any async operations
          savingCredentialsRef.current = true;
          inTutorialFlowRef.current = true;
          
          // Update prevIntegrationRef BEFORE loading to prevent reopening
          // Create a defensive copy of current integration state
          if (integration) {
            prevIntegrationRef.current = { ...integration };
          }
          
          // Reload integration after credentials are saved
          // Use requestAnimationFrame to ensure this happens after React has processed current state
          requestAnimationFrame(() => {
            loadIntegration()
              .then((data) => {
                // loadIntegration already updates prevIntegrationRef, but ensure it's set
                if (data && data.integration) {
                  prevIntegrationRef.current = { ...data.integration };
                }
                // Keep flags true for a longer duration to prevent any reopening or interference
                // This gives React time to process all state updates
                setTimeout(() => {
                  savingCredentialsRef.current = false;
                  // Keep inTutorialFlowRef true - it will be set to false when user closes or completes
                }, 3000); // Increased to 3 seconds to be extra safe
              })
              .catch(err => {
                savingCredentialsRef.current = false;
                inTutorialFlowRef.current = false;
                console.error('Error reloading integration:', err);
              });
          });
        }}
        onBotNameChange={(newBotName) => {
          handleBotNameChange(newBotName);
        }}
      />

      {/* Blocking overlay if setup incomplete */}
      {isSetupIncomplete && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>
                Complete the Slack setup tutorial to enable the bot. Click the button below to start.
              </span>
              <Button 
                onClick={() => {
                  // Double check that app is not installed before opening tutorial
                  if (!integration || !integration.teamId) {
                    setShowTutorial(true);
                  }
                }} 
                size="sm"
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Start Setup Tutorial
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      {/* Bot Name Configuration */}
      {!hasCredentials && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Bot Configuration
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Double check that app is not installed before opening tutorial
                  if (!integration || !integration.teamId) {
                    setShowTutorial(true);
                  }
                }}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Show Setup Tutorial
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bot-name">Bot Name in Slack</Label>
              <Input
                id="bot-name"
                value={botName}
                onChange={(e) => handleBotNameChange(e.target.value)}
                placeholder="CitadelAI Bot"
                maxLength={80}
              />
              <p className="text-xs text-muted-foreground">
                This will be the display name of your bot in Slack. You can change it before installing.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Installation Status */}
      {hasCredentials && (
        <>
        {!isInstalled ? (
          <Alert>
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span>Slack credentials are configured. Click the button below to install the bot to your Slack workspace.</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Double check that app is not installed before opening tutorial
                      if (!integration || !integration.teamId) {
                        setShowTutorial(true);
                      }
                    }}
                    size="sm"
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Show Tutorial
                  </Button>
                  <Button onClick={handleInstall} disabled={installing}>
                    {installing ? 'Installing...' : (
                      <>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Install to Slack
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
            <>
              {/* Integration Status Card */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Integration Status</CardTitle>
                    <Badge variant={integration.isActive ? 'default' : 'destructive'}>
                      {integration.isActive ? (
                        <>
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Active
                        </>
                      ) : (
                        <>
                          <XCircle className="mr-1 h-3 w-3" />
                          Inactive
                        </>
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Workspace:</span>
                    <span className="font-medium">{integration.teamName}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Bot Name:</span>
                    <span className="font-medium">@{integration.botUserName}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Installed:</span>
                    <span>{new Date(integration.installedAt).toLocaleDateString()}</span>
                  </div>
                  {integration.lastUsedAt && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Last Used:</span>
                      <span>{new Date(integration.lastUsedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="flex justify-end pt-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleUninstall}
                    >
                      <Trash2 className="mr-2 h-3 w-3" />
                      Uninstall
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Configuration */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Configuration</Label>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="respond-to-mentions">Respond to Mentions</Label>
                      <p className="text-xs text-muted-foreground">
                        Bot will respond when @mentioned in channels
                      </p>
                    </div>
                    <Switch
                      id="respond-to-mentions"
                      checked={integration.respondToMentions}
                      onCheckedChange={(checked) => handleConfigUpdate('respondToMentions', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="respond-in-threads">Respond in Threads</Label>
                      <p className="text-xs text-muted-foreground">
                        Bot will respond in threads when message is in a thread
                      </p>
                    </div>
                    <Switch
                      id="respond-in-threads"
                      checked={integration.respondInThreads}
                      onCheckedChange={(checked) => handleConfigUpdate('respondInThreads', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="respond-in-dms">Respond to Direct Messages</Label>
                      <p className="text-xs text-muted-foreground">
                        Bot will respond to direct messages
                      </p>
                    </div>
                    <Switch
                      id="respond-in-dms"
                      checked={integration.respondInDMs}
                      onCheckedChange={(checked) => handleConfigUpdate('respondInDMs', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="respond-in-channels">Respond in Public Channels</Label>
                      <p className="text-xs text-muted-foreground">
                        Bot will respond in public channels even when not mentioned (use with caution)
                      </p>
                    </div>
                    <Switch
                      id="respond-in-channels"
                      checked={integration.respondInChannels}
                      onCheckedChange={(checked) => handleConfigUpdate('respondInChannels', checked)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default SlackBlockProperties;
