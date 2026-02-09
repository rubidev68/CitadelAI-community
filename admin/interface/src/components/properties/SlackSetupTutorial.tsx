import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ExternalLink, Copy, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SlackSetupTutorialProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockId: string;
  apiBaseUrl: string;
  botName: string;
  onComplete: () => void;
}

const steps = [
  {
    id: 1,
    title: 'Create Slack App',
    description: 'Create a new Slack app in your workspace',
    content: (
      <>
        <p className="text-sm text-muted-foreground mb-4">
          First, you need to create a Slack app. This app will act as your chatbot in Slack.
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground mb-4">
          <li>Go to the Slack API website</li>
          <li>Click "Create New App"</li>
          <li>Select "From scratch"</li>
          <li>Enter an app name (e.g., "CitadelAI Chatbot")</li>
          <li>Select your workspace</li>
          <li>Click "Create App"</li>
        </ol>
        <Button
          onClick={() => window.open('https://api.slack.com/apps', '_blank')}
          className="w-full"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Open Slack API Apps Page
        </Button>
      </>
    ),
  },
  {
    id: 2,
    title: 'Configure App Manifest',
    description: 'Copy and paste the manifest to configure your app',
    content: (apiBaseUrl: string, botName: string, onCopy: () => void) => (
      <>
        <p className="text-sm text-muted-foreground mb-4">
          The app manifest configures all the necessary settings for your Slack bot. Copy it and paste it into your Slack app.
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground mb-4">
          <li>In your Slack app, go to "App Manifest" in the left sidebar</li>
          <li>Click "Edit"</li>
          <li>Copy the manifest JSON below</li>
          <li>Paste it into the manifest editor</li>
          <li>Click "Save Changes"</li>
        </ol>
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold">App Manifest JSON</span>
              <Button
                size="sm"
                variant="outline"
                onClick={onCopy}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </Button>
            </div>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-64 overflow-y-auto">
              {JSON.stringify({
                display_information: {
                  name: "CitadelAI Chatbot",
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
                    suggested_prompts: [
                      {
                        text: "Summarize this channel",
                        prompt: "Can you summarize the recent conversations in this channel?",
                      },
                      {
                        text: "What can you help me with?",
                        prompt: "What can you help me with?",
                      },
                      {
                        text: "Ask a question",
                        prompt: "",
                      },
                    ],
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
              }, null, 2)}
            </pre>
          </CardContent>
        </Card>
        <Button
          onClick={() => window.open('https://api.slack.com/apps', '_blank')}
          variant="outline"
          className="w-full"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Open Your Slack App
        </Button>
      </>
    ),
  },
  {
    id: 3,
    title: 'Get App Credentials',
    description: 'Copy your Client ID, Client Secret, and Signing Secret',
    content: (
      <>
        <p className="text-sm text-muted-foreground mb-4">
          You need three credentials from your Slack app to connect it to CitadelAI.
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground mb-4">
          <li>In your Slack app, go to "Basic Information" in the left sidebar</li>
          <li>Scroll down to "App Credentials"</li>
          <li>Copy the <strong>Client ID</strong> (starts with "xoxb-")</li>
          <li>Click "Show" next to <strong>Client Secret</strong> and copy it</li>
          <li>Click "Show" next to <strong>Signing Secret</strong> and copy it</li>
        </ol>
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
            <Badge variant="outline">Client ID</Badge>
            <span className="text-xs text-muted-foreground">Starts with "xoxb-"</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
            <Badge variant="outline">Client Secret</Badge>
            <span className="text-xs text-muted-foreground">Click "Show" to reveal</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
            <Badge variant="outline">Signing Secret</Badge>
            <span className="text-xs text-muted-foreground">Click "Show" to reveal</span>
          </div>
        </div>
        <Button
          onClick={() => window.open('https://api.slack.com/apps', '_blank')}
          className="w-full"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Open Your Slack App Credentials
        </Button>
      </>
    ),
  },
  {
    id: 4,
    title: 'Enter Credentials',
    description: 'Paste your credentials into CitadelAI',
    content: (
      <>
        <p className="text-sm text-muted-foreground mb-4">
          Now paste the credentials you copied into the form below. They will be saved automatically.
        </p>
        <div className="space-y-3 mb-4">
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm font-medium mb-1">Where to paste:</p>
            <p className="text-xs text-muted-foreground">
              Use the credential fields in the properties panel below this tutorial.
            </p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> Credentials are encrypted and stored securely. They will auto-save 2 seconds after you stop typing.
              </div>
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    id: 5,
    title: 'Install Bot to Workspace',
    description: 'Complete the OAuth installation',
    content: (
      <>
        <p className="text-sm text-muted-foreground mb-4">
          Once your credentials are saved, you can install the bot to your Slack workspace.
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground mb-4">
          <li>Make sure all three credentials are saved (you'll see a checkmark)</li>
          <li>Click the "Install to Slack" button in the properties panel</li>
          <li>A popup will open asking for permissions</li>
          <li>Review the permissions and click "Allow"</li>
          <li>You'll be redirected back to CitadelAI</li>
          <li>The bot is now installed and ready to use!</li>
        </ol>
        <div className="p-3 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
            <div className="text-xs text-green-800 dark:text-green-200">
              <strong>Tip:</strong> After installation, you can configure how the bot responds (mentions, DMs, threads, etc.) in the properties panel.
            </div>
          </div>
        </div>
      </>
    ),
  },
];

export const SlackSetupTutorial: React.FC<SlackSetupTutorialProps> = ({
  open,
  onOpenChange,
  blockId,
  apiBaseUrl,
  botName,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const { toast } = useToast();

  const handleCopyManifest = () => {
    const manifest = {
      display_information: {
        name: "CitadelAI Chatbot",
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

    navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
    toast({
      title: "Copied!",
      description: "Manifest copied to clipboard. Paste it into your Slack app's App Manifest section.",
    });
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    // Mark tutorial as completed in localStorage
    localStorage.setItem(`slack_tutorial_completed_${blockId}`, 'true');
    onComplete();
    onOpenChange(false);
  };

  const handleDismiss = () => {
    // User can dismiss, but tutorial will show again until completed
    onOpenChange(false);
  };

  const currentStepData = steps.find(s => s.id === currentStep)!;
  const isLastStep = currentStep === steps.length;

  return (
    <Dialog open={open} onOpenChange={handleDismiss}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" hideClose={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Slack Bot Setup Tutorial</span>
            <Badge variant="outline" className="ml-auto">
              Step {currentStep} of {steps.length}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Follow these steps to set up your Slack bot integration. This tutorial cannot be skipped - you must complete the setup for the bot to work.
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-6">
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
        <Card>
          <CardContent className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-1">{currentStepData.title}</h3>
              <p className="text-sm text-muted-foreground">{currentStepData.description}</p>
            </div>
            <div className="mt-4">
              {typeof currentStepData.content === 'function'
                ? currentStepData.content(apiBaseUrl, botName, handleCopyManifest)
                : currentStepData.content}
            </div>
          </CardContent>
        </Card>

        {/* Navigation buttons */}
        <div className="flex justify-between items-center mt-6">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={handleDismiss}
            >
              Dismiss
            </Button>
            <Button onClick={handleNext}>
              {isLastStep ? 'Complete Setup' : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Warning message */}
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div className="text-xs text-yellow-800 dark:text-yellow-200">
              <strong>Important:</strong> The Slack bot will not work until you complete all setup steps. You can dismiss this tutorial, but it will appear again until setup is complete.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
