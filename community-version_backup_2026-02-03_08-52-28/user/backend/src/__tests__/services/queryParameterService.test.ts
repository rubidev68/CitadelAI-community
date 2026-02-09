import { describe, it, expect } from 'vitest';

// This wrapper simply re-exports from @shared/services.
// We just need to ensure the important functions are properly re-exported.
import * as userQueryParamService from '../../services/queryParameterService';
import * as sharedServices from '@shared/services';

describe('queryParameterService wrapper', () => {
  it('re-exports extractParameters from @shared/services', () => {
    expect(userQueryParamService.extractParameters).toBe(sharedServices.extractParameters);
  });

  it('re-exports buildParameterizedQuery from @shared/services', () => {
    expect(userQueryParamService.buildParameterizedQuery).toBe(
      sharedServices.buildParameterizedQuery,
    );
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractParameters,
  extractFromMessage,
  buildParameterizedQuery,
  ParameterConfig,
} from '../../services/queryParameterService';

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

describe('Query Parameter Service', () => {
  describe('extractParameters', () => {
    it('should extract static parameters', async () => {
      const configs: ParameterConfig[] = [
        {
          name: 'status',
          source: 'static',
          defaultValue: 'active',
          type: 'string',
        },
      ];

      const result = await extractParameters('test message', configs);

      expect(result).toEqual({ status: 'active' });
    });

    it('should extract parameters from session data', async () => {
      const configs: ParameterConfig[] = [
        {
          name: 'userId',
          source: 'session_data',
          type: 'string',
        },
      ];

      const sessionData = { userId: 'user-123' };
      const result = await extractParameters('test message', configs, sessionData);

      expect(result).toEqual({ userId: 'user-123' });
    });

    it('should use default value when session data not available', async () => {
      const configs: ParameterConfig[] = [
        {
          name: 'userId',
          source: 'session_data',
          defaultValue: 'default-user',
          type: 'string',
        },
      ];

      const result = await extractParameters('test message', configs);

      expect(result).toEqual({ userId: 'default-user' });
    });

    it('should extract parameters from user message using regex pattern', async () => {
      const configs: ParameterConfig[] = [
        {
          name: 'orderId',
          source: 'user_message',
          extraction: 'order[\\s#:]+(\\d+)',
          type: 'string',
        },
      ];

      const result = await extractParameters('Please check order #12345', configs);

      expect(result).toEqual({ orderId: '12345' });
    });

    it('should use full match when no capture group in regex', async () => {
      const configs: ParameterConfig[] = [
        {
          name: 'keyword',
          source: 'user_message',
          extraction: 'urgent',
          type: 'string',
        },
      ];

      const result = await extractParameters('This is urgent', configs);

      expect(result).toEqual({ keyword: 'urgent' });
    });

    it('should extract by parameter name when no extraction pattern provided', async () => {
      const configs: ParameterConfig[] = [
        {
          name: 'userId',
          source: 'user_message',
          type: 'string',
        },
      ];

      // The regex pattern uses \w+ which only matches word characters (stops at hyphen)
      const result = await extractParameters('userId: user123', configs);

      expect(result).toEqual({ userId: 'user123' });
    });

    it('should use default value when extraction fails', async () => {
      const configs: ParameterConfig[] = [
        {
          name: 'orderId',
          source: 'user_message',
          extraction: 'order[\\s#:]+(\\d+)',
          defaultValue: 'unknown',
          type: 'string',
        },
      ];

      const result = await extractParameters('Hello there', configs);

      expect(result).toEqual({ orderId: 'unknown' });
    });

    it('should extract with LLM when llmService provided', async () => {
      const mockLLMService = {
        generateResponse: vi.fn().mockResolvedValue('extracted-value'),
      };

      const configs: ParameterConfig[] = [
        {
          name: 'entity',
          source: 'llm_extracted',
          extraction: 'Extract the entity name',
          type: 'string',
        },
      ];

      const result = await extractParameters('test message', configs, {}, mockLLMService);

      expect(mockLLMService.generateResponse).toHaveBeenCalled();
      expect(result).toEqual({ entity: 'extracted-value' });
    });

    it('should use default value when LLM extraction fails', async () => {
      const mockLLMService = {
        generateResponse: vi.fn().mockRejectedValue(new Error('LLM error')),
      };

      const configs: ParameterConfig[] = [
        {
          name: 'entity',
          source: 'llm_extracted',
          extraction: 'Extract the entity name',
          defaultValue: 'default-entity',
          type: 'string',
        },
      ];

      const result = await extractParameters('test message', configs, {}, mockLLMService);

      expect(result).toEqual({ entity: 'default-entity' });
      expect(console.error).toHaveBeenCalled();
    });

    it('should use default value when LLM service not provided', async () => {
      const configs: ParameterConfig[] = [
        {
          name: 'entity',
          source: 'llm_extracted',
          extraction: 'Extract the entity name',
          defaultValue: 'default-entity',
          type: 'string',
        },
      ];

      const result = await extractParameters('test message', configs);

      expect(result).toEqual({ entity: 'default-entity' });
    });

    it('should convert values to number type', async () => {
      const configs: ParameterConfig[] = [
        {
          name: 'count',
          source: 'static',
          defaultValue: '42',
          type: 'number',
        },
      ];

      const result = await extractParameters('test', configs);

      expect(result).toEqual({ count: 42 });
    });

    it('should return null for invalid number', async () => {
      const configs: ParameterConfig[] = [
        {
          name: 'count',
          source: 'static',
          defaultValue: 'not-a-number',
          type: 'number',
        },
      ];

      const result = await extractParameters('test', configs);

      expect(result).toEqual({ count: null });
    });

    it('should convert values to boolean type', async () => {
      const testCases = [
        { value: 'true', expected: true },
        { value: '1', expected: true },
        { value: 'yes', expected: true },
        { value: 'false', expected: false },
        { value: '0', expected: false },
        { value: 'no', expected: false },
      ];

      for (const testCase of testCases) {
        const configs: ParameterConfig[] = [
          {
            name: 'flag',
            source: 'static',
            defaultValue: testCase.value,
            type: 'boolean',
          },
        ];

        const result = await extractParameters('test', configs);
        expect(result.flag).toBe(testCase.expected);
      }
    });

    it('should convert values to date type', async () => {
      const configs: ParameterConfig[] = [
        {
          name: 'date',
          source: 'static',
          defaultValue: '2024-01-01',
          type: 'date',
        },
      ];

      const result = await extractParameters('test', configs);

      expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should return null for invalid date', async () => {
      const configs: ParameterConfig[] = [
        {
          name: 'date',
          source: 'static',
          defaultValue: 'invalid-date',
          type: 'date',
        },
      ];

      const result = await extractParameters('test', configs);

      expect(result).toEqual({ date: null });
    });

    it('should handle multiple parameters', async () => {
      const configs: ParameterConfig[] = [
        {
          name: 'userId',
          source: 'session_data',
          type: 'string',
        },
        {
          name: 'status',
          source: 'static',
          defaultValue: 'active',
          type: 'string',
        },
        {
          name: 'orderId',
          source: 'user_message',
          extraction: 'order[\\s#:]+(\\d+)',
          type: 'string',
        },
      ];

      const sessionData = { userId: 'user-123' };
      const result = await extractParameters('Please check order #12345', configs, sessionData);

      expect(result).toEqual({
        userId: 'user-123',
        status: 'active',
        orderId: '12345',
      });
    });

    it('should not include null values in result', async () => {
      const configs: ParameterConfig[] = [
        {
          name: 'value',
          source: 'session_data',
          type: 'string',
        },
      ];

      const sessionData = { value: null };
      const result = await extractParameters('test', configs, sessionData);

      // Null values are not added to parameters (checked before adding)
      expect(result).toEqual({});
    });

    it('should handle LLM service without generateResponse method', async () => {
      const mockLLMService = {};

      const configs: ParameterConfig[] = [
        {
          name: 'entity',
          source: 'llm_extracted',
          extraction: 'Extract entity',
          defaultValue: 'default',
          type: 'string',
        },
      ];

      const result = await extractParameters('test', configs, {}, mockLLMService);

      expect(result).toEqual({ entity: 'default' });
    });

    it('should handle LLM service returning empty string', async () => {
      const mockLLMService = {
        generateResponse: vi.fn().mockResolvedValue('   '),
      };

      const configs: ParameterConfig[] = [
        {
          name: 'entity',
          source: 'llm_extracted',
          extraction: 'Extract entity',
          defaultValue: 'default',
          type: 'string',
        },
      ];

      const result = await extractParameters('test', configs, {}, mockLLMService);

      expect(result).toEqual({ entity: 'default' });
    });
  });

  describe('extractFromMessage', () => {
    it('should extract value using regex pattern', () => {
      const result = extractFromMessage('Order #12345', 'order[\\s#:]+(\\d+)');

      expect(result).toBe('12345');
    });

    it('should return full match when no capture group', () => {
      const result = extractFromMessage('This is urgent', 'urgent');

      expect(result).toBe('urgent');
    });

    it('should return null when no match', () => {
      const result = extractFromMessage('Hello world', 'order[\\s#:]+(\\d+)');

      expect(result).toBeNull();
    });

    it('should handle invalid regex pattern gracefully', () => {
      const result = extractFromMessage('test message', '[');

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('should be case insensitive', () => {
      const result = extractFromMessage('ORDER #12345', 'order[\\s#:]+(\\d+)');

      expect(result).toBe('12345');
    });
  });

  describe('buildParameterizedQuery', () => {
    it('should replace named parameters with positional markers', () => {
      const queryTemplate = 'SELECT * FROM users WHERE id = :userId AND status = :status';
      const parameters = {
        userId: 'user-123',
        status: 'active',
      };

      const result = buildParameterizedQuery(queryTemplate, parameters);

      expect(result.query).toBe('SELECT * FROM users WHERE id = $1 AND status = $2');
      expect(result.values).toEqual(['user-123', 'active']);
    });

    it('should replace positional parameters (?) with markers', () => {
      const queryTemplate = 'SELECT * FROM users WHERE id = ? AND status = ?';
      const parameters = {
        userId: 'user-123',
        status: 'active',
      };

      const result = buildParameterizedQuery(queryTemplate, parameters);

      expect(result.query).toBe('SELECT * FROM users WHERE id = $1 AND status = $2');
      expect(result.values).toEqual(['user-123', 'active']);
    });

    it('should handle mixed named and positional parameters', () => {
      const queryTemplate = 'SELECT * FROM users WHERE id = :userId AND status = ?';
      const parameters = {
        userId: 'user-123',
        status: 'active',
      };

      const result = buildParameterizedQuery(queryTemplate, parameters);

      expect(result.query).toBe('SELECT * FROM users WHERE id = $1 AND status = $2');
      expect(result.values).toEqual(['user-123', 'active']);
    });

    it('should handle parameters not in query', () => {
      const queryTemplate = 'SELECT * FROM users WHERE id = :userId';
      const parameters = {
        userId: 'user-123',
        extraParam: 'ignored',
      };

      const result = buildParameterizedQuery(queryTemplate, parameters);

      expect(result.query).toBe('SELECT * FROM users WHERE id = $1');
      expect(result.values).toEqual(['user-123']);
    });

    it('should handle empty parameters object', () => {
      const queryTemplate = 'SELECT * FROM users';
      const parameters = {};

      const result = buildParameterizedQuery(queryTemplate, parameters);

      expect(result.query).toBe('SELECT * FROM users');
      expect(result.values).toEqual([]);
    });

    it('should handle multiple occurrences of same parameter', () => {
      const queryTemplate = 'SELECT * FROM users WHERE id = :userId OR parent_id = :userId';
      const parameters = {
        userId: 'user-123',
      };

      const result = buildParameterizedQuery(queryTemplate, parameters);

      // The implementation replaces all occurrences of the same parameter with the same index
      // and only adds the value once to the values array
      expect(result.query).toBe('SELECT * FROM users WHERE id = $1 OR parent_id = $1');
      expect(result.values).toEqual(['user-123']);
    });

    it('should handle word boundaries in parameter names', () => {
      const queryTemplate = 'SELECT * FROM users WHERE id = :userId AND user_id = :userId2';
      const parameters = {
        userId: 'user-123',
        userId2: 'user-456',
      };

      const result = buildParameterizedQuery(queryTemplate, parameters);

      expect(result.query).toBe('SELECT * FROM users WHERE id = $1 AND user_id = $2');
      expect(result.values).toEqual(['user-123', 'user-456']);
    });

    it('should handle null and undefined values', () => {
      const queryTemplate = 'SELECT * FROM users WHERE id = :userId AND status = :status';
      const parameters = {
        userId: 'user-123',
        status: null,
      };

      const result = buildParameterizedQuery(queryTemplate, parameters);

      expect(result.query).toBe('SELECT * FROM users WHERE id = $1 AND status = $2');
      expect(result.values).toEqual(['user-123', null]);
    });
  });
});
