/**
 * SQL Query Validation Service
 * Ensures only SELECT queries are allowed (read-only enforcement)
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate that a query is SELECT-only (read-only)
 */
export function validateSelectQuery(query: string): ValidationResult {
  if (!query || typeof query !== 'string') {
    return { valid: false, error: 'Query must be a non-empty string' };
  }

  // 1. Must start with SELECT (case-insensitive, allow whitespace/comments)
  const trimmedQuery = query.trim().replace(/^--.*$/gm, '').trim(); // Remove comments
  if (!trimmedQuery.match(/^\s*SELECT\s+/i)) {
    return { 
      valid: false, 
      error: 'Only SELECT queries are allowed. Query must start with SELECT.' 
    };
  }

  // 2. Block all write operations
  const writeOperations = [
    /INSERT\s+INTO/i,
    /UPDATE\s+\w+/i,
    /DELETE\s+FROM/i,
    /DROP\s+(TABLE|DATABASE|INDEX|VIEW|SCHEMA)/i,
    /TRUNCATE\s+TABLE/i,
    /ALTER\s+TABLE/i,
    /CREATE\s+(TABLE|INDEX|VIEW|DATABASE|SCHEMA)/i,
    /GRANT\s+/i,
    /REVOKE\s+/i,
    /REPLACE\s+INTO/i,
  ];

  for (const pattern of writeOperations) {
    if (pattern.test(query)) {
      return { 
        valid: false, 
        error: 'Write operations (INSERT, UPDATE, DELETE, DROP, etc.) are not allowed. Only SELECT queries are permitted.' 
      };
    }
  }

  // 3. Block dangerous patterns
  const dangerousPatterns = [
    /;\s*(DROP|DELETE|INSERT|UPDATE|TRUNCATE|CREATE|ALTER)/i, // Multiple statements
    /EXEC\s*\(/i, // SQL Server EXEC
    /EXECUTE\s+/i,
    /CALL\s+/i, // Stored procedures (could be dangerous)
    /EXEC\s+sp_/i, // SQL Server stored procedures
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(query)) {
      return { 
        valid: false, 
        error: 'Dangerous SQL patterns detected. Only simple SELECT queries are allowed.' 
      };
    }
  }

  // 4. Ensure parameterized queries (no string interpolation)
  if (query.includes('${') || query.match(/\$\d+/) || query.includes('`${')) {
    return { 
      valid: false, 
      error: 'Use parameterized queries only. Do not use string interpolation.' 
    };
  }

  // 5. Block UNION-based attacks (optional - can be enabled if needed)
  // const unionCount = (query.match(/\bUNION\s+ALL?\b/gi) || []).length;
  // if (unionCount > 2) {
  //   return { valid: false, error: 'Too many UNION operations. This may be a security risk.' };
  // }

  return { valid: true };
}

/**
 * Sanitize query (remove comments, normalize whitespace)
 */
export function sanitizeQuery(query: string): string {
  // Remove single-line comments
  let sanitized = query.replace(/--.*$/gm, '');
  
  // Remove multi-line comments
  sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
}
