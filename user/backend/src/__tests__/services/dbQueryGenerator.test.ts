import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSqlQuery } from '../../services/dbQueryGenerator';
import { DatabaseSchema, TableSchema } from '../../services/dbSchemaDiscovery';

// Mock llmService
const { mockLLMService } = vi.hoisted(() => {
  const mockGenerateResponse = vi.fn();
  const mockLLMService = {
    generateResponse: mockGenerateResponse,
  };
  return { mockLLMService, mockGenerateResponse };
});

vi.mock('../../services/llmService', () => ({
  createLLMService: vi.fn(() => mockLLMService),
  LLMProvider: {
    GEMINI: 'gemini',
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
    MISTRAL: 'mistral',
  },
}));

describe('DB Query Generator', () => {
  const mockSchema: DatabaseSchema = {
    tables: [
      {
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'INTEGER',
            nullable: false,
            isPrimaryKey: true,
            isForeignKey: false,
          },
          {
            name: 'email',
            type: 'VARCHAR(255)',
            nullable: false,
            isPrimaryKey: false,
            isForeignKey: false,
          },
          {
            name: 'name',
            type: 'VARCHAR(255)',
            nullable: true,
            isPrimaryKey: false,
            isForeignKey: false,
          },
        ],
        primaryKeys: ['id'],
        foreignKeys: [],
        indexes: [],
        rowCount: 100,
      },
      {
        name: 'orders',
        columns: [
          {
            name: 'id',
            type: 'INTEGER',
            nullable: false,
            isPrimaryKey: true,
            isForeignKey: false,
          },
          {
            name: 'user_id',
            type: 'INTEGER',
            nullable: false,
            isPrimaryKey: false,
            isForeignKey: true,
          },
          {
            name: 'total',
            type: 'DECIMAL(10,2)',
            nullable: false,
            isPrimaryKey: false,
            isForeignKey: false,
          },
        ],
        primaryKeys: ['id'],
        foreignKeys: [
          {
            column: 'user_id',
            referencedTable: 'users',
            referencedColumn: 'id',
          },
        ],
        indexes: [],
        rowCount: 500,
      },
    ],
    discoveredAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSqlQuery', () => {
    it('should generate a SELECT query from user message', async () => {
      const userMessage = 'Show me all users';
      const expectedQuery = 'SELECT * FROM users LIMIT 100';

      mockLLMService.generateResponse.mockResolvedValue(expectedQuery);

      const result = await generateSqlQuery(userMessage, mockSchema);

      expect(result).toBe(expectedQuery);
      expect(mockLLMService.generateResponse).toHaveBeenCalledWith(
        'db-query-generator',
        'You are a SQL query expert. Generate safe, read-only SELECT queries.',
        [],
        expect.stringContaining('Database Schema:')
      );
    });

    it('should include schema description in prompt', async () => {
      const userMessage = 'Show me all users';
      mockLLMService.generateResponse.mockResolvedValue('SELECT * FROM users LIMIT 100');

      await generateSqlQuery(userMessage, mockSchema);

      const callArgs = mockLLMService.generateResponse.mock.calls[0];
      const prompt = callArgs[3];

      expect(prompt).toContain('Database Schema:');
      expect(prompt).toContain('Table: users');
      expect(prompt).toContain('Table: orders');
      expect(prompt).toContain('Columns:');
      expect(prompt).toContain('- id (INTEGER) [PRIMARY KEY]');
      expect(prompt).toContain('- email (VARCHAR(255)) [NOT NULL]');
      expect(prompt).toContain('- name (VARCHAR(255))');
      expect(prompt).toContain('user_id (INTEGER) [FK -> users.id]');
      expect(prompt).toContain('Foreign Keys:');
      expect(prompt).toContain('user_id -> users.id');
    });

    it('should include row counts in schema description when available', async () => {
      const userMessage = 'Show me all users';
      mockLLMService.generateResponse.mockResolvedValue('SELECT * FROM users LIMIT 100');

      await generateSqlQuery(userMessage, mockSchema);

      const callArgs = mockLLMService.generateResponse.mock.calls[0];
      const prompt = callArgs[3];

      expect(prompt).toContain('Table: users (100 rows)');
      expect(prompt).toContain('Table: orders (500 rows)');
    });

    it('should include user message in prompt', async () => {
      const userMessage = 'Show me orders for user 123';
      mockLLMService.generateResponse.mockResolvedValue('SELECT * FROM orders WHERE user_id = :userId LIMIT 100');

      await generateSqlQuery(userMessage, mockSchema);

      const callArgs = mockLLMService.generateResponse.mock.calls[0];
      const prompt = callArgs[3];

      expect(prompt).toContain(`User Question: "${userMessage}"`);
    });

    it('should remove markdown code blocks from LLM response', async () => {
      const userMessage = 'Show me all users';
      const llmResponse = '```sql\nSELECT * FROM users LIMIT 100\n```';
      mockLLMService.generateResponse.mockResolvedValue(llmResponse);

      const result = await generateSqlQuery(userMessage, mockSchema);

      expect(result).toBe('SELECT * FROM users LIMIT 100');
    });

    it('should remove markdown code blocks with just ```', async () => {
      const userMessage = 'Show me all users';
      const llmResponse = '```\nSELECT * FROM users LIMIT 100\n```';
      mockLLMService.generateResponse.mockResolvedValue(llmResponse);

      const result = await generateSqlQuery(userMessage, mockSchema);

      expect(result).toBe('SELECT * FROM users LIMIT 100');
    });

    it('should handle response with only opening code block', async () => {
      const userMessage = 'Show me all users';
      const llmResponse = '```sql\nSELECT * FROM users LIMIT 100';
      mockLLMService.generateResponse.mockResolvedValue(llmResponse);

      const result = await generateSqlQuery(userMessage, mockSchema);

      expect(result).toBe('SELECT * FROM users LIMIT 100');
    });

    it('should handle response with only closing code block', async () => {
      const userMessage = 'Show me all users';
      const llmResponse = 'SELECT * FROM users LIMIT 100\n```';
      mockLLMService.generateResponse.mockResolvedValue(llmResponse);

      const result = await generateSqlQuery(userMessage, mockSchema);

      expect(result).toBe('SELECT * FROM users LIMIT 100');
    });

    it('should trim whitespace from response', async () => {
      const userMessage = 'Show me all users';
      const llmResponse = '   SELECT * FROM users LIMIT 100   ';
      mockLLMService.generateResponse.mockResolvedValue(llmResponse);

      const result = await generateSqlQuery(userMessage, mockSchema);

      expect(result).toBe('SELECT * FROM users LIMIT 100');
    });

    it('should validate that generated query is a SELECT query', async () => {
      const userMessage = 'Show me all users';
      const invalidQuery = 'DELETE FROM users';
      mockLLMService.generateResponse.mockResolvedValue(invalidQuery);

      await expect(generateSqlQuery(userMessage, mockSchema)).rejects.toThrow(
        'Generated query is not a SELECT query'
      );
    });

    it('should validate SELECT query case-insensitively', async () => {
      const userMessage = 'Show me all users';
      const query = 'select * from users limit 100';
      mockLLMService.generateResponse.mockResolvedValue(query);

      const result = await generateSqlQuery(userMessage, mockSchema);

      expect(result).toBe(query);
    });

    it('should handle SELECT query with leading whitespace', async () => {
      const userMessage = 'Show me all users';
      const query = '  SELECT * FROM users LIMIT 100';
      mockLLMService.generateResponse.mockResolvedValue(query);

      const result = await generateSqlQuery(userMessage, mockSchema);

      expect(result).toBe('SELECT * FROM users LIMIT 100');
    });

    it('should use default gemini provider when not specified', async () => {
      const userMessage = 'Show me all users';
      mockLLMService.generateResponse.mockResolvedValue('SELECT * FROM users LIMIT 100');

      await generateSqlQuery(userMessage, mockSchema);

      const { createLLMService } = await import('../../services/llmService');
      expect(createLLMService).toHaveBeenCalledWith('gemini', undefined);
    });

    it('should use specified LLM provider', async () => {
      const userMessage = 'Show me all users';
      mockLLMService.generateResponse.mockResolvedValue('SELECT * FROM users LIMIT 100');

      await generateSqlQuery(userMessage, mockSchema, 'openai');

      const { createLLMService } = await import('../../services/llmService');
      expect(createLLMService).toHaveBeenCalledWith('openai', undefined);
    });

    it('should use specified LLM model', async () => {
      const userMessage = 'Show me all users';
      mockLLMService.generateResponse.mockResolvedValue('SELECT * FROM users LIMIT 100');

      await generateSqlQuery(userMessage, mockSchema, 'openai', 'gpt-4');

      const { createLLMService } = await import('../../services/llmService');
      expect(createLLMService).toHaveBeenCalledWith('openai', 'gpt-4');
    });

    it('should handle all LLM providers', async () => {
      const userMessage = 'Show me all users';
      const providers: Array<'gemini' | 'openai' | 'anthropic' | 'mistral'> = [
        'gemini',
        'openai',
        'anthropic',
        'mistral',
      ];

      for (const provider of providers) {
        vi.clearAllMocks();
        mockLLMService.generateResponse.mockResolvedValue('SELECT * FROM users LIMIT 100');

        await generateSqlQuery(userMessage, mockSchema, provider);

        const { createLLMService } = await import('../../services/llmService');
        expect(createLLMService).toHaveBeenCalledWith(provider, undefined);
      }
    });

    it('should handle LLM service errors', async () => {
      const userMessage = 'Show me all users';
      const error = new Error('LLM service error');
      mockLLMService.generateResponse.mockRejectedValue(error);

      await expect(generateSqlQuery(userMessage, mockSchema)).rejects.toThrow(
        'Failed to generate SQL query: LLM service error'
      );
    });

    it('should handle non-Error exceptions from LLM service', async () => {
      const userMessage = 'Show me all users';
      mockLLMService.generateResponse.mockRejectedValue('String error');

      await expect(generateSqlQuery(userMessage, mockSchema)).rejects.toThrow(
        'Failed to generate SQL query: Unknown error'
      );
    });

    it('should format schema with foreign keys correctly', async () => {
      const schemaWithFK: DatabaseSchema = {
        tables: [
          {
            name: 'orders',
            columns: [
              {
                name: 'user_id',
                type: 'INTEGER',
                nullable: false,
                isPrimaryKey: false,
                isForeignKey: true,
              },
            ],
            primaryKeys: [],
            foreignKeys: [
              {
                column: 'user_id',
                referencedTable: 'users',
                referencedColumn: 'id',
              },
            ],
            indexes: [],
          },
        ],
        discoveredAt: '2024-01-01T00:00:00Z',
      };

      const userMessage = 'Show me orders';
      mockLLMService.generateResponse.mockResolvedValue('SELECT * FROM orders LIMIT 100');

      await generateSqlQuery(userMessage, schemaWithFK);

      const callArgs = mockLLMService.generateResponse.mock.calls[0];
      const prompt = callArgs[3];

      expect(prompt).toContain('user_id (INTEGER) [FK -> users.id]');
      expect(prompt).toContain('Foreign Keys:');
      expect(prompt).toContain('user_id -> users.id');
    });

    it('should format schema without row counts when not available', async () => {
      const schemaWithoutRowCount: DatabaseSchema = {
        tables: [
          {
            name: 'users',
            columns: [
              {
                name: 'id',
                type: 'INTEGER',
                nullable: false,
                isPrimaryKey: true,
                isForeignKey: false,
              },
            ],
            primaryKeys: ['id'],
            foreignKeys: [],
            indexes: [],
            // rowCount is undefined
          },
        ],
        discoveredAt: '2024-01-01T00:00:00Z',
      };

      const userMessage = 'Show me users';
      mockLLMService.generateResponse.mockResolvedValue('SELECT * FROM users LIMIT 100');

      await generateSqlQuery(userMessage, schemaWithoutRowCount);

      const callArgs = mockLLMService.generateResponse.mock.calls[0];
      const prompt = callArgs[3];

      expect(prompt).toContain('Table: users');
      expect(prompt).not.toContain('Table: users (');
    });

    it('should format schema with nullable columns correctly', async () => {
      const schemaWithNullable: DatabaseSchema = {
        tables: [
          {
            name: 'users',
            columns: [
              {
                name: 'id',
                type: 'INTEGER',
                nullable: false,
                isPrimaryKey: true,
                isForeignKey: false,
              },
              {
                name: 'name',
                type: 'VARCHAR(255)',
                nullable: true,
                isPrimaryKey: false,
                isForeignKey: false,
              },
            ],
            primaryKeys: ['id'],
            foreignKeys: [],
            indexes: [],
          },
        ],
        discoveredAt: '2024-01-01T00:00:00Z',
      };

      const userMessage = 'Show me users';
      mockLLMService.generateResponse.mockResolvedValue('SELECT * FROM users LIMIT 100');

      await generateSqlQuery(userMessage, schemaWithNullable);

      const callArgs = mockLLMService.generateResponse.mock.calls[0];
      const prompt = callArgs[3];

      expect(prompt).toContain('- id (INTEGER) [PRIMARY KEY]');
      expect(prompt).toContain('- name (VARCHAR(255))');
      expect(prompt).not.toContain('name (VARCHAR(255)) [NOT NULL]');
    });

    it('should format schema with multiple tables correctly', async () => {
      const multiTableSchema: DatabaseSchema = {
        tables: [
          {
            name: 'users',
            columns: [
              {
                name: 'id',
                type: 'INTEGER',
                nullable: false,
                isPrimaryKey: true,
                isForeignKey: false,
              },
            ],
            primaryKeys: ['id'],
            foreignKeys: [],
            indexes: [],
          },
          {
            name: 'orders',
            columns: [
              {
                name: 'id',
                type: 'INTEGER',
                nullable: false,
                isPrimaryKey: true,
                isForeignKey: false,
              },
            ],
            primaryKeys: ['id'],
            foreignKeys: [],
            indexes: [],
          },
          {
            name: 'products',
            columns: [
              {
                name: 'id',
                type: 'INTEGER',
                nullable: false,
                isPrimaryKey: true,
                isForeignKey: false,
              },
            ],
            primaryKeys: ['id'],
            foreignKeys: [],
            indexes: [],
          },
        ],
        discoveredAt: '2024-01-01T00:00:00Z',
      };

      const userMessage = 'Show me all data';
      mockLLMService.generateResponse.mockResolvedValue('SELECT * FROM users LIMIT 100');

      await generateSqlQuery(userMessage, multiTableSchema);

      const callArgs = mockLLMService.generateResponse.mock.calls[0];
      const prompt = callArgs[3];

      expect(prompt).toContain('Table: users');
      expect(prompt).toContain('Table: orders');
      expect(prompt).toContain('Table: products');
    });

    it('should format schema with empty tables', async () => {
      const emptySchema: DatabaseSchema = {
        tables: [],
        discoveredAt: '2024-01-01T00:00:00Z',
      };

      const userMessage = 'Show me data';
      mockLLMService.generateResponse.mockResolvedValue('SELECT 1');

      await generateSqlQuery(userMessage, emptySchema);

      const callArgs = mockLLMService.generateResponse.mock.calls[0];
      const prompt = callArgs[3];

      expect(prompt).toContain('Database Schema:');
      // Should not crash with empty tables
    });

    it('should format schema with tables that have no foreign keys section', async () => {
      const schemaNoFK: DatabaseSchema = {
        tables: [
          {
            name: 'users',
            columns: [
              {
                name: 'id',
                type: 'INTEGER',
                nullable: false,
                isPrimaryKey: true,
                isForeignKey: false,
              },
            ],
            primaryKeys: ['id'],
            foreignKeys: [],
            indexes: [],
          },
        ],
        discoveredAt: '2024-01-01T00:00:00Z',
      };

      const userMessage = 'Show me users';
      mockLLMService.generateResponse.mockResolvedValue('SELECT * FROM users LIMIT 100');

      await generateSqlQuery(userMessage, schemaNoFK);

      const callArgs = mockLLMService.generateResponse.mock.calls[0];
      const prompt = callArgs[3];

      expect(prompt).toContain('Table: users');
      expect(prompt).not.toContain('Foreign Keys:');
    });

    it('should handle complex SELECT queries with JOINs', async () => {
      const userMessage = 'Show me orders with user information';
      const complexQuery = 'SELECT o.*, u.name, u.email FROM orders o JOIN users u ON o.user_id = u.id LIMIT 100';
      mockLLMService.generateResponse.mockResolvedValue(complexQuery);

      const result = await generateSqlQuery(userMessage, mockSchema);

      expect(result).toBe(complexQuery);
    });

    it('should handle SELECT queries with WHERE clauses', async () => {
      const userMessage = 'Show me orders for user 123';
      const queryWithWhere = 'SELECT * FROM orders WHERE user_id = :userId LIMIT 100';
      mockLLMService.generateResponse.mockResolvedValue(queryWithWhere);

      const result = await generateSqlQuery(userMessage, mockSchema);

      expect(result).toBe(queryWithWhere);
    });

    it('should handle SELECT queries with parameterized values', async () => {
      const userMessage = 'Show me user with email test@example.com';
      const queryWithParam = 'SELECT * FROM users WHERE email = :email LIMIT 100';
      mockLLMService.generateResponse.mockResolvedValue(queryWithParam);

      const result = await generateSqlQuery(userMessage, mockSchema);

      expect(result).toBe(queryWithParam);
    });
  });
});
