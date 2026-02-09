import React from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Globe, AlertCircle, Bot } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const UsageDisplay: React.FC = () => {
  const { subscriptionStatus } = useSubscription();

  if (!subscriptionStatus || !subscriptionStatus.hasSubscription) {
    return null;
  }

  const {
    currentMonthMessages = 0,
    maxMessages,
    totalIndexedPages = 0,
    maxPages,
    currentChatbotCount = 0,
    maxChatbots,
  } = subscriptionStatus;

  const messagesPercent = maxMessages ? Math.min((currentMonthMessages / maxMessages) * 100, 100) : 0;
  const pagesPercent = maxPages ? Math.min((totalIndexedPages / maxPages) * 100, 100) : 0;
  const chatbotsPercent = maxChatbots ? Math.min((currentChatbotCount / maxChatbots) * 100, 100) : 0;

  const messagesRemaining = maxMessages ? maxMessages - currentMonthMessages : null;
  const pagesRemaining = maxPages ? maxPages - totalIndexedPages : null;
  const chatbotsRemaining = maxChatbots ? maxChatbots - currentChatbotCount : null;

  const isMessagesNearLimit = maxMessages && currentMonthMessages >= maxMessages * 0.8;
  const isPagesNearLimit = maxPages && totalIndexedPages >= maxPages * 0.8;
  const isChatbotsNearLimit = maxChatbots && currentChatbotCount >= maxChatbots * 0.8;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Usage Statistics</CardTitle>
        <CardDescription>Track your current usage against plan limits</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chatbots Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Chatbots</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {currentChatbotCount.toLocaleString()} / {maxChatbots ? maxChatbots.toLocaleString() : 'Unlimited'}
            </span>
          </div>
          {maxChatbots ? (
            <>
              <Progress value={chatbotsPercent} className="h-2" />
              {chatbotsRemaining !== null && (
                <p className="text-xs text-muted-foreground">
                  {chatbotsRemaining > 0 ? (
                    `${chatbotsRemaining.toLocaleString()} chatbots remaining`
                  ) : (
                    <span className="text-destructive font-medium">Limit reached</span>
                  )}
                </p>
              )}
              {isChatbotsNearLimit && chatbotsRemaining !== null && chatbotsRemaining > 0 && (
                <Alert className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    You're approaching your chatbot limit. Consider upgrading to create more chatbots.
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Unlimited chatbots</p>
          )}
        </div>

        {/* Messages Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Messages (30 days)</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {currentMonthMessages.toLocaleString()} / {maxMessages ? maxMessages.toLocaleString() : 'Unlimited'}
            </span>
          </div>
          {maxMessages ? (
            <>
              <Progress value={messagesPercent} className="h-2" />
              {messagesRemaining !== null && (
                <p className="text-xs text-muted-foreground">
                  {messagesRemaining > 0 ? (
                    `${messagesRemaining.toLocaleString()} messages remaining`
                  ) : (
                    <span className="text-destructive font-medium">Limit reached</span>
                  )}
                </p>
              )}
              {isMessagesNearLimit && messagesRemaining !== null && messagesRemaining > 0 && (
                <Alert className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    You're approaching your message limit. Consider upgrading to avoid interruptions.
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Unlimited messages</p>
          )}
        </div>

        {/* Indexed Pages Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Indexed Pages</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {totalIndexedPages.toLocaleString()} / {maxPages ? maxPages.toLocaleString() : 'Unlimited'}
            </span>
          </div>
          {maxPages ? (
            <>
              <Progress value={pagesPercent} className="h-2" />
              {pagesRemaining !== null && (
                <p className="text-xs text-muted-foreground">
                  {pagesRemaining > 0 ? (
                    `${pagesRemaining.toLocaleString()} pages remaining`
                  ) : (
                    <span className="text-destructive font-medium">Limit reached</span>
                  )}
                </p>
              )}
              {isPagesNearLimit && pagesRemaining !== null && pagesRemaining > 0 && (
                <Alert className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    You're approaching your indexed pages limit. Consider upgrading to index more content.
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Unlimited indexed pages</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default UsageDisplay;
