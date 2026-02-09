import React, { useState, ReactNode, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getChatbot, updateChatbot, deleteBlockData, getCrawlingStatus, getCloudIntegration, getSlackIntegration, CloudIntegration, SlackIntegration } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { BlockEditorContext } from './BlockEditorContext.context';
import { useErrorHandler, ApiError } from '@/hooks/useErrorHandler';

export interface Block {
  id: string;
  chatbotId: string;
  type: 'CONTEXT' | 'LOGIC' | 'ACTION' | 'FRONTEND' | 'TEST' | 'ENTERPRISE' | 'ANALYTICS';
  subtype: string;
  title: string;
  position: { x: number; y: number };
  properties: Record<string, unknown>;
  crawlingStatus?: {
    status: 'idle' | 'starting' | 'crawling' | 'completed' | 'error';
    progress?: number;
    total?: number;
    currentUrl?: string;
  } | null;
  lastCrawledAt?: string | null;
  crawledPagesCount?: number | null;
}

export interface Connection {
  id: string;
  chatbotId: string;
  fromBlockId: string;
  toBlockId: string;
  fromDirection: 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';
  toDirection: 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';
}

export interface WebsiteContext {
  id: string;
  chatbotId: string;
  blockId: string;
  url: string;
  recursive: boolean;
  maxDepth: number;
  crawlingStatus?: {
    status: 'idle' | 'starting' | 'crawling' | 'completed' | 'error';
    progress?: number;
    total?: number;
    currentUrl?: string;
  } | null;
  lastCrawledAt?: string | null;
  crawledPagesCount?: number | null;
  cronEnabled?: boolean;
  cronSchedule?: string;
  cronTimezone?: string;
  nextCrawlAt?: string | null;
}

export interface Chatbot {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  ownerId: string;
  blocks: Block[];
  connections: Connection[];
  websiteContexts: WebsiteContext[];
}

export interface CloudIntegrationWithBlockId extends CloudIntegration {
  blockId: string;
}

export interface SlackIntegrationWithBlockId extends SlackIntegration {
  blockId: string;
}

export interface BlockEditorContextType {
  chatbot: Chatbot | null;
  setChatbot: React.Dispatch<React.SetStateAction<Chatbot | null>>;
  blocks: Block[];
  connections: Connection[];
  websiteContexts: WebsiteContext[];
  setWebsiteContexts: React.Dispatch<React.SetStateAction<WebsiteContext[]>>;
  cloudIntegrations: CloudIntegrationWithBlockId[];
  slackIntegrations: SlackIntegrationWithBlockId[];
  chatbotStatus: 'ACTIVE' | 'INACTIVE';
  setChatbotStatus: React.Dispatch<React.SetStateAction<'ACTIVE' | 'INACTIVE'>>;
  ownerId: string | null;
  chatbotName: string;
  selectedBlock: Block | null;
  isConnecting: boolean;
  connectionStart: { blockId: string; direction: 'RIGHT' | 'BOTTOM' | 'LEFT' } | null;
  canvasOffset: { x: number; y: number };
  canvasScale: number;
  addBlock: (type: Block['type'], subtype: string, position: { x: number; y: number }) => Promise<Block>;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  deleteBlock: (id: string) => void;
  confirmDeleteBlock: () => void;
  cancelDeleteBlock: () => void;
  isDeleteModalOpen: boolean;
  selectBlock: (block: Block | null) => void;
  updateWebsiteContext: (blockId: string, updates: Partial<WebsiteContext>) => void;
  startConnection: (blockId: string, direction: 'RIGHT' | 'BOTTOM' | 'LEFT') => void;
  endConnection: (blockId: string, direction: 'LEFT' | 'TOP') => void;
  addConnection: (connection: { fromBlockId: string, toBlockId: string, fromHandle: 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM', toHandle: 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM' }) => void;
  cancelConnection: () => void;
  deleteConnection: (id: string) => void;
  setCanvasOffset: (offset: { x: number; y: number }) => void;
  setCanvasScale: (scale: number) => void;
  setConnections: (connections: Connection[] | ((prev: Connection[]) => Connection[])) => void;
  setBlocks: (blocks: Block[] | ((prev: Block[]) => Block[])) => void;
  autoLayout: () => void;
  exportConfiguration: () => string;
  importConfiguration: (config: string) => void;
  saveChatbot: (blocksToSave?: Block[], connectionsToSave?: Connection[], websiteContextsToSave?: WebsiteContext[]) => Promise<Chatbot | null>;
}

