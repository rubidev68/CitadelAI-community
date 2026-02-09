import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BlockProps } from './BlockRenderer';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { crawlWebsite } from '@/lib/api';

const WebsiteContextBlock = ({ block, updateBlockPayload }: BlockProps) => {
  const { id: chatbotId } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [crawlingStatus, setCrawlingStatus] = useState<'idle' | 'crawling' | 'crawled' | 'error'>('idle');

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (updateBlockPayload) {
      updateBlockPayload(block.id, { url: e.target.value });
    }
  };

  const handleCrawl = async () => {
    if (!chatbotId || !token || !block.payload?.url) return;

    setCrawlingStatus('crawling');
    try {
      await crawlWebsite(block.payload.url, chatbotId, token);
      setCrawlingStatus('crawled');
    } catch (error) {
      console.error('Failed to crawl website:', error);
      setCrawlingStatus('error');
    }
  };

  return (
    <div className="bg-card border border-border p-4 rounded-lg">
      <div className="flex items-center space-x-2 mb-4">
        <Globe className="w-6 h-6 text-blue-500" />
        <h3 className="text-lg font-semibold">Website Context</h3>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`url-${block.id}`}>Website URL</Label>
        <Input
          id={`url-${block.id}`}
          type="url"
          placeholder="https://example.com"
          value={block.payload?.url || ''}
          onChange={handleUrlChange}
        />
        <Button onClick={handleCrawl} disabled={crawlingStatus === 'crawling'}>
          {crawlingStatus === 'crawling' ? 'Crawling...' : 'Crawl'}
        </Button>
        {crawlingStatus === 'crawled' && <p className="text-green-500">Crawled successfully!</p>}
        {crawlingStatus === 'error' && <p className="text-red-500">Crawling failed.</p>}
      </div>
    </div>
  );
};

export default WebsiteContextBlock;
