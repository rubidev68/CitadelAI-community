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
import { listCloudFiles, listSharedFolders } from '@/lib/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface SelectedItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
}

interface GoogleDrivePickerProps {
  blockId: string;
  selectedItems: SelectedItem[];
  onSelectionChange: (items: SelectedItem[]) => void;
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FolderNode {
  id: string;
  name: string;
  expanded: boolean;
  loading: boolean;
  children: FolderNode[];
  loaded: boolean;
}

const GoogleDrivePicker: React.FC<GoogleDrivePickerProps> = ({
  blockId,
  selectedItems,
  onSelectionChange,
  token,
  open,
  onOpenChange,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rootFolders, setRootFolders] = useState<FolderNode[]>([]);
  const [internalSelectedItems, setInternalSelectedItems] = useState<SelectedItem[]>([]);

  // Initialize internal selections from props when modal opens
  useEffect(() => {
    if (open) {
      setInternalSelectedItems(selectedItems);
    } else {
      // Reset when modal closes
      setRootFolders([]);
      setInternalSelectedItems([]);
      setError(null);
    }
  }, [open, selectedItems]);

  // Load root folders and first 3 levels when modal opens
  useEffect(() => {
    if (open && blockId && token) {
      loadInitialFolders();
    }
  }, [open, blockId, token]);

  const loadInitialFolders = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load "My Drive" root folder
      const rootResponse = await listCloudFiles(blockId, 'root', undefined, token);
      
      // Build "My Drive" root folder node with lazy loading
      const myDriveFolder: FolderNode = {
        id: 'root',
        name: 'My Drive',
        expanded: true, // Auto-expand root
        loading: false,
        children: rootResponse.folders.slice(0, 50).map(f => ({
          id: f.id,
          name: f.name,
          expanded: false,
          loading: false,
          children: [],
          loaded: false, // Children not loaded yet - will load on expand
        })),
        loaded: true, // Root level loaded
      };

      // Load shared folders
      let sharedFoldersNode: FolderNode | null = null;
      try {
        const sharedResponse = await listSharedFolders(blockId, token);
        if (sharedResponse.folders.length > 0) {
          sharedFoldersNode = {
            id: 'shared',
            name: 'Shared with me',
            expanded: false,
            loading: false,
            children: sharedResponse.folders.slice(0, 50).map(f => ({
              id: f.id,
              name: f.name,
              expanded: false,
              loading: false,
              children: [],
              loaded: false,
            })),
            loaded: true,
          };
        }
      } catch (sharedErr) {
        // If shared folders fail to load, just log and continue with My Drive
        console.warn('Failed to load shared folders:', sharedErr);
      }

      // Set root folders - include both My Drive and Shared with me if available
      const rootFoldersList = sharedFoldersNode 
        ? [myDriveFolder, sharedFoldersNode]
        : [myDriveFolder];
      setRootFolders(rootFoldersList);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load folders';
      setError(errorMessage);
      console.error('Error loading initial folders:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFolderChildren = async (folderId: string, parentNode: FolderNode) => {
    // Don't try to load children for the "Shared with me" container node
    if (folderId === 'shared') {
      return;
    }
    
    // Mark as loading
    parentNode.loading = true;
    setRootFolders([...rootFolders]);

    try {
      const response = await listCloudFiles(blockId, folderId, undefined, token);
      const children: FolderNode[] = response.folders.map(f => ({
        id: f.id,
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
        loadFolderChildren(folder.id, folder);
      } else {
        setRootFolders([...rootFolders]);
      }
    } else {
      // Collapsing
      folder.expanded = false;
      setRootFolders([...rootFolders]);
    }
  };

  // Recursively get all descendant folder IDs from a folder node
  const getAllDescendantIds = (folder: FolderNode): string[] => {
    const ids: string[] = [];
    const collectIds = (node: FolderNode) => {
      node.children.forEach(child => {
        ids.push(child.id);
        collectIds(child);
      });
    };
    collectIds(folder);
    return ids;
  };

  const handleFolderSelect = (folder: FolderNode) => {
    setInternalSelectedItems(prev => {
      const newItems = [...prev];
      const isSelected = newItems.some(item => item.id === folder.id);
      
      if (isSelected) {
        // Deselecting: remove this folder and all its descendants
        const descendantIds = getAllDescendantIds(folder);
        return newItems.filter(item => item.id !== folder.id && !descendantIds.includes(item.id));
      } else {
        // Selecting: add this folder and all its loaded descendants
        const newItem: SelectedItem = { id: folder.id, name: folder.name, type: 'folder' };
        const descendantIds = getAllDescendantIds(folder);
        const descendantItems: SelectedItem[] = descendantIds.map(id => {
          // Find the folder node to get its name
          const findFolder = (node: FolderNode): FolderNode | null => {
            if (node.id === id) return node;
            for (const child of node.children) {
              const found = findFolder(child);
              if (found) return found;
            }
            return null;
          };
          
          for (const root of rootFolders) {
            const found = findFolder(root);
            if (found) {
              return { id: found.id, name: found.name, type: 'folder' as const };
            }
          }
          return null;
        }).filter((item): item is SelectedItem => item !== null);
        
        // Remove any existing items that are descendants
        const filtered = newItems.filter(item => !descendantIds.includes(item.id));
        return [...filtered, newItem, ...descendantItems];
      }
    });
  };

  const removeSelectedItem = (id: string) => {
    setInternalSelectedItems(prev => prev.filter(item => item.id !== id));
  };

  const handleConfirm = () => {
    onSelectionChange(internalSelectedItems);
    onOpenChange(false);
  };

  const renderFolder = (folder: FolderNode, depth: number = 0): React.ReactNode => {
    const isSelected = internalSelectedItems.some(item => item.id === folder.id);
    const hasChildren = folder.children.length > 0 || !folder.loaded;

    return (
      <div key={folder.id} className="select-none">
        <div
          className={cn(
            "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer hover:bg-muted transition-colors",
            isSelected && "bg-primary/10 hover:bg-primary/20",
            depth > 0 && "ml-4"
          )}
          style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
          onClick={() => handleFolderSelect(folder)}
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

  const getSelectedItemsArray = () => {
    return internalSelectedItems;
  };

  const getItemDisplayName = (item: SelectedItem) => {
    return item.name;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Select Folders and Files to Index
          </DialogTitle>
          <DialogDescription>
            Click on folders to expand and explore. Click on a folder name to select/deselect it and all its contents. You can select multiple folders.
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
              {/* Folder tree */}
              {rootFolders.map(folder => renderFolder(folder, 0))}
            </div>
          )}
        </div>

        {/* Selected items display */}
        <div className="pt-4 border-t space-y-2">
          <div className="text-sm font-medium">
            Selected Items ({internalSelectedItems.length}):
          </div>
          {internalSelectedItems.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">No items selected</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {getSelectedItemsArray().map(item => (
                <Badge
                  key={item.id}
                  variant="secondary"
                  className="flex items-center gap-1 pr-1"
                >
                  {item.type === 'folder' ? (
                    <Folder className="h-3 w-3" />
                  ) : (
                    <Folder className="h-3 w-3" />
                  )}
                  <span className="max-w-[200px] truncate">{getItemDisplayName(item)}</span>
                  <button
                    onClick={() => removeSelectedItem(item.id)}
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
            Confirm Selection ({internalSelectedItems.length || 0})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GoogleDrivePicker;
