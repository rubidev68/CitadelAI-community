import { describe, it, expect } from 'vitest';
import {
  uuidSchema,
  cuidSchema,
  emailSchema,
  urlSchema,
  paginationSchema,
  chatbotIdSchema,
  blockIdSchema,
  userIdSchema,
  messageSchema,
  passwordSchema,
  dateTimeSchema,
  dateSchema,
  fileUploadSchema,
  idParamSchema,
  chatbotIdParamSchema,
  blockIdParamSchema,
  oauthProviderSchema,
  databaseTypeSchema,
} from '../schemas';

describe('Validation Schemas', () => {
  describe('uuidSchema', () => {
    it('should accept valid UUID', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(() => uuidSchema.parse(validUuid)).not.toThrow();
    });

    it('should reject invalid UUID', () => {
      expect(() => uuidSchema.parse('invalid-uuid')).toThrow();
      expect(() => uuidSchema.parse('123')).toThrow();
    });
  });

  describe('emailSchema', () => {
    it('should accept valid email', () => {
      expect(() => emailSchema.parse('test@example.com')).not.toThrow();
    });

    it('should reject invalid email', () => {
      expect(() => emailSchema.parse('invalid-email')).toThrow();
      expect(() => emailSchema.parse('@example.com')).toThrow();
    });
  });

  describe('urlSchema', () => {
    it('should accept valid URL', () => {
      expect(() => urlSchema.parse('https://example.com')).not.toThrow();
      expect(() => urlSchema.parse('http://example.com/path')).not.toThrow();
    });

    it('should reject invalid URL', () => {
      expect(() => urlSchema.parse('not-a-url')).toThrow();
      expect(() => urlSchema.parse('example.com')).toThrow();
    });
  });

  describe('paginationSchema', () => {
    it('should accept valid pagination', () => {
      expect(() => paginationSchema.parse({ page: 1, limit: 20 })).not.toThrow();
      expect(() => paginationSchema.parse({ page: '1', limit: '20' })).not.toThrow(); // Coercion
    });

    it('should apply defaults', () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should enforce limits', () => {
      expect(() => paginationSchema.parse({ limit: 101 })).toThrow(); // Max 100
      expect(() => paginationSchema.parse({ page: 0 })).toThrow(); // Min 1
    });
  });

  describe('messageSchema', () => {
    it('should accept valid message', () => {
      expect(() => messageSchema.parse('Hello world')).not.toThrow();
    });

    it('should reject empty message', () => {
      expect(() => messageSchema.parse('')).toThrow();
      expect(() => messageSchema.parse('   ')).toThrow(); // Trimmed to empty
    });

    it('should reject message that is too long', () => {
      const longMessage = 'a'.repeat(10001);
      expect(() => messageSchema.parse(longMessage)).toThrow();
    });

    it('should trim whitespace', () => {
      const result = messageSchema.parse('  Hello  ');
      expect(result).toBe('Hello');
    });
  });

  describe('passwordSchema', () => {
    it('should accept valid password', () => {
      const validPassword = 'Password123!';
      expect(() => passwordSchema.parse(validPassword)).not.toThrow();
    });

    it('should reject short password', () => {
      expect(() => passwordSchema.parse('Short1!')).toThrow();
    });

    it('should reject password without uppercase', () => {
      expect(() => passwordSchema.parse('password123!')).toThrow();
    });

    it('should reject password without lowercase', () => {
      expect(() => passwordSchema.parse('PASSWORD123!')).toThrow();
    });

    it('should reject password without number', () => {
      expect(() => passwordSchema.parse('Password!')).toThrow();
    });

    it('should reject password without special character', () => {
      expect(() => passwordSchema.parse('Password123')).toThrow();
    });
  });

  describe('cuidSchema', () => {
    it('should accept valid CUID', () => {
      const validCuid = 'cmjbb8hwd0001qn1tp1of601g';
      expect(() => cuidSchema.parse(validCuid)).not.toThrow();
    });

    it('should reject invalid CUID', () => {
      expect(() => cuidSchema.parse('invalid-cuid')).toThrow();
      expect(() => cuidSchema.parse('123')).toThrow();
      expect(() => cuidSchema.parse('123e4567-e89b-12d3-a456-426614174000')).toThrow(); // UUID format
    });

    it('should reject CUID that is too short', () => {
      expect(() => cuidSchema.parse('c123')).toThrow();
    });

    it('should reject CUID that is too long', () => {
      const longCuid = 'c' + 'a'.repeat(30);
      expect(() => cuidSchema.parse(longCuid)).toThrow();
    });
  });

  describe('chatbotIdSchema, blockIdSchema, userIdSchema', () => {
    const validCuid = 'cmjbb8hwd0001qn1tp1of601g';

    it('should accept valid CUIDs', () => {
      expect(() => chatbotIdSchema.parse(validCuid)).not.toThrow();
      expect(() => blockIdSchema.parse(validCuid)).not.toThrow();
      expect(() => userIdSchema.parse(validCuid)).not.toThrow();
    });

    it('should reject invalid CUIDs', () => {
      expect(() => chatbotIdSchema.parse('invalid')).toThrow();
      expect(() => blockIdSchema.parse('123e4567-e89b-12d3-a456-426614174000')).toThrow();
      expect(() => userIdSchema.parse('not-a-cuid')).toThrow();
    });
  });

  describe('fileUploadSchema', () => {
    it('should accept valid file upload data with CUIDs', () => {
      const validData = {
        chatbotId: 'cmjbb8hwd0001qn1tp1of601g',
        blockId: 'cmjbb8hwd0001qn1tp1of602h',
      };
      expect(() => fileUploadSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid CUIDs', () => {
      expect(() => fileUploadSchema.parse({
        chatbotId: 'invalid',
        blockId: 'cmjbb8hwd0001qn1tp1of602h',
      })).toThrow();
    });
  });

  describe('oauthProviderSchema', () => {
    it('should accept valid providers', () => {
      expect(() => oauthProviderSchema.parse('google')).not.toThrow();
      expect(() => oauthProviderSchema.parse('microsoft')).not.toThrow();
      expect(() => oauthProviderSchema.parse('slack')).not.toThrow();
      expect(() => oauthProviderSchema.parse('nextcloud')).not.toThrow();
    });

    it('should reject invalid providers', () => {
      expect(() => oauthProviderSchema.parse('invalid')).toThrow();
      expect(() => oauthProviderSchema.parse('facebook')).toThrow();
    });
  });

  describe('databaseTypeSchema', () => {
    it('should accept valid database types', () => {
      expect(() => databaseTypeSchema.parse('postgresql')).not.toThrow();
      expect(() => databaseTypeSchema.parse('mysql')).not.toThrow();
      expect(() => databaseTypeSchema.parse('sqlite')).not.toThrow();
    });

    it('should reject invalid database types', () => {
      expect(() => databaseTypeSchema.parse('mongodb')).toThrow();
      expect(() => databaseTypeSchema.parse('invalid')).toThrow();
    });
  });
});
