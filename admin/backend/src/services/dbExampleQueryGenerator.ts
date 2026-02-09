/**
 * Generate Example User Questions Service
 * Uses LLM to generate natural language example questions that users would ask the chatbot
 */

import { DatabaseSchema } from '@shared/services';
import { generateResponse } from './llmHelper';
import { logger } from '@shared/utils';

const dbExampleQueryLogger = logger.child({ service: 'admin-backend', component: 'dbExampleQueryGenerator' });

export interface ExampleQuery {
  question: string;
  description?: string;
}

/**
 * Generate example natural language questions that users would ask the chatbot
 * based on the database schema
 */
export async function generateExampleQueries(
  schema: DatabaseSchema,
  count: number = 5,
  llmProvider: 'gemini' | 'openai' | 'anthropic' | 'mistral' = 'gemini',
  llmModel?: string
): Promise<ExampleQuery[]> {
  // Build schema description for LLM
  const schemaDescription = formatSchemaForLLM(schema);

  // Create prompt for LLM
  const prompt = `You are a chatbot conversation designer. Generate ${count} diverse, natural language example questions that users would ask a chatbot to query this database.

Database Schema:
${schemaDescription}

Requirements:
1. Generate ${count} different, realistic user questions
2. Questions should be in natural, conversational language (like users would actually ask)
3. Questions should be relevant to the database schema and data
4. Include questions that would require:
   - Looking up specific records (e.g., "What's the status of order #12345?")
   - Finding records by criteria (e.g., "Show me all products under $50")
   - Aggregations (e.g., "How many orders did we get this month?")
   - Joins across tables (e.g., "What products did customer John buy?")
5. Make questions practical and useful for a customer support or business chatbot
6. Questions should be clear and specific enough that the chatbot can generate appropriate SQL queries
7. Return questions in JSON format as an array

Return format (JSON array):
[
  {
    "question": "Natural language question a user would ask",
    "description": "Optional brief explanation of what this question demonstrates"
  },
  ...
]

Examples of good questions:
- "What's the status of my order #12345?"
- "Show me all products in the Electronics category"
- "How many customers signed up last month?"
- "What are the top 5 best-selling products?"
- "Find all orders for customer john@example.com"

Return ONLY valid JSON, no markdown, no explanations.`;

  try {
    const response = await generateResponse(
      'You are a chatbot conversation designer. Generate natural language example questions users would ask.',
      [],
      prompt,
      llmProvider,
      llmModel
    );

    // Clean up the response - remove markdown code blocks if present
    let jsonStr = response.trim();
    jsonStr = jsonStr.replace(/^```json\n?/i, '');
    jsonStr = jsonStr.replace(/^```\n?/i, '');
    jsonStr = jsonStr.replace(/\n?```$/i, '');
    jsonStr = jsonStr.trim();

    // Parse JSON
    const examples = JSON.parse(jsonStr) as ExampleQuery[];

    // Validate structure
    for (const example of examples) {
      if (!example.question || typeof example.question !== 'string') {
        throw new Error('Invalid example query format: missing question');
      }
    }

    return examples;
  } catch (error: unknown) {
    dbExampleQueryLogger.error('Failed to generate example queries', { error: error instanceof Error ? error : new Error(String(error)) });
    // Return fallback examples if LLM generation fails
    return generateFallbackExamples(schema);
  }
}

/**
 * Generate fallback example questions if LLM generation fails
 */
function generateFallbackExamples(schema: DatabaseSchema): ExampleQuery[] {
  const examples: ExampleQuery[] = [];

  if (schema.tables.length === 0) {
    return examples;
  }

  // Generate simple examples for first few tables
  for (let i = 0; i < Math.min(3, schema.tables.length); i++) {
    const table = schema.tables[i];
    const tableName = table.name;
    const displayName = tableName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    // Simple lookup question
    examples.push({
      question: `Show me all ${displayName.toLowerCase()}`,
      description: `Retrieve all records from ${tableName}`,
    });

    // Question with filter if there are columns
    if (table.columns.length > 0) {
      const firstColumn = table.columns[0];
      const columnDisplayName = firstColumn.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      examples.push({
        question: `Find ${displayName.toLowerCase()} by ${columnDisplayName.toLowerCase()}`,
        description: `Search ${tableName} using ${firstColumn.name}`,
      });
    }
  }

  return examples;
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
