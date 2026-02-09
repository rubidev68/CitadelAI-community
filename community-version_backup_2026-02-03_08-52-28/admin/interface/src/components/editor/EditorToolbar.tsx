import React from 'react';
import { useBlockEditor } from '@/contexts/BlockEditorContext';
import { Cloud, CloudCog, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

const EditorToolbar = ({ syncStatus }: { syncStatus: SyncStatus }) => {
  const { 
    blocks, 
    connections,
  } = useBlockEditor();
  
  return (
    <div className="bg-card border-b border-border p-3 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <span className="text-sm text-muted-foreground">
          {blocks.length} blocks, {connections.length} connections
        </span>
      </div>
      
      <div className="flex items-center space-x-2">
        <SyncStatusIndicator status={syncStatus} />
      </div>
    </div>
  );
};

export default EditorToolbar;
