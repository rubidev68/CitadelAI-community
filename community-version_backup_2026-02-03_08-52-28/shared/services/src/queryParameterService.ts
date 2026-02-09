/**
 * Query Parameter Extraction Service
 * Extracts parameter values from user messages, session data, or static values
 */

export interface ParameterConfig {
  name: string; // Parameter name (e.g., ":userId", "?")
  source: 'user_message' | 'session_data' | 'static' | 'llm_extracted';
  extraction?: string; // For llm_extracted: prompt to extract value, for user_message: regex pattern
  defaultValue?: string;
  type: 'string' | 'number' | 'boolean' | 'date';
}

/**
 * Extract parameters from user message, session data, or static values
 */
export async function extractParameters(
  userMessage: string,
  parameterConfigs: ParameterConfig[],
  sessionData?: Record<string, unknown>,
  llmService?: unknown // LLM service for extraction (optional) - using unknown instead of any
): Promise<Record<string, unknown>> {
  const parameters: Record<string, unknown> = {};

  for (const config of parameterConfigs) {
    let value: unknown = null;

    switch (config.source) {
      case 'static':
        value = config.defaultValue || null;
        break;

      case 'session_data':
        if (sessionData && config.name in sessionData) {
          value = sessionData[config.name];
        } else {
          value = config.defaultValue || null;
        }
        break;

      case 'user_message':
        if (config.extraction) {
          // Use regex pattern to extract from message
          const pattern = new RegExp(config.extraction, 'i');
          const match = userMessage.match(pattern);
          if (match) {
            value = match[1] || match[0]; // Use first capture group or full match
          } else {
            value = config.defaultValue || null;
          }
        } else {
          // Try to extract by parameter name (e.g., extract "12345" from "order #12345")
          const namePattern = new RegExp(`${config.name}[\\s:=#]*(\\w+)`, 'i');
          const match = userMessage.match(namePattern);
          if (match) {
            value = match[1];
          } else {
            value = config.defaultValue || null;
          }
        }
        break;

      case 'llm_extracted':
        if (llmService && config.extraction) {
          try {
            value = await extractWithLLM(userMessage, config.extraction, llmService);
            if (!value) {
              value = config.defaultValue || null;
            }
          } catch (error) {
            // Use console.error for now to avoid circular dependency with logger
            console.error('LLM extraction failed:', error);
            value = config.defaultValue || null;
          }
        } else {
          value = config.defaultValue || null;
        }
        break;
    }

    // Convert value to appropriate type
    if (value !== null && value !== undefined) {
      parameters[config.name] = convertToType(value, config.type);
    } else if (config.defaultValue) {
      parameters[config.name] = convertToType(config.defaultValue, config.type);
    }
  }

  return parameters;
}

/**
 * Extract value from message using LLM
 */
async function extractWithLLM(
  message: string,
  extractionPrompt: string,
  llmService: unknown
): Promise<string | null> {
  try {
    const prompt = `${extractionPrompt}\n\nUser message: "${message}"\n\nExtract the value and return only the value, nothing else:`;
    
    // Use LLM service to extract value
    // This is a simplified version - adjust based on your LLM service interface
    // Type assertion needed since we don't know the exact interface
    const service = llmService as {
      generateResponse?: (role: string, prompt: string, messages: unknown[], userMessage: string) => Promise<string | null>;
    };
    
    if (service.generateResponse) {
      const response = await service.generateResponse(
        'system',
        prompt,
        [],
        message
      );
      
      return response?.trim() || null;
    }
    
    return null;
  } catch (error) {
    console.error('LLM extraction error:', error);
    return null;
  }
}

/**
 * Convert value to appropriate type
 */
function convertToType(value: unknown, type: ParameterConfig['type']): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  const stringValue = String(value);

  switch (type) {
    case 'number':
      const num = parseFloat(stringValue);
      return isNaN(num) ? null : num;

    case 'boolean':
      const lower = stringValue.toLowerCase();
      return lower === 'true' || lower === '1' || lower === 'yes';

    case 'date':
      const date = new Date(stringValue);
      return isNaN(date.getTime()) ? null : date.toISOString();

    case 'string':
    default:
      return stringValue;
  }
}

/**
 * Extract value from message using regex pattern
 */
export function extractFromMessage(message: string, pattern: string): string | null {
  try {
    const regex = new RegExp(pattern, 'i');
    const match = message.match(regex);
    return match ? (match[1] || match[0]) : null;
  } catch (error) {
    console.error('Regex extraction error:', error);
    return null;
  }
}

/**
 * Build parameterized query by replacing placeholders with parameter markers
 */
export function buildParameterizedQuery(
  queryTemplate: string,
  parameters: Record<string, unknown>
): { query: string; values: unknown[] } {
  let query = queryTemplate;
  const values: unknown[] = [];
  let paramIndex = 1;

  // Replace named parameters (e.g., :userId) with positional parameters ($1, $2, etc.)
  for (const [name, value] of Object.entries(parameters)) {
    // Handle both :name and ? placeholders
    const namedPattern = new RegExp(`:${name}\\b`, 'g');
    const positionalPattern = /\?/;
    
    if (namedPattern.test(query)) {
      query = query.replace(namedPattern, `$${paramIndex}`);
      values.push(value);
      paramIndex++;
    } else if (positionalPattern.test(query)) {
      query = query.replace(positionalPattern, `$${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  return { query, values };
}
