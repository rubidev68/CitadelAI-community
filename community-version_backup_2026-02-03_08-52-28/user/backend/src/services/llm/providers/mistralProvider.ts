import { ChatMessage } from '@prisma/client';
import { Response } from 'express';
import { logger } from '@shared/utils';
import { LLMConfig, LLMResponse, LLMProviderInterface } from '../types';

// Mistral implementation
export class MistralProvider implements LLMProviderInterface {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: LLMConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.mistral.ai';
  }

  private mapRoleToMistral = (role: string): 'user' | 'assistant' => {
    return role === 'USER' ? 'user' : 'assistant';
  };

  // Map UI model names to Mistral API model names
  private mapModelToMistralAPI = (model: string): string => {
    if (model === 'mistral-medium') {
      return 'mistral-medium-latest';
    }
    return model;
  };

  async generateResponse(
    systemPrompt: string,
    history: ChatMessage[],
    userMessage: string,
    model: string
  ): Promise<LLMResponse> {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({
        role: this.mapRoleToMistral(msg.role),
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ];

    const apiModel = this.mapModelToMistralAPI(model);

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: apiModel,
        messages,
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices[0].message.content,
      usage: data.usage
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
        role: this.mapRoleToMistral(msg.role),
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ];

    const apiModel = this.mapModelToMistralAPI(model);

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: apiModel,
        messages,
        temperature: 0.7,
        max_tokens: 4000,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const errorMessage = errorText ? `${response.status} ${response.statusText} - ${errorText}` : `${response.status} ${response.statusText}`;
      throw new Error(`Mistral API error: ${errorMessage}`);
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
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              res.write(`data: ${JSON.stringify({
                type: 'complete',
                fullResponse: fullResponse
              })}\n\n`);
              return fullResponse;
            }

            try {
              const parsed = JSON.parse(data);
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
      });
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: 'Streaming error occurred'
      })}\n\n`);
    }

    return fullResponse;
  }
}