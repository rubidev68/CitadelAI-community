import { ChatMessage } from '@prisma/client';
import { Response } from 'express';
import { logger } from '@shared/utils';
import { LLMConfig, LLMResponse, LLMProviderInterface } from '../types';

// Custom provider implementation (OpenAI-compatible)
export class CustomProvider implements LLMProviderInterface {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: LLMConfig) {
    if (!config.baseUrl) {
      throw new Error('Custom provider requires baseUrl');
    }
    if (!config.apiKey) {
      throw new Error('Custom provider requires apiKey');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
  }

  private mapRoleToOpenAI = (role: string): 'user' | 'assistant' | 'system' => {
    switch (role) {
      case 'USER': return 'user';
      case 'ASSISTANT': return 'assistant';
      default: return 'user';
    }
  };

  async generateResponse(
    systemPrompt: string,
    history: ChatMessage[],
    userMessage: string,
    model: string
  ): Promise<LLMResponse> {
    // Custom providers use OpenAI-compatible Chat Completions API
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({
        role: this.mapRoleToOpenAI(msg.role),
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ];

    // Ensure baseUrl ends with /v1 if not already
    const apiBaseUrl = this.baseUrl.endsWith('/v1') 
      ? this.baseUrl 
      : this.baseUrl.endsWith('/') 
        ? `${this.baseUrl}v1` 
        : `${this.baseUrl}/v1`;

    const response = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Custom provider API error: ${response.status} ${response.statusText}${errText ? ` - ${errText}` : ''}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };
    
    // Transform usage to match LLMResponse interface
    let usage: LLMResponse['usage'] | undefined;
    if (data.usage) {
      usage = {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
        totalTokens: data.usage.total_tokens ?? 0,
      };
    }

    return {
      content: data.choices[0]?.message?.content || '',
      usage
    };
  }

  async generateStreamingResponse(
    systemPrompt: string,
    history: ChatMessage[],
    userMessage: string,
    model: string,
    res: Response
  ): Promise<string> {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({
        role: this.mapRoleToOpenAI(msg.role),
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ];

    // Ensure baseUrl ends with /v1 if not already
    const apiBaseUrl = this.baseUrl.endsWith('/v1') 
      ? this.baseUrl 
      : this.baseUrl.endsWith('/') 
        ? `${this.baseUrl}v1` 
        : `${this.baseUrl}/v1`;

    const response = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 4000,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Custom provider API error: ${response.status} ${response.statusText}${errText ? ` - ${errText}` : ''}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    let fullResponse = '';
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') {
              res.write(`data: ${JSON.stringify({
                type: 'complete',
                fullResponse: fullResponse
              })}\n\n`);
              return fullResponse;
            }

            try {
              const parsed = JSON.parse(dataStr);
              const content = parsed.choices?.[0]?.delta?.content;

              if (content) {
                fullResponse += content;
                res.write(`data: ${JSON.stringify({
                  type: 'chunk',
                  content: content
                })}\n\n`);
              }
            } catch (_e) {
              // Ignore parsing errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error in streaming response', error instanceof Error ? error : undefined, {
        service: 'llmService',
        provider: 'custom',
      });
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: 'Streaming error occurred'
      })}\n\n`);
    }

    return fullResponse;
  }
}
