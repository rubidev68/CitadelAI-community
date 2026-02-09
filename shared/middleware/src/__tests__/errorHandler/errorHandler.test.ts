import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { createErrorHandler } from '../../errorHandler/errorHandler';

// Mock shared utils
vi.mock('@shared/utils', () => ({
  formatErrorForApi: (err: unknown) => {
    if (err instanceof Error) {
      return {
        message: err.message,
        code: (err as any).code,
        details: (err as any).details,
      };
    }
    return { message: String(err) };
  },
  getCorrelationId: () => 'test-correlation-id',
}));

describe('createErrorHandler', () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;
  let mockLogger: { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    
    req = {
      method: 'GET',
      path: '/test',
    } as Request;

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    next = vi.fn() as unknown as NextFunction;

    mockLogger = {
      error: vi.fn(),
    };
  });

  it('should handle errors with logger', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    const errorHandler = createErrorHandler({ logger: mockLogger });
    const error = new Error('Test error');

    errorHandler(error, req, res, next);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Request error',
      error,
      expect.objectContaining({
        service: 'error-handler',
        method: 'GET',
        path: '/test',
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Internal Server Error',
        message: 'Test error',
        requestId: 'test-correlation-id',
      })
    );
    
    process.env.NODE_ENV = originalEnv;
  });

  it('should handle errors without logger', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const errorHandler = createErrorHandler();
    const error = new Error('Test error');

    errorHandler(error, req, res, next);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', error);
    expect(res.status).toHaveBeenCalledWith(500);
    consoleErrorSpy.mockRestore();
  });

  it('should use custom status code from error', () => {
    const errorHandler = createErrorHandler({ logger: mockLogger });
    const error = new Error('Not found') as Error & { statusCode?: number };
    error.statusCode = 404;

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Error',
        message: 'Not found',
      })
    );
  });

  it('should include error code in response', () => {
    const errorHandler = createErrorHandler({ logger: mockLogger });
    const error = new Error('Validation error') as Error & { code?: string };
    error.code = 'VALIDATION_ERROR';

    errorHandler(error, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
      })
    );
  });

  it('should include error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const errorHandler = createErrorHandler({ logger: mockLogger });
    const error = new Error('Test error') as Error & { details?: unknown };
    error.details = { field: 'email', reason: 'invalid format' };

    errorHandler(error, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: { field: 'email', reason: 'invalid format' },
      })
    );

    process.env.NODE_ENV = originalEnv;
  });

  it('should include stack trace in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const errorHandler = createErrorHandler({ logger: mockLogger });
    const error = new Error('Test error');

    errorHandler(error, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        stack: expect.any(String),
      })
    );

    process.env.NODE_ENV = originalEnv;
  });

  it('should not include stack trace in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const errorHandler = createErrorHandler({ logger: mockLogger });
    const error = new Error('Test error');

    errorHandler(error, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.not.objectContaining({
        stack: expect.anything(),
      })
    );

    process.env.NODE_ENV = originalEnv;
  });

  it('should use generic message for 500 errors in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const errorHandler = createErrorHandler({
      logger: mockLogger,
      includeDetails: false,
    });
    const error = new Error('Internal server error');

    errorHandler(error, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Something went wrong',
      })
    );

    process.env.NODE_ENV = originalEnv;
  });

  it('should handle non-Error objects', () => {
    const errorHandler = createErrorHandler({ logger: mockLogger });

    errorHandler('String error', req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Internal Server Error',
      })
    );
  });

  it('should respect includeStack option', () => {
    const errorHandler = createErrorHandler({
      logger: mockLogger,
      includeStack: true,
    });
    const error = new Error('Test error');

    errorHandler(error, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        stack: expect.any(String),
      })
    );
  });

  it('should respect includeDetails option', () => {
    const errorHandler = createErrorHandler({
      logger: mockLogger,
      includeDetails: true,
    });
    const error = new Error('Test error') as Error & { details?: unknown };
    error.details = { test: 'data' };

    errorHandler(error, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: { test: 'data' },
      })
    );
  });
});
