import React from 'react';
import { Block, useBlockEditor } from '@/contexts/BlockEditorContext';
import { Globe, FileText, GitBranch, MessageSquare, Mail, Search, Layout, Code, X, Circle, Users, Database, Cloud, Calendar } from 'lucide-react';
import BlockStatusBadge from './BlockStatusBadge';

interface BlockRendererProps {
  block: Block;
  isSelected: boolean;
  onSelect: () => void;
}

const blockIcons: Record<string, React.ComponentType<{ size?: number }>> = {
  'Website': Globe,
  'Document': FileText,
  'Database': Database,
  'DB': Database,
  'Cloud': Cloud,
  'Calendar': Calendar,
  'If': GitBranch,
  'System Prompt': MessageSquare,
  'Send email': Mail,
  'Browse internet': Search,
  'Interface': Layout,
  'API': Code,
  'Bubble': Circle,
  'Slack': MessageSquare,
  'Teams': Users,
  'TestLLM': Code,
  'MCP': Code
};

const blockColors = {
  context: 'from-blue-500 to-blue-600',
  logic: 'from-yellow-500 to-yellow-600',
  action: 'from-purple-500 to-purple-600',
  frontend: 'from-pink-500 to-pink-600',
  test: 'from-green-500 to-green-600'
};

const blockOutlineColors = {
  context: 'border-blue-500',
  logic: 'border-yellow-500',
  action: 'border-purple-500',
  frontend: 'border-pink-500',
  test: 'border-green-500'
};

