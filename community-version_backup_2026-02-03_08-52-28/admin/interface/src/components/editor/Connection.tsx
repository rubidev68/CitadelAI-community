import React from 'react';
import { X } from 'lucide-react';
import { Connection, useBlockEditor, Block } from '@/contexts/BlockEditorContext';

interface ConnectionRendererProps {
  connection: Connection;
}

const ConnectionRenderer: React.FC<ConnectionRendererProps> = ({ connection }) => {
  const { blocks, deleteConnection } = useBlockEditor();
  
  const fromBlock = blocks.find(b => b.id === connection.fromBlockId);
  const toBlock = blocks.find(b => b.id === connection.toBlockId);
  
  if (!fromBlock || !toBlock) return null;
  
  const getConnectionPoint = (block: Block, direction: string) => {
    const baseX = block.position.x;
    const baseY = block.position.y;
    
    // Block dimensions match BlockRenderer.tsx
    // System Prompt: w-48 h-32 = 192px × 128px
    // Regular blocks: w-36 h-20 = 144px × 80px
    const isSystemPrompt = block.subtype === 'System Prompt';
    const blockWidth = isSystemPrompt ? 192 : 144;
    const blockHeight = isSystemPrompt ? 128 : 80;
    
    // Calculate connection points from center (blocks use translate(-50%, -50%))
    const halfWidth = blockWidth / 2;
    const halfHeight = blockHeight / 2;
    
    switch (direction.toLowerCase()) {
      case 'right':
        return { x: baseX + halfWidth, y: baseY };
      case 'left':
        return { x: baseX - halfWidth, y: baseY };
      case 'bottom':
        return { x: baseX, y: baseY + halfHeight };
      case 'top':
        return { x: baseX, y: baseY - halfHeight };
      default:
        return { x: baseX, y: baseY };
    }
  };
  
  const startPoint = getConnectionPoint(fromBlock, connection.fromDirection);
  const endPoint = getConnectionPoint(toBlock, connection.toDirection);
  
  const controlOffset = 50;
  let controlPoint1, controlPoint2;
  
  if (connection.fromDirection.toLowerCase() === 'right' && connection.toDirection.toLowerCase() === 'left') {
    const midX = (startPoint.x + endPoint.x) / 2;
    controlPoint1 = { x: midX, y: startPoint.y };
    controlPoint2 = { x: midX, y: endPoint.y };
  } else if (connection.fromDirection.toLowerCase() === 'bottom' && connection.toDirection.toLowerCase() === 'top') {
    const midY = (startPoint.y + endPoint.y) / 2;
    controlPoint1 = { x: startPoint.x, y: midY };
    controlPoint2 = { x: endPoint.x, y: midY };
  } else {
    controlPoint1 = { x: startPoint.x + controlOffset, y: startPoint.y };
    controlPoint2 = { x: endPoint.x - controlOffset, y: endPoint.y };
  }
  
  const path = `M ${startPoint.x} ${startPoint.y} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${endPoint.x} ${endPoint.y}`;
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConnection(connection.id);
  };
  
  const midX = (startPoint.x + endPoint.x) / 2;
  const midY = (startPoint.y + endPoint.y) / 2;
  
  return (
    <g className="group pointer-events-auto">
      <path
        d={path}
        stroke="hsl(var(--muted-foreground))"
        strokeWidth={2}
        fill="none"
        className="hover:stroke-primary transition-all duration-200 cursor-pointer"
      />
      
      <foreignObject
        x={midX - 10}
        y={midY - 10}
        width={20}
        height={20}
        className="overflow-visible"
      >
        <button
          onClick={handleDelete}
          className="w-full h-full bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X size={12} className="text-destructive-foreground" />
        </button>
      </foreignObject>
    </g>
  );
};

export default ConnectionRenderer;