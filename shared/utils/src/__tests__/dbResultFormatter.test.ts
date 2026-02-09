import { describe, it, expect } from 'vitest';
import { formatDbResult, DbResultFormat } from '../dbResultFormatter';

describe('DB Result Formatter', () => {
  describe('formatDbResult', () => {
    it('should return "No results found." for empty array', () => {
      const result = formatDbResult([]);

      expect(result).toBe('No results found.');
    });

    it('should format as JSON by default', () => {
      const rows = [
        { id: 1, name: 'Alice', age: 30 },
        { id: 2, name: 'Bob', age: 25 },
      ];

      const result = formatDbResult(rows);

      expect(result).toBe(JSON.stringify(rows, null, 2));
    });

    it('should format as JSON when format is "json"', () => {
      const rows = [
        { id: 1, name: 'Alice' },
      ];

      const result = formatDbResult(rows, 'json');

      expect(result).toBe(JSON.stringify(rows, null, 2));
    });

    it('should format as table when format is "table"', () => {
      const rows = [
        { id: 1, name: 'Alice', age: 30 },
        { id: 2, name: 'Bob', age: 25 },
      ];

      const result = formatDbResult(rows, 'table');

      expect(result).toContain('| id | name | age |');
      expect(result).toContain('| --- | --- | --- |');
      expect(result).toContain('| 1 | Alice | 30 |');
      expect(result).toContain('| 2 | Bob | 25 |');
    });

    it('should format as text when format is "text"', () => {
      const rows = [
        { id: 1, name: 'Alice', age: 30 },
        { id: 2, name: 'Bob', age: 25 },
      ];

      const result = formatDbResult(rows, 'text');

      expect(result).toContain('Record 1:');
      expect(result).toContain('Record 2:');
      expect(result).toContain('id: 1');
      expect(result).toContain('name: Alice');
      expect(result).toContain('age: 30');
    });

    it('should format as custom when format is "custom"', () => {
      const rows = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      const template = 'User {id}: {name}';
      const result = formatDbResult(rows, 'custom', template);

      expect(result).toContain('User 1: Alice');
      expect(result).toContain('User 2: Bob');
    });

    it('should use default JSON format for unknown format', () => {
      const rows = [
        { id: 1, name: 'Alice' },
      ];

      const result = formatDbResult(rows, 'unknown' as DbResultFormat);

      expect(result).toBe(JSON.stringify(rows, null, 2));
    });

    it('should handle single row', () => {
      const rows = [
        { id: 1, name: 'Alice', age: 30 },
      ];

      const jsonResult = formatDbResult(rows, 'json');
      expect(jsonResult).toBe(JSON.stringify(rows, null, 2));

      const tableResult = formatDbResult(rows, 'table');
      expect(tableResult).toContain('| id | name | age |');
      expect(tableResult).toContain('| 1 | Alice | 30 |');

      const textResult = formatDbResult(rows, 'text');
      expect(textResult).toContain('Record 1:');
      expect(textResult).toContain('id: 1, name: Alice, age: 30');
    });

    it('should handle many rows', () => {
      const rows = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
      }));

      const result = formatDbResult(rows, 'text');

      expect(result.split('\n')).toHaveLength(100);
      expect(result).toContain('Record 1:');
      expect(result).toContain('Record 100:');
    });

    it('should handle rows with different column sets', () => {
      const rows = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob', age: 25 },
        { id: 3 },
      ];

      const result = formatDbResult(rows, 'table');

      // Table format uses columns from first row only
      expect(result).toContain('id');
      expect(result).toContain('name');
      // age is not in first row, so it won't be in the table
    });

    it('should handle null and undefined values in JSON format', () => {
      const rows = [
        { id: 1, name: null, age: undefined, active: true },
      ];

      const result = formatDbResult(rows, 'json');

      const parsed = JSON.parse(result);
      expect(parsed[0].name).toBeNull();
      expect(parsed[0].age).toBeUndefined();
      expect(parsed[0].active).toBe(true);
    });

    it('should handle null and undefined values in table format', () => {
      const rows = [
        { id: 1, name: null, age: undefined },
      ];

      const result = formatDbResult(rows, 'table');

      expect(result).toContain('| id | name | age |');
      // Null and undefined become empty strings in table format
      // The row will be: | 1 | | |
      const lines = result.split('\n');
      const dataLine = lines.find(line => line.startsWith('| 1'));
      expect(dataLine).toBeDefined();
      expect(dataLine).toContain('| 1 |');
    });

    it('should handle null and undefined values in text format', () => {
      const rows = [
        { id: 1, name: null, age: undefined },
      ];

      const result = formatDbResult(rows, 'text');

      expect(result).toContain('name: N/A');
      expect(result).toContain('age: N/A');
    });

    it('should handle null and undefined values in custom format', () => {
      const rows = [
        { id: 1, name: null },
      ];

      const template = 'ID: {id}, Name: {name}';
      const result = formatDbResult(rows, 'custom', template);

      expect(result).toContain('ID: 1, Name: ');
    });

    it('should handle various data types', () => {
      const rows = [
        {
          id: 1,
          name: 'Alice',
          age: 30,
          active: true,
          score: 95.5,
          tags: ['admin', 'user'],
          metadata: { role: 'admin' },
        },
      ];

      const jsonResult = formatDbResult(rows, 'json');
      const parsed = JSON.parse(jsonResult);
      expect(parsed[0].id).toBe(1);
      expect(parsed[0].name).toBe('Alice');
      expect(parsed[0].age).toBe(30);
      expect(parsed[0].active).toBe(true);
      expect(parsed[0].score).toBe(95.5);
      expect(parsed[0].tags).toEqual(['admin', 'user']);
      expect(parsed[0].metadata).toEqual({ role: 'admin' });
    });

    it('should handle custom template with {count} placeholder', () => {
      const rows = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      const template = 'Total records: {count}';
      const result = formatDbResult(rows, 'custom', template);

      expect(result).toContain('Total records: 2');
      expect(result.split('\n')).toHaveLength(2);
    });

    it('should handle custom template with multiple placeholders', () => {
      const rows = [
        { id: 1, name: 'Alice', role: 'admin' },
      ];

      const template = 'User {id} ({name}) is a {role}';
      const result = formatDbResult(rows, 'custom', template);

      expect(result).toBe('User 1 (Alice) is a admin');
    });

    it('should handle custom template with repeated placeholders', () => {
      const rows = [
        { id: 1, name: 'Alice' },
      ];

      const template = '{name} ({name})';
      const result = formatDbResult(rows, 'custom', template);

      expect(result).toBe('Alice (Alice)');
    });

    it('should handle empty custom template', () => {
      const rows = [
        { id: 1, name: 'Alice' },
      ];

      const result = formatDbResult(rows, 'custom', '');

      expect(result).toBe('');
    });

    it('should handle custom template with no matching placeholders', () => {
      const rows = [
        { id: 1, name: 'Alice' },
      ];

      const template = 'No placeholders here';
      const result = formatDbResult(rows, 'custom', template);

      expect(result).toBe('No placeholders here');
    });

    it('should handle table format with special characters in values', () => {
      const rows = [
        { id: 1, name: 'Alice | Bob', description: 'Test | Value' },
      ];

      const result = formatDbResult(rows, 'table');

      expect(result).toContain('| Alice | Bob |');
      expect(result).toContain('| Test | Value |');
    });

    it('should handle text format with special characters', () => {
      const rows = [
        { id: 1, name: 'Alice\nBob', description: 'Test\tValue' },
      ];

      const result = formatDbResult(rows, 'text');

      expect(result).toContain('name: Alice\nBob');
      expect(result).toContain('description: Test\tValue');
    });

    it('should handle numeric values correctly', () => {
      const rows = [
        { id: 1, count: 0, price: 99.99, negative: -10 },
      ];

      const jsonResult = formatDbResult(rows, 'json');
      const parsed = JSON.parse(jsonResult);
      expect(parsed[0].count).toBe(0);
      expect(parsed[0].price).toBe(99.99);
      expect(parsed[0].negative).toBe(-10);

      const tableResult = formatDbResult(rows, 'table');
      expect(tableResult).toContain('| 0 |');
      expect(tableResult).toContain('| 99.99 |');
      expect(tableResult).toContain('| -10 |');
    });

    it('should handle boolean values correctly', () => {
      const rows = [
        { id: 1, active: true, deleted: false },
      ];

      const jsonResult = formatDbResult(rows, 'json');
      const parsed = JSON.parse(jsonResult);
      expect(parsed[0].active).toBe(true);
      expect(parsed[0].deleted).toBe(false);

      const tableResult = formatDbResult(rows, 'table');
      expect(tableResult).toContain('| true |');
      expect(tableResult).toContain('| false |');
    });

    it('should handle date values', () => {
      const date = new Date('2024-01-01');
      const rows = [
        { id: 1, createdAt: date },
      ];

      const jsonResult = formatDbResult(rows, 'json');
      const parsed = JSON.parse(jsonResult);
      expect(parsed[0].createdAt).toBe(date.toISOString());

      const tableResult = formatDbResult(rows, 'table');
      // Date is converted to string in table format
      expect(tableResult).toContain('createdAt');
      // String(date) produces a locale-specific string, just check it's there
      expect(tableResult).toMatch(/\| 1 \|/);
    });

    it('should handle array values', () => {
      const rows = [
        { id: 1, tags: ['tag1', 'tag2', 'tag3'] },
      ];

      const jsonResult = formatDbResult(rows, 'json');
      const parsed = JSON.parse(jsonResult);
      expect(parsed[0].tags).toEqual(['tag1', 'tag2', 'tag3']);

      const tableResult = formatDbResult(rows, 'table');
      expect(tableResult).toContain('tag1,tag2,tag3');
    });

    it('should handle object values', () => {
      const rows = [
        { id: 1, metadata: { key: 'value', nested: { deep: 'value' } } },
      ];

      const jsonResult = formatDbResult(rows, 'json');
      const parsed = JSON.parse(jsonResult);
      expect(parsed[0].metadata).toEqual({ key: 'value', nested: { deep: 'value' } });

      const tableResult = formatDbResult(rows, 'table');
      expect(tableResult).toContain('[object Object]');
    });

    it('should handle empty string values', () => {
      const rows = [
        { id: 1, name: '', description: 'test' },
      ];

      const tableResult = formatDbResult(rows, 'table');
      // Empty string becomes empty cell in table format
      expect(tableResult).toContain('| id | name | description |');
      // Empty string produces empty cell: | 1 | | test |
      const lines = tableResult.split('\n');
      const dataLine = lines.find(line => line.includes('| 1 |'));
      expect(dataLine).toBeDefined();
      expect(dataLine).toMatch(/\| 1 \|.*\| test \|/);

      const textResult = formatDbResult(rows, 'text');
      expect(textResult).toContain('name: ');
    });

    it('should handle custom format with empty template for empty rows', () => {
      const result = formatDbResult([], 'custom', 'template');

      expect(result).toBe('No results found.');
    });
  });
});
