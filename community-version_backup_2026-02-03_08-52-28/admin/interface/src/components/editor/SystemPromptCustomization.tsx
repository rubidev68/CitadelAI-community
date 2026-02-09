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
  type CustomProvider,
  type ProviderAvailability
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

const LLM_PROVIDER_OPTIONS = [
  {
    value: 'gemini',
    label: 'Google Gemini',
    description: 'Google\'s advanced AI model',
    icon: <Brain className="h-4 w-4 text-blue-500" />,
    models: ['gemini-2.5-flash', 'gemini-2.5-pro']
  },
  {
    value: 'openai',
    label: 'OpenAI GPT',
    description: 'OpenAI\'s powerful language models',
    icon: <Zap className="h-4 w-4 text-green-500" />,
    models: ['gpt-5-mini', 'gpt-5']
  },
  {
    value: 'anthropic',
    label: 'Anthropic Claude',
    description: 'Anthropic\'s helpful and harmless AI',
    icon: <Bot className="h-4 w-4 text-orange-500" />,
    models: ['claude-4.5-sonnet']
  },
  {
    value: 'mistral',
    label: 'Mistral AI',
    description: 'Mistral\'s efficient language models',
    icon: <Cpu className="h-4 w-4 text-purple-500" />,
    models: ['mistral-medium']
  },
  {
    value: 'custom',
    label: 'Custom Provider',
    description: 'Use your own OpenAI-compatible API',
    icon: <Settings className="h-4 w-4 text-gray-500" />,
    models: [] // Models come from custom provider config
  }
];

const SystemPromptCustomization: React.FC<SystemPromptCustomizationProps> = ({ block }) => {
  const { updateBlock, blocks } = useBlockEditor();
  const { subscriptionStatus } = useSubscription();
  const { toast } = useToast();
  const [currentProvider, setCurrentProvider] = React.useState(String(block.properties.llmProvider || 'gemini'));
  const [providerAvailability, setProviderAvailability] = React.useState<ProviderAvailability | null>(null);
  const [customProviders, setCustomProviders] = React.useState<CustomProvider[]>([]);
  const [loadingAvailability, setLoadingAvailability] = React.useState(true);
  const [loadingCustomProviders, setLoadingCustomProviders] = React.useState(false);
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
  
  // Load provider availability and custom providers
  React.useEffect(() => {
    const loadData = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      
      try {
        setLoadingAvailability(true);
        const availability = await getProviderAvailability(token);
        setProviderAvailability(availability);
      } catch (error) {
        console.error('Failed to load provider availability:', error);
      } finally {
        setLoadingAvailability(false);
      }
      
      try {
        setLoadingCustomProviders(true);
        const providers = await listCustomProviders(token);
        setCustomProviders(providers);
      } catch (error) {
        console.error('Failed to load custom providers:', error);
      } finally {
        setLoadingCustomProviders(false);
      }
    };
    
    loadData();
  }, []);
  
  // Show custom provider form when custom provider is selected
  React.useEffect(() => {
    if (currentProvider === 'custom' && !selectedCustomProviderId) {
      setShowCustomProviderForm(true);
    } else if (currentProvider !== 'custom') {
      setShowCustomProviderForm(false);
    }
  }, [currentProvider, selectedCustomProviderId]);
  
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
  }, [block.properties, blocks]);

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

  const updateProvider = (provider: string) => {
    const providerOption = LLM_PROVIDER_OPTIONS.find(p => p.value === provider);
    let defaultModel = providerOption?.models[0] || 'gemini-2.5-flash';
    
    // For custom provider, use model from selected custom provider
    if (provider === 'custom' && selectedCustomProviderId) {
      const customProvider = customProviders.find(p => p.id === selectedCustomProviderId);
      if (customProvider) {
        defaultModel = customProvider.modelName;
      }
    }
    
    setCurrentProvider(provider);
    
    const newProperties: Record<string, unknown> = { 
      ...block.properties, 
      llmProvider: provider,
      llmModel: defaultModel
    };
    
    // For custom provider, store the custom provider ID
    if (provider === 'custom' && selectedCustomProviderId) {
      newProperties.customProviderId = selectedCustomProviderId;
    } else {
      // Remove customProviderId when switching away from custom
      delete newProperties.customProviderId;
    }
    
    const generatedPrompt = generateSystemPrompt(newProperties);
    newProperties.prompt = generatedPrompt;
    
    updateBlock(block.id, {
      properties: newProperties
    });
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
      updateProvider('custom');
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
      setCurrentProvider('custom');
    }
  };

  // Sync current provider state when block properties change
  React.useEffect(() => {
    const provider = String(block.properties.llmProvider || 'gemini');
    if (provider !== currentProvider) {
      setCurrentProvider(provider);
    }
  }, [block.properties.llmProvider, currentProvider]);

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
                <Label htmlFor="llmProvider">AI Model Provider</Label>
                {!canCustomizeAIModel && (
                  <Alert className="mb-2">
                    <Lock className="h-4 w-4" />
                    <AlertDescription>
                      AI model customization is available in Professional and Enterprise plans. Upgrade to unlock this feature.
                    </AlertDescription>
                  </Alert>
                )}
                <Select
                  value={String(block.properties.llmProvider || 'gemini')}
                  onValueChange={updateProvider}
                  disabled={!canCustomizeAIModel}
                >
                  <SelectTrigger className={!canCustomizeAIModel ? 'opacity-50 cursor-not-allowed' : ''}>
                    <SelectValue placeholder="Select AI provider">
                      {(() => {
                        const selectedOption = LLM_PROVIDER_OPTIONS.find(opt => opt.value === String(block.properties.llmProvider || 'gemini'));
                        return selectedOption ? (
                          <div className="flex items-center space-x-2">
                            {selectedOption.icon}
                            <span>{selectedOption.label}</span>
                          </div>
                        ) : 'Select AI provider';
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LLM_PROVIDER_OPTIONS.map((option) => {
                      const isAvailable = providerAvailability ? providerAvailability[option.value as keyof ProviderAvailability] : true;
                      const isDisabled = !canCustomizeAIModel || (!isAvailable && option.value !== 'custom');
                      
                      return (
                        <SelectItem 
                          key={option.value} 
                          value={option.value}
                          disabled={isDisabled}
                          className={isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                        >
                          <div className="flex items-center space-x-3">
                            {option.icon}
                            <div className="flex flex-col flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium">{option.label}</span>
                                {!isAvailable && option.value !== 'custom' && (
                                  <AlertCircle className="h-3 w-3 text-yellow-500" />
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {!isAvailable && option.value !== 'custom' 
                                  ? 'API key not configured' 
                                  : option.description}
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Custom Provider Configuration */}
              {currentProvider === 'custom' && (
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

              {currentProvider !== 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="llmModel">AI Model</Label>
                  <Select
                    value={String(block.properties.llmModel || 'gemini-2.5-flash')}
                    onValueChange={(value) => updateProperty('llmModel', value)}
                    disabled={!canCustomizeAIModel}
                  >
                    <SelectTrigger className={!canCustomizeAIModel ? 'opacity-50 cursor-not-allowed' : ''}>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const provider = LLM_PROVIDER_OPTIONS.find(p => p.value === currentProvider);
                        return provider?.models.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        )) || [];
                      })()}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {currentProvider === 'custom' && selectedCustomProviderId && (
                <div className="space-y-2">
                  <Label htmlFor="llmModel">AI Model</Label>
                  <Input
                    id="llmModel"
                    value={String(block.properties.llmModel || '')}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Model is set by the selected custom provider
                  </p>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

    </div>
  );
};

export default SystemPromptCustomization;