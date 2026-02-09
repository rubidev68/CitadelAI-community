import React from 'react';
import { Block, WebsiteContext, CloudIntegrationWithBlockId, SlackIntegrationWithBlockId } from '@/contexts/BlockEditorContext';
import { Check, Clock, XCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BlockStatusBadgeProps {
  block: Block;
  websiteContext?: WebsiteContext;
  cloudIntegration?: CloudIntegrationWithBlockId;
  slackIntegration?: SlackIntegrationWithBlockId | null;
  blocks?: Block[]; // For calendar action blocks to check context block linkage
}

type StatusType = 'ready' | 'in-progress' | 'error' | 'not-configured';

interface StatusInfo {
  type: StatusType;
  progress?: number; // 0-100 for circular progress
  tooltip: string;
}

const getWebsiteStatus = (websiteContext?: WebsiteContext): StatusInfo => {
  if (!websiteContext) {
    return {
      type: 'not-configured',
      tooltip: 'Website context not configured',
    };
  }

  const status = websiteContext.crawlingStatus?.status;
  const progress = websiteContext.crawlingStatus?.progress;
  const total = websiteContext.crawlingStatus?.total;
  const lastCrawledAt = websiteContext.lastCrawledAt;
  const crawledPagesCount = websiteContext.crawledPagesCount;

  if (status === 'crawling' || status === 'starting') {
    const progressPercent = total && progress !== undefined
      ? Math.round((progress / total) * 100)
      : 0;
    return {
      type: 'in-progress',
      progress: progressPercent,
      tooltip: `Crawling: ${progress || 0}/${total || '?'} pages (${progressPercent}%)\nCurrent: ${websiteContext.crawlingStatus?.currentUrl || 'N/A'}`,
    };
  }

  if (status === 'error') {
    return {
      type: 'error',
      tooltip: 'Crawling error occurred',
    };
  }

  if (status === 'completed' && lastCrawledAt) {
    const lastCrawled = new Date(lastCrawledAt);
    const timeAgo = getTimeAgo(lastCrawled);
    return {
      type: 'ready',
      tooltip: `Last crawled: ${timeAgo}\nPages crawled: ${crawledPagesCount || 0}`,
    };
  }

  if (lastCrawledAt) {
    const lastCrawled = new Date(lastCrawledAt);
    const timeAgo = getTimeAgo(lastCrawled);
    return {
      type: 'ready',
      tooltip: `Last crawled: ${timeAgo}\nPages crawled: ${crawledPagesCount || 0}`,
    };
  }

  return {
    type: 'not-configured',
    tooltip: 'Not crawled yet',
  };
};

const getCloudStatus = (cloudIntegration?: CloudIntegrationWithBlockId): StatusInfo => {
  if (!cloudIntegration) {
    return {
      type: 'not-configured',
      tooltip: 'Cloud integration not configured',
    };
  }

  const isConnected = cloudIntegration.isConnected;
  const indexingStatus = cloudIntegration.indexingStatus;
  const indexedCount = cloudIntegration.indexedFileCount || 0;
  const filesDiscovered = cloudIntegration.filesDiscovered || 0;
  const lastIndexedAt = cloudIntegration.lastIndexedAt;

  if (!isConnected) {
    return {
      type: 'not-configured',
      tooltip: 'Not connected to cloud storage',
    };
  }

  if (indexingStatus === 'indexing') {
    const progressPercent = filesDiscovered > 0
      ? Math.round((indexedCount / filesDiscovered) * 100)
      : 0;
    return {
      type: 'in-progress',
      progress: progressPercent,
      tooltip: `Indexing: ${indexedCount}/${filesDiscovered} files (${progressPercent}%)\nProvider: ${cloudIntegration.provider || 'Unknown'}`,
    };
  }

  if (indexingStatus === 'error') {
    return {
      type: 'error',
      tooltip: `Indexing error: ${cloudIntegration.indexingError || 'Unknown error'}`,
    };
  }

  if (indexingStatus === 'completed' && lastIndexedAt) {
    const lastIndexed = new Date(lastIndexedAt);
    const timeAgo = getTimeAgo(lastIndexed);
    return {
      type: 'ready',
      tooltip: `Last indexed: ${timeAgo}\nFiles indexed: ${indexedCount}\nProvider: ${cloudIntegration.provider || 'Unknown'}`,
    };
  }

  if (lastIndexedAt) {
    const lastIndexed = new Date(lastIndexedAt);
    const timeAgo = getTimeAgo(lastIndexed);
    return {
      type: 'ready',
      tooltip: `Last indexed: ${timeAgo}\nFiles indexed: ${indexedCount}\nProvider: ${cloudIntegration.provider || 'Unknown'}`,
    };
  }

  return {
    type: 'ready',
    tooltip: `Connected to ${cloudIntegration.provider || 'cloud storage'}\nFiles indexed: ${indexedCount}`,
  };
};

const getSlackStatus = (slackIntegration?: SlackIntegrationWithBlockId | null): StatusInfo => {
  if (!slackIntegration) {
    return {
      type: 'not-configured',
      tooltip: 'Slack integration not installed',
    };
  }

  // Handle both string and null teamId (type might be incorrect)
  const teamId = slackIntegration.teamId as string | null | undefined;
  if (!teamId) {
    return {
      type: 'not-configured',
      tooltip: 'Slack integration not installed',
    };
  }

  if (!slackIntegration.isActive) {
    return {
      type: 'error',
      tooltip: 'Slack integration is inactive',
    };
  }

  const installedAt = new Date(slackIntegration.installedAt);
  const timeAgo = getTimeAgo(installedAt);
  const lastUsed = slackIntegration.lastUsedAt
    ? getTimeAgo(new Date(slackIntegration.lastUsedAt))
    : 'Never';

  return {
    type: 'ready',
    tooltip: `Installed: ${timeAgo}\nWorkspace: ${slackIntegration.teamName || 'Unknown'}\nLast used: ${lastUsed}`,
  };
};

const getCalendarContextStatus = (block: Block): StatusInfo => {
  const properties = (block.properties || {}) as {
    provider?: string;
    caldavConfig?: {
      serverUrl?: string;
    };
  };

  const provider = properties.provider?.toLowerCase();

  // Check if calendar is configured
  // Google Calendar and Outlook Calendar don't need additional config
  // CalDAV needs serverUrl
  const isGoogleCalendar = provider === 'google_calendar' || provider === 'google';
  const isOutlookCalendar = provider === 'outlook_calendar' || provider === 'outlook';
  const isCaldav = provider === 'caldav';
  
  const isConfigured = provider && (
    isGoogleCalendar || 
    isOutlookCalendar ||
    (isCaldav && properties.caldavConfig?.serverUrl)
  );

  if (isConfigured) {
    let providerName = 'Unknown';
    if (isGoogleCalendar) {
      providerName = 'Google Calendar';
    } else if (isOutlookCalendar) {
      providerName = 'Outlook Calendar';
    } else if (isCaldav) {
      providerName = 'CalDAV';
    }

    return {
      type: 'ready',
      tooltip: `Calendar configured\nProvider: ${providerName}`,
    };
  }

  return {
    type: 'not-configured',
    tooltip: 'Calendar not configured\nPlease configure the calendar provider',
  };
};

const getCalendarActionStatus = (block: Block, blocks: Block[]): StatusInfo => {
  const properties = (block.properties || {}) as {
    shareCredentialsWithBlockId?: string;
  };

  // Check if linked to a context block
  const isLinked = properties.shareCredentialsWithBlockId && 
    blocks.some(b => b.id === properties.shareCredentialsWithBlockId && b.type === 'CONTEXT' && b.subtype === 'Calendar');

  if (isLinked) {
    return {
      type: 'ready',
      tooltip: 'Linked to Calendar context block\nCredentials will be shared from the context block',
    };
  }

  return {
    type: 'not-configured',
    tooltip: 'Not linked to Calendar context block\nPlease link to a Calendar context block to share credentials',
  };
};

const getTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
};


