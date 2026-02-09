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

interface NextcloudFolderPickerProps {
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

const NextcloudFolderPicker: React.FC<NextcloudFolderPickerProps> = ({
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
      
      // Update the folder node
      parentNode.children = children;
      parentNode.loaded = true;
      parentNode.loading = false;
      setRootFolders([...rootFolders]);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load subfolders';
      setError(errorMessage);
      parentNode.loading = false;
      setRootFolders([...rootFolders]);
      console.error('Error loading folder children:', err);
    }
  };

  const toggleFolder = (folder: FolderNode) => {
    if (!folder.expanded) {
      // Expanding - load children if not already loaded
      folder.expanded = true;
      if (!folder.loaded) {
        loadFolderChildren(folder.path, folder);
      } else {
        setRootFolders([...rootFolders]);
      }
    } else {
      // Collapsing
      folder.expanded = false;
      setRootFolders([...rootFolders]);
    }
  };

  const handleFolderSelect = (path: string) => {
    setSelectedPaths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        // If selecting root, clear all other selections
        if (path === '') {
          return new Set(['']);
        }
        // If selecting a folder, remove root if it was selected
        newSet.delete('');
        newSet.add(path);
      }
      return newSet;
    });
  };

  const removeSelectedPath = (path: string) => {
    setSelectedPaths(prev => {
      const newSet = new Set(prev);
      newSet.delete(path);
      return newSet;
    });
  };

  const handleConfirm = () => {
    const pathsArray = Array.from(selectedPaths);
    // Return paths as-is (empty array if nothing selected)
    // Don't default to root - let user explicitly select
    onSelect(pathsArray);
    onOpenChange(false);
  };

  const renderFolder = (folder: FolderNode, depth: number = 0): React.ReactNode => {
    const isSelected = selectedPaths.has(folder.path);
    const hasChildren = folder.children.length > 0 || !folder.loaded;

    return (
      <div key={folder.path} className="select-none">
        <div
          className={cn(
            "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer hover:bg-muted transition-colors",
            isSelected && "bg-primary/10 hover:bg-primary/20",
            depth > 0 && "ml-4"
          )}
          style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
          onClick={() => handleFolderSelect(folder.path)}
        >
          {/* Expand/Collapse Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFolder(folder);
            }}
            className={cn(
              "flex items-center justify-center w-5 h-5 rounded hover:bg-background transition-colors",
              !hasChildren && "invisible"
            )}
            disabled={folder.loading}
          >
            {folder.loading ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : folder.expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {/* Folder Icon */}
          <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />

          {/* Folder Name */}
          <span className={cn(
            "flex-1 text-sm truncate",
            isSelected && "font-medium text-primary"
          )}>
            {folder.name}
          </span>

          {/* Selection Indicator */}
          {isSelected && (
            <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
          )}
        </div>

        {/* Children */}
        {folder.expanded && folder.children.length > 0 && (
          <div className="mt-1">
            {folder.children.map(child => renderFolder(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const getSelectedPathsArray = () => {
    return Array.from(selectedPaths);
  };

  const getPathDisplayName = (path: string) => {
    if (!path) {
      return 'Root (Index All)';
    }
    const parts = path.split('/').filter(p => p);
    return parts.length > 0 ? parts[parts.length - 1] : 'Root';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Select Folders to Index
          </DialogTitle>
          <DialogDescription>
            Click on folders to expand and explore. Click on a folder name to select/deselect it. You can select multiple folders.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex-1 overflow-y-auto border rounded-md p-2 min-h-[300px]">
          {loading && rootFolders.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading folders...</span>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Root option */}
              <div
                className={cn(
                  "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer hover:bg-muted transition-colors",
                  selectedPaths.has('') && "bg-primary/10 hover:bg-primary/20"
                )}
                onClick={() => handleFolderSelect('')}
              >
                <div className="w-5" /> {/* Spacer for alignment */}
                <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className={cn(
                  "flex-1 text-sm",
                  selectedPaths.has('') && "font-medium text-primary"
                )}>
                  Root (Index All)
                </span>
                {selectedPaths.has('') && (
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                )}
              </div>

              {/* Folder tree */}
              {rootFolders.map(folder => renderFolder(folder, 0))}
            </div>
          )}
        </div>

        {/* Selected paths display */}
        <div className="pt-4 border-t space-y-2">
          <div className="text-sm font-medium">
            Selected Folders ({selectedPaths.size}):
          </div>
          {selectedPaths.size === 0 ? (
            <div className="text-sm text-muted-foreground italic">No folders selected</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {getSelectedPathsArray().map(path => (
                <Badge
                  key={path}
                  variant="secondary"
                  className="flex items-center gap-1 pr-1"
                >
                  <Folder className="h-3 w-3" />
                  <span className="max-w-[200px] truncate">{getPathDisplayName(path)}</span>
                  <button
                    onClick={() => removeSelectedPath(path)}
                    className="ml-1 hover:bg-destructive/20 rounded-full p-0.5 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            Confirm Selection ({selectedPaths.size || 1})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NextcloudFolderPicker;
