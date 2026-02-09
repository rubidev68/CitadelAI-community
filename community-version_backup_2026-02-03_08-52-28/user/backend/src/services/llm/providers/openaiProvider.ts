import { ChatMessage } from '@prisma/client';
import { Response } from 'express';
import { logger } from '@shared/utils';
import { LLMConfig, LLMResponse, LLMProviderInterface } from '../types';

// OpenAI implementation
export class OpenAIProvider implements LLMProviderInterface {
  private apiKey: string;
  private baseUrl?: string;

  constructor(config: LLMConfig) {
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
    // Use Responses API for modern models (gpt-5*, gpt-4.1*, gpt-4o*) and fallback to Chat Completions for legacy
    const useResponsesAPI = /^(gpt-5|gpt-4\.1|gpt-4o)/.test(model);

    if (useResponsesAPI) {
      const input = [
        { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
        ...history.map(msg => {
          const role = this.mapRoleToOpenAI(msg.role);
          const isAssistant = role === 'assistant';
          return {
            role,
            content: [
              {
                // Responses API attend 'input_text' pour les entrées utilisateur/système
                // et 'output_text' pour l'historique assistant
                type: isAssistant ? 'output_text' : 'input_text',
                text: msg.content
              }
            ]
          };
        }),
        { role: 'user', content: [{ type: 'input_text', text: userMessage }] }
      ];

      const response = await fetch(`${this.baseUrl || 'https://api.openai.com'}/v1/responses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input,
          max_output_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}${errText ? ` - ${errText}` : ''}`);
      }

      const data = await response.json() as {
        output_text?: string;
        output?: Array<{ content?: Array<{ text?: string }> }>;
        content?: Array<{ text?: string }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          input_tokens?: number;
          output_tokens?: number;
        };
      };
      const content = data.output_text
        || data.output?.map((o) => o?.content?.map((c) => c?.text).filter(Boolean).join('')).filter(Boolean).join('')
        || data.content?.map((c) => c?.text).filter(Boolean).join('')
        || '';

      // Transform usage to match LLMResponse interface
      let usage: LLMResponse['usage'] | undefined;
      if (data.usage) {
        // Handle different usage formats
        if ('prompt_tokens' in data.usage || 'completion_tokens' in data.usage || 'total_tokens' in data.usage) {
          usage = {
            promptTokens: (data.usage as { prompt_tokens?: number }).prompt_tokens ?? 0,
            completionTokens: (data.usage as { completion_tokens?: number }).completion_tokens ?? 0,
            totalTokens: (data.usage as { total_tokens?: number }).total_tokens ?? 0,
          };
        } else if ('input_tokens' in data.usage || 'output_tokens' in data.usage) {
          const inputTokens = (data.usage as { input_tokens?: number }).input_tokens ?? 0;
          const outputTokens = (data.usage as { output_tokens?: number }).output_tokens ?? 0;
          usage = {
            promptTokens: inputTokens,
            completionTokens: outputTokens,
            totalTokens: inputTokens + outputTokens,
          };
        }
      }

      return {
        content,
        usage
      };
    } else {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(msg => ({
          role: this.mapRoleToOpenAI(msg.role),
          content: msg.content
        })),
        { role: 'user', content: userMessage }
      ];

      const response = await fetch(`${this.baseUrl || 'https://api.openai.com'}/v1/chat/completions`, {
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
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}${errText ? ` - ${errText}` : ''}`);
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
        content: data.choices[0].message.content,
        usage
      };
    }
  }

  async generateStreamingResponse(
    systemPrompt: string,
    history: ChatMessage[],
    userMessage: string,
    model: string,
    res: Response
  ): Promise<string> {
    const useResponsesAPI = /^(gpt-5|gpt-4\.1|gpt-4o)/.test(model);

    // Prepare request and endpoint
    let requestUrl = '';
    let body: { model: string; [key: string]: unknown } = { model };

    if (useResponsesAPI) {
      requestUrl = `${this.baseUrl || 'https://api.openai.com'}/v1/responses`;
      body.input = [
        { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
        ...history.map(msg => {
          const role = this.mapRoleToOpenAI(msg.role);
          const isAssistant = role === 'assistant';
          return {
            role,
            content: [
              {
                type: isAssistant ? 'output_text' : 'input_text',
                text: msg.content
              }
            ]
          };
        }),
        { role: 'user', content: [{ type: 'input_text', text: userMessage }] }
      ];
      body.max_output_tokens = 4000;
      body.stream = true;
    } else {
      requestUrl = `${this.baseUrl || 'https://api.openai.com'}/v1/chat/completions`;
      body.temperature = 0.7;
      body.messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(msg => ({
          role: this.mapRoleToOpenAI(msg.role),
          content: msg.content
        })),
        { role: 'user', content: userMessage }
      ];
      body.max_tokens = 4000;
      body.stream = true;
    }

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}${errText ? ` - ${errText}` : ''}`);
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

              // Chat Completions delta
              let content: string | undefined = parsed.choices?.[0]?.delta?.content;

              // Responses API text delta shapes
              if (!content) {
                // Common shape: { type: 'response.output_text.delta', delta: '...' }
                if (typeof parsed.delta === 'string') {
                  content = parsed.delta;
                } else if (parsed.output_text_delta) {
                  content = parsed.output_text_delta;
                } else if (parsed.type && typeof parsed.type === 'string' && parsed.type.endsWith('.delta')) {
                  // Sometimes the payload uses { type: 'response.output_text.delta', ... text fields }
                  content = parsed.text || parsed.output_text || parsed.data || undefined;
                }
              }

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