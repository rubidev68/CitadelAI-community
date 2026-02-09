import React from 'react';
import { Block, useBlockEditor } from '@/contexts/BlockEditorContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  HelpCircle, 
  Briefcase, 
  Smile, 
  Wrench, 
  Sparkles, 
  Heart,
  Brain,
  Zap,
  Bot,
  Cpu,
  Lock,
  Settings,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  getProviderAvailability,
  listCustomProviders,
  createCustomProvider,
  testCustomProvider,
  listGlobalAIModels,
  type CustomProvider,
  type ProviderAvailability,
  type GlobalAIModel
} from '@/lib/api';

interface SystemPromptCustomizationProps {
  block: Block;
}

const BEHAVIOR_OPTIONS = [
  {
    value: 'helpful',
    label: 'Helpful Assistant',
    description: 'Friendly, informative, and eager to help with any questions',
    icon: <HelpCircle className="h-4 w-4 text-blue-500" />
  },
  {
    value: 'professional',
    label: 'Professional Expert',
    description: 'Formal, knowledgeable, and focused on providing expert advice',
    icon: <Briefcase className="h-4 w-4 text-indigo-500" />
  },
  {
    value: 'casual',
    label: 'Casual Friend',
    description: 'Relaxed, conversational, and approachable in tone',
    icon: <Smile className="h-4 w-4 text-green-500" />
  },
  {
    value: 'technical',
    label: 'Technical Specialist',
    description: 'Precise, detailed, and focused on technical accuracy',
    icon: <Wrench className="h-4 w-4 text-orange-500" />
  },
  {
    value: 'creative',
    label: 'Creative Collaborator',
    description: 'Imaginative, inspiring, and focused on creative solutions',
    icon: <Sparkles className="h-4 w-4 text-purple-500" />
  },
  {
    value: 'supportive',
    label: 'Supportive Guide',
    description: 'Empathetic, patient, and focused on helping users succeed',
    icon: <Heart className="h-4 w-4 text-pink-500" />
  }
];

const getIconForProvider = (provider: string) => {
  switch (provider.toLowerCase()) {
    case 'gemini': return <Brain className="h-4 w-4 text-blue-500" />;
    case 'openai': return <Zap className="h-4 w-4 text-green-500" />;
    case 'anthropic': return <Bot className="h-4 w-4 text-orange-500" />;
    case 'mistral': return <Cpu className="h-4 w-4 text-purple-500" />;
    case 'custom': return <Settings className="h-4 w-4 text-gray-500" />;
    default: return <Sparkles className="h-4 w-4 text-gray-500" />;
  }
};

