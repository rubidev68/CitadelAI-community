import { describe, it, expect } from 'vitest';
import { generateSystemPrompt } from '../../utils/systemPromptGenerator';
import { Block } from '@prisma/client';

describe('System Prompt Generator', () => {
  it('should generate prompt from system prompt block configuration', () => {
    const systemPromptBlock: Block = {
      id: 'block-123',
      chatbotId: 'chatbot-123',
      type: 'LOGIC',
      subtype: 'System Prompt',
      title: 'System Prompt',
      position: {},
      properties: {
        botName: 'TestBot',
        companyName: 'Test Company',
        behavior: 'professional',
        additionalInstructions: 'Be concise and helpful',
      },
    };

    const contextBlocks: Block[] = [];
    const context = 'Some context information';

    const prompt = generateSystemPrompt(systemPromptBlock, contextBlocks, context);

    expect(prompt).toContain('TestBot');
    expect(prompt).toContain('Test Company');
    expect(prompt).toContain('professional');
    expect(prompt).toContain('Be concise and helpful');
    expect(prompt).toContain(context);
  });

  it('should use default values when properties are missing', () => {
    const systemPromptBlock: Block = {
      id: 'block-123',
      chatbotId: 'chatbot-123',
      type: 'LOGIC',
      subtype: 'System Prompt',
      title: 'System Prompt',
      position: {},
      properties: {},
    };

    const contextBlocks: Block[] = [];
    const context = 'Some context';

    const prompt = generateSystemPrompt(systemPromptBlock, contextBlocks, context);

    expect(prompt).toContain('Assistant');
    expect(prompt).toContain('helpful');
    expect(prompt).toContain(context);
  });

  it('should include website context blocks', () => {
    const systemPromptBlock: Block = {
      id: 'block-123',
      chatbotId: 'chatbot-123',
      type: 'LOGIC',
      subtype: 'System Prompt',
      title: 'System Prompt',
      position: {},
      properties: {
        botName: 'TestBot',
      },
    };

    const contextBlocks: Block[] = [
      {
        id: 'block-456',
        chatbotId: 'chatbot-123',
        type: 'CONTEXT',
        subtype: 'Website',
        title: 'Website Context',
        position: {},
        properties: {
          url: 'https://example.com',
        },
      },
    ];

    const context = 'Some context';

    const prompt = generateSystemPrompt(systemPromptBlock, contextBlocks, context);

    expect(prompt).toContain('Website');
    expect(prompt).toContain('https://example.com');
  });

  it('should include document context blocks', () => {
    const systemPromptBlock: Block = {
      id: 'block-123',
      chatbotId: 'chatbot-123',
      type: 'LOGIC',
      subtype: 'System Prompt',
      title: 'System Prompt',
      position: {},
      properties: {
        botName: 'TestBot',
      },
    };

    const contextBlocks: Block[] = [
      {
        id: 'block-456',
        chatbotId: 'chatbot-123',
        type: 'CONTEXT',
        subtype: 'Document',
        title: 'Document Context',
        position: {},
        properties: {
          filename: 'document.pdf',
        },
      },
    ];

    const context = 'Some context';

    const prompt = generateSystemPrompt(systemPromptBlock, contextBlocks, context);

    expect(prompt).toContain('Document');
    expect(prompt).toContain('document.pdf');
  });

  it('should use manual prompt if provided', () => {
    const systemPromptBlock: Block = {
      id: 'block-123',
      chatbotId: 'chatbot-123',
      type: 'LOGIC',
      subtype: 'System Prompt',
      title: 'System Prompt',
      position: {},
      properties: {
        prompt: 'Custom manual prompt text',
      },
    };

    const contextBlocks: Block[] = [];
    const context = 'Some context';

    const prompt = generateSystemPrompt(systemPromptBlock, contextBlocks, context);

    expect(prompt).toContain('Custom manual prompt text');
    expect(prompt).toContain(context);
  });

  it('should return default prompt if no system prompt block provided', () => {
    const contextBlocks: Block[] = [];
    const context = 'Some context';

    const prompt = generateSystemPrompt(null, contextBlocks, context);

    expect(prompt).toContain('helpful assistant');
    expect(prompt).toContain(context);
  });

  it('should handle different behavior types', () => {
    const behaviors = ['helpful', 'professional', 'casual', 'technical', 'creative', 'supportive'];

    behaviors.forEach((behavior) => {
      const systemPromptBlock: Block = {
        id: 'block-123',
        chatbotId: 'chatbot-123',
        type: 'LOGIC',
        subtype: 'System Prompt',
        title: 'System Prompt',
        position: {},
        properties: {
          botName: 'TestBot',
          behavior,
        },
      };

      const prompt = generateSystemPrompt(systemPromptBlock, [], 'context');
      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
    });
  });

  it('should include multiple context blocks', () => {
    const systemPromptBlock: Block = {
      id: 'block-123',
      chatbotId: 'chatbot-123',
      type: 'LOGIC',
      subtype: 'System Prompt',
      title: 'System Prompt',
      position: {},
      properties: {
        botName: 'TestBot',
      },
    };

    const contextBlocks: Block[] = [
      {
        id: 'block-1',
        chatbotId: 'chatbot-123',
        type: 'CONTEXT',
        subtype: 'Website',
        title: 'Website 1',
        position: {},
        properties: { url: 'https://example1.com' },
      },
      {
        id: 'block-2',
        chatbotId: 'chatbot-123',
        type: 'CONTEXT',
        subtype: 'Document',
        title: 'Document 1',
        position: {},
        properties: { filename: 'doc1.pdf' },
      },
    ];

    const prompt = generateSystemPrompt(systemPromptBlock, contextBlocks, 'context');

    expect(prompt).toContain('https://example1.com');
    expect(prompt).toContain('doc1.pdf');
  });

  it('should include cloud storage context blocks', () => {
    const systemPromptBlock: Block = {
      id: 'block-123',
      chatbotId: 'chatbot-123',
      type: 'LOGIC',
      subtype: 'System Prompt',
      title: 'System Prompt',
      position: {},
      properties: {
        botName: 'TestBot',
      },
    };

    const contextBlocks: Block[] = [
      {
        id: 'block-1',
        chatbotId: 'chatbot-123',
        type: 'CONTEXT',
        subtype: 'Cloud',
        title: 'Cloud Context',
        position: {},
        properties: { provider: 'nextcloud' },
      },
      {
        id: 'block-2',
        chatbotId: 'chatbot-123',
        type: 'CONTEXT',
        subtype: 'Cloud',
        title: 'Cloud Context 2',
        position: {},
        properties: { provider: 'googledrive' },
      },
      {
        id: 'block-3',
        chatbotId: 'chatbot-123',
        type: 'CONTEXT',
        subtype: 'Cloud',
        title: 'Cloud Context 3',
        position: {},
        properties: { provider: 'onedrive' },
      },
      {
        id: 'block-4',
        chatbotId: 'chatbot-123',
        type: 'CONTEXT',
        subtype: 'Cloud',
        title: 'Cloud Context 4',
        position: {},
        properties: { provider: 'unknown' },
      },
    ];

    const prompt = generateSystemPrompt(systemPromptBlock, contextBlocks, 'context');

    expect(prompt).toContain('Nextcloud');
    expect(prompt).toContain('Google Drive');
    expect(prompt).toContain('OneDrive');
    expect(prompt).toContain('Cloud Storage');
  });

  it('should include action capabilities and disable mermaid diagrams when requested', () => {
    const systemPromptBlock: Block = {
      id: 'block-123',
      chatbotId: 'chatbot-123',
      type: 'LOGIC',
      subtype: 'System Prompt',
      title: 'System Prompt',
      position: {},
      properties: {
        botName: 'TestBot',
      },
    };

    const actionBlocks: Block[] = [
      {
        id: 'action-1',
        chatbotId: 'chatbot-123',
        type: 'ACTION',
        subtype: 'Calendar',
        title: 'Calendar Actions',
        position: {},
        properties: {
          actionConfig: {
            allowedActions: ['create', 'update', 'delete'],
          },
        },
      },
      {
        id: 'action-2',
        chatbotId: 'chatbot-123',
        type: 'ACTION',
        subtype: 'Send email',
        title: 'Email Actions',
        position: {},
        properties: {},
      },
      {
        id: 'action-3',
        chatbotId: 'chatbot-123',
        type: 'ACTION',
        subtype: 'DB',
        title: 'DB Actions',
        position: {},
        properties: {},
      },
    ];

    const prompt = generateSystemPrompt(systemPromptBlock, [], 'context', false, actionBlocks);

    expect(prompt).toContain('## Action Capabilities');
    expect(prompt).toContain('Calendar Management');
    expect(prompt).toContain('create calendar events');
    expect(prompt).toContain('update calendar events');
    expect(prompt).toContain('delete calendar events');
    expect(prompt).toContain('Email');
    expect(prompt).toContain('Database Operations');
    // When includeMermaidDiagrams is false, we should not mention mermaid code blocks
    expect(prompt).not.toContain('```mermaid');
  });
});
