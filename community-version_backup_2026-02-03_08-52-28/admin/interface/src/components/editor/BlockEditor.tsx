import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBlockEditor } from '@/contexts/BlockEditorContext';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import BlockPalette from './BlockPalette';
import BlockRenderer from '../blocks/BlockRenderer';
import BlockProperties from './BlockProperties';
import EditorToolbar from './EditorToolbar';
import ConnectionRenderer from './Connection';
import ChatbotSettingsModal from './ChatbotSettingsModal';
import { Button } from '@/components/ui/button';
import { Settings, ArrowLeft, LogIn, Cloud, CloudCog, CloudOff } from 'lucide-react';
import { loginAsTestUser, updateChatbot } from '@/lib/api';
import { USER_INTERFACE_URL } from '@/lib/apiClient';
import { useErrorHandler, ApiError } from '@/hooks/useErrorHandler';
import TutorialBubble from '../tutorial/TutorialBubble';
import { useTutorial } from '@/contexts/TutorialContext';

type SyncStatus = 'syncing' | 'synced' | 'error' | 'idle';

const SyncStatusIndicator = ({ status }: { status: SyncStatus }) => {
  switch (status) {
    case 'syncing':
      return <div className="flex items-center text-sm text-muted-foreground"><Cloud className="w-4 h-4 mr-2 animate-pulse" />Syncing...</div>;
    case 'synced':
      return <div className="flex items-center text-sm text-green-500"><CloudCog className="w-4 h-4 mr-2" />Synced</div>;
    case 'error':
      return <div className="flex items-center text-sm text-red-500"><CloudOff className="w-4 h-4 mr-2" />Error</div>;
    default:
      return null;
  }
};

const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};

