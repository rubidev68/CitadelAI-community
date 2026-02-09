/**
 * Automatic SQL Query Generation Service
 * Uses LLM to generate SQL queries based on user message and database schema
 */

import { DatabaseSchema } from './dbSchemaDiscovery';

export type GenerateResponseFn = (
  systemPrompt: string,
  history: any[],
  userMessage: string,
  provider: 'gemini' | 'openai' | 'anthropic' | 'mistral',
  model?: string
) => Promise<string>;

/**
 * Generate SQL SELECT query automatically based on user message and database schema
 */
export async function generateSqlQuery(
  userMessage: string,
  schema: DatabaseSchema,
  generateResponse: GenerateResponseFn,
  llmProvider: 'gemini' | 'openai' | 'anthropic' | 'mistral' = 'gemini',
  llmModel?: string
): Promise<string> {
  // Build schema description for LLM
  const schemaDescription = formatSchemaForLLM(schema);

  // Create prompt for LLM
  const prompt = `You are a SQL query generator. Generate a safe, read-only SELECT query based on the user's question and the database schema.

Database Schema:
${schemaDescription}

User Question: "${userMessage}"

IMPORTANT RULES:
1. Generate ONLY a SELECT query (read-only)
2. Use parameterized queries with named parameters (e.g., :userId, :email)
3. Extract relevant parameters from the user question
4. Use proper JOINs when querying related tables
5. Include appropriate WHERE clauses based on the user's question
6. Use LIMIT to prevent returning too many rows (default: 100)
7. Return ONLY the SQL query, no explanations or markdown formatting
8. Use table and column names exactly as shown in the schema

Example:
User: "Show me orders for user 123"
Query: SELECT * FROM orders WHERE user_id = :userId LIMIT 100

User: "What products are in stock?"
Query: SELECT * FROM products WHERE stock_quantity > 0 LIMIT 100

Now generate the query for the user's question:`;

  try {
    const response = await generateResponse(
      'You are a SQL query expert. Generate safe, read-only SELECT queries.',
      [],
      prompt,
      llmProvider,
      llmModel
    );

    // Clean up the response - remove markdown code blocks if present
    let query = response.trim();
    query = query.replace(/^```sql\n?/i, '');
    query = query.replace(/^```\n?/i, '');
    query = query.replace(/\n?```$/i, '');
    query = query.trim();

    // Validate it's a SELECT query
    if (!query.toUpperCase().trim().startsWith('SELECT')) {
      throw new Error('Generated query is not a SELECT query');
    }

    return query;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to generate SQL query: ${errorMessage}`);
  }
}

/**
 * Format database schema as a readable description for LLM
 */
function formatSchemaForLLM(schema: DatabaseSchema): string {
  let description = '';

  for (const table of schema.tables) {
    description += `\nTable: ${table.name}`;
    if (table.rowCount !== undefined) {
      description += ` (${table.rowCount} rows)`;
    }
    description += '\n';

    // Columns
    description += '  Columns:\n';
    for (const column of table.columns) {
      description += `    - ${column.name} (${column.type})`;
      if (column.isPrimaryKey) {
        description += ' [PRIMARY KEY]';
      }
      if (column.isForeignKey) {
        const fk = table.foreignKeys.find(f => f.column === column.name);
        if (fk) {
          description += ` [FK -> ${fk.referencedTable}.${fk.referencedColumn}]`;
        }
      }
      if (!column.nullable) {
        description += ' [NOT NULL]';
      }
      description += '\n';
    }

    // Foreign keys
    if (table.foreignKeys.length > 0) {
      description += '  Foreign Keys:\n';
      for (const fk of table.foreignKeys) {
        description += `    - ${fk.column} -> ${fk.referencedTable}.${fk.referencedColumn}\n`;
      }
    }

    description += '\n';
  }

  return description;
}