const BlockRenderer: React.FC<BlockRendererProps> = ({ block, isSelected, onSelect }) => {
  const { updateBlock, deleteBlock, isConnecting, startConnection, endConnection, connectionStart, websiteContexts, cloudIntegrations, slackIntegrations, blocks } = useBlockEditor();
  
  // Get icon with fallback handling - try multiple matching strategies
  let Icon = Code;
  if (block.subtype) {
    // Try exact match first
    Icon = blockIcons[block.subtype];
    
    // Try capitalized version (e.g., "database" -> "Database")
    if (!Icon) {
      const capitalized = block.subtype.charAt(0).toUpperCase() + block.subtype.slice(1).toLowerCase();
      Icon = blockIcons[capitalized];
    }
    
    // Try all lowercase
    if (!Icon) {
      Icon = blockIcons[block.subtype.toLowerCase()];
    }
    
    // Try all uppercase
    if (!Icon) {
      Icon = blockIcons[block.subtype.toUpperCase()];
    }
    
    // Fallback to Code icon
    if (!Icon) {
      Icon = Code;
      // Debug: log when icon lookup fails for context blocks
      if (block.type.toLowerCase() === 'context') {
        console.warn(`Icon not found for context block subtype: "${block.subtype}". Available keys:`, Object.keys(blockIcons));
      }
    }
  }

  const handleDragStart = (e: React.DragEvent) => {
    const dragOffset = {
      x: e.clientX - block.position.x,
      y: e.clientY - block.position.y,
    };
    e.dataTransfer.setData('application/json', JSON.stringify({ blockId: block.id, dragOffset }));
  };

  const handleDrag = (e: React.DragEvent) => {
    if (e.clientX === 0 && e.clientY === 0) return;
    
    const { blockId, dragOffset } = JSON.parse(e.dataTransfer.getData('application/json'));
    
    // This is a workaround. In a real drag event, you'd get the position from the event.
    // The parent's onDragOver/onDrop should handle the position calculation.
    // For now, this logic is simplified as direct block dragging is complex with scaling.
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (block.subtype === 'System Prompt') return;
    deleteBlock(block.id);
  };

  const handleConnectionStart = (e: React.MouseEvent, direction: 'right' | 'bottom' | 'left') => {
    e.stopPropagation();
    startConnection(block.id, direction);
  };

  const handleConnectionEnd = (e: React.MouseEvent, direction: 'left' | 'top') => {
    e.stopPropagation();
    if (isConnecting && connectionStart) {
      endConnection(block.id, direction);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isConnecting) {
      onSelect();
    }
  };

  const showConnectionPlaceholder = isConnecting && connectionStart && connectionStart.blockId !== block.id;

  const getConnectionHandles = () => {
    const handles = [];
    
    switch (block.type.toLowerCase()) {
      case 'context':
        handles.push(
          <div
            key="right"
            className="absolute top-1/2 -right-2 w-4 h-4 bg-card border-2 border-blue-500 rounded-full cursor-pointer z-10 -translate-y-1/2 opacity-0 group-hover:opacity-100"
            onClick={(e) => handleConnectionStart(e, 'right')}
            title="Connect to Logic block"
          />
        );
        break;
      
      case 'test':
        handles.push(
          <div
            key="bottom"
            className="absolute left-1/2 -bottom-2 w-4 h-4 bg-card border-2 border-green-500 rounded-full cursor-pointer z-10 -translate-x-1/2 opacity-0 group-hover:opacity-100"
            onClick={(e) => handleConnectionStart(e, 'bottom')}
            title="Connect to Logic block"
          />
        );
        break;
        
      case 'logic':
        handles.push(
          <div
            key="right"
            className="absolute top-1/2 -right-2 w-4 h-4 bg-card border-2 border-yellow-500 rounded-full cursor-pointer z-10 -translate-y-1/2 opacity-0 group-hover:opacity-100"
            onClick={(e) => handleConnectionStart(e, 'right')}
            title="Connect to Frontend block"
          />,
          <div
            key="bottom"
            className="absolute left-1/2 -bottom-2 w-4 h-4 bg-card border-2 border-yellow-500 rounded-full cursor-pointer z-10 -translate-x-1/2 opacity-0 group-hover:opacity-100"
            onClick={(e) => handleConnectionStart(e, 'bottom')}
            title="Connect to Action block"
          />
        );
        if (showConnectionPlaceholder) {
          handles.push(
            <div
              key="left-placeholder"
              className="absolute top-1/2 -left-2 w-4 h-4 bg-green-400 border-2 border-green-500 rounded-full cursor-pointer z-10 -translate-y-1/2"
              onClick={(e) => handleConnectionEnd(e, 'left')}
              title="Drop connection here"
            />
          );
        }
        break;
        
      case 'action':
        if (showConnectionPlaceholder) {
          handles.push(
            <div
              key="top-placeholder"
              className="absolute left-1/2 -top-2 w-4 h-4 bg-green-400 border-2 border-green-500 rounded-full cursor-pointer z-10 -translate-x-1/2"
              onClick={(e) => handleConnectionEnd(e, 'top')}
              title="Drop connection here"
            />
          );
        }
        break;
        
      case 'frontend':
        if (showConnectionPlaceholder) {
          handles.push(
            <div
              key="left-placeholder"
              className="absolute top-1/2 -left-2 w-4 h-4 bg-green-400 border-2 border-green-500 rounded-full cursor-pointer z-10 -translate-y-1/2"
              onClick={(e) => handleConnectionEnd(e, 'left')}
              title="Drop connection here"
            />
          );
        }
        break;
    }
    
    return handles;
  };

  return (
    <div
      className={`absolute cursor-pointer select-none group ${
        isSelected ? 'ring-2 ring-primary' : ''
      } ${isConnecting ? 'cursor-crosshair' : ''} ${
        showConnectionPlaceholder ? 'ring-2 ring-green-400 ring-opacity-50' : ''
      }`}
      style={{
        left: block.position.x,
        top: block.position.y,
        transform: 'translate(-50%, -50%)',
      }}
      onClick={handleClick}
      onMouseDown={(e) => e.stopPropagation()}
      data-block-id={block.id}
    >
      <div className={`bg-card border-2 ${blockOutlineColors[block.type.toLowerCase() as keyof typeof blockOutlineColors]} text-foreground shadow-lg relative ${
        block.subtype === 'System Prompt' ? 'w-48 h-32 rounded-full' : 'w-36 h-20 rounded-lg'
      }`}>
        
        {getConnectionHandles()}
        
        {/* Status Badge */}
        {(block.subtype === 'Website' || block.subtype === 'Cloud' || block.subtype === 'Slack' || 
          (block.subtype === 'Calendar' && (block.type === 'CONTEXT' || block.type === 'ACTION'))) && (
          <BlockStatusBadge
            block={block}
            websiteContext={block.subtype === 'Website' ? websiteContexts.find(wc => wc.blockId === block.id) : undefined}
            cloudIntegration={block.subtype === 'Cloud' ? cloudIntegrations.find(ci => ci.blockId === block.id) : undefined}
            slackIntegration={block.subtype === 'Slack' ? slackIntegrations.find(si => si.blockId === block.id) : undefined}
            blocks={blocks}
          />
        )}
        
        {block.subtype !== 'System Prompt' && (
          <button
            onClick={handleDelete}
            className="absolute -top-2 -right-2 w-6 h-6 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 z-30"
          >
            <X size={14} />
          </button>
        )}
        
        <div className="p-3 h-full flex items-center space-x-3">
          <Icon size={18} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {block.subtype === 'System Prompt' ? 'Global Intelligence' : block.title}
            </div>
            <div className="text-xs opacity-80 capitalize">{block.type}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockRenderer;