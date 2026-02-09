import { Request, Response } from 'express';
import { AdminAuthRequest } from '../middleware/adminAuth';
import { vi } from 'vitest';

export const createMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => {
  return {
    body: {},
    query: {},
    params: {},
    headers: {},
    ...overrides,
  };
};

export const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    write: vi.fn().mockReturnThis(),
    writeHead: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    headersSent: false,
  };
  return res;
};

export const createMockAdminAuthRequest = (overrides: Partial<AdminAuthRequest> = {}): Partial<AdminAuthRequest> => {
  return {
    ...createMockRequest(),
    adminUser: {
      id: 'admin-id',
      email: 'admin@example.com',
      name: 'Admin User',
    },
    ...overrides,
  };
};

export const createMockNext = () => vi.fn();
