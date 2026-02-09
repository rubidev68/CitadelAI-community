import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Response } from 'express';
import {
  successResponse,
  errorResponse,
  sendSuccessResponse,
  sendErrorResponse,
} from '../../response/responseFormatter';

// Mock shared utils
vi.mock('@shared/utils', () => ({
  getCorrelationId: () => 'test-correlation-id',
}));

describe('Response Formatters', () => {
  let res: Response;

  beforeEach(() => {
    vi.clearAllMocks();
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
  });

  describe('successResponse', () => {
    it('should create success response with data', () => {
      const response = successResponse({ id: '123', name: 'Test' });

      expect(response).toEqual({
        success: true,
        data: { id: '123', name: 'Test' },
        metadata: {
          requestId: 'test-correlation-id',
          timestamp: expect.any(String),
        },
      });
    });

    it('should create success response with metadata', () => {
      const response = successResponse({ id: '123' }, { timestamp: '2025-01-01T00:00:00Z' });

      expect(response).toEqual({
        success: true,
        data: { id: '123' },
        metadata: {
          requestId: 'test-correlation-id',
          timestamp: '2025-01-01T00:00:00Z',
        },
      });
    });
  });

  describe('errorResponse', () => {
    it('should create error response with message', () => {
      const response = errorResponse('ERROR', 'Test error');

      expect(response).toEqual({
        success: false,
        error: 'ERROR',
        message: 'Test error',
        requestId: 'test-correlation-id',
      });
    });

    it('should create error response with code', () => {
      const response = errorResponse('ERROR', 'Test error', 'ERROR_CODE');

      expect(response).toEqual({
        success: false,
        error: 'ERROR',
        message: 'Test error',
        code: 'ERROR_CODE',
        requestId: 'test-correlation-id',
      });
    });

    it('should create error response with details', () => {
      const response = errorResponse('ERROR', 'Test error', 'ERROR_CODE', { field: 'email' });

      expect(response).toEqual({
        success: false,
        error: 'ERROR',
        message: 'Test error',
        code: 'ERROR_CODE',
        details: { field: 'email' },
        requestId: 'test-correlation-id',
      });
    });
  });

  describe('sendSuccessResponse', () => {
    it('should send success response with data', () => {
      sendSuccessResponse(res, { id: '123', name: 'Test' });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { id: '123', name: 'Test' },
        metadata: {
          requestId: 'test-correlation-id',
          timestamp: expect.any(String),
        },
      });
    });

    it('should send success response with custom status code', () => {
      sendSuccessResponse(res, { id: '123' }, undefined, 201);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { id: '123' },
        metadata: {
          requestId: 'test-correlation-id',
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('sendErrorResponse', () => {
    it('should send error response with message', () => {
      sendErrorResponse(res, 'ERROR', 'Bad Request');

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'ERROR',
        message: 'Bad Request',
        requestId: 'test-correlation-id',
      });
    });

    it('should send error response with code', () => {
      sendErrorResponse(res, 'ERROR', 'Bad Request', 400, 'VALIDATION_ERROR');

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'ERROR',
        message: 'Bad Request',
        code: 'VALIDATION_ERROR',
        requestId: 'test-correlation-id',
      });
    });

    it('should send error response with details', () => {
      sendErrorResponse(res, 'ERROR', 'Bad Request', 400, 'VALIDATION_ERROR', { field: 'email' });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'ERROR',
        message: 'Bad Request',
        code: 'VALIDATION_ERROR',
        details: { field: 'email' },
        requestId: 'test-correlation-id',
      });
    });
  });
});