const SystemPromptCustomization: React.FC<SystemPromptCustomizationProps> = ({ block }) => {
  const { updateBlock, blocks } = useBlockEditor();
  const { subscriptionStatus } = useSubscription();
  const { toast } = useToast();
  const [globalModels, setGlobalModels] = React.useState<GlobalAIModel[]>([]);
  const [providerAvailability, setProviderAvailability] = React.useState<ProviderAvailability | null>(null);
  const [customProviders, setCustomProviders] = React.useState<CustomProvider[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // State for UI control
  const [testingProvider, setTestingProvider] = React.useState<string | null>(null);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message?: string } | null>(null);
  
  // Custom provider form state
  const [showCustomProviderForm, setShowCustomProviderForm] = React.useState(false);
  const [customProviderForm, setCustomProviderForm] = React.useState({
    name: '',
    baseUrl: '',
    apiToken: '',
    modelName: ''
  });
  const [selectedCustomProviderId, setSelectedCustomProviderId] = React.useState<string | null>(
    block.properties.customProviderId ? String(block.properties.customProviderId) : null
  );
  
  // Check if AI model customization is allowed
  const canCustomizeAIModel = subscriptionStatus?.canCustomizeAIModel !== false;
  const isStarterPlan = subscriptionStatus?.plan?.name?.toLowerCase() === 'starter';
  
  // Load provider availability, custom providers, and global models
  React.useEffect(() => {
    const loadData = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      
      setLoading(true);
      try {
        const [availability, providers, models] = await Promise.all([
          getProviderAvailability(token),
          listCustomProviders(token),
          listGlobalAIModels(token)
        ]);
        setProviderAvailability(availability);
        setCustomProviders(providers);
        setGlobalModels(models);
      } catch (error) {
        console.error('Failed to load AI configuration:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  // Show custom provider form when custom provider is selected
  React.useEffect(() => {
    if (block.properties.llmProvider === 'custom' && !selectedCustomProviderId) {
      setShowCustomProviderForm(true);
    } else if (block.properties.llmProvider !== 'custom') {
      setShowCustomProviderForm(false);
    }
  }, [block.properties.llmProvider, selectedCustomProviderId]);
  
  const generateSystemPrompt = React.useCallback((properties: Record<string, unknown> = block.properties) => {
    const botName = properties.botName || 'Assistant';
    const behavior = properties.behavior || 'helpful';
    const companyName = properties.companyName || '';
    const additionalInstructions = properties.additionalInstructions || '';
    
    // Get context sources from connected blocks
    const contextBlocks = blocks.filter(b => 
      b.type.toLowerCase() === 'context' && 
      blocks.some(conn => 
        conn.fromBlockId === b.id && 
        blocks.find(block => block.id === conn.toBlockId)?.id === block.id
      )
    );

    const behaviorConfig = BEHAVIOR_OPTIONS.find(b => b.value === behavior) || BEHAVIOR_OPTIONS[0];
    
    // Get current date
    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    let systemPrompt = `You are ${botName}`;
    
    if (companyName) {
      systemPrompt += `, an AI assistant for ${companyName}`;
    }
    
    systemPrompt += `. ${behaviorConfig.description}`;
    
    // Add current date
    systemPrompt += `\n\nToday's date is: ${currentDate}`;
    
    if (contextBlocks.length > 0) {
      systemPrompt += `\n\nYou have access to the following knowledge sources:`;
      contextBlocks.forEach((contextBlock, index) => {
        if (contextBlock.subtype === 'Website') {
          systemPrompt += `\n- Website: ${contextBlock.properties.url || 'Connected website'}`;
        } else if (contextBlock.subtype === 'Document') {
          systemPrompt += `\n- Document: ${contextBlock.properties.filename || 'Connected document'}`;
        }
      });
      systemPrompt += `\n\nUse this information to provide accurate and helpful responses. Always cite your sources when referencing specific information.`;
    }
    
    // Always add instruction to use newest knowledge (context can come from various sources)
    systemPrompt += `\n\nIMPORTANT: Always prioritize and use the newest, most up-to-date knowledge available. When multiple sources contain conflicting information, prefer the most recent information.`;
    
    if (additionalInstructions) {
      systemPrompt += `\n\nAdditional instructions: ${additionalInstructions}`;
    }
    
    systemPrompt += `\n\nRemember to be helpful, accurate, and professional in all your interactions.`;
    
    return systemPrompt;
  }, [block.properties, blocks, block.id]);

  const updateProperty = React.useCallback((key: string, value: string) => {
    const newProperties = { ...block.properties, [key]: value };
    const generatedPrompt = generateSystemPrompt(newProperties);
    newProperties.prompt = generatedPrompt;
    
    updateBlock(block.id, {
      properties: newProperties
    });
  }, [block.properties, block.id, generateSystemPrompt, updateBlock]);
  
  // eslint-disable-next-line react-hooks/exhaustive-deps

  // Lock to Gemini for Starter plan
  React.useEffect(() => {
    if (isStarterPlan && (block.properties.llmProvider !== 'gemini' || block.properties.llmModel !== 'gemini-2.5-flash')) {
      updateProperty('llmProvider', 'gemini');
      updateProperty('llmModel', 'gemini-2.5-flash');
      setCurrentProvider('gemini');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStarterPlan, block.id, updateProperty]);

  const handleModelSelection = (value: string) => {
    if (value === 'custom_provider') {
      const newProperties: Record<string, unknown> = {
        ...block.properties,
        llmProvider: 'custom',
        llmModel: '', // Will be set by custom provider selection
      };
      // Keep customProviderId if previously selected
      if (selectedCustomProviderId) {
        newProperties.customProviderId = selectedCustomProviderId;
        const customProvider = customProviders.find(p => p.id === selectedCustomProviderId);
        if (customProvider) {
          newProperties.llmModel = customProvider.modelName;
        }
      }
      
      const generatedPrompt = generateSystemPrompt(newProperties);
      newProperties.prompt = generatedPrompt;
      updateBlock(block.id, { properties: newProperties });
      return;
    }

    // It's a global model ID (we use model.id as value)
    const selectedModel = globalModels.find(m => m.id === value);
    if (selectedModel) {
      const newProperties: Record<string, unknown> = {
        ...block.properties,
        llmProvider: selectedModel.provider,
        llmModel: selectedModel.modelId
      };
      
      // Clear custom provider specific fields
      delete newProperties.customProviderId;
      
      const generatedPrompt = generateSystemPrompt(newProperties);
      newProperties.prompt = generatedPrompt;
      
      updateBlock(block.id, { properties: newProperties });
    }
  };
  
  const handleCreateCustomProvider = async () => {
    if (!customProviderForm.name || !customProviderForm.baseUrl || !customProviderForm.apiToken || !customProviderForm.modelName) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all fields',
        variant: 'destructive'
      });
      return;
    }
    
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    
    try {
      const provider = await createCustomProvider(customProviderForm, token);
      setCustomProviders([...customProviders, provider]);
      setSelectedCustomProviderId(provider.id);
      setShowCustomProviderForm(false);
      
      // Update block to use this new custom provider
      const newProperties: Record<string, unknown> = {
        ...block.properties,
        llmProvider: 'custom',
        llmModel: provider.modelName,
        customProviderId: provider.id
      };
      const generatedPrompt = generateSystemPrompt(newProperties);
      newProperties.prompt = generatedPrompt;
      updateBlock(block.id, { properties: newProperties });
      
      toast({
        title: 'Success',
        description: 'Custom provider created successfully'
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create custom provider';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  };
  
  const handleTestCustomProvider = async (providerId: string) => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    
    setTestingProvider(providerId);
    setTestResult(null);
    
    try {
      const result = await testCustomProvider(providerId, token);
      setTestResult({ success: result.success, message: result.message || result.error });
      
      if (result.success) {
        toast({
          title: 'Test Successful',
          description: result.message || 'Custom provider configuration is working correctly'
        });
      } else {
        toast({
          title: 'Test Failed',
          description: result.error || 'Custom provider configuration test failed',
          variant: 'destructive'
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Test failed';
      setTestResult({ success: false, message: errorMessage });
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setTestingProvider(null);
    }
  };
  
  const handleSelectExistingCustomProvider = (providerId: string) => {
    setSelectedCustomProviderId(providerId);
    const customProvider = customProviders.find(p => p.id === providerId);
    if (customProvider) {
      const newProperties: Record<string, unknown> = {
        ...block.properties,
        llmProvider: 'custom',
        llmModel: customProvider.modelName,
        customProviderId: providerId
      };
      const generatedPrompt = generateSystemPrompt(newProperties);
      newProperties.prompt = generatedPrompt;
      updateBlock(block.id, { properties: newProperties });
    }
  };

  // Auto-generate prompt when LLM provider or model changes
  React.useEffect(() => {
    const generatedPrompt = generateSystemPrompt();
    if (generatedPrompt !== block.properties.prompt) {
      updateBlock(block.id, {
        properties: { ...block.properties, prompt: generatedPrompt }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.properties.llmProvider, block.properties.llmModel, block.properties.botName, block.properties.companyName, block.properties.behavior, block.properties.additionalInstructions]);

  // Determine current selection value
  const currentSelectionValue = (() => {
    if (block.properties.llmProvider === 'custom') return 'custom_provider';
    const foundModel = globalModels.find(m => 
      m.provider === block.properties.llmProvider && 
      m.modelId === block.properties.llmModel
    );
    return foundModel ? foundModel.id : '';
  })();

  return (
    <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="botName">Bot Name</Label>
          <Input
            id="botName"
            value={String(block.properties.botName || '')}
            onChange={(e) => updateProperty('botName', e.target.value)}
            placeholder="e.g., Alex, CustomerBot, Support Assistant"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name (Optional)</Label>
          <Input
            id="companyName"
            value={String(block.properties.companyName || '')}
            onChange={(e) => updateProperty('companyName', e.target.value)}
            placeholder="e.g., Acme Corp, Tech Solutions Inc."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="behavior">Bot Behavior</Label>
          <Select
            value={String(block.properties.behavior || 'helpful')}
            onValueChange={(value) => updateProperty('behavior', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select behavior">
                {(() => {
                  const selectedOption = BEHAVIOR_OPTIONS.find(opt => opt.value === String(block.properties.behavior || 'helpful'));
                  return selectedOption ? (
                    <div className="flex items-center space-x-2">
                      {selectedOption.icon}
                      <span>{selectedOption.label}</span>
                    </div>
                  ) : 'Select behavior';
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {BEHAVIOR_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center space-x-3">
                    {option.icon}
                    <div className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="additionalInstructions">Additional Instructions (Optional)</Label>
          <Textarea
            id="additionalInstructions"
            value={String(block.properties.additionalInstructions || '')}
            onChange={(e) => updateProperty('additionalInstructions', e.target.value)}
            placeholder="Any specific instructions or guidelines for the bot..."
            rows={3}
          />
        </div>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="advanced-features">
            <AccordionTrigger>Advanced Features</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="llmModel">AI Model</Label>
                {!canCustomizeAIModel && (
                  <Alert className="mb-2">
                    <Lock className="h-4 w-4" />
                    <AlertDescription>
                      AI model customization is available in Professional and Enterprise plans. Upgrade to unlock this feature.
                    </AlertDescription>
                  </Alert>
                )}
                <Select
                  value={currentSelectionValue}
                  onValueChange={handleModelSelection}
                  disabled={!canCustomizeAIModel || loading}
                >
                  <SelectTrigger className={!canCustomizeAIModel ? 'opacity-50 cursor-not-allowed' : ''}>
                    <SelectValue placeholder={loading ? "Loading models..." : "Select AI model"}>
                      {(() => {
                         if (currentSelectionValue === 'custom_provider') {
                             return (
                                <div className="flex items-center space-x-2">
                                  {getIconForProvider('custom')}
                                  <span>Custom Provider</span>
                                </div>
                             );
                         }
                         const selectedModel = globalModels.find(m => m.id === currentSelectionValue);
                         return selectedModel ? (
                           <div className="flex items-center space-x-2">
                             {getIconForProvider(selectedModel.provider)}
                             <span>{selectedModel.name}</span>
                           </div>
                         ) : (loading ? "Loading models..." : "Select AI model");
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {globalModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex items-center space-x-3">
                            {getIconForProvider(model.provider)}
                            <div className="flex flex-col">
                                <span className="font-medium">{model.name}</span>
                                <span className="text-xs text-muted-foreground">{model.description || model.modelId}</span>
                            </div>
                          </div>
                        </SelectItem>
                    ))}
                    <SelectItem value="custom_provider">
                        <div className="flex items-center space-x-3">
                            {getIconForProvider('custom')}
                            <div className="flex flex-col">
                                <span className="font-medium">Custom Provider</span>
                                <span className="text-xs text-muted-foreground">Use your own OpenAI-compatible API</span>
                            </div>
                        </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Custom Provider Configuration */}
              {block.properties.llmProvider === 'custom' && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between">
                    <Label>Custom Provider Configuration</Label>
                    {selectedCustomProviderId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestCustomProvider(selectedCustomProviderId)}
                        disabled={testingProvider === selectedCustomProviderId}
                      >
                        {testingProvider === selectedCustomProviderId ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-2" />
                            Test Configuration
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  
                  {testResult && (
                    <Alert variant={testResult.success ? 'default' : 'destructive'}>
                      {testResult.success ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <AlertDescription>
                        {testResult.message || (testResult.success ? 'Test successful' : 'Test failed')}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {customProviders.length > 0 && !showCustomProviderForm && (
                    <div className="space-y-2">
                      <Label>Load Existing Provider</Label>
                      <Select
                        value={selectedCustomProviderId || ''}
                        onValueChange={handleSelectExistingCustomProvider}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select existing custom provider" />
                        </SelectTrigger>
                        <SelectContent>
                          {customProviders.map((provider) => (
                            <SelectItem key={provider.id} value={provider.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{provider.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {provider.baseUrl} • {provider.modelName}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowCustomProviderForm(true);
                          setSelectedCustomProviderId(null);
                        }}
                        className="w-full"
                      >
                        Create New Provider
                      </Button>
                    </div>
                  )}
                  
                  {showCustomProviderForm && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="customProviderName">Provider Name</Label>
                        <Input
                          id="customProviderName"
                          value={customProviderForm.name}
                          onChange={(e) => setCustomProviderForm({ ...customProviderForm, name: e.target.value })}
                          placeholder="e.g., My Custom API"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="customProviderBaseUrl">Base URL</Label>
                        <Input
                          id="customProviderBaseUrl"
                          value={customProviderForm.baseUrl}
                          onChange={(e) => setCustomProviderForm({ ...customProviderForm, baseUrl: e.target.value })}
                          placeholder="https://api.example.com"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="customProviderApiToken">API Token</Label>
                        <Input
                          id="customProviderApiToken"
                          type="password"
                          value={customProviderForm.apiToken}
                          onChange={(e) => setCustomProviderForm({ ...customProviderForm, apiToken: e.target.value })}
                          placeholder="sk-..."
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="customProviderModelName">Model Name</Label>
                        <Input
                          id="customProviderModelName"
                          value={customProviderForm.modelName}
                          onChange={(e) => setCustomProviderForm({ ...customProviderForm, modelName: e.target.value })}
                          placeholder="e.g., gpt-4, custom-model-v1"
                        />
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button
                          onClick={handleCreateCustomProvider}
                          className="flex-1"
                        >
                          Save Provider
                        </Button>
                        {customProviders.length > 0 && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowCustomProviderForm(false);
                              setCustomProviderForm({ name: '', baseUrl: '', apiToken: '', modelName: '' });
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {selectedCustomProviderId && !showCustomProviderForm && (
                    <div className="text-sm text-muted-foreground">
                      <p>Using: {customProviders.find(p => p.id === selectedCustomProviderId)?.name}</p>
                    </div>
                  )}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

    </div>
  );
};

export default SystemPromptCustomization;