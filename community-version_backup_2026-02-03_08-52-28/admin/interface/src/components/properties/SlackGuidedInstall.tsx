import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ExternalLink, Copy, ChevronRight, ChevronLeft, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { adminApiClient, handleApiResponse } from '@/lib/apiClient';
import { startSlackOAuth, getSlackIntegration } from '@/lib/api';

interface SlackGuidedInstallProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockId: string;
  chatbotId: string;
  apiBaseUrl: string;
  botName: string;
  token: string | null;
  onComplete: () => void;
  onCredentialsSaved: () => void;
  onBotNameChange?: (botName: string) => void;
}

const steps = [
  {
    id: 0,
    title: 'Customize Bot Name',
    description: 'Set your bot name and customize the manifest',
  },
  {
    id: 1,
    title: 'Create Slack App from Manifest',
    description: 'Create your Slack app directly from the manifest',
  },
  {
    id: 2,
    title: 'Get App Credentials',
    description: 'Copy your Client ID, Client Secret, and Signing Secret',
  },
  {
    id: 3,
    title: 'Enter Credentials',
    description: 'Paste your credentials below',
  },
  {
    id: 4,
    title: 'Install to Workspace',
    description: 'Complete OAuth installation',
  },
];

export const SlackGuidedInstall: React.FC<SlackGuidedInstallProps> = ({
  open,
  onOpenChange,
  blockId,
  chatbotId,
  apiBaseUrl,
  botName: initialBotName,
  token,
  onComplete,
  onCredentialsSaved,
  onBotNameChange,
}) => {
  // CRITICAL: Use localStorage to persist step across component remounts
  // This prevents step from resetting when parent component re-renders
  const getStoredStep = (): number => {
    const stored = localStorage.getItem(`slack_tutorial_step_${blockId}`);
    if (stored !== null) {
      const step = parseInt(stored, 10);
      if (!isNaN(step) && step >= 0 && step <= 4) {
        return step;
      }
    }
    return 0;
  };

  const [currentStep, setCurrentStep] = useState(getStoredStep);
  const [botName, setBotName] = useState(initialBotName);
  const [appName, setAppName] = useState("CitadelAI Chatbot");
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [signingSecret, setSigningSecret] = useState('');
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [installing, setInstalling] = useState(false);
  const { toast } = useToast();

  // Track modal state to prevent unnecessary resets
  const prevOpenRef = useRef(open);
  const hasInitializedRef = useRef(false);
  
  // CRITICAL: Persist step to localStorage whenever it changes
  useEffect(() => {
    if (open) {
      localStorage.setItem(`slack_tutorial_step_${blockId}`, currentStep.toString());
    }
  }, [currentStep, blockId, open]);
  
  useEffect(() => {
    // Only reset if modal was closed and is now opening (not if it was already open)
    if (open && !prevOpenRef.current) {
      // Check if tutorial was completed - if so, reset everything
      const tutorialCompleted = localStorage.getItem(`slack_tutorial_completed_${blockId}`);
      if (tutorialCompleted === 'true') {
        // Tutorial was completed - start fresh and clear any stored step
        setCurrentStep(0);
        localStorage.removeItem(`slack_tutorial_step_${blockId}`);
        setClientId('');
        setClientSecret('');
        setSigningSecret('');
        setBotName(initialBotName);
        hasInitializedRef.current = true;
        prevOpenRef.current = open;
        return;
      }
      
      // Check localStorage for saved step (survives component remounts)
      const storedStep = getStoredStep();
      
      if (storedStep > 0) {
        // Restore the stored step (component was remounted but step was preserved)
        // This is the key fix - step survives component remounts
        setCurrentStep(storedStep);
      } else {
        // Fresh open - start at step 0
        setCurrentStep(0);
        // Reset credential fields when opening fresh
        setClientId('');
        setClientSecret('');
        setSigningSecret('');
        // Reset bot name to initial value
        setBotName(initialBotName);
      }
      hasInitializedRef.current = true;
    } else if (open && prevOpenRef.current && hasInitializedRef.current) {
      // Modal is already open - preserve the current step
      // Don't reset anything, but ensure localStorage is up to date
      const storedStep = getStoredStep();
      if (currentStep !== storedStep) {
        localStorage.setItem(`slack_tutorial_step_${blockId}`, currentStep.toString());
      }
      return;
    }
    
    prevOpenRef.current = open;
    
    // If modal closes, don't clear localStorage - keep step for potential remount
    // Only clear when tutorial is completed or manually reset
    if (!open) {
      hasInitializedRef.current = false;
    }
  }, [open, initialBotName, blockId, currentStep]);

  // Update bot name when initialBotName changes, but only if modal just opened
  useEffect(() => {
    if (open && !hasInitializedRef.current) {
      setBotName(initialBotName);
    }
  }, [initialBotName, open]);

  const manifest = {
    display_information: {
      name: appName,
      description: "AI-powered chatbot integration for Slack workspaces",
      background_color: "#2c2c2c",
    },
    features: {
      bot_user: {
        display_name: botName,
        always_online: true,
      },
      assistant_view: {
        assistant_description: "Ask me anything! I can help answer questions, summarize conversations, and provide information based on your chatbot's knowledge base.",
      },
    },
    oauth_config: {
      redirect_urls: [
        `${apiBaseUrl}/api/admin/slack/oauth/callback`,
      ],
      scopes: {
        bot: [
          "app_mentions:read",
          "assistant:write",
          "channels:history",
          "channels:read",
          "chat:write",
          "groups:history",
          "groups:read",
          "im:history",
          "im:read",
          "im:write",
          "mpim:history",
          "mpim:read",
          "users:read",
          "users:read.email",
        ],
      },
    },
    settings: {
      event_subscriptions: {
        request_url: `${apiBaseUrl}/api/admin/slack/events`,
        bot_events: [
          "app_mention",
          "assistant_thread_started",
          "assistant_thread_context_changed",
          "message.channels",
          "message.groups",
          "message.im",
          "message.mpim",
        ],
      },
      interactivity: {
        is_enabled: true,
        request_url: `${apiBaseUrl}/api/admin/slack/interactive`,
      },
      org_deploy_enabled: false,
      socket_mode_enabled: false,
      token_rotation_enabled: false,
    },
  };

  const handleCopyManifest = () => {
    navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
    toast({
      title: "Copied!",
      description: "Manifest copied to clipboard. You can now create your app from it.",
    });
  };

  const handleCopyAndOpenSlack = () => {
    // Copy manifest to clipboard
    navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
    
    // Open Slack app creation page
    window.open('https://api.slack.com/apps?new_app=1', '_blank');
    
    toast({
      title: "Manifest Copied!",
      description: "Manifest copied to clipboard. On the Slack page, click 'Create from manifest' and paste it.",
    });
  };

  const handleSaveCredentials = async () => {
    if (!clientId || !clientSecret || !signingSecret) {
      toast({
        title: "Missing Credentials",
        description: "Please fill in all three credential fields.",
        variant: "destructive",
      });
      return;
    }

    if (!token) {
      toast({
        title: "Authentication Required",
        description: "Please log in to save credentials.",
        variant: "destructive",
      });
      return;
    }

    setSavingCredentials(true);
    try {
      const response = await adminApiClient.post(
        `/chatbots/${chatbotId}/slack/integration/credentials`,
        {
          blockId,
          clientId,
          clientSecret,
          signingSecret,
        },
        token
      );

      await handleApiResponse(response);
      toast({
        title: "Credentials Saved",
        description: "Your Slack app credentials have been saved securely.",
      });
      // Move to installation step first, then reload integration in background
      // Don't close the modal - let user proceed to step 4
      // CRITICAL: Update both state and localStorage immediately to prevent loss on remount
      setCurrentStep(4);
      localStorage.setItem(`slack_tutorial_step_${blockId}`, '4');
      // Call onCredentialsSaved but don't wait for it to complete
      // This allows the modal to stay open and move to next step
      onCredentialsSaved().catch(err => console.error('Error reloading integration:', err));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save credentials';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleInstall = async () => {
    if (!token) {
      toast({
        title: "Authentication Required",
        description: "Please log in to install the bot.",
        variant: "destructive",
      });
      return;
    }

    setInstalling(true);
    try {
      const data = await startSlackOAuth(chatbotId, blockId, token);
      
      // Open OAuth URL in new window/popup
      const popup = window.open(data.oauthUrl, '_blank', 'width=600,height=700');
      
      if (!popup) {
        toast({
          title: "Popup Blocked",
          description: "Please allow popups for this site to complete installation.",
          variant: "destructive",
        });
        setInstalling(false);
        return;
      }
      
      // Check if popup was closed manually
      const checkPopupClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopupClosed);
          clearInterval(pollInterval);
          setInstalling(false);
          return;
        }
      }, 500);
      
      // Poll for integration status (check every 2 seconds for up to 60 seconds)
      let attempts = 0;
      const maxAttempts = 30; // 60 seconds total
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const integrationData = await getSlackIntegration(chatbotId, token);
          if (integrationData.integration && integrationData.integration.teamId) {
            // Installation successful - close popup and update UI
            if (popup && !popup.closed) {
              try {
                popup.close();
              } catch (e) {
                // Popup might be blocked from closing, that's okay
                console.log('Could not close popup:', e);
              }
            }
            clearInterval(pollInterval);
            clearInterval(checkPopupClosed);
            setInstalling(false);
            toast({
              title: "Installation Complete",
              description: "Your Slack bot has been installed successfully!",
            });
            // Mark tutorial as completed and call onComplete
            localStorage.setItem(`slack_tutorial_completed_${blockId}`, 'true');
            // Clear the step from localStorage when tutorial is completed
            localStorage.removeItem(`slack_tutorial_step_${blockId}`);
            onComplete();
          } else if (attempts >= maxAttempts) {
            // Timeout - stop polling
            clearInterval(pollInterval);
            clearInterval(checkPopupClosed);
            setInstalling(false);
            toast({
              title: "Installation Timeout",
              description: "Installation is taking longer than expected. Please check your Slack workspace.",
              variant: "destructive",
            });
          }
        } catch (error) {
          // Continue polling on error
          console.error('Error polling for integration:', error);
        }
      }, 2000);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start installation';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setInstalling(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 3) {
      // Step 3: Validate credentials before moving forward
      if (!clientId || !clientSecret || !signingSecret) {
        toast({
          title: "Missing Credentials",
          description: "Please fill in all credential fields before continuing.",
          variant: "destructive",
        });
        return;
      }
      handleSaveCredentials();
      return;
    }
    
    const maxStepId = steps[steps.length - 1].id;
    if (currentStep < maxStepId) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      // CRITICAL: Update localStorage immediately to prevent loss on remount
      localStorage.setItem(`slack_tutorial_step_${blockId}`, nextStep.toString());
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      // CRITICAL: Update localStorage immediately to prevent loss on remount
      localStorage.setItem(`slack_tutorial_step_${blockId}`, prevStep.toString());
    }
  };

  const handleComplete = async () => {
    localStorage.setItem(`slack_tutorial_completed_${blockId}`, 'true');
    // Clear the step from localStorage when tutorial is completed
    localStorage.removeItem(`slack_tutorial_step_${blockId}`);
    await onComplete();
    onOpenChange(false);
  };

  const currentStepData = steps.find(s => s.id === currentStep)!;
  const isLastStep = currentStep === steps[steps.length - 1].id;
  const hasAllCredentials = clientId && clientSecret && signingSecret;

  // Prevent dialog from closing unexpectedly during credential save or step transitions
  const handleDialogOpenChange = (newOpen: boolean) => {
    // CRITICAL: Only allow closing if we're not in the middle of saving credentials or installing
    // This prevents the dialog from closing during step 3->4 transition
    if (!newOpen && (savingCredentials || installing)) {
      // Don't close if credentials are being saved or installation is in progress
      return;
    }
    
    // If closing, save the current step (will be handled by useEffect)
    // But only if this is a real user action, not a forced close
    if (!newOpen) {
      // Step will be saved in the useEffect with timestamp
    }
    
    // Call parent's onOpenChange handler
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <span>Slack Bot Guided Installation</span>
            <Badge variant="outline" className="ml-auto">
              Step {currentStep} of {steps.length}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Follow these steps to set up your Slack bot integration.
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-6 flex-shrink-0">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    step.id < currentStep
                      ? 'bg-green-500 border-green-500 text-white'
                      : step.id === currentStep
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-muted border-muted-foreground text-muted-foreground'
                  }`}
                >
                  {step.id < currentStep ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span className="text-xs font-semibold">{step.id}</span>
                  )}
                </div>
                <span className="text-xs mt-1 text-center text-muted-foreground hidden sm:block">
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 ${
                    step.id < currentStep ? 'bg-green-500' : 'bg-muted'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <Card className="flex-1 overflow-hidden flex flex-col">
          <CardContent className="p-6 overflow-y-auto flex-1">
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-1">{currentStepData.title}</h3>
              <p className="text-sm text-muted-foreground">{currentStepData.description}</p>
            </div>

            {currentStep === 0 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Customize your app and bot names before creating the Slack app. These will be included in the manifest.
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="app-name-input">App Name</Label>
                    <Input
                      id="app-name-input"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      placeholder="CitadelAI Chatbot"
                      maxLength={80}
                    />
                    <p className="text-xs text-muted-foreground">
                      This is the name of your Slack app as it appears in the Slack App Directory.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bot-name-input">Bot Display Name</Label>
                    <Input
                      id="bot-name-input"
                      value={botName}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setBotName(newName);
                        if (onBotNameChange) {
                          onBotNameChange(newName);
                        }
                      }}
                      placeholder="CitadelAI Bot"
                      maxLength={80}
                    />
                    <p className="text-xs text-muted-foreground">
                      This will be the display name of your bot in Slack conversations. You can change it later in your Slack app settings.
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="text-xs text-blue-800 dark:text-blue-200">
                      <strong>Note:</strong> The manifest in the next step will be customized with these names. Make sure to use these exact names when creating your Slack app.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Copy the manifest below, then open the Slack app creation page to paste it.
                </p>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <pre className="flex-1 text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-48 overflow-y-auto">
                      {JSON.stringify(manifest, null, 2)}
                    </pre>
                    <Button size="sm" variant="outline" onClick={handleCopyManifest}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    onClick={() => {
                      // Copy manifest first
                      handleCopyManifest();
                      // Then open Slack creation page
                      setTimeout(() => {
                        window.open('https://api.slack.com/apps?new_app=1', '_blank');
                      }, 100);
                    }}
                    className="w-full"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Manifest & Open Slack App Creation
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    After opening the page, click "Create from manifest" and paste the copied manifest.
                  </p>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  After creating your app, you need to copy three credentials from your Slack app settings.
                </p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Go to your Slack app's "Basic Information" page</li>
                  <li>Scroll down to "App Credentials"</li>
                  <li>Copy the <strong>Client ID</strong></li>
                  <li>Click "Show" next to <strong>Client Secret</strong> and copy it</li>
                  <li>Click "Show" next to <strong>Signing Secret</strong> and copy it</li>
                </ol>
                <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div className="text-xs text-amber-800 dark:text-amber-200">
                      <strong>Important:</strong> While you're in your Slack app settings, go to <strong>"App Home"</strong> and enable <strong>"Messages Tab"</strong> under "Show Tabs", then enable <strong>"Allow users to send Slash commands and messages from the messages tab"</strong>. This allows users to send direct messages to your bot.
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => window.open('https://api.slack.com/apps', '_blank')}
                  variant="outline"
                  className="w-full"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Your Slack App Settings
                </Button>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Paste the credentials you copied into the fields below. They will be saved securely.
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientId">Client ID</Label>
                    <Input
                      id="clientId"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="xoxb-..."
                      type="password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientSecret">Client Secret</Label>
                    <Input
                      id="clientSecret"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="Enter client secret"
                      type="password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signingSecret">Signing Secret</Label>
                    <Input
                      id="signingSecret"
                      value={signingSecret}
                      onChange={(e) => setSigningSecret(e.target.value)}
                      placeholder="Enter signing secret"
                      type="password"
                    />
                  </div>
                </div>
                {hasAllCredentials && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
                      <div className="text-xs text-green-800 dark:text-green-200">
                        All credentials entered. Click "Save & Continue" to proceed.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Now you can install the bot to your Slack workspace. This will open a popup where you can authorize the bot.
                </p>
                <Button
                  onClick={handleInstall}
                  disabled={installing}
                  className="w-full"
                >
                  {installing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Install to Slack Workspace
                    </>
                  )}
                </Button>
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="text-xs text-blue-800 dark:text-blue-200">
                      <strong>Note:</strong> After installation, you can configure how the bot responds (mentions, DMs, threads, etc.) in the properties panel.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation buttons */}
        <div className="flex justify-between items-center mt-6 flex-shrink-0">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <Button
            onClick={currentStep === 3 ? handleSaveCredentials : handleNext}
            disabled={(currentStep === 3 && savingCredentials) || (currentStep === 0 && (!botName.trim() || !appName.trim()))}
          >
            {currentStep === 3 ? (
              savingCredentials ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save & Continue'
              )
            ) : isLastStep ? (
              'Complete'
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
