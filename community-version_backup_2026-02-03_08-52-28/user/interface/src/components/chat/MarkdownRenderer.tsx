import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Mermaid diagram modal with zoom and pan
function MermaidModal({ 
  isOpen, 
  onClose, 
  svgContent 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  svgContent: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Reset zoom and pan when modal opens
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 flex flex-col">
        {/* Controls bar */}
        <div className="flex items-center justify-between p-4 border-b bg-background">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              disabled={scale >= 3}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground ml-2">
              {Math.round(scale * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Move className="h-4 w-4" />
            <span>Click and drag to pan</span>
          </div>
        </div>

        {/* Diagram container with zoom and pan */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative bg-gray-50 dark:bg-gray-950"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <div
            ref={svgRef}
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Mermaid diagram component
function MermaidDiagram({ code, id }: { code: string; id: string }) {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [svgContent, setSvgContent] = React.useState<string>('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  useEffect(() => {
    if (!mermaidRef.current) return;

    const renderMermaid = async () => {
      try {
        setError(null);
        // Initialize mermaid if not already initialized
        mermaid.initialize({ 
          startOnLoad: false,
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
          securityLevel: 'loose',
        });
        
        // Clear previous content
        mermaidRef.current!.innerHTML = '';
        
        // Render the diagram
        const { svg } = await mermaid.render(`mermaid-${id}`, code);
        mermaidRef.current!.innerHTML = svg;
        setSvgContent(svg);
      } catch (err: unknown) {
        console.error('Mermaid rendering error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to render diagram';
        setError(errorMessage);
        if (mermaidRef.current) {
          mermaidRef.current.innerHTML = `<div class="text-red-500 text-sm p-2">Error rendering diagram: ${errorMessage}</div>`;
        }
      }
    };

    renderMermaid();
  }, [code, id]);

  return (
    <>
      <div 
        className="my-4 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => setIsModalOpen(true)}
        title="Click to view full size"
      >
        <div ref={mermaidRef} className="flex justify-center items-center min-h-[100px] bg-white dark:bg-gray-900 rounded-md p-4 overflow-x-auto" />
        {error && (
          <div className="text-red-500 text-xs mt-1">{error}</div>
        )}
      </div>
      <MermaidModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        svgContent={svgContent}
      />
    </>
  );
}

/**
 * Check if a Mermaid code block is complete (has closing ```)
 * This is important during streaming when blocks might be incomplete
 */
function isCompleteMermaidBlock(content: string, codeString: string): boolean {
  // Find all mermaid code blocks in the content
  const mermaidBlockRegex = /```mermaid\n([\s\S]*?)```/g;
  let match;
  const completeBlocks: string[] = [];
  
  // Extract all complete mermaid blocks
  while ((match = mermaidBlockRegex.exec(content)) !== null) {
    completeBlocks.push(match[1].trim());
  }
  
  // Check if the codeString matches any complete block
  const normalizedCodeString = codeString.trim();
  return completeBlocks.some(block => block === normalizedCodeString);
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  // Initialize mermaid on mount
  useEffect(() => {
    mermaid.initialize({ 
      startOnLoad: false,
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
      securityLevel: 'loose',
    });
  }, []);

  // Track mermaid diagram IDs
  const mermaidIdRef = useRef(0);

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headers
          h1: ({ children }) => (
            <h1 className="text-lg font-bold mb-2 mt-4 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h6>
          ),
          
          // Paragraphs
          p: ({ children }) => (
            <p className="mb-2 last:mb-0">{children}</p>
          ),
          
          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-sm">{children}</li>
          ),
          
          // Text formatting
          strong: ({ children }) => (
            <strong className="font-bold">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
          code: ({ node, inline, className, children, ...props }: { node?: unknown; inline?: boolean; className?: string; children?: React.ReactNode; [key: string]: unknown }) => {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            
            // Handle mermaid code blocks - only render if complete
            if (!inline && match && match[1] === 'mermaid') {
              // Check if this is a complete mermaid block before rendering
              // During streaming, incomplete blocks should be shown as regular code
              if (isCompleteMermaidBlock(content, codeString)) {
                const id = `mermaid-${++mermaidIdRef.current}`;
                return <MermaidDiagram key={id} code={codeString} id={id} />;
              } else {
                // Show as regular code block while streaming
                return (
                  <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-x-auto mb-2">
                    <code className="text-xs font-mono" {...props}>
                      {children}
                    </code>
                  </pre>
                );
              }
            }
            
            // Regular inline code
            if (inline) {
              return (
                <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                  {children}
                </code>
              );
            }
            
            // Regular code block
            return (
              <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-x-auto mb-2">
                <code className="text-xs font-mono" {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          
          // Code blocks (fallback)
          pre: ({ children }) => (
            <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-x-auto mb-2">
              {children}
            </pre>
          ),
          
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic mb-2">
              {children}
            </blockquote>
          ),
          
          // Links
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {children}
            </a>
          ),
          
          // Horizontal rule
          hr: () => (
            <hr className="border-gray-300 dark:border-gray-600 my-3" />
          ),
          
          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto mb-2">
              <table className="min-w-full border border-gray-300 dark:border-gray-600">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50 dark:bg-gray-700">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody>{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="border-b border-gray-300 dark:border-gray-600">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 border-r border-gray-300 dark:border-gray-600 last:border-r-0">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100 border-r border-gray-300 dark:border-gray-600 last:border-r-0">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}