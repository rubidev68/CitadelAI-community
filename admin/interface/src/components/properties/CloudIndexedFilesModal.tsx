import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { File, Loader2, AlertCircle, Search, Folder } from 'lucide-react';
import { getCloudIndexedFiles } from '@/lib/api';

interface IndexedCloudFile {
  fileName: string;
  filePath: string;
  fileType: string;
  mimeType?: string;
  fileSize?: number;
  modifiedAt?: string;
}

interface CloudIndexedFilesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatbotId: string;
  blockId: string;
  token: string;
}

const CloudIndexedFilesModal: React.FC<CloudIndexedFilesModalProps> = ({
  open,
  onOpenChange,
  chatbotId,
  blockId,
  token,
}) => {
  const [files, setFiles] = useState<IndexedCloudFile[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<IndexedCloudFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open && chatbotId && blockId && token) {
      fetchIndexedFiles();
    }
  }, [open, chatbotId, blockId, token]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredFiles(files);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredFiles(
        files.filter(
          (file) =>
            file.fileName.toLowerCase().includes(query) ||
            file.filePath.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, files]);


  const fetchIndexedFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCloudIndexedFiles(chatbotId, blockId, token);
      setFiles(data || []);
      setFilteredFiles(data || []);
    } catch (err) {
      console.error('Error fetching indexed files:', err);
      setError('Failed to load indexed files');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (bytes === undefined) return '';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderListView = () => {
    if (filteredFiles.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{searchQuery ? 'No files match your search' : 'No indexed files found'}</p>
        </div>
      );
    }

    return (
      <ScrollArea className="h-[500px]">
        <div className="space-y-2 pr-4">
          {filteredFiles.map((file, index) => (
            <div
              key={index}
              className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                      #{index + 1}
                    </span>
                    <div className="flex items-center gap-2">
                        {file.fileType === 'folder' ? <Folder className="w-4 h-4 text-blue-500" /> : <File className="w-4 h-4 text-gray-500" />}
                        <h4 className="font-medium text-sm truncate">{file.fileName}</h4>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground break-all">
                    {file.filePath}
                  </div>
                   <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      {file.fileSize !== undefined && <span>{formatFileSize(file.fileSize)}</span>}
                      {file.modifiedAt && <span>{new Date(file.modifiedAt).toLocaleDateString()}</span>}
                   </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Indexed Files</DialogTitle>
          <DialogDescription>
            View all files that have been indexed from your cloud storage
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <p className="text-destructive">{error}</p>
            <Button onClick={fetchIndexedFiles} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search files by name or path..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="mt-4">{renderListView()}</div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {searchQuery ? (
                  <>
                    Showing {filteredFiles.length} of {files.length} file{files.length !== 1 ? 's' : ''}
                  </>
                ) : (
                  <>
                    Total: {files.length} file{files.length !== 1 ? 's' : ''}
                  </>
                )}
              </div>
              <Button onClick={fetchIndexedFiles} variant="outline" size="sm">
                Refresh
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CloudIndexedFilesModal;
