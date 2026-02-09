import React from 'react';
import { Block, useBlockEditor } from '@/contexts/BlockEditorContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash2, X } from 'lucide-react';
import WebsiteContextProperties from '../properties/WebsiteContextProperties';
import DocumentContextProperties from '../properties/DocumentContextProperties';
import ApiBlockProperties from '../properties/ApiBlockProperties';
import SlackBlockProperties from '../properties/SlackBlockProperties';
import DbBlockProperties from '../properties/DbBlockProperties';
import CloudBlockProperties from '../properties/CloudBlockProperties';
import CalendarBlockProperties from '../properties/CalendarBlockProperties';
import QuestionSuggestionsConfig from './QuestionSuggestionsConfig';
import SystemPromptCustomization from './SystemPromptCustomization';
import EmbedCodeGenerator from './EmbedCodeGenerator';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { listTestDatasets, createTestDataset, updateTestDataset, deleteTestDataset, TestDataset, importTestDatasetCsv, downloadTestDatasetCsv, downloadTestRunCsv } from '@/lib/api';
import { adminApiClient, handleApiResponse } from '@/lib/apiClient';

import { ColorPicker } from '@/components/ui/color-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BlockPropertiesProps {
  block: Block;
}
const BlockProperties: React.FC<BlockPropertiesProps> = ({ block }) => {
  const { updateBlock, deleteBlock, selectBlock } = useBlockEditor();

  const updateProperty = (key: string, value: string) => {
    updateBlock(block.id, {
      properties: { ...block.properties, [key]: value }
    });
  };

  const updateTitle = (value: string) => {
    // Prevent renaming the core System Prompt block
    if (block.subtype === 'System Prompt') return;
    updateBlock(block.id, { title: value });
  };

  const renderTypeSpecificProperties = () => {
    switch (block.type.toLowerCase()) {
      case 'context':
        return (
          <>
            {block.subtype === 'Website' && (
              <WebsiteContextProperties block={block} />
            )}
            {block.subtype === 'Document' && (
              <DocumentContextProperties block={block} />
            )}
            {block.subtype === 'Database' && (
              <DbBlockProperties block={block} />
            )}
            {block.subtype === 'Cloud' && (
              <CloudBlockProperties block={block} />
            )}
            {block.subtype === 'Calendar' && (
              <CalendarBlockProperties block={block} />
            )}
          </>
        );
      case 'logic':
        return (
          <>
            {block.subtype === 'System Prompt' && (
              <SystemPromptCustomization block={block} />
            )}
            {block.subtype === 'If' && (
              <div className="space-y-2">
                <Label htmlFor="condition">Condition</Label>
                <Textarea
                  id="condition"
                  value={String(block.properties.condition || '')}
                  onChange={(e) => updateProperty('condition', e.target.value)}
                  placeholder="Enter condition logic..."
                  rows={3}
                />
              </div>
            )}
          </>
        );
        case 'action':
        return (
          <>
            {block.subtype === 'Calendar' && (
              <CalendarBlockProperties block={block} />
            )}
            {block.subtype === 'Send email' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="recipient">Recipient</Label>
                  <Input
                    id="recipient"
                    value={String(block.properties.recipient || '')}
                    onChange={(e) => updateProperty('recipient', e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={String(block.properties.subject || '')}
                    onChange={(e) => updateProperty('subject', e.target.value)}
                    placeholder="Email subject"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body">Body Template</Label>
                  <Textarea
                    id="body"
                    value={String(block.properties.body || '')}
                    onChange={(e) => updateProperty('body', e.target.value)}
                    placeholder="Email body template..."
                    rows={4}
                  />
                </div>
              </>
            )}
            {block.subtype === 'Browse internet' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="query">Search Query</Label>
                  <Input
                    id="query"
                    value={String(block.properties.query || '')}
                    onChange={(e) => updateProperty('query', e.target.value)}
                    placeholder="Search terms..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-results">Max Results</Label>
                  <Input
                    id="max-results"
                    type="number"
                    value={String(block.properties.maxResults || 5)}
                    onChange={(e) => updateProperty('maxResults', parseInt(e.target.value))}
                  />
                </div>
              </>
            )}
            {block.subtype === 'DB' && (
              <DbBlockProperties block={block} />
            )}
          </>
        );
      case 'test':
        return (
          <>
            <div className="space-y-4">
              <DatasetSelector blockId={block.id} />
              <RunTestsButton blockId={block.id} />
              <ResultsSummary blockId={block.id} />
            </div>
          </>
        );
      case 'frontend':
        return (
          <>
            {block.subtype === 'Interface' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="title-prop">Title</Label>
                  <Input
                    id="title-prop"
                    value={String(block.properties.title || '')}
                    onChange={(e) => updateProperty('title', e.target.value)}
                    placeholder="Chatbot window title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={String(block.properties.description || '')}
                    onChange={(e) => updateProperty('description', e.target.value)}
                    placeholder="A short welcome message"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={String(block.properties.theme || 'light')}
                    onValueChange={(value) => updateProperty('theme', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accent-color">Accent Color</Label>
                  <ColorPicker
                    id="accent-color"
                    value={String(block.properties.accentColor || '')}
                    onChange={(e) => updateProperty('accentColor', e.target.value)}
                    placeholder="#FFFFFF"
                  />
                </div>
                <QuestionSuggestionsConfig 
                  suggestions={block.properties.questionSuggestions || []}
                  onUpdate={(suggestions) => updateProperty('questionSuggestions', suggestions)}
                />
              </>
            )}
            {block.subtype === 'API' && (
              <ApiBlockProperties block={block} />
            )}
            {block.subtype === 'Slack' && (
              <SlackBlockProperties block={block} />
            )}
            {block.subtype === 'Bubble' && (
              <>
                {/* Appearance Section */}
                <div className="space-y-4 border-b pb-4">
                  <h3 className="font-semibold">Appearance</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="bubble-color">Bubble Color</Label>
                    <ColorPicker
                      id="bubble-color"
                      value={String(block.properties.bubbleColor || '#007bff')}
                      onChange={(e) => updateProperty('bubbleColor', e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="bubble-size">Bubble Size</Label>
                    <Select
                      value={String(block.properties.bubbleSize || 'medium')}
                      onValueChange={(value) => updateProperty('bubbleSize', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="bubble-icon">Bubble Icon (emoji or text)</Label>
                    <Input
                      id="bubble-icon"
                      value={String(block.properties.bubbleIcon || '💬')}
                      onChange={(e) => updateProperty('bubbleIcon', e.target.value)}
                      placeholder="💬"
                      maxLength={2}
                    />
                    <p className="text-xs text-muted-foreground">Enter an emoji or single character (e.g., 💬, 🤖, ?)</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="chat-window-color">Chat Window Header Color</Label>
                    <ColorPicker
                      id="chat-window-color"
                      value={String(block.properties.chatWindowColor || block.properties.bubbleColor || '#007bff')}
                      onChange={(e) => updateProperty('chatWindowColor', e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="chat-window-theme">Chat Window Theme</Label>
                    <Select
                      value={String(block.properties.chatWindowTheme || 'light')}
                      onValueChange={(value) => updateProperty('chatWindowTheme', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="auto">Auto (follows system)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Position Section */}
                <div className="space-y-4 border-b pb-4 mt-4">
                  <h3 className="font-semibold">Position</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="position">Corner Position</Label>
                    <Select
                      value={String(block.properties.position || 'bottom-right')}
                      onValueChange={(value) => updateProperty('position', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom-right">Bottom Right</SelectItem>
                        <SelectItem value="bottom-left">Bottom Left</SelectItem>
                        <SelectItem value="top-right">Top Right</SelectItem>
                        <SelectItem value="top-left">Top Left</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="offset-x">Horizontal Offset (px)</Label>
                      <Input
                        id="offset-x"
                        type="number"
                        value={String(block.properties.offsetX || 20)}
                        onChange={(e) => updateProperty('offsetX', parseInt(e.target.value) || 20)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="offset-y">Vertical Offset (px)</Label>
                      <Input
                        id="offset-y"
                        type="number"
                        value={String(block.properties.offsetY || 20)}
                        onChange={(e) => updateProperty('offsetY', parseInt(e.target.value) || 20)}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Behavior Section */}
                <div className="space-y-4 border-b pb-4 mt-4">
                  <h3 className="font-semibold">Behavior</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="chat-window-title">Chat Window Title</Label>
                    <Input
                      id="chat-window-title"
                      value={String(block.properties.chatWindowTitle || 'Chat')}
                      onChange={(e) => updateProperty('chatWindowTitle', e.target.value)}
                      placeholder="Chat with us"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="greeting-message">Greeting Message (optional)</Label>
                    <Textarea
                      id="greeting-message"
                      value={String(block.properties.greetingMessage || '')}
                      onChange={(e) => updateProperty('greetingMessage', e.target.value)}
                      placeholder="Hello! How can I help you?"
                      rows={2}
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="auto-open"
                      checked={Boolean(block.properties.autoOpen)}
                      onChange={(e) => updateProperty('autoOpen', e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="auto-open" className="cursor-pointer">Auto-open chat on page load</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="show-on-mobile"
                      checked={block.properties.showOnMobile !== false}
                      onChange={(e) => updateProperty('showOnMobile', e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="show-on-mobile" className="cursor-pointer">Show bubble on mobile devices</Label>
                  </div>
                </div>
                
                {/* Embed Code Section */}
                <div className="space-y-4 mt-4">
                  <h3 className="font-semibold">Embed Code</h3>
                  <EmbedCodeGenerator chatbotId={block.chatbotId} blockId={block.id} />
                </div>
              </>
            )}
          </>
        );
      default:
        return null;
    }
  };
  return (
    <Card className="border-0 rounded-none">
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center justify-between">
          <span>Block Properties</span>
          <div className="flex items-center gap-2">
            {block.subtype !== 'System Prompt' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteBlock(block.id)}
              >
                <Trash2 size={14} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => selectBlock(null)}
            >
              <X size={14} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {block.subtype !== 'System Prompt' && (
          <div className="space-y-2">
            <Label htmlFor="block-title">Block name</Label>
            <Input
              id="block-title"
              value={String(block.title || '')}
              onChange={(e) => updateTitle(e.target.value)}
              placeholder={`Name this ${block.subtype.toLowerCase()} block`}
            />
          </div>
        )}
        {renderTypeSpecificProperties()}
      </CardContent>
    </Card>
  );
};

// TestLLM components
const DatasetSelector: React.FC<{ blockId: string }> = ({ blockId }) => {
  const { token } = useAuth();
  const { toast } = useToast();
  const { blocks, chatbot, updateBlock } = useBlockEditor();
  const block = blocks.find(b => b.id === blockId)!;
  const selectedChatbotId = chatbot?.id || block.chatbotId;
  const [open, setOpen] = React.useState(false);
  const [openNewOnMount, setOpenNewOnMount] = React.useState(false);
  const [datasets, setDatasets] = React.useState<TestDataset[]>([]);
  const [loading, setLoading] = React.useState(false);
  const selectedDatasetId = String(block.properties.datasetId || '');

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await listTestDatasets(token || '', selectedChatbotId || undefined);
      setDatasets(data);
    } catch {
      toast({ title: 'Failed to load datasets', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [token, selectedChatbotId, toast]);

  React.useEffect(() => { if (open) load(); }, [open, load]);
  React.useEffect(() => { load(); }, [load]);

  const onSelect = async (id: string) => {
    updateBlock(blockId, { properties: { ...block.properties, datasetId: id } });
    await load();
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <Label>Examples Dataset</Label>
      <div className="flex items-center gap-2">
        <Input
          readOnly
          className="cursor-pointer"
          onClick={() => { setOpenNewOnMount(false); setOpen(true); }}
          value={datasets.find(d => d.id === selectedDatasetId)?.name || (datasets.length === 0 ? 'No datasets yet' : (selectedDatasetId ? selectedDatasetId : 'None selected'))}
        />
        <Button variant="default" size="sm" onClick={() => { setOpenNewOnMount(true); setOpen(true); }}>New</Button>
      </div>
      {datasets.length === 0 && (
        <div className="text-xs text-muted-foreground">No datasets created yet. Click New to create your first set of questions and answers.</div>
      )}
      {open && (
        <DatasetModal
          datasets={datasets}
          loading={loading}
          onRefresh={load}
          onClose={() => setOpen(false)}
          onSelect={onSelect}
          startNew={openNewOnMount}
          selectedId={selectedDatasetId}
        />
      )}
    </div>
  );
};

const DatasetModal: React.FC<{
  datasets: TestDataset[];
  loading: boolean;
  onRefresh: () => void;
  onClose: () => void;
  onSelect: (id: string) => void;
  startNew?: boolean;
  selectedId?: string;
}> = ({ datasets, loading, onRefresh, onClose, onSelect, startNew, selectedId }) => {
  const { token } = useAuth();
  const { toast } = useToast();
  const { chatbot, blocks } = useBlockEditor();
  const selectedChatbotId = chatbot?.id || (blocks.length > 0 ? blocks[0].chatbotId : undefined);
  const [editing, setEditing] = React.useState<TestDataset | null>(null);
  const [name, setName] = React.useState('');
  const [examples, setExamples] = React.useState<Array<{ question: string; answer: string; expectedSources?: string[] }>>([]);

  const selected = React.useMemo(() => datasets.find(d => d.id === selectedId), [datasets, selectedId]);

  const startNewDataset = () => {
    setEditing(null);
    setName('New Dataset');
    setExamples([{ question: '', answer: '' }]);
  };

  const startEdit = (ds: TestDataset) => {
    setEditing(ds);
    setName(ds.name);
    setExamples(ds.examples || []);
  };

  React.useEffect(() => {
    if (startNew) {
      startNewDataset();
    }
  }, [startNew]);

  const save = async () => {
    try {
      if (!name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
      if (editing) {
        await updateTestDataset(token || '', editing.id, { name, examples });
      } else {
        await createTestDataset(token || '', { name, examples, chatbotId: selectedChatbotId || undefined });
      }
      await onRefresh();
      toast({ title: 'Saved' });
    } catch {
      toast({ title: 'Failed to save dataset', variant: 'destructive' });
    }
  };

  const remove = async (id: string) => {
    try { await deleteTestDataset(token || '', id); await onRefresh(); } catch { toast({ title: 'Failed to delete', variant: 'destructive' }); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg w-[800px] max-w-full max-h-[80vh] overflow-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Manage Datasets</div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={14} />
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">Your Datasets</div>
              <div className="flex items-center gap-2">
                <input id="import-dataset-file" type="file" accept=".csv" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    await importTestDatasetCsv(token || '', file, { chatbotId: selectedChatbotId });
                    await onRefresh();
                    toast({ title: 'Dataset imported' });
                  } catch {
                    toast({ title: 'Failed to import CSV', variant: 'destructive' });
                  } finally {
                    (e.target as HTMLInputElement).value = '';
                  }
                }} />
                <Button size="sm" variant="outline" onClick={() => document.getElementById('import-dataset-file')?.click()}>Import CSV</Button>
                <Button size="sm" variant="default" onClick={startNewDataset}>New</Button>
              </div>
            </div>
            <div className="border rounded p-2 max-h-64 overflow-auto">
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : datasets.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">
                  No datasets yet. Click <span className="font-medium">New</span> to create your first dataset.
                </div>
              ) : (
                datasets.map(ds => (
                  <div key={ds.id} className="flex items-center justify-between py-1 border-b last:border-b-0">
                    <div className="truncate pr-2">
                      {ds.name}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => onSelect(ds.id)} disabled={selectedId === ds.id}>
                        {selectedId === ds.id ? 'Selected' : 'Select'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={async () => {
                        try { await downloadTestDatasetCsv(token || '', ds.id); } catch { toast({ title: 'Export failed', variant: 'destructive' }); }
                      }}>Export</Button>
                      <Button size="sm" variant="outline" onClick={() => startEdit(ds)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => remove(ds.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="space-y-3">
            {editing === null && name === '' && examples.length === 0 ? (
              selected ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">Selected Dataset</div>
                    <Button size="sm" variant="outline" onClick={() => startEdit(selected)}>Edit</Button>
                  </div>
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input value={selected.name} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Examples</Label>
                    <div className="border rounded max-h-64 overflow-auto">
                      {selected.examples && selected.examples.length > 0 ? (
                        selected.examples.map((ex, i) => (
                          <div key={i} className="p-2 border-b last:border-b-0 text-sm">
                            <div className="font-medium">Q{i+1}: {ex.question}</div>
                            <div className="text-muted-foreground">{ex.answer}</div>
                          </div>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-muted-foreground">No examples in this dataset.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground h-full flex items-center justify-center p-6 border rounded">
                  Select a dataset to edit, or click New to create one.
                </div>
              )
            ) : (
              <>
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Examples</Label>
                  {examples.map((ex, i) => (
                    <div key={i} className="space-y-2 border rounded p-2">
                      <Input value={ex.question} onChange={(e) => {
                        const next = [...examples]; next[i] = { ...next[i], question: e.target.value }; setExamples(next);
                      }} placeholder="Question" />
                      <Textarea value={ex.answer} onChange={(e) => {
                        const next = [...examples]; next[i] = { ...next[i], answer: e.target.value }; setExamples(next);
                      }} placeholder="Good answer" rows={2} />
                      <div className="space-y-1">
                        <Label>Expected sources (comma-separated URLs or filenames)</Label>
                        <Input value={(ex.expectedSources || []).join(', ')} onChange={(e) => {
                          const list = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          const next = [...examples]; next[i] = { ...next[i], expectedSources: list }; setExamples(next);
                        }} placeholder="https://example.com/page, Document.pdf" />
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <Button size="sm" variant="outline" onClick={() => setExamples([...examples, { question: '', answer: '' }])}>Add example</Button>
                    <Button size="sm" onClick={save}>Save</Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

type TestCaseResult = {
  question: string;
  expected: string;
  actual: string;
  metrics: { answerRelevancy: number; ragRetrieval?: number; expectedSources?: string[]; foundCitations?: string[] };
  passed: boolean;
};

type TestRunSummary = {
  total: number;
  passed: number;
  failed: number;
  averageScore: number;
};

type TestRunResult = {
  id: string;
  status: 'running' | 'completed';
  summary: TestRunSummary;
  cases: TestCaseResult[];
  processed?: number;
  total?: number;
};

const RunTestsButton: React.FC<{ blockId: string }> = ({ blockId }) => {
  const { token } = useAuth();
  const { toast } = useToast();
  const { blocks, chatbot, updateBlock } = useBlockEditor();
  const block = blocks.find(b => b.id === blockId);
  const chatbotId = chatbot?.id || block?.chatbotId;
  const isDisabled = !block || !block?.properties?.datasetId || !chatbotId;
  const [runId, setRunId] = React.useState<string | null>(null);
  const [expectedTotal, setExpectedTotal] = React.useState<number | null>(null);

  type StartRunResponse = { id: string; status: string; total?: number };

  const handleComplete = React.useCallback((result: TestRunResult) => {
    // Persist lightweight summary on block for quick access
    updateBlock(blockId, {
      properties: {
        ...block?.properties,
        lastRunId: result?.id || runId,
        lastRunSummary: result?.summary,
        lastRunCompletedAt: new Date().toISOString(),
      }
    });
  }, [blockId, block?.properties, runId, updateBlock]);

  const run = async () => {
    try {
      // Re-read from latest blocks state to avoid stale closure
      const latestBlock = blocks.find(b => b.id === blockId);
      const datasetId = latestBlock?.properties?.datasetId || block?.properties?.datasetId || null;
      const payload = {
        chatbotId: chatbotId!,
        blockId,
        suites: { qa: true, rag: true },
        examples: (latestBlock?.properties?.examples as Array<{ question: string; answer: string }>) || [],
        datasetId
      };
      const res = await adminApiClient.post('/test-runs', payload, token || '');
      const data = await handleApiResponse(res) as StartRunResponse;
      setRunId(data.id);
      setExpectedTotal(typeof data.total === 'number' ? data.total : null);
      // persist last run id on block for summary
      updateBlock(blockId, { properties: { ...block?.properties, lastRunId: data.id } });
      toast({ title: 'Test run started', description: `Run ID: ${data.id}` });
    } catch (e) {
      toast({ title: 'Failed to start tests', variant: 'destructive' });
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={run} disabled={isDisabled}>Run tests</Button>
      </div>
      {runId ? (
        <ResultsViewer
          runId={runId}
          expectedTotal={expectedTotal ?? undefined}
          onComplete={handleComplete}
        />
      ) : null}
    </div>
  );
};

const ResultsViewer: React.FC<{ runId: string; expectedTotal?: number; onComplete?: (result: TestRunResult) => void }> = ({ runId, expectedTotal, onComplete }) => {
  const { token } = useAuth();
  const [data, setData] = React.useState<TestRunResult | null>(null);
  const [status, setStatus] = React.useState<string>('running');

  React.useEffect(() => {
    let mounted = true;
    const fetchOnce = async () => {
      const res = await adminApiClient.get(`/test-runs/${runId}`, token || '');
      const json = await handleApiResponse(res);
      if (!mounted) return;
      setStatus(json.status);
      setData(json);
      if (json.status === 'completed' && onComplete) {
        try { onComplete(json as TestRunResult); } catch (e) {
          // Silently ignore callback errors
          console.warn('onComplete callback error:', e);
        }
      }
    };
    fetchOnce();
    if (status !== 'completed') {
      const id = setInterval(fetchOnce, 1000);
      return () => { mounted = false; clearInterval(id); };
    }
    return () => { mounted = false; };
  }, [runId, token, status, onComplete]);

  if (!data) return null;

  if (status !== 'completed') {
    // Hide inline progress here to avoid duplicate progress UI.
    return null;
  }

  return (
    <div className="space-y-1 text-sm">
      <div>Run completed. Avg score: {Math.round((data.summary?.averageScore || 0) * 100)}%</div>
      <div>Passed: {data.summary?.passed} / {data.summary?.total}</div>
      <div className="text-xs text-muted-foreground">Click "View details" for the full breakdown.</div>
    </div>
  );
};

// Lightweight summary based on last run id stored in block properties
const ResultsSummary: React.FC<{ blockId: string }> = ({ blockId }) => {
  const { token } = useAuth();
  const { blocks } = useBlockEditor();
  const block = blocks.find(b => b.id === blockId);
  const lastRunId = String(block?.properties?.lastRunId || '');
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<TestRunResult | null>(null);
  const [status, setStatus] = React.useState<string>('running');

  React.useEffect(() => {
    if (!lastRunId) return;
    let mounted = true;
    const fetchOnce = async () => {
      const res = await adminApiClient.get(`/test-runs/${lastRunId}`, token || '');
      const json = await handleApiResponse(res);
      if (!mounted) return;
      setStatus(json.status);
      setData(json);
    };
    fetchOnce();
    const id = setInterval(fetchOnce, 1000);
    return () => { mounted = false; clearInterval(id); };
  }, [lastRunId, token]);

  if (!lastRunId) return null;

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Last test run</div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>View details</Button>
      </div>
      {status !== 'completed' ? (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Running... {data?.processed ?? 0}/{data?.total ?? 0}</div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(data?.processed && data?.total) ? Math.round(((data?.processed || 0) / (data?.total || 0)) * 100) : 0}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="text-xs">
          Avg score: {Math.round((data?.summary?.averageScore || 0) * 100)}% • Passed: {data?.summary?.passed}/{data?.summary?.total}
        </div>
      )}
      {open && data ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg w-[900px] max-w-full p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Test Run Details</div>
              <div className="flex items-center gap-2">
                {status === 'completed' && (
                  <Button size="sm" variant="outline" onClick={async () => {
                    try { await downloadTestRunCsv(token || '', lastRunId); } catch (e) { console.error('Failed to export test run CSV', e); }
                  }}>Export CSV</Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}><X size={14} /></Button>
              </div>
            </div>
            <div className="text-sm">Avg score: {Math.round((data.summary?.averageScore || 0) * 100)}% • Passed: {data.summary?.passed}/{data.summary?.total}</div>
            <div className="border rounded max-h-[60vh] overflow-auto text-sm">
              {data.cases?.map((c: TestCaseResult, i: number) => (
                <div key={i} className="p-2 border-b last:border-b-0">
                  <div className="font-medium">Q{i+1}: {c.question}</div>
                  <div className="text-muted-foreground mt-1">Expected: {c.expected}</div>
                  <div className="text-muted-foreground">Actual: {c.actual}</div>
                  <div className="mt-1">
                    <span className={c.passed ? 'text-green-600' : 'text-red-600'}>
                      {c.passed ? '✓ Passed' : '✗ Failed'}
                    </span>
                    {' '}• Score: {Math.round((c.metrics.answerRelevancy || 0) * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default BlockProperties;
