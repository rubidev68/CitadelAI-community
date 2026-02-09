import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware';

// Mock logger
vi.mock('../../logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('validateRequest Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      body: {},
      params: {},
      query: {},
      path: '/test',
      method: 'POST',
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe('Body Validation', () => {
    it('should pass validation for valid body', async () => {
      const schema = {
        body: z.object({
          email: z.string().email(),
          password: z.string().min(8),
        }),
      };

      req.body = {
        email: 'test@example.com',
        password: 'password123',
      };

      const middleware = validateRequest(schema);
      await middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
      expect(req.body).toEqual({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should reject invalid body and return 400', async () => {
      const schema = {
        body: z.object({
          email: z.string().email(),
          password: z.string().min(8),
        }),
      };

      req.body = {
        email: 'invalid-email',
        password: 'short',
      };

      const middleware = validateRequest(schema);
      await middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: expect.any(String),
              message: expect.any(String),
              path: expect.any(Array),
            }),
          ]),
        },
      });
    });

    it('should reject invalid data without coercion', async () => {
      const schema = {
        body: z.object({
          age: z.number(),
        }),
      };

      req.body = {
        age: '25', // String instead of number - should be rejected
      };

      const middleware = validateRequest(schema);
      await middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Params Validation', () => {
    it('should pass validation for valid params (CUID)', async () => {
      const schema = {
        params: z.object({
          id: z.string().min(20).max(30).regex(/^c[a-z0-9]+$/),
        }),
      };

      req.params = {
        id: 'cmjbb8hwd0001qn1tp1of601g',
      };

      const middleware = validateRequest(schema);
      await middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject invalid params', async () => {
      const schema = {
        params: z.object({
          id: z.string().min(20).max(30).regex(/^c[a-z0-9]+$/),
        }),
      };

      req.params = {
        id: 'invalid-cuid',
      };

      const middleware = validateRequest(schema);
      await middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Query Validation', () => {
    it('should pass validation for valid query', async () => {
      const schema = {
        query: z.object({
          page: z.coerce.number().int().min(1).optional(),
          limit: z.coerce.number().int().min(1).max(100).optional(),
        }),
      };

      req.query = {
        page: '1',
        limit: '20',
      };

      const middleware = validateRequest(schema);
      await middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject invalid query', async () => {
      const schema = {
        query: z.object({
          page: z.coerce.number().int().min(1),
        }),
      };

      req.query = {
        page: '0', // Invalid: must be >= 1
      };

      const middleware = validateRequest(schema);
      await middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Combined Validation', () => {
    it('should validate body, params, and query together', async () => {
      const schema = {
        body: z.object({
          name: z.string(),
        }),
        params: z.object({
          id: z.string().min(20).max(30).regex(/^c[a-z0-9]+$/),
        }),
        query: z.object({
          page: z.coerce.number().int().min(1).optional(),
        }),
      };

      req.body = { name: 'Test' };
      req.params = { id: 'cmjbb8hwd0001qn1tp1of601g' };
      req.query = { page: '1' };

      const middleware = validateRequest(schema);
      await middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should fail if any validation fails', async () => {
      const schema = {
        body: z.object({
          name: z.string(),
        }),
        params: z.object({
          id: z.string().min(20).max(30).regex(/^c[a-z0-9]+$/),
        }),
      };

      req.body = { name: 'Test' };
      req.params = { id: 'invalid' }; // Invalid CUID

      const middleware = validateRequest(schema);
      await middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Error Handling', () => {
    it('should pass through non-Zod errors', async () => {
      const schema = {
        body: z.object({
          name: z.string(),
        }),
      };

      req.body = { name: 'Test' };

      const middleware = validateRequest(schema);
      const testError = new Error('Test error');
      
      // Simulate an error in next()
      next = vi.fn().mockImplementation(() => {
        throw testError;
      });

      await expect(
        middleware(req as Request, res as Response, next)
      ).rejects.toThrow('Test error');
    });
  });
});
