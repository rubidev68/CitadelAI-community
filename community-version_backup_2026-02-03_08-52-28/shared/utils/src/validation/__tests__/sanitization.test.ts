import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  sanitizeHtml,
  sanitizePath,
  sanitizeFilename,
  sanitizeSqlInput,
  sanitizeObjectKey,
} from '../sanitization';

describe('Sanitization Utilities', () => {
  describe('sanitizeString', () => {
    it('should remove control characters', () => {
      const input = 'Hello\x00World\x1FTest';
      const result = sanitizeString(input);
      expect(result).toBe('HelloWorldTest');
    });

    it('should preserve legitimate whitespace', () => {
      const input = 'Hello\tWorld\nTest\r';
      const result = sanitizeString(input);
      expect(result).toBe('Hello\tWorld\nTest\r');
    });

    it('should handle empty string', () => {
      expect(sanitizeString('')).toBe('');
    });

    it('should handle normal text without control characters', () => {
      const input = 'Hello World Test';
      expect(sanitizeString(input)).toBe('Hello World Test');
    });
  });

  describe('sanitizeHtml', () => {
    it('should remove all HTML tags by default', () => {
      const input = '<p>Hello <b>World</b></p>';
      const result = sanitizeHtml(input);
      expect(result).toBe('Hello World');
    });

    it('should remove script tags', () => {
      const input = '<script>alert("xss")</script>Hello';
      const result = sanitizeHtml(input);
      expect(result).toBe('Hello');
    });

    it('should remove iframe tags', () => {
      const input = '<iframe src="evil.com"></iframe>Hello';
      const result = sanitizeHtml(input);
      expect(result).toBe('Hello');
    });

    it('should remove event handlers', () => {
      const input = '<div onclick="alert(1)">Hello</div>';
      const result = sanitizeHtml(input);
      expect(result).toBe('Hello');
    });

    it('should remove javascript: protocol', () => {
      const input = '<a href="javascript:alert(1)">Link</a>';
      const result = sanitizeHtml(input);
      expect(result).toBe('Link');
    });

    it('should handle empty string', () => {
      expect(sanitizeHtml('')).toBe('');
    });

    it('should handle text without HTML', () => {
      const input = 'Plain text without HTML';
      expect(sanitizeHtml(input)).toBe('Plain text without HTML');
    });
  });

  describe('sanitizePath', () => {
    it('should remove directory traversal sequences', () => {
      const input = '../../../etc/passwd';
      const result = sanitizePath(input);
      expect(result).toBe('etcpasswd');
    });

    it('should remove path separators', () => {
      const input = 'path/to/file';
      const result = sanitizePath(input);
      expect(result).toBe('pathtofile');
    });

    it('should trim whitespace', () => {
      const input = '  file.txt  ';
      const result = sanitizePath(input);
      expect(result).toBe('filetxt');
    });

    it('should handle empty string', () => {
      expect(sanitizePath('')).toBe('');
    });

    it('should handle safe filename', () => {
      const input = 'safe-file-name';
      expect(sanitizePath(input)).toBe('safe-file-name');
    });
  });

  describe('sanitizeFilename', () => {
    it('should sanitize filename while preserving extension', () => {
      const input = '../../../etc/passwd.txt';
      const result = sanitizeFilename(input);
      expect(result).toBe('etcpasswd.txt');
    });

    it('should replace invalid characters with underscore', () => {
      const input = 'file@name#test$.pdf';
      const result = sanitizeFilename(input);
      expect(result).toBe('file_name_test_.pdf');
    });

    it('should limit filename length', () => {
      const longName = 'a'.repeat(300);
      const result = sanitizeFilename(`${longName}.txt`);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result).toMatch(/\.txt$/);
    });

    it('should handle filename without extension', () => {
      const input = 'filename';
      const result = sanitizeFilename(input);
      expect(result).toBe('filename');
    });

    it('should handle multiple dots in filename', () => {
      const input = 'file.name.test.pdf';
      const result = sanitizeFilename(input);
      expect(result).toMatch(/\.pdf$/);
    });

    it('should handle empty string', () => {
      expect(sanitizeFilename('')).toBe('');
    });
  });

  describe('sanitizeSqlInput', () => {
    it('should remove SQL comment markers', () => {
      const input = "SELECT * FROM users -- comment";
      const result = sanitizeSqlInput(input);
      expect(result).toBe('SELECT * FROM users  comment');
    });

    it('should remove multi-line comments', () => {
      const input = 'SELECT * /* comment */ FROM users';
      const result = sanitizeSqlInput(input);
      expect(result).toBe('SELECT *  FROM users');
    });

    it('should remove statement separators', () => {
      const input = 'SELECT * FROM users; DROP TABLE users;';
      const result = sanitizeSqlInput(input);
      expect(result).toBe('SELECT * FROM users DROP TABLE users');
    });

    it('should handle empty string', () => {
      expect(sanitizeSqlInput('')).toBe('');
    });

    it('should handle normal SQL without dangerous patterns', () => {
      const input = 'SELECT * FROM users WHERE id = 1';
      const result = sanitizeSqlInput(input);
      expect(result).toBe('SELECT * FROM users WHERE id = 1');
    });
  });

  describe('sanitizeObjectKey', () => {
    it('should reject __proto__', () => {
      const result = sanitizeObjectKey('__proto__');
      expect(result).toBeNull();
    });

    it('should reject constructor', () => {
      const result = sanitizeObjectKey('constructor');
      expect(result).toBeNull();
    });

    it('should reject prototype', () => {
      const result = sanitizeObjectKey('prototype');
      expect(result).toBeNull();
    });

    it('should accept valid alphanumeric keys', () => {
      expect(sanitizeObjectKey('validKey')).toBe('validKey');
      expect(sanitizeObjectKey('key123')).toBe('key123');
      expect(sanitizeObjectKey('key_name')).toBe('key_name');
      expect(sanitizeObjectKey('key-name')).toBe('key-name');
    });

    it('should reject keys with special characters', () => {
      expect(sanitizeObjectKey('key.name')).toBeNull();
      expect(sanitizeObjectKey('key@name')).toBeNull();
      expect(sanitizeObjectKey('key name')).toBeNull();
    });

    it('should handle empty string', () => {
      expect(sanitizeObjectKey('')).toBeNull();
    });
  });
});
