import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { createRateLimiter } from '../../rateLimiter/rateLimiter';
import rateLimit from 'express-rate-limit';

// Mock express-rate-limit
vi.mock('express-rate-limit', () => {
  const mockMiddleware = vi.fn((req: Request, res: Response, next: NextFunction) => {
    next();
  });
  return {
    default: vi.fn(() => mockMiddleware),
  };
});

describe('createRateLimiter', () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {} as Request;
    res = {} as Response;
    next = vi.fn() as unknown as NextFunction;
  });

  it('should create rate limiter with default message', () => {
    const limiter = createRateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 100,
    });

    expect(rateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: { error: 'Too many requests, please try again later' },
        standardHeaders: true,
        legacyHeaders: false,
      })
    );
    expect(limiter).toBeDefined();
  });

  it('should create rate limiter with custom message', () => {
    const limiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 10,
      message: 'Custom rate limit message',
    });

    expect(rateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        windowMs: 60 * 1000,
        max: 10,
        message: { error: 'Custom rate limit message' },
      })
    );
    expect(limiter).toBeDefined();
  });

  it('should create rate limiter with additional options', () => {
    const limiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 10,
      options: {
        skip: (req) => req.ip === '127.0.0.1',
      },
    });

    expect(rateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        windowMs: 60 * 1000,
        max: 10,
        skip: expect.any(Function),
      })
    );
    expect(limiter).toBeDefined();
  });

  it('should merge additional options with defaults', () => {
    const limiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 10,
      options: {
        standardHeaders: false,
        legacyHeaders: true,
      },
    });

    expect(rateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        windowMs: 60 * 1000,
        max: 10,
        standardHeaders: false,
        legacyHeaders: true,
      })
    );
    expect(limiter).toBeDefined();
  });
});
