import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink, Loader2, AlertCircle, Search } from 'lucide-react';
import { getCrawledPages } from '@/lib/api';

interface CrawledPage {
  url: string;
  title?: string;
  content?: string;
}

interface CrawledPagesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatbotId: string;
  blockId: string;
  token: string;
}

const CrawledPagesModal: React.FC<CrawledPagesModalProps> = ({
  open,
  onOpenChange,
  chatbotId,
  blockId,
  token,
}) => {
  const [pages, setPages] = useState<CrawledPage[]>([]);
  const [filteredPages, setFilteredPages] = useState<CrawledPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open && chatbotId && blockId && token) {
      fetchCrawledPages();
    }
  }, [open, chatbotId, blockId, token]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredPages(pages);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredPages(
        pages.filter(
          (page) =>
            page.url.toLowerCase().includes(query) ||
            page.title?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, pages]);


  const fetchCrawledPages = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCrawledPages(chatbotId, blockId, token);
      setPages(data || []);
      setFilteredPages(data || []);
    } catch (err) {
      console.error('Error fetching crawled pages:', err);
      setError('Failed to load crawled pages');
    } finally {
      setLoading(false);
    }
  };

  

  const renderListView = () => {
    if (filteredPages.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{searchQuery ? 'No pages match your search' : 'No crawled pages found'}</p>
        </div>
      );
    }

    return (
      <ScrollArea className="h-[500px]">
        <div className="space-y-2 pr-4">
          {filteredPages.map((page, index) => (
            <div
              key={index}
              className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                      #{pages.indexOf(page) + 1}
                    </span>
                    {page.title && (
                      <h4 className="font-medium text-sm truncate">{page.title}</h4>
                    )}
                  </div>
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1 break-all"
                  >
                    {page.url}
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  };

  // Graph view removed per request; only list view remains

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Crawled Pages</DialogTitle>
          <DialogDescription>
            View all pages that have been crawled for this website context
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
            <Button onClick={fetchCrawledPages} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search pages by URL or title..."
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
                    Showing {filteredPages.length} of {pages.length} page{pages.length !== 1 ? 's' : ''}
                  </>
                ) : (
                  <>
                    Total: {pages.length} page{pages.length !== 1 ? 's' : ''}
                  </>
                )}
              </div>
              <Button onClick={fetchCrawledPages} variant="outline" size="sm">
                Refresh
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CrawledPagesModal;
