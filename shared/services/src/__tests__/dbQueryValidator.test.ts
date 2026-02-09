import { describe, it, expect } from 'vitest';
import { validateSelectQuery, sanitizeQuery } from '../dbQueryValidator';

describe('DB Query Validator', () => {
  describe('validateSelectQuery', () => {
    it('should validate simple SELECT query', () => {
      const query = 'SELECT * FROM users';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate SELECT with WHERE clause', () => {
      const query = 'SELECT id, name FROM users WHERE id = :userId';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(true);
    });

    it('should validate SELECT with JOIN', () => {
      const query = 'SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(true);
    });

    it('should reject empty query', () => {
      const result = validateSelectQuery('');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });

    it('should reject null query', () => {
      const result = validateSelectQuery(null as any);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });

    it('should reject non-string query', () => {
      const result = validateSelectQuery(123 as any);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });

    it('should reject query that does not start with SELECT', () => {
      const query = 'UPDATE users SET name = "test"';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('must start with SELECT');
    });

    it('should allow SELECT with leading whitespace', () => {
      const query = '   SELECT * FROM users';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(true);
    });

    it('should allow SELECT with comments', () => {
      const query = '-- This is a comment\nSELECT * FROM users';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(true);
    });

    it('should reject INSERT queries', () => {
      const query = 'INSERT INTO users (name) VALUES (:name)';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(false);
      // Query doesn't start with SELECT, so it fails the first check
      expect(result.error).toBeDefined();
    });

    it('should reject UPDATE queries', () => {
      const query = 'UPDATE users SET name = :name WHERE id = :id';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject DELETE queries', () => {
      const query = 'DELETE FROM users WHERE id = :id';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject DROP TABLE queries', () => {
      const query = 'DROP TABLE users';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject DROP DATABASE queries', () => {
      const query = 'DROP DATABASE mydb';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject TRUNCATE queries', () => {
      const query = 'TRUNCATE TABLE users';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject ALTER TABLE queries', () => {
      const query = 'ALTER TABLE users ADD COLUMN email VARCHAR(255)';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject CREATE TABLE queries', () => {
      const query = 'CREATE TABLE new_table (id INT)';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject GRANT queries', () => {
      const query = 'GRANT SELECT ON users TO user1';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject REPLACE INTO queries', () => {
      const query = 'REPLACE INTO users (id, name) VALUES (1, "test")';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject write operations in SELECT query', () => {
      const query = 'SELECT * FROM users; INSERT INTO users (name) VALUES ("test")';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Write operations');
    });

    it('should reject multiple statements with DROP', () => {
      const query = 'SELECT * FROM users; DROP TABLE users';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(false);
      // Could be either write operations or dangerous patterns
      expect(result.error).toBeDefined();
    });

    it('should reject EXEC statements', () => {
      const query = 'SELECT * FROM users; EXEC sp_helpdb';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Dangerous SQL patterns');
    });

    it('should reject EXECUTE statements', () => {
      const query = 'EXECUTE stored_procedure';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(false);
      // Doesn't start with SELECT, so fails first check
      expect(result.error).toBeDefined();
    });

    it('should reject CALL statements', () => {
      const query = 'CALL stored_procedure()';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject dangerous patterns in SELECT query', () => {
      const query = 'SELECT * FROM users; EXEC sp_helpdb';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Dangerous SQL patterns');
    });

    it('should reject string interpolation with ${', () => {
      const query = 'SELECT * FROM users WHERE id = ${userId}';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('parameterized queries');
    });

    it('should reject template literal interpolation', () => {
      const query = 'SELECT * FROM users WHERE id = `${userId}`';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('parameterized queries');
    });

    it('should allow parameterized queries with :param', () => {
      const query = 'SELECT * FROM users WHERE id = :userId';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(true);
    });

    it('should allow parameterized queries with ?', () => {
      const query = 'SELECT * FROM users WHERE id = ?';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(true);
    });

    it('should allow SELECT with UNION', () => {
      const query = 'SELECT * FROM users UNION SELECT * FROM admins';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(true);
    });

    it('should allow case-insensitive SELECT', () => {
      const query = 'select * from users';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(true);
    });

    it('should reject write operation in case-insensitive check', () => {
      const query = 'select * from users; update users set name = "test"';
      const result = validateSelectQuery(query);

      expect(result.valid).toBe(false);
    });
  });

  describe('sanitizeQuery', () => {
    it('should remove single-line comments', () => {
      const query = 'SELECT * FROM users -- This is a comment';
      const result = sanitizeQuery(query);

      expect(result).not.toContain('--');
      expect(result).toContain('SELECT');
    });

    it('should remove multi-line comments', () => {
      const query = 'SELECT * /* This is a\nmulti-line comment */ FROM users';
      const result = sanitizeQuery(query);

      expect(result).not.toContain('/*');
      expect(result).not.toContain('*/');
      expect(result).toContain('SELECT');
    });

    it('should normalize whitespace', () => {
      const query = 'SELECT   *   FROM    users   WHERE   id   =   1';
      const result = sanitizeQuery(query);

      expect(result).not.toContain('  '); // No double spaces
      expect(result).toContain('SELECT * FROM users WHERE id = 1');
    });

    it('should trim leading and trailing whitespace', () => {
      const query = '   SELECT * FROM users   ';
      const result = sanitizeQuery(query);

      expect(result).toBe('SELECT * FROM users');
    });

    it('should handle query with multiple comments', () => {
      const query = `-- Comment 1
SELECT * FROM users
-- Comment 2
WHERE id = 1
/* Multi-line
comment */`;
      const result = sanitizeQuery(query);

      expect(result).not.toContain('--');
      expect(result).not.toContain('/*');
      expect(result).not.toContain('*/');
    });

    it('should handle empty query', () => {
      const result = sanitizeQuery('');

      expect(result).toBe('');
    });

    it('should handle query with only comments', () => {
      const query = '-- Only comment\n/* Another comment */';
      const result = sanitizeQuery(query);

      expect(result).toBe('');
    });
  });
});