interface BlockEditorProviderProps {
  children: ReactNode;
}

export const BlockEditorProvider: React.FC<BlockEditorProviderProps> = ({ children }) => {
  const { logout } = useAuth();
  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [websiteContexts, setWebsiteContexts] = useState<WebsiteContext[]>([]);
  const [cloudIntegrations, setCloudIntegrations] = useState<CloudIntegrationWithBlockId[]>([]);
  const [slackIntegrations, setSlackIntegrations] = useState<SlackIntegrationWithBlockId[]>([]);
  const [chatbotStatus, setChatbotStatus] = useState<'ACTIVE' | 'INACTIVE'>('INACTIVE');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [chatbotName, setChatbotName] = useState('');
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<{ blockId: string; direction: 'RIGHT' | 'BOTTOM' | 'LEFT' } | null>(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [canvasScale, setCanvasScale] = useState(1);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [blockToDelete, setBlockToDelete] = useState<string | null>(null);
  const { id: chatbotId } = useParams();
  const { handleError } = useErrorHandler(logout);

  useEffect(() => {
    const fetchChatbotData = async () => {
      if (chatbotId) {
        const token = localStorage.getItem('auth_token');
        if (token) {
          try {
            const chatbotData = await getChatbot(chatbotId, token);
            setChatbot(chatbotData);
            setBlocks(chatbotData.blocks || []);
            setConnections(chatbotData.connections || []);
            // Ensure websiteContexts have the new fields with defaults and match current blocks
            const websiteContextsWithDefaults = (chatbotData.websiteContexts || []).map(wc => ({
              ...wc,
              recursive: wc.recursive ?? false,
              maxDepth: wc.maxDepth ?? 3,
              cronEnabled: wc.cronEnabled ?? false,
              cronSchedule: wc.cronSchedule ?? '0 0 * * *',
              cronTimezone: wc.cronTimezone ?? 'UTC',
              nextCrawlAt: wc.nextCrawlAt ?? null,
            }));
            
            // Find website context blocks and create missing ones
            const websiteBlocks = chatbotData.blocks.filter(block => block.subtype === 'Website');
            const updatedWebsiteContexts = [...websiteContextsWithDefaults];
            
            websiteBlocks.forEach(block => {
              const existingContext = updatedWebsiteContexts.find(wc => wc.blockId === block.id);
              if (!existingContext && block.properties?.url) {
                // Create a new website context for this block
                updatedWebsiteContexts.push({
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
                });
              }
            });
            
            setWebsiteContexts(updatedWebsiteContexts);
            setChatbotStatus(chatbotData.status || 'INACTIVE');
            setOwnerId(chatbotData.ownerId);
            setChatbotName(chatbotData.name || '');

            // Fetch Cloud integrations for Cloud blocks
            const cloudBlocks = chatbotData.blocks.filter(block => block.subtype === 'Cloud');
            const cloudPromises = cloudBlocks.map(async (block) => {
              try {
                const response = await getCloudIntegration(block.id, token);
                return { ...response.integration, blockId: block.id };
              } catch (error) {
                console.error(`Failed to fetch cloud integration for block ${block.id}:`, error);
                return null;
              }
            });
            const cloudResults = await Promise.all(cloudPromises);
            setCloudIntegrations(cloudResults.filter((ci): ci is CloudIntegrationWithBlockId => ci !== null));

            // Fetch Slack integration
            try {
              const slackResponse = await getSlackIntegration(chatbotId, token);
              if (slackResponse.integration) {
                const slackBlock = chatbotData.blocks.find(block => block.subtype === 'Slack');
                if (slackBlock) {
                  setSlackIntegrations([{ ...slackResponse.integration, blockId: slackBlock.id }]);
                }
              } else {
                setSlackIntegrations([]);
              }
            } catch (error) {
              console.error("Failed to fetch Slack integration:", error);
              setSlackIntegrations([]);
            }
          } catch (error) {
            console.error("Failed to fetch chatbot data:", error);
            handleError(error as ApiError);
          }
        }
      }
    };

    fetchChatbotData();
  }, [chatbotId, handleError]);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token || !chatbotId) return;

    const activeCrawls = websiteContexts.filter(wc =>
      ['starting', 'crawling', 'queued'].includes(wc.crawlingStatus?.status || '')
    );

    if (activeCrawls.length === 0) return;

    const interval = setInterval(async () => {
      const promises = activeCrawls.map(wc =>
        getCrawlingStatus(wc.blockId, token).catch(error => {
          console.error(`Failed to get crawling status for block ${wc.blockId}:`, error);
          return { status: 'error', progress: 0, total: 0, currentUrl: '' }; // Return a consistent error object
        })
      );

      const newStatuses = await Promise.all(promises);

      let changed = false;
      let needsFullRefetch = false;
      
      const newWebsiteContexts = websiteContexts.map(wc => {
        const activeIndex = activeCrawls.findIndex(ac => ac.blockId === wc.blockId);
        if (activeIndex !== -1) {
          const newStatus = newStatuses[activeIndex];
          const oldStatus = wc.crawlingStatus;

          if (newStatus && (newStatus.status !== oldStatus?.status || newStatus.progress !== oldStatus?.progress)) {
            changed = true;
            if (newStatus.status === 'completed' && oldStatus?.status !== 'completed') {
              needsFullRefetch = true;
            }
            return { ...wc, crawlingStatus: newStatus };
          }
        }
        return wc;
      });

      if (changed) {
        setWebsiteContexts(newWebsiteContexts);
      }

      if (needsFullRefetch) {
        clearInterval(interval);
        const updatedChatbot = await getChatbot(chatbotId, token);
        if (updatedChatbot) {
          const websiteContextsWithDefaults = (updatedChatbot.websiteContexts || []).map(wc => ({
            ...wc,
            recursive: wc.recursive ?? false,
            maxDepth: wc.maxDepth ?? 3,
            cronEnabled: wc.cronEnabled ?? false,
            cronSchedule: wc.cronSchedule ?? '0 0 * * *',
            cronTimezone: wc.cronTimezone ?? 'UTC',
            nextCrawlAt: wc.nextCrawlAt ?? null,
          }));
          
          // Find website context blocks and create missing ones
          const websiteBlocks = updatedChatbot.blocks.filter(block => block.subtype === 'Website');
          const updatedWebsiteContexts = [...websiteContextsWithDefaults];
          
          websiteBlocks.forEach(block => {
            const existingContext = updatedWebsiteContexts.find(wc => wc.blockId === block.id);
            if (!existingContext && block.properties?.url) {
              // Create a new website context for this block
              updatedWebsiteContexts.push({
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
              });
            }
          });
          
          setWebsiteContexts(updatedWebsiteContexts);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [websiteContexts, chatbotId]);

  // Poll Cloud integration status when indexing
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token || !chatbotId) return;

    const indexingCloudBlocks = cloudIntegrations.filter(ci => 
      ci.indexingStatus === 'indexing'
    );

    if (indexingCloudBlocks.length === 0) return;

    const interval = setInterval(async () => {
      const promises = indexingCloudBlocks.map(async (ci) => {
        try {
          const response = await getCloudIntegration(ci.blockId, token);
          return { ...response.integration, blockId: ci.blockId };
        } catch (error) {
          console.error(`Failed to get cloud integration status for block ${ci.blockId}:`, error);
          return null;
        }
      });

      const newIntegrations = await Promise.all(promises);
      const validIntegrations = newIntegrations.filter((ci): ci is CloudIntegrationWithBlockId => ci !== null);

      // Update only changed integrations
      setCloudIntegrations(prev => {
        const updated = [...prev];
        validIntegrations.forEach(newCi => {
          const index = updated.findIndex(ci => ci.blockId === newCi.blockId);
          if (index !== -1) {
            updated[index] = newCi;
          }
        });
        return updated;
      });

      // If any indexing completed, refetch all cloud integrations
      const completed = validIntegrations.some(ci => ci.indexingStatus === 'completed');
      if (completed) {
        const cloudBlocks = blocks.filter(block => block.subtype === 'Cloud');
        const cloudPromises = cloudBlocks.map(async (block) => {
          try {
            const response = await getCloudIntegration(block.id, token);
            return { ...response.integration, blockId: block.id };
          } catch (error) {
            console.error(`Failed to fetch cloud integration for block ${block.id}:`, error);
            return null;
          }
        });
        const cloudResults = await Promise.all(cloudPromises);
        setCloudIntegrations(cloudResults.filter((ci): ci is CloudIntegrationWithBlockId => ci !== null));
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [cloudIntegrations, chatbotId, blocks]);

  // Refresh Cloud and Slack integrations when blocks change
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token || !chatbotId) return;

    const refreshIntegrations = async () => {
      // Refresh Cloud integrations
      const cloudBlocks = blocks.filter(block => block.subtype === 'Cloud');
      if (cloudBlocks.length > 0) {
        const cloudPromises = cloudBlocks.map(async (block) => {
          try {
            const response = await getCloudIntegration(block.id, token);
            return { ...response.integration, blockId: block.id };
          } catch (error) {
            console.error(`Failed to fetch cloud integration for block ${block.id}:`, error);
            return null;
          }
        });
        const cloudResults = await Promise.all(cloudPromises);
        setCloudIntegrations(cloudResults.filter((ci): ci is CloudIntegrationWithBlockId => ci !== null));
      } else {
        setCloudIntegrations([]);
      }

      // Refresh Slack integration
      const slackBlock = blocks.find(block => block.subtype === 'Slack');
      if (slackBlock) {
        try {
          const slackResponse = await getSlackIntegration(chatbotId, token);
          if (slackResponse.integration) {
            setSlackIntegrations([{ ...slackResponse.integration, blockId: slackBlock.id }]);
          } else {
            setSlackIntegrations([]);
          }
        } catch (error) {
          console.error("Failed to fetch Slack integration:", error);
          setSlackIntegrations([]);
        }
      } else {
        setSlackIntegrations([]);
      }
    };

    // Debounce the refresh to avoid too many API calls
    const timeoutId = setTimeout(refreshIntegrations, 1000);
    return () => clearTimeout(timeoutId);
  }, [blocks.length, chatbotId]); // Only refresh when block count changes

  const addBlock = async (type: Block['type'], subtype: string, position: { x: number; y: number }) => {
    const tempId = `block-${Date.now()}`;
    
    // Map subtypes to display titles for consistency between palette and canvas
    // Only apply special titles for specific type+subtype combinations
    let blockTitle = subtype;
    if (subtype === 'Calendar' && type.toUpperCase() === 'ACTION') {
      blockTitle = 'Manage events'; // Calendar action block -> "Manage events" on canvas
    }
    
    const newBlock: Block = {
      id: tempId,
      chatbotId: chatbotId || '',
      type: type.toUpperCase() as Block['type'],
      subtype,
      title: blockTitle,
      position,
      properties: {}
    };
    
    const currentChatbot = chatbot;

    if (subtype === 'Interface') {
      newBlock.properties = {
        title: 'My Chatbot',
        description: 'Welcome to my chatbot!',
        theme: 'light',
        accentColor: '#2D726D',
        questionSuggestions: [
          { id: '1', text: 'Tell me about the platform', icon: 'Building' },
          { id: '2', text: 'How do I create a new project?', icon: 'Sparkles' },
          { id: '3', text: 'Explain the workflow', icon: 'MessageSquare' }
        ]
      };
    }

    if (subtype === 'DB' || subtype === 'Database') {
      newBlock.properties = {
        dbType: 'postgresql',
      };
    }

    if (subtype === 'Bubble') {
      newBlock.properties = {
        bubbleColor: '#2D726D',
        bubbleSize: 'medium',
        bubbleIcon: '💬',
        position: 'bottom-right',
        offsetX: 20,
        offsetY: 20,
        chatWindowTitle: currentChatbot?.name || 'Chat',
        chatWindowColor: '#2D726D',
        chatWindowTheme: 'light',
        autoOpen: false,
        showOnMobile: true,
        trackConversations: true,
        trackPageViews: false
      };
    }

    // Auto-link Calendar action blocks to Calendar context blocks
    if (subtype === 'Calendar' && type.toUpperCase() === 'ACTION') {
      const calendarContextBlock = blocks.find(
        (b: Block) => b.type === 'CONTEXT' && b.subtype === 'Calendar'
      );
      if (calendarContextBlock) {
        newBlock.properties = {
          ...newBlock.properties,
          shareCredentialsWithBlockId: calendarContextBlock.id,
        };
        console.log('[BlockEditor] Auto-linked Calendar action block to context block:', calendarContextBlock.id);
      }
    }

    let newConnection: Connection | null = null;
    const logicBlock = blocks.find((b: Block) => b.type === 'LOGIC');

    if (logicBlock && logicBlock.id !== newBlock.id) {
      let fromBlock = newBlock.type === 'CONTEXT' ? newBlock : logicBlock;
      let toBlock = newBlock.type === 'CONTEXT' ? logicBlock : newBlock;
      
      let fromDirection: 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM' = 'RIGHT';
      let toDirection: 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM' = 'LEFT';

      if (newBlock.type === 'ACTION') {
        fromDirection = 'BOTTOM';
        toDirection = 'TOP';
      }
      if (newBlock.type === 'TEST') {
        // Connect Test block from its bottom to the System Prompt (logic) top
        fromBlock = newBlock;
        toBlock = logicBlock;
        fromDirection = 'BOTTOM';
        toDirection = 'TOP';
      }

      newConnection = {
        id: `conn-${Date.now()}`,
        chatbotId: chatbotId || '',
        fromBlockId: fromBlock.id, // This might be a temp ID, which is fine
        toBlockId: toBlock.id,
        fromDirection: fromDirection,
        toDirection: toDirection,
      };
    }

    const newBlocksArray = [...blocks, newBlock];
    // Handle multiple connections: logic connection + calendar connection
    const connectionsToAdd: Connection[] = [];
    if (newConnection) {
      connectionsToAdd.push(newConnection);
    }
    // Add calendar connection if this is a Calendar action block
    if (subtype === 'Calendar' && type.toUpperCase() === 'ACTION') {
      const calendarContextBlock = blocks.find(
        (b: Block) => b.type === 'CONTEXT' && b.subtype === 'Calendar'
      );
      if (calendarContextBlock) {
        const calendarConnection: Connection = {
          id: `conn-calendar-${Date.now()}`,
          chatbotId: chatbotId || '',
          fromBlockId: calendarContextBlock.id,
          toBlockId: tempId,
          fromDirection: 'RIGHT',
          toDirection: 'LEFT',
        };
        // Only add if not already in connectionsToAdd
        if (!connectionsToAdd.find(c => c.fromBlockId === calendarContextBlock.id && c.toBlockId === tempId)) {
          connectionsToAdd.push(calendarConnection);
          console.log('[BlockEditor] Created Calendar connection:', calendarConnection.id);
        }
      }
    }
    const newConnectionsArray = connectionsToAdd.length > 0 ? [...connections, ...connectionsToAdd] : connections;

    // Optimistically update the UI
    setBlocks(newBlocksArray);
    setConnections(newConnectionsArray);

    // Save the entire state in one go
    const updatedChatbot = await saveChatbot(newBlocksArray, newConnectionsArray);

    if (!updatedChatbot) {
      console.error("Failed to save chatbot, reverting optimistic update.");
      // Revert the optimistic update
      setBlocks(blocks);
      setConnections(connections);
      return newBlock; // Return temporary block
    }

    // The saveChatbot function already updates the state with the correct IDs.
    // We just need to find the final block to return it.
    const finalNewBlock = updatedChatbot.blocks.find((b: Block) => 
      !blocks.some(oldBlock => oldBlock.id === b.id)
    );

    setTimeout(() => autoLayout(), 50);

    return finalNewBlock || newBlock; // Return the final block, or fallback to the temp one
  };

  const addConnection = (connection: { fromBlockId: string, toBlockId: string, fromHandle: 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM', toHandle: 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM' }) => {
    const newConnection: Connection = {
      id: `conn-${Date.now()}`,
      chatbotId: chatbotId || '',
      fromBlockId: connection.fromBlockId,
      toBlockId: connection.toBlockId,
      fromDirection: connection.fromHandle,
      toDirection: connection.toHandle,
    };
    setConnections(prev => [...prev, newConnection]);
  };

  const updateBlock = (id: string, updates: Partial<Block>) => {
    console.log('Updating block:', id, updates);
    setBlocks(prev => prev.map(block => 
      block.id === id ? { ...block, ...updates } : block
    ));
    if (selectedBlock?.id === id) {
      setSelectedBlock(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const updateWebsiteContext = (blockId: string, updates: Partial<WebsiteContext>) => {
    setWebsiteContexts(prev => prev.map(wc => 
      wc.blockId === blockId ? { ...wc, ...updates } : wc
    ));
  };

  const deleteBlock = (id: string) => {
    setBlockToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteBlock = async () => {
    if (blockToDelete) {
      const block = blocks.find(b => b.id === blockToDelete);
      if (block) {
        try {
          const token = localStorage.getItem('auth_token');
          if (!token) {
            console.error("Authentication token not found.");
            return;
          }
          // This is a new API call that needs to be created
          await deleteBlockData(chatbotId!, block.id, token);
        } catch (error) {
          console.error("Failed to delete block data:", error);
          // Optionally, handle the error more gracefully (e.g., show a notification to the user)
          return; // Stop the deletion process if the API call fails
        }
      }

      setBlocks(prev => prev.filter(block => block.id !== blockToDelete));
      setConnections(prev => prev.filter(conn => conn.fromBlockId !== blockToDelete && conn.toBlockId !== blockToDelete));
      if (selectedBlock?.id === blockToDelete) {
        setSelectedBlock(null);
      }
      setBlockToDelete(null);
    }
    setIsDeleteModalOpen(false);
    setTimeout(() => autoLayout(), 50);
  };

  const cancelDeleteBlock = () => {
    setBlockToDelete(null);
    setIsDeleteModalOpen(false);
  };

  const selectBlock = (block: Block | null) => {
    setSelectedBlock(block);
  };

  const startConnection = (blockId: string, direction: 'RIGHT' | 'BOTTOM' | 'LEFT') => {
    setIsConnecting(true);
    setConnectionStart({ blockId, direction });
  };

  const endConnection = (blockId: string, direction: 'LEFT' | 'TOP') => {
    if (connectionStart && connectionStart.blockId !== blockId) {
      const fromBlock = blocks.find(b => b.id === connectionStart.blockId);
      const toBlock = blocks.find(b => b.id === blockId);
      
      if (fromBlock && toBlock && isValidConnection(fromBlock, toBlock, connectionStart.direction, direction)) {
        const newConnection: Connection = {
          id: `conn-${Date.now()}`,
          chatbotId: chatbotId || '',
          fromBlockId: connectionStart.blockId,
          toBlockId: blockId,
          fromDirection: connectionStart.direction,
          toDirection: direction
        };
        setConnections(prev => [...prev, newConnection]);
      }
    }
    setIsConnecting(false);
    setConnectionStart(null);
    setTimeout(() => autoLayout(), 50);
  };

  const isValidConnection = (fromBlock: Block, toBlock: Block, fromDir: 'RIGHT' | 'BOTTOM' | 'LEFT', toDir: 'LEFT' | 'TOP'): boolean => {
    const fromType = fromBlock.type.toLowerCase();
    const toType = toBlock.type.toLowerCase();

    if (fromType === 'context' && toType === 'logic' && fromDir === 'RIGHT' && toDir === 'LEFT') return true;
    if (fromType === 'logic' && toType === 'frontend' && fromDir === 'RIGHT' && toDir === 'LEFT') return true;
    if (fromType === 'logic' && toType === 'action' && fromDir === 'BOTTOM' && toDir === 'TOP') return true;
    if (fromType === 'test' && toType === 'logic' && fromDir === 'BOTTOM' && toDir === 'TOP') return true;
    
    return false;
  };

  const cancelConnection = () => {
    setIsConnecting(false);
    setConnectionStart(null);
  };

  const deleteConnection = (id: string) => {
    setConnections(prev => prev.filter(conn => conn.id !== id));
    setTimeout(() => autoLayout(), 50);
  };

  const autoLayout = () => {
    setBlocks(prevBlocks => {
      const logicBlock = prevBlocks.find(b => b.type.toLowerCase() === 'logic');
      if (!logicBlock) return prevBlocks;

      const HORIZONTAL_SPACING = 250;
      const VERTICAL_SPACING = 150;

      const blockMap = new Map(prevBlocks.map(b => [b.id, { ...b, position: { ...b.position } }]));

      const newLogicBlock = blockMap.get(logicBlock.id)!;
      newLogicBlock.position = { x: 0, y: 0 };

      const contextBlocks = prevBlocks.filter(b => b.type.toLowerCase() === 'context');
      contextBlocks.forEach((block, index) => {
        const newBlock = blockMap.get(block.id)!;
        newBlock.position = {
          x: newLogicBlock.position.x - HORIZONTAL_SPACING,
          y: newLogicBlock.position.y + (index - (contextBlocks.length - 1) / 2) * VERTICAL_SPACING
        };
      });

      const frontendBlocks = prevBlocks.filter(b => b.type.toLowerCase() === 'frontend');
      frontendBlocks.forEach((block, index) => {
        const newBlock = blockMap.get(block.id)!;
        newBlock.position = {
          x: newLogicBlock.position.x + HORIZONTAL_SPACING,
          y: newLogicBlock.position.y + (index - (frontendBlocks.length - 1) / 2) * VERTICAL_SPACING
        };
      });

      const actionBlocks = prevBlocks.filter(b => b.type.toLowerCase() === 'action');
      actionBlocks.forEach((block, index) => {
        const newBlock = blockMap.get(block.id)!;
        newBlock.position = {
          x: newLogicBlock.position.x + (index - (actionBlocks.length - 1) / 2) * HORIZONTAL_SPACING,
          y: newLogicBlock.position.y + VERTICAL_SPACING
        };
      });

      const testBlocks = prevBlocks.filter(b => b.type.toLowerCase() === 'test');
      testBlocks.forEach((block, index) => {
        const newBlock = blockMap.get(block.id)!;
        newBlock.position = {
          x: newLogicBlock.position.x + (index - (testBlocks.length - 1) / 2) * HORIZONTAL_SPACING,
          y: newLogicBlock.position.y - VERTICAL_SPACING
        };
      });

      return Array.from(blockMap.values());
    });
  };

  const exportConfiguration = () => {
    return JSON.stringify({ blocks, connections, timestamp: Date.now() }, null, 2);
  };

  const importConfiguration = (config: string) => {
    try {
      const parsed = JSON.parse(config);
      if (parsed.blocks) {
        setBlocks(parsed.blocks);
        setConnections(parsed.connections || []);
        setSelectedBlock(null);
      }
    } catch (error) {
      console.error('Failed to import configuration:', error);
    }
  };

  const saveChatbot = async (blocksToSave?: Block[], connectionsToSave?: Connection[], websiteContextsToSave?: WebsiteContext[]): Promise<Chatbot | null> => {
    if (chatbotId) {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const blocksPayload = blocksToSave || blocks;
          const connectionsPayload = connectionsToSave || connections;
          const websiteContextsPayload = websiteContextsToSave || websiteContexts;

          // Create a map of temporary IDs to original blocks
          const tempIdBlockMap = new Map(blocksPayload.map(b => [b.id, b]));

          const updatedChatbot = await updateChatbot(chatbotId, { name: chatbotName, status: chatbotStatus, blocks: blocksPayload, connections: connectionsPayload, websiteContexts: websiteContextsPayload }, token);

          const newBlocks = updatedChatbot.blocks || [];
          const newConnections = updatedChatbot.connections || [];

          // Create a mapping from old temporary IDs to new permanent IDs
          const idMap: { [key: string]: string } = {};
          newBlocks.forEach(newBlock => {
            const originalBlock = Array.from(tempIdBlockMap.values()).find(
              oldBlock => 
                oldBlock.id.startsWith('block-') && // Correctly identify temporary IDs
                oldBlock.subtype === newBlock.subtype &&
                oldBlock.position.x === newBlock.position.x &&
                oldBlock.position.y === newBlock.position.y &&
                !newBlocks.some(b => b.id === oldBlock.id)
            );

            if (originalBlock && originalBlock.id !== newBlock.id) {
              idMap[originalBlock.id] = newBlock.id;
            }
          });

          // Update block IDs in the blocks list
          const finalBlocks = newBlocks.map(block => {
            return block;
          });

          // Update connection IDs
          const finalConnections = newConnections.map(conn => {
            const newFromId = idMap[conn.fromBlockId] || conn.fromBlockId;
            const newToId = idMap[conn.toBlockId] || conn.toBlockId;
            return { ...conn, fromBlockId: newFromId, toBlockId: newToId };
          });

          setBlocks(finalBlocks);
          setConnections(finalConnections);

          // Update selected block if it was one of the temporary ones
          if (selectedBlock && idMap[selectedBlock.id]) {
            const newSelectedBlock = finalBlocks.find(b => b.id === idMap[selectedBlock.id]);
            if (newSelectedBlock) {
              setSelectedBlock(newSelectedBlock);
            }
          }
          
          const websiteContextsWithDefaults = (updatedChatbot.websiteContexts || []).map(wc => ({
            ...wc,
            recursive: wc.recursive ?? false,
            maxDepth: wc.maxDepth ?? 3,
            cronEnabled: wc.cronEnabled ?? false,
            cronSchedule: wc.cronSchedule ?? '0 0 * * *',
            cronTimezone: wc.cronTimezone ?? 'UTC',
            nextCrawlAt: wc.nextCrawlAt ?? null,
          }));
          
          // Find website context blocks and create missing ones
          const websiteBlocks = finalBlocks.filter(block => block.subtype === 'Website');
          const updatedWebsiteContexts = [...websiteContextsWithDefaults];
          
          websiteBlocks.forEach(block => {
            const existingContext = updatedWebsiteContexts.find(wc => wc.blockId === block.id);
            if (!existingContext && block.properties?.url) {
              // Create a new website context for this block
              updatedWebsiteContexts.push({
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
              });
            }
          });
          
          return { ...updatedChatbot, blocks: finalBlocks, connections: finalConnections, websiteContexts: updatedWebsiteContexts };

        } catch (error) {
          console.error("Failed to save chatbot data:", error);
        }
      }
    }
    return null;
  };

  return (
    <BlockEditorContext.Provider value={{
      chatbot,
      setChatbot,
      blocks,
      connections,
      websiteContexts,
      setWebsiteContexts,
      cloudIntegrations,
      slackIntegrations,
      chatbotStatus,
      setChatbotStatus,
      ownerId,
      chatbotName,
      selectedBlock,
      isConnecting,
      connectionStart,
      canvasOffset,
      canvasScale,
      addBlock,
      updateBlock,
      deleteBlock,
      confirmDeleteBlock,
      cancelDeleteBlock,
      isDeleteModalOpen,
      selectBlock,
      updateWebsiteContext,
      startConnection,
      endConnection,
      addConnection,
      cancelConnection,
      deleteConnection,
      setCanvasOffset,
      setCanvasScale,
      setConnections,
      setBlocks,
      autoLayout,
      exportConfiguration,
      importConfiguration,
      saveChatbot,
    }}>
      {children}
    </BlockEditorContext.Provider>
  );
};

export { useBlockEditor } from './BlockEditorContext.hooks';