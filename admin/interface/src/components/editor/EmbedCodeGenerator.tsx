import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { adminApiClient, handleApiResponse } from '@/lib/apiClient';
import { Copy, Check } from 'lucide-react';

interface EmbedCodeGeneratorProps {
  chatbotId: string;
  blockId: string;
}

const EmbedCodeGenerator: React.FC<EmbedCodeGeneratorProps> = ({ chatbotId, blockId }) => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [embedCode, setEmbedCode] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const generateEmbedCode = async () => {
    setLoading(true);
    try {
      const response = await adminApiClient.get(
        `/chatbot/${chatbotId}/bubble/embed-code`,
        token || ''
      );
      const data = await handleApiResponse(response);
      setEmbedCode(data.embedCode);
      toast({
        title: 'Embed code generated',
        description: 'Copy the code below to embed the widget on your website.'
      });
    } catch (error) {
      console.error('Failed to generate embed code:', error);
      toast({
        title: 'Failed to generate embed code',
        variant: 'destructive',
        description: 'Please try again later.'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      toast({
        title: 'Copied to clipboard',
        description: 'Embed code has been copied to your clipboard.'
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: 'Failed to copy',
        variant: 'destructive'
      });
    }
  };
  
  return (
    <div className="space-y-2">
      <Button 
        onClick={generateEmbedCode} 
        disabled={loading}
        className="w-full"
      >
        {loading ? 'Generating...' : 'Generate Embed Code'}
      </Button>
      
      {embedCode && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Embed Code</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={copyToClipboard}
                className="h-8"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <Textarea
              value={embedCode}
              readOnly
              className="font-mono text-xs"
              rows={3}
            />
          </div>
          
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
            <strong>Instructions:</strong>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Copy the embed code above</li>
              <li>Paste it before the closing &lt;/body&gt; tag on your website</li>
              <li>The bubble will appear automatically on your website</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
};

export default EmbedCodeGenerator;
