import { ChatMessage } from '@prisma/client';
import { Response } from 'express';
import { logger } from '@shared/utils';
import { LLMConfig, LLMResponse, LLMProviderInterface } from '../types';

// Anthropic implementation
export class AnthropicProvider implements LLMProviderInterface {
  private apiKey: string;

  constructor(config: LLMConfig) {
    this.apiKey = config.apiKey;
  }

  private mapRoleToAnthropic = (role: string): 'user' | 'assistant' => {
    return role === 'USER' ? 'user' : 'assistant';
  };

  async generateResponse(
    systemPrompt: string,
    history: ChatMessage[],
    userMessage: string,
    model: string
  ): Promise<LLMResponse> {
    const messages = history
      .filter(msg => msg.role !== 'SYSTEM')
      .map(msg => ({
        role: this.mapRoleToAnthropic(msg.role),
        content: msg.content
      }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          ...messages,
          { role: 'user', content: userMessage }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json() as {
      content: Array<{ text: string }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
      };
    };
    
    // Transform usage to match LLMResponse interface
    let usage: LLMResponse['usage'] | undefined;
    if (data.usage) {
      const inputTokens = data.usage.input_tokens ?? 0;
      const outputTokens = data.usage.output_tokens ?? 0;
      usage = {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
      };
    }

    return {
      content: data.content[0].text,
      usage
    };
  }

  async generateStreamingResponse(
    systemPrompt: string,
    history: ChatMessage[],
    userMessage: string,
    model: string,
    res: Response
  ): Promise<{ content: string; usage?: LLMResponse['usage'] }> {
    const messages = history
      .filter(msg => msg.role !== 'SYSTEM')
      .map(msg => ({
        role: this.mapRoleToAnthropic(msg.role),
        content: msg.content
      }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          ...messages,
          { role: 'user', content: userMessage }
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
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
              return { content: fullResponse };
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.delta?.text;
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

    return { content: fullResponse };
  }
}