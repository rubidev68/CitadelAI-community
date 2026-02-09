# LLM Provider Support

CitadelAI now supports multiple Large Language Model (LLM) providers, allowing admin users to choose the best AI model for their specific use case. This feature provides flexibility, cost optimization, and the ability to leverage different AI capabilities.

## Supported Providers

### 1. Google Gemini (Default)
- **Provider ID**: `gemini`
- **Default Model**: `gemini-2.5-flash`
- **Available Models**:
  - `gemini-2.5-flash` - Fast and efficient (default)
  - `gemini-2.5-pro` - Most capable model
- **API Key**: `GEMINI_API_KEY`
- **Model Override**: `GEMINI_MODEL`

### 2. OpenAI GPT
- **Provider ID**: `openai`
- **Default Model**: `gpt-5-mini`
- **Available Models**:
  - `gpt-5-mini` - Efficient version of GPT-5 (default)
  - `gpt-5` - Latest and most capable model
- **API Key**: `OPENAI_API_KEY`
- **Model Override**: `OPENAI_MODEL`
- **Custom Base URL**: `OPENAI_BASE_URL`

### 3. Anthropic Claude
- **Provider ID**: `anthropic`
- **Default Model**: `claude-4.5-sonnet`
- **Available Models**:
  - `claude-4.5-sonnet` - Latest and most capable (default)
- **API Key**: `ANTHROPIC_API_KEY`
- **Model Override**: `ANTHROPIC_MODEL`

### 4. Mistral AI
- **Provider ID**: `mistral`
- **Default Model**: `mistral-large-latest`
- **Available Models**:
  - `mistral-large-latest` - Most capable model (default)
  - `mistral-small-latest` - Efficient option
  - `mistral-nemo-latest` - Lightweight model
- **API Key**: `MISTRAL_API_KEY`
- **Model Override**: `MISTRAL_MODEL`
- **Custom Base URL**: `MISTRAL_BASE_URL`

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
# LLM Provider API Keys
GEMINI_API_KEY="your_gemini_api_key"
OPENAI_API_KEY="your_openai_api_key"
ANTHROPIC_API_KEY="your_anthropic_api_key"
MISTRAL_API_KEY="your_mistral_api_key"

# Optional: Override default models
GEMINI_MODEL="gemini-2.5-flash"
OPENAI_MODEL="gpt-5-mini"
ANTHROPIC_MODEL="claude-4.5-sonnet"
MISTRAL_MODEL="mistral-large-latest"

# Optional: Custom base URLs (for self-hosted or proxy endpoints)
OPENAI_BASE_URL=""
MISTRAL_BASE_URL=""
```

### Admin Interface Configuration

1. **Access System Prompt Block**: In the admin interface, select the System Prompt block in your chatbot configuration.

2. **Select AI Model Provider**: Choose from the dropdown menu:
   - Google Gemini
   - OpenAI GPT
   - Anthropic Claude
   - Mistral AI

3. **Select Specific Model**: After choosing a provider, select the specific model from the available options.

4. **Save Configuration**: The changes are automatically saved and will apply to all new conversations.

## Usage

### For Admin Users

1. **Create New Chatbot**: When creating a new chatbot, the System Prompt block will default to Gemini 2.5 Flash.

2. **Modify Existing Chatbot**: 
   - Open the chatbot in the admin interface
   - Click on the System Prompt block
   - Change the AI Model Provider and Model as needed
   - Save the configuration

3. **Test Different Models**: You can easily switch between different providers and models to find the best fit for your use case.

### For End Users

- Users will automatically use the AI model configured by the admin
- No changes are required on the user side
- All existing features (streaming, follow-up suggestions, citations) work with all providers

## Features

### Universal Support
- **Streaming Responses**: All providers support real-time streaming
- **Follow-up Suggestions**: AI-generated follow-up questions work with all providers
- **Context Integration**: Weaviate vector search works with all providers
- **Citation Support**: Source citations are maintained across all providers

### Provider-Specific Features
- **Token Usage Tracking**: Available for OpenAI, Anthropic, and Mistral
- **Custom Base URLs**: Support for self-hosted or proxy endpoints
- **Model-specific Optimizations**: Each provider is optimized for their specific API

## Cost Considerations

### Gemini
- Generally cost-effective for most use cases
- Good balance of performance and cost
- Free tier available for development

### OpenAI
- Premium pricing for advanced models
- Pay-per-token pricing
- Good for high-quality, complex tasks

### Anthropic
- Competitive pricing
- Known for helpful and harmless responses
- Good for customer-facing applications

### Mistral
- Cost-effective option
- Good performance for European users
- Open-source models available

## Migration Guide

### From Single Provider to Multi-Provider

1. **Update Environment Variables**: Add API keys for desired providers
2. **No Database Changes Required**: The system automatically handles the new configuration
3. **Gradual Migration**: You can test different providers without affecting existing chatbots
4. **Default Behavior**: Existing chatbots will continue using Gemini unless explicitly changed

### Backward Compatibility

- All existing chatbots continue to work without changes
- Default provider is Gemini 2.5 Flash
- Legacy API endpoints remain functional
- No breaking changes to existing integrations

## Troubleshooting

### Common Issues

1. **API Key Not Set**: Ensure the appropriate API key is set in environment variables
2. **Model Not Available**: Check that the selected model is available for the chosen provider
3. **Rate Limiting**: Some providers have rate limits; consider using different models or providers
4. **Network Issues**: Check network connectivity and firewall settings

### Error Handling

- The system gracefully falls back to error messages if a provider fails
- Invalid configurations are logged for debugging
- Users see friendly error messages instead of technical details

## Best Practices

### Model Selection
- **High-Volume Applications**: Use faster, more cost-effective models
- **Complex Reasoning**: Use more capable models like GPT-4 or Claude-3.5-Sonnet
- **Multilingual Support**: Consider models with better language support
- **Real-time Applications**: Use models optimized for low latency

### Cost Optimization
- Monitor token usage across different providers
- Use appropriate models for different use cases
- Consider caching for frequently asked questions
- Implement rate limiting to control costs

### Security
- Store API keys securely
- Use environment variables, not hardcoded keys
- Regularly rotate API keys
- Monitor API usage for unusual patterns

## Future Enhancements

### Planned Features
- **A/B Testing**: Test different models automatically
- **Cost Analytics**: Detailed cost tracking per provider
- **Performance Metrics**: Response time and quality metrics
- **Auto-scaling**: Automatically switch providers based on load
- **Custom Models**: Support for fine-tuned models

### Integration Opportunities
- **Azure OpenAI**: Microsoft's OpenAI service
- **AWS Bedrock**: Amazon's managed AI service
- **Google Vertex AI**: Enterprise AI platform
- **Local Models**: Support for self-hosted models

## Support

For issues related to LLM provider configuration:

1. Check the application logs for detailed error messages
2. Verify API keys are correctly set
3. Test with different models to isolate issues
4. Contact support with specific error details and configuration

## API Reference

### LLM Service Interface

```typescript
interface LLMService {
  generateResponse(
    chatbotId: string,
    systemPrompt: string,
    history: ChatMessage[],
    userMessage: string
  ): Promise<string>;

  generateStreamingResponse(
    chatbotId: string,
    systemPrompt: string,
    history: ChatMessage[],
    userMessage: string,
    res: Response,
    chatSessionId?: string
  ): Promise<string>;
}
```

### Provider Configuration

```typescript
interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
}
```

This multi-provider support makes CitadelAI more flexible and allows organizations to choose the best AI model for their specific needs while maintaining all existing functionality.