const BlockStatusBadge: React.FC<BlockStatusBadgeProps> = ({
  block,
  websiteContext,
  cloudIntegration,
  slackIntegration,
  blocks = [],
}) => {
  // Get the latest block from blocks array to ensure we have up-to-date properties
  const latestBlock = blocks.find(b => b.id === block.id) || block;

  let statusInfo: StatusInfo;

  // Determine status based on block type
  if (latestBlock.subtype === 'Website') {
    statusInfo = getWebsiteStatus(websiteContext);
  } else if (latestBlock.subtype === 'Cloud') {
    statusInfo = getCloudStatus(cloudIntegration);
  } else if (latestBlock.subtype === 'Slack') {
    statusInfo = getSlackStatus(slackIntegration);
  } else if (latestBlock.subtype === 'Calendar' && latestBlock.type === 'CONTEXT') {
    statusInfo = getCalendarContextStatus(latestBlock);
  } else if (latestBlock.subtype === 'Calendar' && latestBlock.type === 'ACTION') {
    statusInfo = getCalendarActionStatus(latestBlock, blocks);
  } else {
    // No status indicator for other blocks
    return null;
  }

  const { type, tooltip } = statusInfo;

  // Badge colors with icons
  // Green: #2d766d (primary green) - white tick
  // Yellow: #eab308 (yellow-500, same as logic block outline) - white chrono
  // Red: #ef4444 (red-500) - white error signal
  // Gray: #9ca3af (gray-400) - white error signal
  const badgeConfig = {
    ready: {
      bgColor: '#2d766d',
      icon: Check,
    },
    'in-progress': {
      bgColor: '#eab308',
      icon: Clock,
    },
    error: {
      bgColor: '#ef4444', // red-500
      icon: XCircle,
    },
    'not-configured': {
      bgColor: '#9ca3af', // gray-400
      icon: XCircle,
    },
  };

  const config = badgeConfig[type];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="absolute -top-2 -right-2 z-20 pointer-events-auto">
            <div
              className="w-6 h-6 rounded-full shadow-lg ring-2 ring-background flex items-center justify-center"
              style={{
                backgroundColor: config.bgColor,
                animation: type === 'in-progress' ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : undefined,
              }}
            >
              <Icon size={14} className="text-white" />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs whitespace-pre-line">
          <p className="font-semibold mb-1">
            {latestBlock.subtype === 'Website' && 'Website Context Status'}
            {latestBlock.subtype === 'Cloud' && 'Cloud Storage Status'}
            {latestBlock.subtype === 'Slack' && 'Slack Integration Status'}
            {latestBlock.subtype === 'Calendar' && latestBlock.type === 'CONTEXT' && 'Calendar Context Status'}
            {latestBlock.subtype === 'Calendar' && latestBlock.type === 'ACTION' && 'Manage Events Status'}
          </p>
          <p className="text-sm">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default BlockStatusBadge;
