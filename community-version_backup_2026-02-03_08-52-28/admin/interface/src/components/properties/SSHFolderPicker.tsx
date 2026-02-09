import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Folder, ChevronRight, ChevronDown, CheckCircle2, X } from 'lucide-react';
import { listCloudFolders } from '@/lib/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface SSHFolderPickerProps {
  blockId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (selectedPaths: string[]) => void;
  token: string;
  initialSelectedPaths?: string[];
}

interface FolderNode {
  path: string;
  name: string;
  expanded: boolean;
  loading: boolean;
  children: FolderNode[];
  loaded: boolean;
}

const SSHFolderPicker: React.FC<SSHFolderPickerProps> = ({
  blockId,
  open,
  onOpenChange,
  onSelect,
  token,
  initialSelectedPaths = [],
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rootFolders, setRootFolders] = useState<FolderNode[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  // Load root folders when modal opens
  useEffect(() => {
    if (open && blockId && token) {
      loadRootFolders();
    } else {
      // Reset when modal closes
      setRootFolders([]);
      setSelectedPaths(new Set());
      setError(null);
    }
  }, [open, blockId, token]);

  // Initialize selected paths from props
  useEffect(() => {
    if (open && initialSelectedPaths.length > 0) {
      setSelectedPaths(new Set(initialSelectedPaths));
    }
  }, [open, initialSelectedPaths]);

  const loadRootFolders = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listCloudFolders(blockId, '', token);
      const folders: FolderNode[] = response.folders.map(f => ({
        path: f.path,
        name: f.name,
        expanded: false,
        loading: false,
        children: [],
        loaded: false,
      }));
      setRootFolders(folders);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load folders';
      setError(errorMessage);
      console.error('Error loading root folders:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFolderChildren = async (folderPath: string, parentNode: FolderNode) => {
    // Mark as loading
    parentNode.loading = true;
    setRootFolders([...rootFolders]);

    try {
      const response = await listCloudFolders(blockId, folderPath, token);
      const children: FolderNode[] = response.folders.map(f => ({
        path: f.path,
        name: f.name,
        expanded: false,
        loading: false,
        children: [],
        loaded: false,
      }));
      parentNode.children = children;
      parentNode.loaded = true;
      parentNode.loading = false;
      setRootFolders([...rootFolders]);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load folder';
      setError(errorMessage);
      parentNode.loading = false;
      setRootFolders([...rootFolders]);
      console.error('Error loading folder children:', err);
    }
  };

  const toggleFolder = (node: FolderNode) => {
    if (!node.loaded && !node.loading) {
      // Load children if not already loaded
      loadFolderChildren(node.path, node);
    }
    node.expanded = !node.expanded;
    setRootFolders([...rootFolders]);
  };

  const toggleSelection = (path: string) => {
    const newSelected = new Set(selectedPaths);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedPaths(newSelected);
  };

  const handleConfirm = () => {
    onSelect(Array.from(selectedPaths));
    onOpenChange(false);
  };

  const renderFolderNode = (node: FolderNode, level: number = 0): React.ReactNode => {
    const isSelected = selectedPaths.has(node.path);
    const hasChildren = node.children.length > 0 || !node.loaded;

    return (
      <div key={node.path}>
        <div
          className={cn(
            'flex items-center gap-2 py-1.5 px-2 rounded hover:bg-accent cursor-pointer',
            isSelected && 'bg-accent'
          )}
          style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
        >
          <button
            onClick={() => toggleFolder(node)}
            className="flex items-center justify-center w-5 h-5"
            disabled={!hasChildren}
          >
            {hasChildren ? (
              node.loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : node.expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )
            ) : (
              <div className="w-4 h-4" />
            )}
          </button>
          <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span
            className="flex-1 text-sm truncate"
            onClick={() => toggleSelection(node.path)}
          >
            {node.name}
          </span>
          {isSelected && (
            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          )}
        </div>
        {node.expanded && node.children.map(child => renderFolderNode(child, level + 1))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select SSH Folders to Index</DialogTitle>
          <DialogDescription>
            Choose the folders you want to index from your SSH server. You can select multiple folders.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex-1 overflow-y-auto border rounded-md p-2 min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading folders...</span>
            </div>
          ) : rootFolders.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>No folders found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {rootFolders.map(node => renderFolderNode(node))}
            </div>
          )}
        </div>

        {selectedPaths.size > 0 && (
          <div className="flex flex-wrap gap-2 p-2 bg-muted rounded-md">
            <span className="text-sm font-medium">Selected:</span>
            {Array.from(selectedPaths).map(path => (
              <Badge key={path} variant="secondary" className="flex items-center gap-1">
                {path}
                <button
                  onClick={() => toggleSelection(path)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedPaths.size === 0}>
            Confirm Selection ({selectedPaths.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SSHFolderPicker;
