import React from 'react';
import { Globe, FileText, Code, Layout, Circle, Database, Cloud, Calendar } from 'lucide-react';
import { useBlockEditor } from '@/contexts/BlockEditorContext';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { useSubscription } from '@/contexts/SubscriptionContext';

const blockOutlineColors = {
  context: 'border-blue-500',
  logic: 'border-yellow-500',
  action: 'border-purple-500',
  frontend: 'border-pink-500',
  test: 'border-green-500',
  enterprise: 'border-orange-500',
  analytics: 'border-indigo-500'
};

const getBlockCategories = (features: any) => {
  return [
    {
      name: 'Context',
      blocks: [
        {
          type: 'context' as const,
          subtype: 'Website',
          title: 'Website',
          description: 'Fetch web content',
          icon: Globe,
          color: 'from-blue-500 to-blue-600'
        },
        {
          type: 'context' as const,
          subtype: 'Document',
          title: 'Document',
          description: 'Process documents',
          icon: FileText,
          color: 'from-blue-500 to-blue-600'
        },
        {
            type: 'context' as const,
            subtype: 'Cloud',
            title: 'Cloud Storage',
            description: 'Nextcloud Integration',
            icon: Cloud,
            color: 'from-blue-500 to-blue-600'
        },
        {
            type: 'context' as const,
            subtype: 'Calendar',
            title: 'Calendar',
            description: 'Read calendar events',
            icon: Calendar,
            color: 'from-blue-500 to-blue-600'
        },
        {
          type: 'context' as const,
          subtype: 'Database',
          title: 'Database',
          description: 'Connect to database',
          icon: Database,
          color: 'from-blue-500 to-blue-600'
        }
      ]
    },
    {
      name: 'Frontend',
      blocks: [
        {
          type: 'frontend' as const,
          subtype: 'Interface',
          title: 'Interface',
          description: 'UI components',
          icon: Layout,
          color: 'from-pink-500 to-pink-600'
        },
        {
          type: 'frontend' as const,
          subtype: 'Bubble',
          title: 'Bubble',
          description: 'On the corner of your website',
          icon: Circle,
          color: 'from-pink-500 to-pink-600'
        },
        {
          type: 'frontend' as const,
          subtype: 'API',
          title: 'API',
          description: 'API endpoints',
          icon: Code,
          color: 'from-pink-500 to-pink-600'
        }
      ]
    },
    {
      name: 'Test',
      blocks: [
        {
          type: 'test' as const,
          subtype: 'TestLLM',
          title: 'TestLLM',
          description: 'Test answers quality',
          icon: Code,
          color: 'from-green-500 to-green-600'
        }
      ]
    }
  ];
};

const BlockPalette = () => {
  const { blocks } = useBlockEditor();
  const { features } = useFeatureFlags();
  const blockCategories = getBlockCategories(features);

  const handleDragStart = (e: React.DragEvent, type: string, subtype: string) => {
    e.dataTransfer.setData('blockData', JSON.stringify({ type, subtype }));
  };

  const isBlockDisabled = (type: string, subtype: string) => {
    if (type.toLowerCase() === 'frontend') {
      return blocks.some(b => b.type.toLowerCase() === 'frontend' && b.subtype === subtype);
    }
    if (type.toLowerCase() === 'test' && subtype === 'TestLLM') {
      return blocks.some(b => b.type.toLowerCase() === 'test' && b.subtype === 'TestLLM');
    }
    return false;
  };

  return (
    <div className="flex flex-col h-full w-full bg-card border-r border-border animate-slide-in-left">
      <div className="flex-shrink-0 p-4 pb-2">
        <h3 className="text-lg font-semibold text-foreground mb-4">Block Library</h3>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        <div className="space-y-6">
          {blockCategories.map((category, categoryIndex) => (
            <div key={category.name} className="animate-fade-in" style={{ animationDelay: `${categoryIndex * 100}ms` }}>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                {category.name}
              </h4>
              <div className="space-y-2">
                {category.blocks.map((block, blockIndex) => {
                  const Icon = block.icon;
                  const isDisabled = isBlockDisabled(block.type, block.subtype);
                  const showBetaBadge = 'isBeta' in block && block.isBeta === true && !isDisabled;
                  const categoryColor = blockOutlineColors[block.type.toLowerCase() as keyof typeof blockOutlineColors];
                  
                  return (
                    <div
                      key={`${block.type}-${block.subtype}`}
                      draggable={!isDisabled}
                      onDragStart={(e) => !isDisabled && handleDragStart(e, block.type, block.subtype)}
                      className={`p-3 rounded-lg relative ${
                        isDisabled
                          ? 'bg-muted cursor-not-allowed opacity-50'
                          : `bg-card border-2 ${categoryColor} text-foreground hover:scale-105 transition-all duration-300 shadow-sm hover:shadow-md animate-slide-up hover:-translate-y-1 group cursor-move`
                      }`}
                      style={{ 
                        animationDelay: `${(categoryIndex * 100) + (blockIndex * 50)}ms`
                      }}
                    >
                      {showBetaBadge && (
                        <div className="absolute top-1 right-1 text-xs font-semibold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded border border-purple-300">
                          Beta
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <Icon size={16} className={`transition-transform duration-300 ${!isDisabled ? 'group-hover:scale-110 group-hover:rotate-12' : ''}`} />
                        <div>
                          <div className="font-medium text-sm">{block.title}</div>
                          <div className="text-xs opacity-90">{block.description}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex-shrink-0 p-4 pt-2 text-xs text-muted-foreground animate-fade-in animation-delay-1000">
        <p>Drag blocks onto the canvas to build your workflow.</p>
      </div>
    </div>
  );
};

export default BlockPalette;
