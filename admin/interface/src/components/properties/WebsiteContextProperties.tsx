import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CronFrequencySelector from '@/components/ui/CronFrequencySelector';
import { useAuth } from '@/contexts/AuthContext';
import { useBlockEditor } from '@/contexts/BlockEditorContext';

import { crawlWebsite, stopCrawlWebsite, updateCronSettings } from '@/lib/api';
import { Block } from '@/types/block';
import CrawledPagesModal from './CrawledPagesModal';
import { Eye, Lock, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface WebsiteContextPropertiesProps {
  block: Block;
}

const WebsiteContextProperties: React.FC<WebsiteContextPropertiesProps> = ({ block }) => {
  const { id: chatbotId } = useParams<{ id: string }>();
  const { token } = useAuth();
  const subscriptionStatus: any = {};
  const { updateBlock, websiteContexts, setWebsiteContexts, saveChatbot, updateWebsiteContext } = useBlockEditor();
  const { toast } = useToast();
  const [isStopping, setIsStopping] = useState(false);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [urlSaveTimeout, setUrlSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isCrawledPagesModalOpen, setIsCrawledPagesModalOpen] = useState(false);
  
  // Check if cron scheduling is available (Pro/Enterprise only)
  const canUseProBlocks = subscriptionStatus?.canUseProBlocks !== false;

  // Get website context for this block
  const websiteContext = websiteContexts.find(wc => wc.blockId === block.id);
  
  // Local state for immediate UI updates
  const [localRecursive, setLocalRecursive] = useState<boolean>(websiteContext?.recursive ?? false);
  const [localMaxDepth, setLocalMaxDepth] = useState<number>(websiteContext?.maxDepth ?? 3);
  const [localCronEnabled, setLocalCronEnabled] = useState<boolean>(websiteContext?.cronEnabled ?? false);
  const [localCronSchedule, setLocalCronSchedule] = useState<string>(websiteContext?.cronSchedule ?? '0 0 * * *');
  const [localCronTimezone, setLocalCronTimezone] = useState<string>(websiteContext?.cronTimezone ?? 'UTC');
  
  // Refs to get current values in callbacks
  const localRecursiveRef = useRef(localRecursive);
  const localMaxDepthRef = useRef(localMaxDepth);
  const localCronEnabledRef = useRef(localCronEnabled);
  const localCronScheduleRef = useRef(localCronSchedule);
  const localCronTimezoneRef = useRef(localCronTimezone);
  const websiteContextsRef = useRef(websiteContexts);
  
  // Update refs when state changes
  useEffect(() => {
    localRecursiveRef.current = localRecursive;
  }, [localRecursive]);
  
  useEffect(() => {
    localMaxDepthRef.current = localMaxDepth;
  }, [localMaxDepth]);

  useEffect(() => {
    localCronEnabledRef.current = localCronEnabled;
  }, [localCronEnabled]);

  useEffect(() => {
    localCronScheduleRef.current = localCronSchedule;
  }, [localCronSchedule]);

  useEffect(() => {
    localCronTimezoneRef.current = localCronTimezone;
  }, [localCronTimezone]);

  useEffect(() => {
    websiteContextsRef.current = websiteContexts;
  }, [websiteContexts]);

  // Update local state when websiteContext changes (when switching between blocks)
  useEffect(() => {
    if (websiteContext) {
      setLocalRecursive(websiteContext.recursive ?? false);
      setLocalMaxDepth(websiteContext.maxDepth ?? 3);
      setLocalCronEnabled(websiteContext.cronEnabled ?? false);
      setLocalCronSchedule(websiteContext.cronSchedule ?? '0 0 * * *');
      setLocalCronTimezone(websiteContext.cronTimezone ?? 'UTC');
    } else {
      // Reset to defaults when no website context is found
      setLocalRecursive(false);
      setLocalMaxDepth(3);
      setLocalCronEnabled(false);
      setLocalCronSchedule('0 0 * * *');
      setLocalCronTimezone('UTC');
    }
  }, [websiteContext]);

  // Debounced save function that uses current local state
  const debouncedSave = useCallback(() => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    const timeout = setTimeout(async () => {
      try {
        // Create updated website contexts with current local state
        const currentRecursive = localRecursiveRef.current;
        const currentMaxDepth = localMaxDepthRef.current;
        const currentCronEnabled = localCronEnabledRef.current;
        const currentCronSchedule = localCronScheduleRef.current;
        const currentCronTimezone = localCronTimezoneRef.current;
        
        const updatedWebsiteContexts = websiteContextsRef.current.map(wc => 
          wc.blockId === block.id 
            ? { 
                ...wc, 
                recursive: currentRecursive, 
                maxDepth: currentMaxDepth,
                cronEnabled: currentCronEnabled,
                cronSchedule: currentCronSchedule,
                cronTimezone: currentCronTimezone
              }
            : wc
        );
        
        // Update the context state
        setWebsiteContexts(updatedWebsiteContexts);
        
        // Pass the updated websiteContexts directly to saveChatbot
        await saveChatbot(undefined, undefined, updatedWebsiteContexts);
      } catch (error) {
        console.error('❌ Auto-save failed:', error);
      }
    }, 1000); // 1 second delay
    
    setSaveTimeout(timeout);
  }, [saveTimeout, block.id, setWebsiteContexts, saveChatbot]);

  // Debounced save function specifically for URL changes
  const debouncedUrlSave = useCallback(() => {
    if (urlSaveTimeout) {
      clearTimeout(urlSaveTimeout);
    }
    
    const timeout = setTimeout(async () => {
      try {
        // Update the website context URL if it exists
        const currentWebsiteContext = websiteContextsRef.current.find(wc => wc.blockId === block.id);
        if (currentWebsiteContext) {
          const updatedWebsiteContexts = websiteContextsRef.current.map(wc => 
            wc.blockId === block.id 
              ? { ...wc, url: block.properties?.url as string || '' }
              : wc
          );
          
          setWebsiteContexts(updatedWebsiteContexts);
          await saveChatbot(undefined, undefined, updatedWebsiteContexts);
        }
      } catch (error) {
        console.error('❌ URL auto-save failed:', error);
      }
    }, 2000); // 2 second delay for URL changes
    
    setUrlSaveTimeout(timeout);
  }, [urlSaveTimeout, block.id, setWebsiteContexts, saveChatbot, block.properties?.url]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      if (urlSaveTimeout) {
        clearTimeout(urlSaveTimeout);
      }
    };
  }, [saveTimeout, urlSaveTimeout]);

  const crawlingStatus = websiteContext?.crawlingStatus?.status || 'idle';
  const progress = websiteContext?.crawlingStatus?.progress || 0;
  const total = websiteContext?.crawlingStatus?.total || 0;
  const currentUrl = websiteContext?.crawlingStatus?.currentUrl || '';
  const lastCrawledAt = websiteContext?.lastCrawledAt;
  const crawledPagesCount = websiteContext?.crawledPagesCount;

  // Initialize website context if it doesn't exist and we have a URL
  useEffect(() => {
    if (!websiteContext && block.properties?.url && chatbotId) {
      const newWebsiteContext = {
        id: '',
        chatbotId: chatbotId,
        blockId: block.id,
        url: block.properties.url as string,
        recursive: false,
        maxDepth: 3,
        crawlingStatus: null,
        lastCrawledAt: null,
        crawledPagesCount: null,
        cronEnabled: false,
        cronSchedule: '0 0 * * *',
        cronTimezone: 'UTC',
        nextCrawlAt: null,
      };
      
      // Add to websiteContexts via the context
      const currentContexts = websiteContextsRef.current;
      const updatedContexts = [...currentContexts, newWebsiteContext];
      setWebsiteContexts(updatedContexts);
      
      // We need to trigger a save to create the context in the backend
      setTimeout(() => {
        saveChatbot(undefined, undefined, updatedContexts);
      }, 100);
    }
  }, [websiteContext, block.properties?.url, chatbotId, setWebsiteContexts, saveChatbot, block.id]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    
    updateBlock(block.id, { properties: { ...block.properties, url: newUrl } });
    
    // Use debounced save for URL changes (2 second delay)
    if (websiteContext) {
      debouncedUrlSave();
    }
  };

  const handleUrlBlur = () => {
    // Save immediately when input loses focus
    if (websiteContext && block.properties?.url) {
      // Clear any pending debounced save
      if (urlSaveTimeout) {
        clearTimeout(urlSaveTimeout);
        setUrlSaveTimeout(null);
      }
      
      // Save immediately
      const updatedWebsiteContexts = websiteContextsRef.current.map(wc => 
        wc.blockId === block.id 
          ? { ...wc, url: block.properties?.url as string || '' }
          : wc
      );
      
      setWebsiteContexts(updatedWebsiteContexts);
      saveChatbot(undefined, undefined, updatedWebsiteContexts);
    }
  };

  const handleRecursiveChange = (checked: boolean | string) => {
    // Ensure we have a proper boolean value
    const booleanValue = checked === true || checked === 'true';
    
    // Update local state immediately
    setLocalRecursive(booleanValue);
    
    // Trigger debounced save to update the backend
    debouncedSave();
  };

  const handleMaxDepthChange = (value: number) => {
    // Ensure we have a proper number value
    const numericValue = Number(value) || 3;
    
    // Update local state immediately
    setLocalMaxDepth(numericValue);
    
    // Trigger debounced save to update the backend
    debouncedSave();
  };

  const handleCronEnabledChange = async (checked: boolean | string) => {
    const booleanValue = checked === true || checked === 'true';
    
    // Check if cron scheduling is available (Pro/Enterprise only)
    if (booleanValue && !canUseProBlocks) {
      toast({
        title: 'Scheduled Crawling Not Available',
        description: 'Scheduled crawling is available in Professional and Enterprise plans. Please upgrade to access this feature.',
        variant: 'destructive',
      });
      return; // Don't enable if not allowed
    }
    
    setLocalCronEnabled(booleanValue);
    
    // Ensure website context exists before updating cron settings
    if (!websiteContext && chatbotId && block.properties?.url) {
      const newWebsiteContext = {
        id: '',
        chatbotId: chatbotId,
        blockId: block.id,
        url: block.properties.url as string,
        recursive: false,
        maxDepth: 3,
        crawlingStatus: null,
        lastCrawledAt: null,
        crawledPagesCount: null,
        cronEnabled: booleanValue,
        cronSchedule: localCronSchedule,
        cronTimezone: localCronTimezone,
        nextCrawlAt: null,
      };
      
      // Add to websiteContexts via the context
      const currentContexts = websiteContextsRef.current;
      const updatedContexts = [...currentContexts, newWebsiteContext];
      setWebsiteContexts(updatedContexts);
      
      // Save the chatbot first to create the website context in the backend
      try {
        await saveChatbot();
        
        // Then update cron settings after the context is created
        if (token && booleanValue && canUseProBlocks) {
          try {
            await updateCronSettings(
              block.id,
              booleanValue,
              localCronSchedule,
              localCronTimezone,
              token
            );
          } catch (error: unknown) {
            console.error('Failed to update cron settings:', error);
            const errorObj = error as { response?: { data?: { message?: string; code?: string } }; message?: string };
            const errorMessage = errorObj?.response?.data?.message || errorObj?.message || 'Failed to update cron settings';
            if (errorObj?.response?.data?.code === 'CRON_NOT_AVAILABLE') {
              setLocalCronEnabled(false); // Disable checkbox if not allowed
            }
            toast({
              title: 'Failed to Enable Scheduling',
              description: errorMessage,
              variant: 'destructive',
            });
          }
        }
      } catch (error) {
        console.error('Failed to create website context or update cron settings:', error);
      }
    } else {
      // Update cron settings immediately if context already exists
      if (token && booleanValue && canUseProBlocks) {
        try {
          await updateCronSettings(
            block.id,
            booleanValue,
            localCronSchedule,
            localCronTimezone,
            token
          );
        } catch (error: unknown) {
          console.error('Failed to update cron settings:', error);
          const errorObj = error as { response?: { data?: { message?: string; code?: string } }; message?: string };
          const errorMessage = errorObj?.response?.data?.message || errorObj?.message || 'Failed to update cron settings';
          if (errorObj?.response?.data?.code === 'CRON_NOT_AVAILABLE') {
            setLocalCronEnabled(false); // Disable checkbox if not allowed
          }
          toast({
            title: 'Failed to Update Scheduling',
            description: errorMessage,
            variant: 'destructive',
          });
        }
      }
    }
    
    debouncedSave();
  };

  const handleCronScheduleChange = async (value: string) => {
    if (!canUseProBlocks) {
      toast({
        title: 'Scheduled Crawling Not Available',
        description: 'Scheduled crawling is available in Professional and Enterprise plans. Please upgrade to access this feature.',
        variant: 'destructive',
      });
      return;
    }
    
    setLocalCronSchedule(value);
    
    // Ensure website context exists before updating cron settings
    if (!websiteContext && chatbotId && block.properties?.url) {
      const newWebsiteContext = {
        id: '',
        chatbotId: chatbotId,
        blockId: block.id,
        url: block.properties.url as string,
        recursive: false,
        maxDepth: 3,
        crawlingStatus: null,
        lastCrawledAt: null,
        crawledPagesCount: null,
        cronEnabled: localCronEnabled,
        cronSchedule: value,
        cronTimezone: localCronTimezone,
        nextCrawlAt: null,
      };
      
      // Add to websiteContexts via the context
      const currentContexts = websiteContextsRef.current;
      const updatedContexts = [...currentContexts, newWebsiteContext];
      setWebsiteContexts(updatedContexts);
      
      // Save the chatbot first to create the website context in the backend
      try {
        await saveChatbot();
        
        // Then update cron settings after the context is created
        if (localCronEnabled && token && canUseProBlocks) {
          try {
            await updateCronSettings(
              block.id,
              localCronEnabled,
              value,
              localCronTimezone,
              token
            );
          } catch (error: unknown) {
            console.error('Failed to update cron settings:', error);
            const errorObj = error as { response?: { data?: { message?: string } }; message?: string };
            const errorMessage = errorObj?.response?.data?.message || errorObj?.message || 'Failed to update cron settings';
            toast({
              title: 'Failed to Update Schedule',
              description: errorMessage,
              variant: 'destructive',
            });
          }
        }
      } catch (error) {
        console.error('Failed to create website context or update cron settings:', error);
      }
    } else {
      // Update cron settings immediately if context already exists and cron is enabled
      if (localCronEnabled && token && canUseProBlocks) {
        try {
          await updateCronSettings(
            block.id,
            localCronEnabled,
            value,
            localCronTimezone,
            token
          );
        } catch (error: unknown) {
          console.error('Failed to update cron settings:', error);
          const errorObj = error as { response?: { data?: { message?: string } }; message?: string };
          const errorMessage = errorObj?.response?.data?.message || errorObj?.message || 'Failed to update cron settings';
          toast({
            title: 'Failed to Update Schedule',
            description: errorMessage,
            variant: 'destructive',
          });
        }
      }
    }
    
    debouncedSave();
  };

  const handleCronTimezoneChange = async (value: string) => {
    if (!canUseProBlocks) {
      toast({
        title: 'Scheduled Crawling Not Available',
        description: 'Scheduled crawling is available in Professional and Enterprise plans. Please upgrade to access this feature.',
        variant: 'destructive',
      });
      return;
    }
    
    setLocalCronTimezone(value);
    
    // Ensure website context exists before updating cron settings
    if (!websiteContext && chatbotId && block.properties?.url) {
      const newWebsiteContext = {
        id: '',
        chatbotId: chatbotId,
        blockId: block.id,
        url: block.properties.url as string,
        recursive: false,
        maxDepth: 3,
        crawlingStatus: null,
        lastCrawledAt: null,
        crawledPagesCount: null,
        cronEnabled: localCronEnabled,
        cronSchedule: localCronSchedule,
        cronTimezone: value,
        nextCrawlAt: null,
      };
      
      // Add to websiteContexts via the context
      const currentContexts = websiteContextsRef.current;
      const updatedContexts = [...currentContexts, newWebsiteContext];
      setWebsiteContexts(updatedContexts);
      
      // Save the chatbot first to create the website context in the backend
      try {
        await saveChatbot();
        
        // Then update cron settings after the context is created
        if (localCronEnabled && token && canUseProBlocks) {
          try {
            await updateCronSettings(
              block.id,
              localCronEnabled,
              localCronSchedule,
              value,
              token
            );
          } catch (error: unknown) {
            console.error('Failed to update cron settings:', error);
            const errorObj = error as { response?: { data?: { message?: string } }; message?: string };
            const errorMessage = errorObj?.response?.data?.message || errorObj?.message || 'Failed to update cron settings';
            toast({
              title: 'Failed to Update Timezone',
              description: errorMessage,
              variant: 'destructive',
            });
          }
        }
      } catch (error) {
        console.error('Failed to create website context or update cron settings:', error);
      }
    } else {
      // Update cron settings immediately if context already exists and cron is enabled
      if (localCronEnabled && token && canUseProBlocks) {
        try {
          await updateCronSettings(
            block.id,
            localCronEnabled,
            localCronSchedule,
            value,
            token
          );
        } catch (error: unknown) {
          console.error('Failed to update cron settings:', error);
          const errorObj = error as { response?: { data?: { message?: string } }; message?: string };
          const errorMessage = errorObj?.response?.data?.message || errorObj?.message || 'Failed to update cron settings';
          toast({
            title: 'Failed to Update Timezone',
            description: errorMessage,
            variant: 'destructive',
          });
        }
      }
    }
    
    debouncedSave();
  };

  const handleCrawl = async () => {
    if (!chatbotId || !token || !block.properties?.url) return;

    // Optimistically update the state to show 'crawling'
    const updatedContexts = websiteContextsRef.current.map(wc => 
      wc.blockId === block.id 
        ? { 
            ...wc, 
            crawlingStatus: { 
              status: 'crawling' as const, 
              progress: 0, 
              total: 0, 
              currentUrl: '' 
            } 
          }
        : wc
    );
    
    // Update the state immediately to show crawling status
    setWebsiteContexts(updatedContexts);

    try {
      await crawlWebsite(
        block.properties.url as string,
        chatbotId,
        block.id,
        token,
        localRecursive,
        localMaxDepth
      );
    } catch (error: unknown) {
      console.error('Crawl failed:', error);
      
      // Reset the crawling status on error
      const resetContexts = websiteContextsRef.current.map(wc => 
        wc.blockId === block.id 
          ? { 
              ...wc, 
              crawlingStatus: { 
                status: 'idle' as const, 
                progress: 0, 
                total: 0, 
                currentUrl: '' 
              } 
            }
          : wc
      );
      setWebsiteContexts(resetContexts);
      
      // Show error message to user
      const errorObj = error as { response?: { data?: { message?: string; code?: string } }; message?: string };
      const errorMessage = errorObj?.response?.data?.message || errorObj?.message || 'Failed to start crawling';
      const errorCode = errorObj?.response?.data?.code;
      
      if (errorCode === 'PAGES_LIMIT_REACHED' || errorCode === 'NO_SUBSCRIPTION') {
        toast({
          title: 'Crawling Not Available',
          description: errorMessage,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Crawl Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    }
  };

  const handleStopCrawl = async () => {
    if (!chatbotId || !token) return;

    setIsStopping(true);
    try {
      await stopCrawlWebsite(chatbotId, block.id, token);
      
      // Update the crawling status to 'idle' after successful stop
      const updatedContexts = websiteContextsRef.current.map(wc => 
        wc.blockId === block.id 
          ? { 
              ...wc, 
              crawlingStatus: { 
                status: 'idle' as const, 
                progress: 0, 
                total: 0, 
                currentUrl: '' 
              } 
            }
          : wc
      );
      setWebsiteContexts(updatedContexts);
    } catch (error) {
      console.error('Stop crawl failed:', error);
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <div className="space-y-4 min-h-0 pb-4">
      <div>
        <Label htmlFor={`url-${block.id}`}>Website URL</Label>
        <Input
          id={`url-${block.id}`}
          placeholder="https://example.com"
          value={(block.properties?.url as string) || ''}
          onChange={handleUrlChange}
          onBlur={handleUrlBlur}
        />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox 
          id="recursive" 
          checked={localRecursive} 
          onCheckedChange={handleRecursiveChange} 
        />
        <Label htmlFor="recursive">Recursive Crawl</Label>
      </div>
      {localRecursive && (
        <div>
          <Label htmlFor={`max-depth-${block.id}`}>Max Depth</Label>
          <Input
            id={`max-depth-${block.id}`}
            type="number"
            value={localMaxDepth}
            onChange={(e) => {
              const inputValue = e.target.value;
              const parsedValue = parseInt(inputValue, 10);
              if (!isNaN(parsedValue) && parsedValue > 0) {
                handleMaxDepthChange(parsedValue);
              }
            }}
          />
        </div>
      )}
      
      {/* Cron Scheduling Section */}
      <div className="border-t pt-4 bg-muted/30 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-medium mb-3">Scheduled Crawling</h4>
        {!canUseProBlocks && (
          <Alert className="mb-3">
            <Lock className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Scheduled crawling is available in Professional and Enterprise plans. Upgrade to unlock this feature.
            </AlertDescription>
          </Alert>
        )}
        <div className="flex items-center space-x-2 mb-3">
          <Checkbox 
            id="cron-enabled" 
            checked={localCronEnabled} 
            onCheckedChange={handleCronEnabledChange}
            disabled={!canUseProBlocks}
          />
          <Label htmlFor="cron-enabled" className={!canUseProBlocks ? 'opacity-50 cursor-not-allowed' : ''}>
            Enable Scheduled Crawling
          </Label>
        </div>
        
        {localCronEnabled && canUseProBlocks && (
          <div className="space-y-3">
            <CronFrequencySelector
              value={localCronSchedule}
              onChange={handleCronScheduleChange}
              disabled={!canUseProBlocks}
            />
            
            {websiteContext?.nextCrawlAt && (
              <div className="text-sm text-muted-foreground">
                Next crawl: {new Date(websiteContext.nextCrawlAt).toLocaleString(undefined, {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button onClick={handleCrawl} disabled={crawlingStatus === 'crawling' || crawlingStatus === 'queued'} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
            {crawlingStatus === 'crawling' && 'Crawling...'}
            {crawlingStatus === 'queued' && 'Queued...'}
            {crawlingStatus !== 'crawling' && crawlingStatus !== 'queued' && 'Crawl'}
          </Button>
          {crawlingStatus === 'crawling' && (
            <Button onClick={handleStopCrawl} disabled={isStopping} variant="destructive">
              {isStopping ? 'Stopping...' : 'Stop'}
            </Button>
          )}
        </div>
        
        <Button
          onClick={() => setIsCrawledPagesModalOpen(true)}
          variant="outline"
          className="w-full"
        >
          <Eye className="w-4 h-4 mr-2" />
          View Crawled Pages
          {crawledPagesCount !== null && ` (${crawledPagesCount})`}
        </Button>
      
        {crawlingStatus === 'crawling' && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Progress: {progress} / {total}
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300" 
                style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }}
              />
            </div>
            {currentUrl && (
              <div className="text-sm text-muted-foreground truncate">
                Current: {currentUrl}
              </div>
            )}
          </div>
        )}
      
        {lastCrawledAt && (
          <div className="text-sm text-muted-foreground">
            Last crawled: {new Date(lastCrawledAt).toLocaleString(undefined, {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            })}
            {crawledPagesCount && ` (${crawledPagesCount} pages)`}
          </div>
        )}
      </div>
      
      {chatbotId && token && (
        <CrawledPagesModal
          open={isCrawledPagesModalOpen}
          onOpenChange={setIsCrawledPagesModalOpen}
          chatbotId={chatbotId}
          blockId={block.id}
          token={token}
        />
      )}
    </div>
  );
};

export default WebsiteContextProperties;