const BlockEditor = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { handleError } = useErrorHandler(logout);
  const { 
    blocks, 
    connections, 
    selectedBlock, 
    addBlock, 
    addConnection,
    updateBlock,
    selectBlock, 
    isConnecting, 
    cancelConnection,
    canvasOffset,
    canvasScale,
    setCanvasOffset,
    setCanvasScale,
    autoLayout,
    websiteContexts,
  } = useBlockEditor();

  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { id } = useParams<{ id: string }>();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [isInitialLayoutDone, setIsInitialLayoutDone] = useState(false);
  const { isCompleted, startTutorial } = useTutorial();
  
  const isChatbotRoute = location.pathname.startsWith('/chatbot/');

  const debouncedBlocks = useDebounce(blocks, 1500);
  const debouncedConnections = useDebounce(connections, 1500);
  const initialLoadRef = useRef(true);

  const isAnyBlockCrawling = blocks.some(
    (b) => b.crawlingStatus?.status === 'crawling' || b.crawlingStatus?.status === 'starting'
  );

  const centerCanvasView = useCallback(() => {
    if (!canvasRef.current || blocks.length === 0) return;

    const PADDING = 200;
    const xCoordinates = blocks.map(b => b.position.x);
    const yCoordinates = blocks.map(b => b.position.y);
    const minX = Math.min(...xCoordinates) - PADDING;
    const maxX = Math.max(...xCoordinates) + PADDING;
    const minY = Math.min(...yCoordinates) - PADDING;
    const maxY = Math.max(...yCoordinates) + PADDING;

    const blocksWidth = maxX - minX;
    const blocksHeight = maxY - minY;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const canvasWidth = canvasRect.width;
    const canvasHeight = canvasRect.height;

    if (canvasWidth <= 0 || canvasHeight <= 0) return;

    const scaleX = canvasWidth / blocksWidth;
    const scaleY = canvasHeight / blocksHeight;
    const newScale = Math.min(scaleX, scaleY, 1);
    
    const newOffsetX = (canvasWidth - (blocksWidth * newScale)) / 2 - minX * newScale;
    const newOffsetY = (canvasHeight - (blocksHeight * newScale)) / 2 - minY * newScale;

    setCanvasOffset({ x: newOffsetX, y: newOffsetY });
    setCanvasScale(newScale);
  }, [blocks, setCanvasOffset, setCanvasScale]);

  useEffect(() => {
    if (blocks.length > 0 && !isInitialLayoutDone) {
      const timer = setTimeout(() => {
        centerCanvasView();
        setIsInitialLayoutDone(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [blocks, isInitialLayoutDone, centerCanvasView]);

  useEffect(() => {
    if (isInitialLayoutDone) {
      // Wait for properties panel transition to complete (300ms) plus buffer
      // Also ensure canvas dimensions are updated by using requestAnimationFrame
      const timer = setTimeout(() => {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            centerCanvasView();
          });
        });
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [selectedBlock, isInitialLayoutDone, centerCanvasView]);

  // Handle window resize and canvas container resize to recalculate canvas view
  useEffect(() => {
    if (!isInitialLayoutDone || blocks.length === 0 || !canvasRef.current) return;

    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
      // Debounce resize to avoid excessive recalculations
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        centerCanvasView();
      }, 150);
    };

    // Watch for window resize
    window.addEventListener('resize', handleResize);
    
    // Watch for canvas container resize (e.g., when properties panel opens/closes)
    const resizeObserver = new ResizeObserver(() => {
      // Wait for CSS transitions to complete (300ms) plus a small buffer
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        centerCanvasView();
      }, 350);
    });

    resizeObserver.observe(canvasRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      clearTimeout(resizeTimer);
    };
  }, [isInitialLayoutDone, blocks.length, centerCanvasView]);

  // Auto-start tutorial for new users
  useEffect(() => {
    if (!isCompleted) {
      const timer = setTimeout(() => {
        startTutorial();
      }, 1000); // Small delay to ensure everything is loaded
      return () => clearTimeout(timer);
    }
  }, [isCompleted, startTutorial]);

  useEffect(() => {
    if (initialLoadRef.current) {
      if (debouncedBlocks.length > 0 || debouncedConnections.length > 0) {
          initialLoadRef.current = false;
      }
      return;
    }

    const autoSave = async () => {
      if (!id || !token || isAnyBlockCrawling) return;
      setSyncStatus('syncing');
      try {
        await updateChatbot(id, { blocks: debouncedBlocks, connections: debouncedConnections }, token);
        setSyncStatus('synced');
      } catch (error) {
        setSyncStatus('error');
        console.error("Auto-save failed:", error);
        handleError(error as ApiError);
      }
    };

    autoSave();
  }, [debouncedBlocks, debouncedConnections, id, token, isAnyBlockCrawling, handleError]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (isConnecting) {
        cancelConnection();
      } else {
        selectBlock(null);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const blockDataStr = e.dataTransfer.getData('blockData');
    const movingBlockStr = e.dataTransfer.getData('application/json');

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - canvasOffset.x) / canvasScale;
    const y = (e.clientY - rect.top - canvasOffset.y) / canvasScale;

    if (blockDataStr) {
      const { type, subtype } = JSON.parse(blockDataStr);
      const created = await addBlock(type, subtype, { x, y });
      if (created) {
        selectBlock(created);
      }
    } else if (movingBlockStr) {
      const { blockId, dragOffset } = JSON.parse(movingBlockStr);
      updateBlock(blockId, {
        position: {
          x: x - dragOffset.x / canvasScale,
          y: y - dragOffset.y / canvasScale,
        }
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleLoginAsTestUser = async () => {
    const authToken = localStorage.getItem('auth_token');
    if (authToken && id) {
      try {
        const { token: userToken } = await loginAsTestUser(authToken);
        window.open(`${USER_INTERFACE_URL}/chatbot/${id}?test_token=${userToken}`, '_blank');
      } catch (error) {
        console.error("Failed to login as test user:", error);
        handleError(error as ApiError);
      }
    }
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (e.button === 0 && !target.closest('[data-block-id]')) {
      e.preventDefault();
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      setCanvasOffset({
        x: canvasOffset.x + deltaX,
        y: canvasOffset.y + deltaY
      });
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  }, [isPanning, lastPanPoint, canvasOffset, setCanvasOffset]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(3, canvasScale * delta));
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const scaleChange = newScale / canvasScale;
      setCanvasOffset({
        x: mouseX - (mouseX - canvasOffset.x) * scaleChange,
        y: mouseY - (mouseY - canvasOffset.y) * scaleChange
      });
    }
    
    setCanvasScale(newScale);
  }, [canvasScale, setCanvasScale, canvasOffset, setCanvasOffset]);

  const enhanceLayout = () => {
    // Layout logic remains the same
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <div className="bg-card border-b border-border p-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workflow Builder</h1>
          <p className="text-muted-foreground">Welcome, {user?.name || user?.email}</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setIsSettingsOpen(true)} className="settings-button">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button variant="outline" size="sm" onClick={handleLoginAsTestUser} className="test-mode-button">
            <LogIn className="w-4 h-4 mr-2" />
            Test Mode
          </Button>
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-72 h-full block-palette">
          <BlockPalette />
        </div>

        <div className="flex-1 flex flex-col">
          <EditorToolbar syncStatus={syncStatus} />
          <div
            ref={canvasRef}
            className="flex-1 relative overflow-hidden bg-background canvas-area"
            onClick={handleCanvasClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)`,
                backgroundSize: `${20 * canvasScale}px ${20 * canvasScale}px`,
                backgroundPosition: `${canvasOffset.x}px ${canvasOffset.y}px`,
                transition: 'background-position 0.3s ease-in-out',
              }}
            />
            
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ transformOrigin: '0 0' }}>
              <g style={{ 
                transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`, 
                transformOrigin: '0 0',
                transition: 'transform 0.3s ease-in-out' 
              }}>
                {connections.map(connection => (
                  <ConnectionRenderer key={connection.id} connection={connection} />
                ))}
              </g>
            </svg>

            <div
              className="absolute inset-0"
              style={{
                transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`,
                transformOrigin: '0 0',
                transition: 'transform 0.3s ease-in-out',
              }}
            >
              {blocks.map(block => (
                <BlockRenderer
                  key={block.id}
                  block={block}
                  isSelected={selectedBlock?.id === block.id}
                  onSelect={() => selectBlock(block)}
                />
              ))}
              {(() => {
                const mainBlock = blocks.find(b => b.subtype === 'System Prompt');
                if (!mainBlock) return null;

                const MAIN_BLOCK_WIDTH = 192;
                const MAIN_BLOCK_HEIGHT = 128;
                const PLACEHOLDER_WIDTH = 160;
                const PLACEHOLDER_HEIGHT = 80;
                const GAP = 40;

                const hasLeftContext = connections.some(c => {
                  const fromBlock = blocks.find(b => b.id === c.fromBlockId);
                  const toBlock = blocks.find(b => b.id === c.toBlockId);
                  
                  return (
                    (fromBlock?.type.toLowerCase() === 'context' && toBlock?.id === mainBlock.id && fromBlock.position.x < mainBlock.position.x) ||
                    (toBlock?.type.toLowerCase() === 'context' && fromBlock?.id === mainBlock.id && toBlock.position.x < mainBlock.position.x)
                  );
                });

                const hasRightFrontend = connections.some(c => {
                  const targetBlock = blocks.find(b => b.id === c.toBlockId);
                  return c.fromBlockId === mainBlock.id &&
                         targetBlock?.type.toLowerCase() === 'frontend' &&
                         targetBlock.position.x > mainBlock.position.x;
                });

                const hasBottomAction = connections.some(c => {
                  const targetBlock = blocks.find(b => b.id === c.toBlockId);
                  return c.fromBlockId === mainBlock.id &&
                         targetBlock?.type.toLowerCase() === 'action' &&
                         targetBlock.position.y > mainBlock.position.y;
                });

                const hasTopTest = connections.some(c => {
                  const fromBlock = blocks.find(b => b.id === c.fromBlockId);
                  return c.toBlockId === mainBlock.id &&
                         fromBlock?.type.toLowerCase() === 'test' &&
                         fromBlock.position.y < mainBlock.position.y;
                });
                const hasAnyTestBlock = blocks.some(b => b.type.toLowerCase() === 'test');

                const placeholderBaseStyle: React.CSSProperties = {
                  position: 'absolute',
                  width: `${PLACEHOLDER_WIDTH}px`,
                  height: `${PLACEHOLDER_HEIGHT}px`,
                };

                return (
                  <>
                    {!(hasTopTest || hasAnyTestBlock) && (
                      <div
                        style={{
                          ...placeholderBaseStyle,
                          top: `${mainBlock.position.y - (MAIN_BLOCK_HEIGHT / 2) - PLACEHOLDER_HEIGHT - GAP}px`,
                          left: `${mainBlock.position.x - (PLACEHOLDER_WIDTH / 2)}px`
                        }}
                        className="flex items-center justify-center rounded-lg border-2 border-dashed border-green-500/30 bg-green-500/5 p-4 text-center text-green-500/60 pointer-events-none"
                      >
                        Add a test block
                      </div>
                    )}
                    {!hasLeftContext && (
                      <div
                        style={{
                          ...placeholderBaseStyle,
                          top: `${mainBlock.position.y - (PLACEHOLDER_HEIGHT / 2)}px`,
                          left: `${mainBlock.position.x - (MAIN_BLOCK_WIDTH / 2) - PLACEHOLDER_WIDTH - GAP}px`
                        }}
                        className="flex items-center justify-center rounded-lg border-2 border-dashed border-blue-500/30 bg-blue-500/5 p-4 text-center text-blue-500/60 pointer-events-none placeholder-context"
                      >
                        Add a context block
                      </div>
                    )}
                    {!hasRightFrontend && (
                      <div
                        style={{
                          ...placeholderBaseStyle,
                          top: `${mainBlock.position.y - (PLACEHOLDER_HEIGHT / 2)}px`,
                          left: `${mainBlock.position.x + (MAIN_BLOCK_WIDTH / 2) + GAP}px`
                        }}
                        className="flex items-center justify-center rounded-lg border-2 border-dashed border-pink-500/30 bg-pink-500/5 p-4 text-center text-pink-500/60 pointer-events-none placeholder-frontend"
                      >
                        Add a frontend block
                      </div>
                    )}
                    {!hasBottomAction && (
                      <div
                        style={{
                          ...placeholderBaseStyle,
                          top: `${mainBlock.position.y + (MAIN_BLOCK_HEIGHT / 2) + GAP}px`,
                          left: `${mainBlock.position.x - (PLACEHOLDER_WIDTH / 2)}px`
                        }}
                        className="flex items-center justify-center rounded-lg border-2 border-dashed border-purple-500/30 bg-purple-500/5 p-4 text-center text-purple-500/60 pointer-events-none placeholder-action"
                      >
                        Add an action block
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {blocks.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none tutorial-welcome">
                <div className="text-center text-muted-foreground">
                  <h3 className="text-xl font-semibold mb-2">Build Your Workflow</h3>
                  <p>Drag blocks from the palette to start designing</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={`bg-card border-l border-border transition-all duration-300 ease-in-out flex flex-col ${selectedBlock ? 'w-80' : 'w-0'}`}>
          {selectedBlock && (
            <div 
              className="w-80 flex-1 overflow-y-auto custom-scrollbar"
              style={{
                maxHeight: 'calc(100vh - 120px)', // Account for header height
              }}
            >
              <BlockProperties block={selectedBlock} />
            </div>
          )}
        </div>
      </div>
      
      <ChatbotSettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <TutorialBubble step={0} />
      
      {/* Tutorial completion message */}
      <div className="tutorial-complete hidden" />
    </div>
  );
};

export default BlockEditor;
