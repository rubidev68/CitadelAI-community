import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateExampleQueries, ExampleQuery } from '../../services/dbExampleQueryGenerator';
import { generateResponse } from '../../services/llmHelper';
import { DatabaseSchema } from '@shared/services';

// Mock dependencies
vi.mock('../../services/llmHelper', () => ({
  generateResponse: vi.fn(),
}));

describe('DB Example Query Generator', () => {
  const mockSchema: DatabaseSchema = {
    tables: [
      {
        name: 'users',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
          { name: 'name', type: 'VARCHAR(255)', nullable: false, isPrimaryKey: false, isForeignKey: false },
          { name: 'email', type: 'VARCHAR(255)', nullable: true, isPrimaryKey: false, isForeignKey: false },
        ],
        foreignKeys: [],
        rowCount: 100,
      },
      {
        name: 'orders',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isForeignKey: false },
          { name: 'user_id', type: 'INTEGER', nullable: false, isPrimaryKey: false, isForeignKey: true },
          { name: 'total', type: 'DECIMAL(10,2)', nullable: false, isPrimaryKey: false, isForeignKey: false },
        ],
        foreignKeys: [
          { column: 'user_id', referencedTable: 'users', referencedColumn: 'id' },
        ],
        rowCount: 500,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateExampleQueries', () => {
    it('should generate example queries from LLM', async () => {
      const mockResponse = JSON.stringify([
        { question: 'Show me all users', description: 'List all users' },
        { question: 'What are my orders?', description: 'Get user orders' },
      ]);
      vi.mocked(generateResponse).mockResolvedValue(mockResponse);

      const result = await generateExampleQueries(mockSchema, 2);

      expect(generateResponse).toHaveBeenCalledWith(
        'You are a chatbot conversation designer. Generate natural language example questions users would ask.',
        [],
        expect.stringContaining('Database Schema:'),
        'gemini',
        undefined
      );
      expect(result).toHaveLength(2);
      expect(result[0].question).toBe('Show me all users');
    });

    it('should clean markdown code blocks from response', async () => {
      const responseWithMarkdown = '```json\n[{"question":"Test question"}]\n```';
      vi.mocked(generateResponse).mockResolvedValue(responseWithMarkdown);

      const result = await generateExampleQueries(mockSchema, 1);

      expect(result).toHaveLength(1);
      expect(result[0].question).toBe('Test question');
    });

    it('should clean json code blocks', async () => {
      const responseWithJsonBlock = '```json\n[{"question":"Test"}]\n```';
      vi.mocked(generateResponse).mockResolvedValue(responseWithJsonBlock);

      const result = await generateExampleQueries(mockSchema, 1);

      expect(result).toHaveLength(1);
    });

    it('should validate query structure', async () => {
      const invalidResponse = JSON.stringify([
        { description: 'Missing question' },
      ]);
      vi.mocked(generateResponse).mockResolvedValue(invalidResponse);

      // Should fallback to generated examples
      const result = await generateExampleQueries(mockSchema, 1);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should use custom LLM provider', async () => {
      const mockResponse = JSON.stringify([{ question: 'Test' }]);
      vi.mocked(generateResponse).mockResolvedValue(mockResponse);

      await generateExampleQueries(mockSchema, 1, 'openai');

      expect(generateResponse).toHaveBeenCalledWith(
        expect.any(String),
        [],
        expect.any(String),
        'openai',
        undefined
      );
    });

    it('should use custom LLM model', async () => {
      const mockResponse = JSON.stringify([{ question: 'Test' }]);
      vi.mocked(generateResponse).mockResolvedValue(mockResponse);

      await generateExampleQueries(mockSchema, 1, 'openai', 'gpt-4');

      expect(generateResponse).toHaveBeenCalledWith(
        expect.any(String),
        [],
        expect.any(String),
        'openai',
        'gpt-4'
      );
    });

    it('should return fallback examples on LLM error', async () => {
      vi.mocked(generateResponse).mockRejectedValue(new Error('LLM error'));

      const result = await generateExampleQueries(mockSchema, 5);

      // Should return fallback examples
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].question).toBeDefined();
    });

    it('should return fallback examples on JSON parse error', async () => {
      vi.mocked(generateResponse).mockResolvedValue('Invalid JSON');

      const result = await generateExampleQueries(mockSchema, 5);

      // Should return fallback examples
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate fallback examples for empty schema', async () => {
      const emptySchema: DatabaseSchema = { tables: [] };
      vi.mocked(generateResponse).mockRejectedValue(new Error('Error'));

      const result = await generateExampleQueries(emptySchema, 5);

      expect(result).toEqual([]);
    });

    it('should include schema information in prompt', async () => {
      const mockResponse = JSON.stringify([{ question: 'Test' }]);
      vi.mocked(generateResponse).mockResolvedValue(mockResponse);

      await generateExampleQueries(mockSchema, 1);

      const prompt = vi.mocked(generateResponse).mock.calls[0][2] as string;
      expect(prompt).toContain('Table: users');
      expect(prompt).toContain('Table: orders');
      expect(prompt).toContain('user_id (INTEGER) [FK -> users.id]');
    });

    it('should request correct number of examples', async () => {
      const mockResponse = JSON.stringify([
        { question: 'Q1' },
        { question: 'Q2' },
        { question: 'Q3' },
      ]);
      vi.mocked(generateResponse).mockResolvedValue(mockResponse);

      await generateExampleQueries(mockSchema, 3);

      const prompt = vi.mocked(generateResponse).mock.calls[0][2] as string;
      expect(prompt).toContain('Generate 3 diverse');
    });

    it('should handle fallback examples with multiple tables', async () => {
      vi.mocked(generateResponse).mockRejectedValue(new Error('Error'));

      const result = await generateExampleQueries(mockSchema, 5);

      // Should generate fallback examples for first 3 tables
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(6); // 2 examples per table, max 3 tables
    });
  });
});
