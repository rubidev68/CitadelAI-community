/**
 * Database Result Formatter
 * Formats database query results for LLM consumption
 */

export type DbResultFormat = 'json' | 'table' | 'text' | 'custom';

/**
 * Format database results for LLM context
 */
export function formatDbResult(
  rows: Array<Record<string, unknown>>,
  format: DbResultFormat = 'json',
  template?: string
): string {
  if (rows.length === 0) {
    return 'No results found.';
  }

  switch (format) {
    case 'json':
      return formatAsJson(rows);

    case 'table':
      return formatAsTable(rows);

    case 'text':
      return formatAsText(rows);

    case 'custom':
      return formatAsCustom(rows, template || '');

    default:
      return formatAsJson(rows);
  }
}

/**
 * Format as JSON
 */
function formatAsJson(rows: Array<Record<string, unknown>>): string {
  return JSON.stringify(rows, null, 2);
}

/**
 * Format as Markdown table
 */
function formatAsTable(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) {
    return 'No results found.';
  }

  // Get all column names
  const columns = Object.keys(rows[0]);
  
  // Build header
  const header = `| ${columns.join(' | ')} |`;
  const separator = `| ${columns.map(() => '---').join(' | ')} |`;
  
  // Build rows
  const dataRows = rows.map(row => {
    const values = columns.map(col => {
      const value = row[col];
      return value === null || value === undefined ? '' : String(value);
    });
    return `| ${values.join(' | ')} |`;
  });

  return [header, separator, ...dataRows].join('\n');
}

/**
 * Format as natural language text
 */
function formatAsText(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) {
    return 'No results found.';
  }

  const lines = rows.map((row, index) => {
    const entries = Object.entries(row)
      .map(([key, value]) => `${key}: ${value === null || value === undefined ? 'N/A' : value}`)
      .join(', ');
    return `Record ${index + 1}: ${entries}`;
  });

  return lines.join('\n');
}

/**
 * Format using custom template
 */
function formatAsCustom(rows: Array<Record<string, unknown>>, template: string): string {
  if (rows.length === 0) {
    return 'No results found.';
  }

  return rows.map(row => {
    let formatted = template;
    
    // Replace placeholders like {columnName}
    for (const [key, value] of Object.entries(row)) {
      const placeholder = new RegExp(`\\{${key}\\}`, 'g');
      formatted = formatted.replace(placeholder, String(value === null || value === undefined ? '' : value));
    }

    // Replace {count} with row count
    formatted = formatted.replace(/\{count\}/g, String(rows.length));

    return formatted;
  }).join('\n');
}
