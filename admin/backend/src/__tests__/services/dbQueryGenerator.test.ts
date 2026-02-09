import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSqlQuery } from '../../services/dbQueryGenerator';
import { generateResponse } from '../../services/llmHelper';
import { DatabaseSchema } from '@shared/services';

// Mock dependencies
vi.mock('../../services/llmHelper', () => ({
  generateResponse: vi.fn(),
}));

describe('DB Query Generator', () => {
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

  describe('generateSqlQuery', () => {
    it('should generate SQL query from user message', async () => {
      const userMessage = 'Show me all users';
      const expectedQuery = 'SELECT * FROM users LIMIT 100';
      vi.mocked(generateResponse).mockResolvedValue(expectedQuery);

      const result = await generateSqlQuery(userMessage, mockSchema);

      expect(generateResponse).toHaveBeenCalledWith(
        'You are a SQL query expert. Generate safe, read-only SELECT queries.',
        [],
        expect.stringContaining('User Question: "Show me all users"'),
        'gemini',
        undefined
      );
      expect(result).toBe(expectedQuery);
    });

    it('should include schema information in prompt', async () => {
      const userMessage = 'Get user orders';
      vi.mocked(generateResponse).mockResolvedValue('SELECT * FROM orders LIMIT 100');

      await generateSqlQuery(userMessage, mockSchema);

      const prompt = vi.mocked(generateResponse).mock.calls[0][2] as string;
      expect(prompt).toContain('Table: users');
      expect(prompt).toContain('Table: orders');
      expect(prompt).toContain('id (INTEGER) [PRIMARY KEY]');
      expect(prompt).toContain('user_id (INTEGER) [FK -> users.id]');
    });

    it('should clean markdown code blocks from response', async () => {
      const userMessage = 'Get users';
      const responseWithMarkdown = '```sql\nSELECT * FROM users LIMIT 100\n```';
      vi.mocked(generateResponse).mockResolvedValue(responseWithMarkdown);

      const result = await generateSqlQuery(userMessage, mockSchema);

      expect(result).toBe('SELECT * FROM users LIMIT 100');
      expect(result).not.toContain('```');
    });

    it('should handle response with sql code block', async () => {
      const userMessage = 'Get users';
      const responseWithSqlBlock = '```sql\nSELECT * FROM users\n```';
      vi.mocked(generateResponse).mockResolvedValue(responseWithSqlBlock);

      const result = await generateSqlQuery(userMessage, mockSchema);

      expect(result).toBe('SELECT * FROM users');
    });

    it('should handle response with plain code block', async () => {
      const userMessage = 'Get users';
      const responseWithPlainBlock = '```\nSELECT * FROM users\n```';
      vi.mocked(generateResponse).mockResolvedValue(responseWithPlainBlock);

      const result = await generateSqlQuery(userMessage, mockSchema);

      expect(result).toBe('SELECT * FROM users');
    });

    it('should trim whitespace from response', async () => {
      const userMessage = 'Get users';
      const responseWithWhitespace = '   SELECT * FROM users   ';
      vi.mocked(generateResponse).mockResolvedValue(responseWithWhitespace);

      const result = await generateSqlQuery(userMessage, mockSchema);

      expect(result).toBe('SELECT * FROM users');
    });

    it('should throw error if generated query is not SELECT', async () => {
      const userMessage = 'Get users';
      const invalidQuery = 'UPDATE users SET name = "test"';
      vi.mocked(generateResponse).mockResolvedValue(invalidQuery);

      await expect(generateSqlQuery(userMessage, mockSchema)).rejects.toThrow(
        'Generated query is not a SELECT query'
      );
    });

    it('should throw error if LLM generation fails', async () => {
      const userMessage = 'Get users';
      vi.mocked(generateResponse).mockRejectedValue(new Error('LLM API error'));

      await expect(generateSqlQuery(userMessage, mockSchema)).rejects.toThrow(
        'Failed to generate SQL query: LLM API error'
      );
    });

    it('should use custom LLM provider', async () => {
      const userMessage = 'Get users';
      vi.mocked(generateResponse).mockResolvedValue('SELECT * FROM users LIMIT 100');

      await generateSqlQuery(userMessage, mockSchema, 'openai');

      expect(generateResponse).toHaveBeenCalledWith(
        expect.any(String),
        [],
        expect.any(String),
        'openai',
        undefined
      );
    });

    it('should use custom LLM model', async () => {
      const userMessage = 'Get users';
      vi.mocked(generateResponse).mockResolvedValue('SELECT * FROM users LIMIT 100');

      await generateSqlQuery(userMessage, mockSchema, 'openai', 'gpt-4');

      expect(generateResponse).toHaveBeenCalledWith(
        expect.any(String),
        [],
        expect.any(String),
        'openai',
        'gpt-4'
      );
    });

    it('should include row counts in schema description', async () => {
      const userMessage = 'Get users';
      vi.mocked(generateResponse).mockResolvedValue('SELECT * FROM users LIMIT 100');

      await generateSqlQuery(userMessage, mockSchema);

      const prompt = vi.mocked(generateResponse).mock.calls[0][2] as string;
      expect(prompt).toContain('Table: users (100 rows)');
      expect(prompt).toContain('Table: orders (500 rows)');
    });

    it('should include foreign key relationships', async () => {
      const userMessage = 'Get orders with users';
      vi.mocked(generateResponse).mockResolvedValue('SELECT * FROM orders JOIN users ON orders.user_id = users.id LIMIT 100');

      await generateSqlQuery(userMessage, mockSchema);

      const prompt = vi.mocked(generateResponse).mock.calls[0][2] as string;
      expect(prompt).toContain('user_id (INTEGER) [FK -> users.id]');
      expect(prompt).toContain('Foreign Keys:');
      expect(prompt).toContain('user_id -> users.id');
    });

    it('should handle schema with no tables', async () => {
      const emptySchema: DatabaseSchema = { tables: [] };
      const userMessage = 'Get data';
      vi.mocked(generateResponse).mockResolvedValue('SELECT 1');

      await generateSqlQuery(userMessage, emptySchema);

      const prompt = vi.mocked(generateResponse).mock.calls[0][2] as string;
      expect(prompt).toContain('Database Schema:');
      expect(prompt).toContain('User Question: "Get data"');
    });

    it('should handle case-insensitive SELECT check', async () => {
      const userMessage = 'Get users';
      const lowercaseSelect = 'select * from users';
      vi.mocked(generateResponse).mockResolvedValue(lowercaseSelect);

      const result = await generateSqlQuery(userMessage, mockSchema);

      expect(result).toBe('select * from users');
    });
  });
});
