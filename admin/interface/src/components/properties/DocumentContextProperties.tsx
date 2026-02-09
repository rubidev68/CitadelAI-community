import React, { useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useBlockEditor } from '@/contexts/BlockEditorContext';
import { Block } from '@/contexts/BlockEditorContext';
import { Upload, FileText, X, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { processDocument } from '@/lib/api';

interface DocumentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  markdown?: string;
  vectors?: Array<{
    id: string;
    content: string;
    chunkIndex: number;
    totalChunks: number;
  }>;
  error?: string;
}

interface DocumentContextPropertiesProps {
  block: Block;
}

const DocumentContextProperties: React.FC<DocumentContextPropertiesProps> = ({ block }) => {
  const { id: chatbotId } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { updateBlock } = useBlockEditor();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize files from block properties
  React.useEffect(() => {
    if (block.properties?.files) {
      setFiles(block.properties.files as DocumentFile[]);
    }
  }, [block.properties?.files]);

  const updateBlockFiles = useCallback((newFiles: DocumentFile[]) => {
    updateBlock(block.id, {
      properties: { ...block.properties, files: newFiles }
    });
  }, [block.id, block.properties, updateBlock]);

  const validateFile = (file: File): boolean => {
    const allowedTypes = ['application/pdf'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Only PDF files are allowed.",
        variant: "destructive",
      });
      return false;
    }

    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "File size must be less than 10MB.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const processFile = async (file: File): Promise<DocumentFile> => {
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const documentFile: DocumentFile = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'uploading'
    };

    try {
      documentFile.status = 'processing';

      const result = await processDocument(file, chatbotId || '', block.id, token || '');
      
      documentFile.markdown = result.markdown;
      documentFile.vectors = result.vectors;
      documentFile.status = 'completed';

      toast({
        title: "Document processed",
        description: `${file.name} has been converted to markdown and vectorized.`,
      });

    } catch (error) {
      console.error('Error processing file:', error);
      documentFile.status = 'error';
      documentFile.error = error instanceof Error ? error.message : 'Unknown error';
      
      toast({
        title: "Processing failed",
        description: `Failed to process ${file.name}: ${documentFile.error}`,
        variant: "destructive",
      });
    }

    return documentFile;
  };

  const handleFileSelect = useCallback(async (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const validFiles = Array.from(selectedFiles).filter(validateFile);
    if (validFiles.length === 0) return;

    setIsProcessing(true);
    const newFiles: DocumentFile[] = [];
    
    for (const file of validFiles) {
      const documentFile = await processFile(file);
      newFiles.push(documentFile);
    }

    const updatedFiles = [...files, ...newFiles];
    setFiles(updatedFiles);
    updateBlockFiles(updatedFiles);
    setIsProcessing(false);
  }, [files, updateBlockFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset input value to allow selecting the same file again
    if (e.target) {
      e.target.value = '';
    }
  };

  const removeFile = (fileId: string) => {
    const updatedFiles = files.filter(file => file.id !== fileId);
    setFiles(updatedFiles);
    updateBlockFiles(updatedFiles);
  };

  const getFileIcon = (file: DocumentFile) => {
    switch (file.status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'completed':
        return <FileText className="w-4 h-4 text-green-500" />;
      case 'error':
        return <X className="w-4 h-4 text-red-500" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusText = (file: DocumentFile) => {
    switch (file.status) {
      case 'uploading':
        return 'Uploading...';
      case 'processing':
        return 'Converting to markdown and vectorizing...';
      case 'completed':
        return 'Ready';
      case 'error':
        return `Error: ${file.error}`;
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (file: DocumentFile) => {
    switch (file.status) {
      case 'uploading':
      case 'processing':
        return 'text-blue-500';
      case 'completed':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Drag and Drop Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isProcessing
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 cursor-not-allowed opacity-75'
            : isDragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
        onDrop={isProcessing ? undefined : handleDrop}
        onDragOver={isProcessing ? undefined : handleDragOver}
        onDragLeave={isProcessing ? undefined : handleDragLeave}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-8 h-8 mx-auto mb-2 text-blue-500 animate-spin" />
            <p className="text-sm text-blue-600 dark:text-blue-400 mb-2 font-medium">
              Processing documents...
            </p>
            <p className="text-xs text-gray-500">
              Please wait while we convert and vectorize your PDF
            </p>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Drag and drop PDF files here, or click to select
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleFileInputClick}
              disabled={isProcessing}
            >
              Choose Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
              disabled={isProcessing}
            />
            <p className="text-xs text-gray-500 mt-2">
              Only PDF files are supported (max 10MB each)
            </p>
          </>
        )}
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <Label>Uploaded Documents</Label>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map((file) => (
              <Card key={file.id} className="p-3">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      {getFileIcon(file)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-500">
                            {formatFileSize(file.size)}
                          </p>
                          <span className="text-xs">•</span>
                          <p className={`text-xs ${getStatusColor(file)}`}>
                            {getStatusText(file)}
                          </p>
                        </div>
                        {file.status === 'processing' && (
                          <div className="mt-1">
                            <div className="w-full bg-gray-200 rounded-full h-1">
                              <div className="bg-blue-500 h-1 rounded-full animate-pulse" style={{ width: '60%' }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      disabled={file.status === 'processing' || file.status === 'uploading'}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Processing Status Summary */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">
              {files.filter(f => f.status === 'completed').length} of {files.length} documents processed
            </span>
            {isProcessing && (
              <span className="text-blue-500 font-medium">
                Processing in progress...
              </span>
            )}
          </div>
          {isProcessing && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out" 
                style={{ 
                  width: `${files.length > 0 ? (files.filter(f => f.status === 'completed').length / files.length) * 100 : 0}%` 
                }} 
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentContextProperties;