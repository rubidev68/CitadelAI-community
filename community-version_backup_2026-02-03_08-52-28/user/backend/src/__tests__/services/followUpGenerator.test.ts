import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateFollowUps } from '../../services/followUpGenerator';

// Mock LLM service
const mockLLMService = {
  generateResponse: vi.fn(),
};

vi.mock('../../services/llmService', () => ({
  createLLMService: vi.fn(() => mockLLMService),
  LLMProvider: {
    GEMINI: 'gemini',
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
    MISTRAL: 'mistral',
  },
}));

describe('FollowUp Generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate follow-up suggestions from JSON response', async () => {
    const mockResponse = JSON.stringify({
      suggestions: [
        { id: '1', text: 'Tell me more', icon: 'HelpCircle' },
        { id: '2', text: 'What else?', icon: 'Lightbulb' },
        { id: '3', text: 'Explain further', icon: 'Search' },
      ],
    });

    mockLLMService.generateResponse.mockResolvedValue(mockResponse);

    const followUps = await generateFollowUps(
      'chatbot-123',
      'System prompt',
      [],
      'User message',
      'Assistant response'
    );

    expect(followUps).toHaveLength(3);
    expect(followUps[0]).toHaveProperty('id');
    expect(followUps[0]).toHaveProperty('text');
    expect(followUps[0]).toHaveProperty('icon');
    expect(mockLLMService.generateResponse).toHaveBeenCalled();
  });

  it('should handle JSON wrapped in markdown code blocks', async () => {
    const mockResponse = `\`\`\`json
{
  "suggestions": [
    { "id": "1", "text": "Question 1", "icon": "HelpCircle" },
    { "id": "2", "text": "Question 2", "icon": "Lightbulb" },
    { "id": "3", "text": "Question 3", "icon": "Search" }
  ]
}
\`\`\``;

    mockLLMService.generateResponse.mockResolvedValue(mockResponse);

    const followUps = await generateFollowUps(
      'chatbot-123',
      'System prompt',
      [],
      'User message',
      'Assistant response'
    );

    expect(followUps).toHaveLength(3);
  });

  it('should fallback to text parsing if JSON parsing fails', async () => {
    const mockResponse = `1. First question
2. Second question
3. Third question`;

    mockLLMService.generateResponse.mockResolvedValue(mockResponse);

    const followUps = await generateFollowUps(
      'chatbot-123',
      'System prompt',
      [],
      'User message',
      'Assistant response'
    );

    expect(followUps.length).toBeGreaterThanOrEqual(3);
  });

  it('should return default suggestions on error', async () => {
    mockLLMService.generateResponse.mockRejectedValue(new Error('API Error'));

    const followUps = await generateFollowUps(
      'chatbot-123',
      'System prompt',
      [],
      'User message',
      'Assistant response'
    );

    expect(followUps).toHaveLength(3);
    expect(followUps[0].text).toBe('Tell me more about this topic');
    expect(followUps[1].text).toBe('What else can you help me with?');
    expect(followUps[2].text).toBe('Can you explain this differently?');
  });

  it('should include context in the prompt if provided', async () => {
    const mockResponse = JSON.stringify({
      suggestions: [
        { id: '1', text: 'Question 1', icon: 'HelpCircle' },
        { id: '2', text: 'Question 2', icon: 'Lightbulb' },
        { id: '3', text: 'Question 3', icon: 'Search' },
      ],
    });

    mockLLMService.generateResponse.mockResolvedValue(mockResponse);

    await generateFollowUps(
      'chatbot-123',
      'System prompt',
      [],
      'User message',
      'Assistant response',
      'Some context'
    );

    const callArgs = mockLLMService.generateResponse.mock.calls[0];
    expect(callArgs[3]).toContain('Some context');
  });

  it('should use custom LLM provider and model', async () => {
    const mockResponse = JSON.stringify({
      suggestions: [
        { id: '1', text: 'Question 1', icon: 'HelpCircle' },
        { id: '2', text: 'Question 2', icon: 'Lightbulb' },
        { id: '3', text: 'Question 3', icon: 'Search' },
      ],
    });

    mockLLMService.generateResponse.mockResolvedValue(mockResponse);

    await generateFollowUps(
      'chatbot-123',
      'System prompt',
      [],
      'User message',
      'Assistant response',
      undefined,
      'openai',
      'gpt-5-mini'
    );

    expect(mockLLMService.generateResponse).toHaveBeenCalled();
  });

  it('should handle JSON wrapped in non-json code blocks', async () => {
    const mockResponse = `\`\`\`
{
  "suggestions": [
    { "id": "1", "text": "Question 1", "icon": "HelpCircle" },
    { "id": "2", "text": "Question 2", "icon": "Lightbulb" },
    { "id": "3", "text": "Question 3", "icon": "Search" }
  ]
}
\`\`\``;

    mockLLMService.generateResponse.mockResolvedValue(mockResponse);

    const followUps = await generateFollowUps(
      'chatbot-123',
      'System prompt',
      [],
      'User message',
      'Assistant response'
    );

    expect(followUps).toHaveLength(3);
  });

  it('should handle string suggestions in JSON array', async () => {
    const mockResponse = JSON.stringify({
      suggestions: [
        'First question',
        'Second question',
        'Third question',
      ],
    });

    mockLLMService.generateResponse.mockResolvedValue(mockResponse);

    const followUps = await generateFollowUps(
      'chatbot-123',
      'System prompt',
      [],
      'User message',
      'Assistant response'
    );

    expect(followUps).toHaveLength(3);
    expect(followUps[0].text).toBe('First question');
    expect(followUps[0].icon).toBe('MessageSquare');
  });

  it('should add default suggestions when text parsing yields fewer than 3', async () => {
    const mockResponse = `Short`;

    mockLLMService.generateResponse.mockResolvedValue(mockResponse);

    const followUps = await generateFollowUps(
      'chatbot-123',
      'System prompt',
      [],
      'User message',
      'Assistant response'
    );

    expect(followUps).toHaveLength(3);
    // Should include defaults since "Short" is too short (length <= 5)
    expect(followUps.some(f => f.text.includes('Tell me more'))).toBe(true);
    expect(followUps.some(f => f.text.includes('What else'))).toBe(true);
    expect(followUps.some(f => f.text.includes('explain this differently'))).toBe(true);
  });

  it('should handle suggestions with missing id or text fields', async () => {
    const mockResponse = JSON.stringify({
      suggestions: [
        { id: '1', text: 'Question 1' },
        { text: 'Question 2' }, // Missing id
        { id: '3' }, // Missing text
      ],
    });

    mockLLMService.generateResponse.mockResolvedValue(mockResponse);

    const followUps = await generateFollowUps(
      'chatbot-123',
      'System prompt',
      [],
      'User message',
      'Assistant response'
    );

    expect(followUps).toHaveLength(3);
    expect(followUps[0].id).toBe('1');
    expect(followUps[0].text).toBe('Question 1');
    expect(followUps[1].id).toBeDefined(); // Should generate id
    expect(followUps[1].text).toBe('Question 2');
    expect(followUps[2].id).toBe('3');
    expect(followUps[2].text).toBeDefined(); // Should have text
  });

  it('should handle empty or very short lines in text parsing', async () => {
    const mockResponse = `1. 
2. Short
3. This is a longer question that should be included`;

    mockLLMService.generateResponse.mockResolvedValue(mockResponse);

    const followUps = await generateFollowUps(
      'chatbot-123',
      'System prompt',
      [],
      'User message',
      'Assistant response'
    );

    // Should skip lines that are too short (length <= 5)
    expect(followUps).toHaveLength(3);
    expect(followUps.some(f => f.text.includes('longer question'))).toBe(true);
  });
});
