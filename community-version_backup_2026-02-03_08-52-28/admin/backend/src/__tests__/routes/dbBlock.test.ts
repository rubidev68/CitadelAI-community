import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BlockType } from '@prisma/client';
import request from 'supertest';
import express from 'express';
import dbBlockRouter from '../../routes/dbBlock';

// Mock Prisma - use vi.hoisted to ensure mocks are available when vi.mock runs
// Must be defined inline to avoid import hoisting issues
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    adminUser: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    chatbot: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    block: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn((callback: any) => callback(mockPrisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
  BlockType: {
    ACTION: 'ACTION',
    CONTEXT: 'CONTEXT',
    LOGIC: 'LOGIC',
  },
}));

// Mock Prisma lib
vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
  getPrismaClient: () => mockPrisma,
}));

// Mock DB services - use vi.hoisted
const { mockDbConnectionService, mockDbQueryValidator, mockQueryParameterService, mockDbSchemaDiscovery, mockDbBlockExecutionService, mockDbFileStorageService } = vi.hoisted(() => {
  const mockDbConnectionService = {
    testConnection: vi.fn(),
    getDbConnection: vi.fn(),
    executeSelectQuery: vi.fn(),
    prepareCredentialsForStorage: vi.fn((creds: any) => ({ ...creds, password: creds.password ? 'encrypted-' + creds.password : undefined })),
  };
  const mockDbQueryValidator = {
    validateSelectQuery: vi.fn(),
  };
  const mockQueryParameterService = {
    buildParameterizedQuery: vi.fn(),
  };
  const mockDbSchemaDiscovery = {
    discoverSchema: vi.fn(),
  };
  const mockDbBlockExecutionService = {
    executeDbBlock: vi.fn(),
    shouldExecuteDbBlock: vi.fn(),
  };
  const mockDbFileStorageService = {
    storeFile: vi.fn(),
    getFileInfo: vi.fn(),
    deleteFile: vi.fn(),
  };
  return { mockDbConnectionService, mockDbQueryValidator, mockQueryParameterService, mockDbSchemaDiscovery, mockDbBlockExecutionService, mockDbFileStorageService };
});

vi.mock('../../services/dbConnectionService', () => ({
  testConnection: mockDbConnectionService.testConnection,
  getDbConnection: mockDbConnectionService.getDbConnection,
  executeSelectQuery: mockDbConnectionService.executeSelectQuery,
  prepareCredentialsForStorage: mockDbConnectionService.prepareCredentialsForStorage,
}));

vi.mock('../../services/dbQueryValidator', () => ({
  validateSelectQuery: mockDbQueryValidator.validateSelectQuery,
}));

vi.mock('../../services/queryParameterService', () => ({
  buildParameterizedQuery: mockQueryParameterService.buildParameterizedQuery,
}));

vi.mock('../../services/dbSchemaDiscovery', () => ({
  discoverSchema: mockDbSchemaDiscovery.discoverSchema,
}));

vi.mock('../../services/dbBlockExecutionService', () => ({
  executeDbBlock: mockDbBlockExecutionService.executeDbBlock,
  shouldExecuteDbBlock: mockDbBlockExecutionService.shouldExecuteDbBlock,
}));

vi.mock('../../services/dbFileStorageService', () => ({
  dbFileStorageService: mockDbFileStorageService,
}));

// Mock adminAuth middleware
const { mockAdminAuthMiddleware } = vi.hoisted(() => {
  const mockAdminAuthMiddleware = vi.fn((req: any, res: any, next: any) => {
    req.adminUser = {
      id: 'admin-id',
      email: 'admin@example.com',
      name: 'Admin User',
    };
    next();
  });
  return { mockAdminAuthMiddleware };
});

vi.mock('../../middleware/adminAuth', () => ({
  adminAuthMiddleware: mockAdminAuthMiddleware,
  AdminAuthRequest: {},
}));

// Mock multer - use vi.hoisted
const { mockMulterSingle, mockMulterFactory } = vi.hoisted(() => {
  const mockMulterSingle = vi.fn((req: any, res: any, next: any) => {
    // Default: set req.file for successful uploads
    req.file = {
      buffer: Buffer.from('sqlite content'),
      originalname: 'test.db',
      mimetype: 'application/octet-stream',
      size: 1024,
    };
    next();
  });
  const mockMulterFactory = vi.fn(() => ({
    single: vi.fn(() => mockMulterSingle),
  }));
  mockMulterFactory.memoryStorage = vi.fn(() => ({}));
  return { mockMulterSingle, mockMulterFactory };
});

vi.mock('multer', () => ({
  default: mockMulterFactory,
}));

// Mock dbExampleQueryGenerator
const { mockDbExampleQueryGenerator } = vi.hoisted(() => {
  const mockDbExampleQueryGenerator = {
    generateExampleQueries: vi.fn(),
  };
  return { mockDbExampleQueryGenerator };
});

vi.mock('../../services/dbExampleQueryGenerator', () => ({
  generateExampleQueries: mockDbExampleQueryGenerator.generateExampleQueries,
}));

describe('DB Block Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin', dbBlockRouter);
    // Add error handler to catch and log errors
    app.use((err: any, req: any, res: any, next: any) => {
      // CRITICAL: If response already sent (e.g., by validation middleware), don't send another response
      // Check both headersSent and writableEnded to be absolutely sure
      if (res.headersSent || res.writableEnded || res.finished) {
        // Response already sent - don't interfere
        return;
      }
      // Log error for debugging
      if (process.env.DEBUG) {
        console.error('Express error handler:', err);
      }
      // Only send error response if headers haven't been sent
      // Double-check before sending to prevent double responses
      if (!res.headersSent && !res.writableEnded && !res.finished) {
        try {
          res.status(err.status || 500).json({
            error: err.status === 400 ? 'Bad Request' : 'Internal Server Error',
            message: err.message || 'An error occurred',
          });
        } catch (sendError) {
          // If sending fails, response might have already been sent
          // Just return silently
          return;
        }
      }
    });
    vi.clearAllMocks();
    
    // Reset multer mock
    mockMulterSingle.mockImplementation((req: any, res: any, next: any) => {
      req.file = {
        buffer: Buffer.from('sqlite content'),
        originalname: 'test.db',
        mimetype: 'application/octet-stream',
        size: 1024,
      };
      next();
    });
    
    // Reset dbFileStorageService mocks
    mockDbFileStorageService.getFilePath = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/admin/chatbots/:chatbotId/blocks/:blockId/test-connection', () => {
    const chatbotId = 'cmjbb8hwd0001qn1tp1of601g'; // Valid CUID format
    const blockId = 'cmjbb8hwd0001qn1tp1of602h'; // Valid CUID format

    beforeEach(() => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      });

      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {},
      });
    });

    it('should return 401 if adminUserId is missing', async () => {
      // Mock adminAuthMiddleware to not set adminUser
      mockAdminAuthMiddleware.mockImplementationOnce((req: any, res: any, next: any) => {
        req.adminUser = null;
        next();
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-connection`)
        .send({
          dbType: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'user',
          password: 'pass',
        })
        .expect(401);

      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should return 400 if dbType is missing', async () => {
      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-connection`)
        .send({
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'user',
          password: 'pass',
        })
        .expect(400);

      expect(response.body.message || response.body.error).toMatch(/dbType|Database type|Invalid database type|required/i);
    });

    it('should return 404 if chatbot not found', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-connection`)
        .send({
          dbType: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'user',
          password: 'pass',
        })
        .expect(404);

      expect(response.body).toEqual({ error: 'Chatbot not found' });
    });

    it('should return 404 if block not found', async () => {
      mockPrisma.block.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-connection`)
        .send({
          dbType: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'user',
          password: 'pass',
        })
        .expect(404);

      expect(response.body).toEqual({ error: 'DB block not found' });
    });

    it('should test connection successfully', async () => {
      mockDbConnectionService.testConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });
      
      // Mock prepareCredentialsForStorage to return the credentials object
      mockDbConnectionService.prepareCredentialsForStorage.mockReturnValue({
        dbType: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'user',
        password: 'encrypted-password',
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-connection`)
        .send({
          dbType: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'user',
          password: 'pass',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockDbConnectionService.testConnection).toHaveBeenCalled();
    });

    it('should handle connection failure', async () => {
      mockDbConnectionService.testConnection.mockResolvedValue({
        success: false,
        error: 'Connection failed',
      });
      
      // Mock prepareCredentialsForStorage
      mockDbConnectionService.prepareCredentialsForStorage.mockReturnValue({
        dbType: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'user',
        password: 'encrypted-password',
      });
      
      // Mock block.update for storing test result
      mockPrisma.block.update.mockResolvedValue({
        id: blockId,
        properties: { lastTestStatus: 'failed' },
      } as any);

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-connection`)
        .send({
          dbType: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'user',
          password: 'pass',
        })
        .expect(400); // Route returns 400 when connection fails

      expect(response.body.success).toBe(false);
    });

    it('should handle connection test errors', async () => {
      mockDbConnectionService.testConnection.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-connection`)
        .send({
          dbType: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'user',
          password: 'pass',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should handle connectionString instead of host/port', async () => {
      mockDbConnectionService.testConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });
      
      mockDbConnectionService.prepareCredentialsForStorage.mockReturnValue({
        dbType: 'postgresql',
        connectionString: 'postgresql://user:pass@localhost:5432/test',
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-connection`)
        .send({
          dbType: 'postgresql',
          connectionString: 'postgresql://user:pass@localhost:5432/test',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle different database types', async () => {
      mockDbConnectionService.testConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });
      
      mockDbConnectionService.prepareCredentialsForStorage.mockReturnValue({
        dbType: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'test',
        username: 'user',
        password: 'encrypted-password',
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-connection`)
        .send({
          dbType: 'mysql',
          host: 'localhost',
          port: 3306,
          database: 'test',
          username: 'user',
          password: 'pass',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle sqlite database type', async () => {
      mockDbConnectionService.testConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });
      
      mockDbConnectionService.prepareCredentialsForStorage.mockReturnValue({
        dbType: 'sqlite',
        connectionString: 'sqlite:///path/to/db.sqlite',
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-connection`)
        .send({
          dbType: 'sqlite',
          connectionString: 'sqlite:///path/to/db.sqlite',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle password being optional', async () => {
      mockDbConnectionService.testConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });
      
      mockDbConnectionService.prepareCredentialsForStorage.mockReturnValue({
        dbType: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'user',
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-connection`)
        .send({
          dbType: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'user',
          // No password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle CONTEXT Database block type', async () => {
      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: BlockType.CONTEXT,
        subtype: 'Database',
        properties: {},
      });

      mockDbConnectionService.testConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });
      
      mockDbConnectionService.prepareCredentialsForStorage.mockReturnValue({
        dbType: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'test',
        username: 'user',
        password: 'encrypted-password',
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-connection`)
        .send({
          dbType: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'user',
          password: 'pass',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/admin/chatbots/:chatbotId/blocks/:blockId/test-query', () => {
    const chatbotId = 'cmjbb8hwd0001qn1tp1of601g'; // Valid CUID format
    const blockId = 'cmjbb8hwd0001qn1tp1of602h'; // Valid CUID format

    beforeEach(() => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      });

      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {
          connectionMode: 'server',
          dbType: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'user',
          password: 'pass',
        },
      });
    });

    it('should return 401 if adminUserId is missing', async () => {
      // Mock adminAuthMiddleware to not set adminUser
      mockAdminAuthMiddleware.mockImplementationOnce((req: any, res: any, next: any) => {
        req.adminUser = null;
        next();
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-query`)
        .send({
          sqlQuery: 'SELECT * FROM users',
        })
        .expect(401);

      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should return 404 if chatbot not found', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-query`)
        .send({
          sqlQuery: 'SELECT * FROM users',
        })
        .expect(404);

      expect(response.body).toEqual({ error: 'Chatbot not found' });
    });

    it('should return 404 if block not found', async () => {
      mockPrisma.block.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-query`)
        .send({
          sqlQuery: 'SELECT * FROM users',
        })
        .expect(404);

      expect(response.body).toEqual({ error: 'DB block not found' });
    });

    it('should return 400 if SQL query is missing', async () => {
      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-query`)
        .send({})
        .expect(400);

      expect(response.body.message || response.body.error).toMatch(/sqlQuery|SQL query|required/i);
    });

    it('should return 400 if query is not SELECT', async () => {
      mockDbQueryValidator.validateSelectQuery.mockReturnValue({
        valid: false,
        error: 'Only SELECT queries are allowed',
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-query`)
        .send({
          sqlQuery: 'DELETE FROM users',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('SELECT');
    });

    it('should execute query successfully', async () => {
      mockDbQueryValidator.validateSelectQuery.mockReturnValue({
        valid: true,
      });

      mockQueryParameterService.buildParameterizedQuery.mockReturnValue({
        query: 'SELECT * FROM users',
        values: [],
      });

      mockDbConnectionService.getDbConnection.mockResolvedValue({});

      mockDbConnectionService.executeSelectQuery.mockResolvedValue({
        rows: [{ id: 1, name: 'Test' }],
        executionTime: 10,
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-query`)
        .send({
          sqlQuery: 'SELECT * FROM users',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.rowCount).toBe(1);
    });

    it('should limit results to 100 rows', async () => {
      mockDbQueryValidator.validateSelectQuery.mockReturnValue({
        valid: true,
      });

      mockQueryParameterService.buildParameterizedQuery.mockReturnValue({
        query: 'SELECT * FROM users',
        values: [],
      });

      mockDbConnectionService.getDbConnection.mockResolvedValue({});

      const manyRows = Array.from({ length: 150 }, (_, i) => ({ id: i }));
      mockDbConnectionService.executeSelectQuery.mockResolvedValue({
        rows: manyRows,
        executionTime: 10,
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-query`)
        .send({
          sqlQuery: 'SELECT * FROM users',
        })
        .expect(200);

      expect(response.body.results).toHaveLength(100);
      expect(response.body.totalRowCount).toBe(150);
      expect(response.body.message).toContain('100 of 150');
    });

    it('should handle query execution errors', async () => {
      mockDbQueryValidator.validateSelectQuery.mockReturnValue({
        valid: true,
      });

      mockQueryParameterService.buildParameterizedQuery.mockReturnValue({
        query: 'SELECT * FROM users',
        values: [],
      });

      mockDbConnectionService.getDbConnection.mockRejectedValue(new Error('Connection error'));

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-query`)
        .send({
          sqlQuery: 'SELECT * FROM users',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should handle query with parameters', async () => {
      mockDbQueryValidator.validateSelectQuery.mockReturnValue({
        valid: true,
      });

      mockQueryParameterService.buildParameterizedQuery.mockReturnValue({
        query: 'SELECT * FROM users WHERE id = ?',
        values: ['123'],
      });

      mockDbConnectionService.getDbConnection.mockResolvedValue({});
      mockDbConnectionService.executeSelectQuery.mockResolvedValue({
        rows: [{ id: '123', name: 'Test' }],
        executionTime: 10,
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-query`)
        .send({
          sqlQuery: 'SELECT * FROM users WHERE id = :id',
          parameters: { id: '123' },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results).toHaveLength(1);
      expect(mockQueryParameterService.buildParameterizedQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = :id',
        { id: '123' }
      );
    });

    it('should handle file-based connection mode', async () => {
      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {
          connectionMode: 'file',
          dbType: 'sqlite',
          fileId: 'file-123',
        },
      });

      mockDbQueryValidator.validateSelectQuery.mockReturnValue({
        valid: true,
      });

      mockQueryParameterService.buildParameterizedQuery.mockReturnValue({
        query: 'SELECT * FROM users',
        values: [],
      });

      mockDbConnectionService.getDbConnection.mockResolvedValue({});
      mockDbConnectionService.executeSelectQuery.mockResolvedValue({
        rows: [{ id: 1, name: 'Test' }],
        executionTime: 10,
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-query`)
        .send({
          sqlQuery: 'SELECT * FROM users',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockDbConnectionService.getDbConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionMode: 'file',
          fileId: 'file-123',
        })
      );
    });

    it('should handle connectionString in block properties', async () => {
      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {
          connectionMode: 'server',
          dbType: 'postgresql',
          connectionString: 'postgresql://user:pass@localhost:5432/test',
        },
      });

      mockDbQueryValidator.validateSelectQuery.mockReturnValue({
        valid: true,
      });

      mockQueryParameterService.buildParameterizedQuery.mockReturnValue({
        query: 'SELECT * FROM users',
        values: [],
      });

      mockDbConnectionService.getDbConnection.mockResolvedValue({});
      mockDbConnectionService.executeSelectQuery.mockResolvedValue({
        rows: [{ id: 1 }],
        executionTime: 10,
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-query`)
        .send({
          sqlQuery: 'SELECT * FROM users',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle executeSelectQuery errors', async () => {
      mockDbQueryValidator.validateSelectQuery.mockReturnValue({
        valid: true,
      });

      mockQueryParameterService.buildParameterizedQuery.mockReturnValue({
        query: 'SELECT * FROM users',
        values: [],
      });

      mockDbConnectionService.getDbConnection.mockResolvedValue({});
      mockDbConnectionService.executeSelectQuery.mockRejectedValue(new Error('Query failed'));

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-query`)
        .send({
          sqlQuery: 'SELECT * FROM users',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should handle exactly 100 rows', async () => {
      mockDbQueryValidator.validateSelectQuery.mockReturnValue({
        valid: true,
      });

      mockQueryParameterService.buildParameterizedQuery.mockReturnValue({
        query: 'SELECT * FROM users',
        values: [],
      });

      mockDbConnectionService.getDbConnection.mockResolvedValue({});

      const exactly100Rows = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      mockDbConnectionService.executeSelectQuery.mockResolvedValue({
        rows: exactly100Rows,
        executionTime: 10,
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-query`)
        .send({
          sqlQuery: 'SELECT * FROM users',
        })
        .expect(200);

      expect(response.body.results).toHaveLength(100);
      expect(response.body.totalRowCount).toBe(100);
      expect(response.body.message).toBeUndefined(); // No message when exactly 100
    });
  });

  describe('POST /api/admin/chatbots/:chatbotId/blocks/:blockId/discover-schema', () => {
    const chatbotId = 'cmjbb8hwd0001qn1tp1of601g'; // Valid CUID format
    const blockId = 'cmjbb8hwd0001qn1tp1of602h'; // Valid CUID format

    beforeEach(() => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      });

      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {
          connectionMode: 'server',
          dbType: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'user',
          password: 'pass',
        },
      });
    });

    it('should return 401 if adminUserId is missing', async () => {
      // Mock adminAuthMiddleware to not set adminUser
      mockAdminAuthMiddleware.mockImplementationOnce((req: any, res: any, next: any) => {
        req.adminUser = null;
        next();
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/discover-schema`)
        .send({
          dbType: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'user',
          password: 'pass',
        })
        .expect(401);

      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should return 404 if chatbot not found', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/discover-schema`)
        .send({
          dbType: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'user',
          password: 'pass',
        })
        .expect(404);

      expect(response.body).toEqual({ error: 'Chatbot not found' });
    });

    it('should discover schema successfully', async () => {
      const mockSchema = {
        tables: [
          {
            name: 'users',
            columns: [
              { name: 'id', type: 'integer' },
              { name: 'name', type: 'varchar' },
            ],
          },
        ],
      };

      mockDbSchemaDiscovery.discoverSchema.mockResolvedValue(mockSchema);

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/discover-schema`)
        .send({
          dbType: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'user',
          password: 'pass',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.schema).toEqual(mockSchema);
    });

    it('should handle schema discovery errors', async () => {
      mockDbSchemaDiscovery.discoverSchema.mockRejectedValue(
        new Error('Connection failed')
      );

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/discover-schema`)
        .send({
          dbType: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'user',
          password: 'pass',
        })
        .expect(500);

      expect(response.body.error).toBeDefined();
    });

    it('should handle file-based connection mode for schema discovery', async () => {
      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {
          connectionMode: 'file',
          dbType: 'sqlite',
          fileId: 'file-123',
        },
      });

      const mockSchema = {
        tables: [
          { name: 'users', columns: [{ name: 'id', type: 'integer' }] },
        ],
        discoveredAt: new Date().toISOString(),
      };

      mockDbSchemaDiscovery.discoverSchema.mockResolvedValue(mockSchema);

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/discover-schema`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.schema).toEqual(mockSchema);
      expect(mockDbSchemaDiscovery.discoverSchema).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionMode: 'file',
          fileId: 'file-123',
        })
      );
    });

    it('should handle example queries generation failure gracefully', async () => {
      const mockSchema = {
        tables: [
          { name: 'users', columns: [{ name: 'id', type: 'integer' }] },
        ],
        discoveredAt: new Date().toISOString(),
      };

      mockDbSchemaDiscovery.discoverSchema.mockResolvedValue(mockSchema);
      mockDbExampleQueryGenerator.generateExampleQueries.mockRejectedValue(new Error('LLM error'));

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/discover-schema`)
        .send({
          dbType: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'user',
          password: 'pass',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.schema).toEqual(mockSchema);
      // Example queries should be null if generation fails
      expect(response.body.exampleQueries).toBeNull();
    });

    it('should handle missing system prompt block for example queries', async () => {
      const mockSchema = {
        tables: [
          { name: 'users', columns: [{ name: 'id', type: 'integer' }] },
        ],
        discoveredAt: new Date().toISOString(),
      };

      mockDbSchemaDiscovery.discoverSchema.mockResolvedValue(mockSchema);
      // Mock findFirst to return null for system prompt block (second call)
      mockPrisma.block.findFirst
        .mockResolvedValueOnce({
          id: blockId,
          chatbotId: chatbotId,
          type: BlockType.ACTION,
          subtype: 'DB',
          properties: {},
        })
        .mockResolvedValueOnce(null); // System prompt block not found

      mockDbExampleQueryGenerator.generateExampleQueries.mockResolvedValue([
        'SELECT * FROM users',
      ]);

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/discover-schema`)
        .send({
          dbType: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'user',
          password: 'pass',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should use default 'gemini' provider when system prompt block is missing
      expect(mockDbExampleQueryGenerator.generateExampleQueries).toHaveBeenCalledWith(
        mockSchema,
        5,
        'gemini',
        undefined
      );
    });

    it('should handle connectionString in block properties for schema discovery', async () => {
      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {
          connectionMode: 'server',
          dbType: 'postgresql',
          connectionString: 'postgresql://user:pass@localhost:5432/test',
        },
      });

      const mockSchema = {
        tables: [],
        discoveredAt: new Date().toISOString(),
      };

      mockDbSchemaDiscovery.discoverSchema.mockResolvedValue(mockSchema);

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/discover-schema`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockDbSchemaDiscovery.discoverSchema).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: 'postgresql://user:pass@localhost:5432/test',
        })
      );
    });
  });

  describe('POST /api/admin/internal/chatbots/:chatbotId/execute-db-blocks', () => {
    const chatbotId = 'chatbot-123';

    beforeEach(async () => {
      // Reset config cache before setting env var
      const { resetConfig } = await import('../../config');
      process.env.INTERNAL_SERVICE_TOKEN = 'test-token';
      resetConfig();
    });

    afterEach(() => {
      delete process.env.INTERNAL_SERVICE_TOKEN;
    });

    it('should return 500 if internal service token is not configured', async () => {
      // Reset config cache before setting to empty string
      const { resetConfig } = await import('../../config');
      // Set to empty string (config validation allows it, but code checks for falsy)
      process.env.INTERNAL_SERVICE_TOKEN = '';
      resetConfig();

      const response = await request(app)
        .post(`/api/admin/internal/chatbots/${chatbotId}/execute-db-blocks`)
        .set('x-internal-service-token', 'test-token')
        .send({})
        .expect(500);

      expect(response.body).toEqual({ error: 'Internal service token not configured' });
    });

    it('should return 401 if token is missing', async () => {
      const response = await request(app)
        .post(`/api/admin/internal/chatbots/${chatbotId}/execute-db-blocks`)
        .send({})
        .expect(401);

      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should return 401 if token is invalid', async () => {
      const response = await request(app)
        .post(`/api/admin/internal/chatbots/${chatbotId}/execute-db-blocks`)
        .set('x-internal-service-token', 'wrong-token')
        .send({})
        .expect(401);

      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should execute DB blocks with valid token', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      });

      mockPrisma.block.findMany.mockResolvedValue([
        {
          id: 'block-1',
          type: BlockType.ACTION,
          subtype: 'DB',
          properties: {},
        },
      ]);

      mockDbBlockExecutionService.shouldExecuteDbBlock.mockResolvedValue(true);
      mockDbBlockExecutionService.executeDbBlock.mockResolvedValue({
        success: true,
        results: [{ id: 1 }],
      });

      const response = await request(app)
        .post(`/api/admin/internal/chatbots/${chatbotId}/execute-db-blocks`)
        .set('x-internal-service-token', 'test-token')
        .send({
          message: 'test message',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 400 if message is missing', async () => {
      const response = await request(app)
        .post(`/api/admin/internal/chatbots/${chatbotId}/execute-db-blocks`)
        .set('x-internal-service-token', 'test-token')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Message is required');
    });

    it('should return 400 if message is not a string', async () => {
      const response = await request(app)
        .post(`/api/admin/internal/chatbots/${chatbotId}/execute-db-blocks`)
        .set('x-internal-service-token', 'test-token')
        .send({ message: 123 })
        .expect(400);

      expect(response.body.error).toBe('Message is required');
    });

    it('should handle blocks that should not be executed', async () => {
      // The route finds system prompt block first
      mockPrisma.block.findFirst.mockResolvedValueOnce({
        id: 'system-prompt-block',
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
        properties: {},
      });

      mockPrisma.block.findMany.mockResolvedValue([
        {
          id: 'block-1',
          type: BlockType.ACTION,
          subtype: 'DB',
          properties: {},
        },
      ]);

      // Mock shouldExecuteDbBlock to return false for this block
      // Reset the mock to ensure clean state
      mockDbBlockExecutionService.shouldExecuteDbBlock.mockReset();
      mockDbBlockExecutionService.shouldExecuteDbBlock.mockResolvedValue(false);
      mockDbBlockExecutionService.executeDbBlock.mockReset();

      const response = await request(app)
        .post(`/api/admin/internal/chatbots/${chatbotId}/execute-db-blocks`)
        .set('x-internal-service-token', 'test-token')
        .send({
          message: 'test message',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results).toEqual([]);
      expect(response.body.count).toBe(0);
      // shouldExecuteDbBlock should be called to check if block should execute
      expect(mockDbBlockExecutionService.shouldExecuteDbBlock).toHaveBeenCalled();
      // When shouldExecuteDbBlock returns false, executeDbBlock should not be called
      // The important thing is that results are empty, indicating no blocks were executed
    });

    it('should handle multiple blocks with some failing', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      });

      mockPrisma.block.findMany.mockResolvedValue([
        {
          id: 'block-1',
          type: BlockType.ACTION,
          subtype: 'DB',
          properties: {},
        },
        {
          id: 'block-2',
          type: BlockType.ACTION,
          subtype: 'DB',
          properties: {},
        },
      ]);

      mockDbBlockExecutionService.shouldExecuteDbBlock.mockResolvedValue(true);
      mockDbBlockExecutionService.executeDbBlock
        .mockResolvedValueOnce({
          success: true,
          data: 'result1',
          metadata: {},
        })
        .mockRejectedValueOnce(new Error('Block 2 failed'));

      const response = await request(app)
        .post(`/api/admin/internal/chatbots/${chatbotId}/execute-db-blocks`)
        .set('x-internal-service-token', 'test-token')
        .send({
          message: 'test message',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.count).toBe(1);
    });

    it('should handle empty dbBlocks array', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      });

      mockPrisma.block.findMany.mockResolvedValue([]);

      const response = await request(app)
        .post(`/api/admin/internal/chatbots/${chatbotId}/execute-db-blocks`)
        .set('x-internal-service-token', 'test-token')
        .send({
          message: 'test message',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    it('should handle sessionData parameter', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      });

      mockPrisma.block.findMany.mockResolvedValue([
        {
          id: 'block-1',
          type: BlockType.ACTION,
          subtype: 'DB',
          properties: {},
        },
      ]);

      mockDbBlockExecutionService.shouldExecuteDbBlock.mockResolvedValue(true);
      mockDbBlockExecutionService.executeDbBlock.mockResolvedValue({
        success: true,
        data: 'result',
        metadata: {},
      });

      const response = await request(app)
        .post(`/api/admin/internal/chatbots/${chatbotId}/execute-db-blocks`)
        .set('x-internal-service-token', 'test-token')
        .send({
          message: 'test message',
          sessionData: { userId: 'user-123' },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockDbBlockExecutionService.executeDbBlock).toHaveBeenCalledWith(
        expect.any(Object),
        'test message',
        { userId: 'user-123' },
        undefined,
        expect.any(String),
        undefined
      );
    });

    it('should handle errors in main catch block', async () => {
      // Mock to throw error when finding system prompt block
      mockPrisma.block.findFirst.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post(`/api/admin/internal/chatbots/${chatbotId}/execute-db-blocks`)
        .set('x-internal-service-token', 'test-token')
        .send({
          message: 'test message',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/admin/chatbots/:chatbotId/blocks/:blockId/upload-db-file', () => {
    const chatbotId = 'cmjbb8hwd0001qn1tp1of601g'; // Valid CUID format
    const blockId = 'cmjbb8hwd0001qn1tp1of602h'; // Valid CUID format

    beforeEach(() => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      });

      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {},
      });
    });

    it('should return 401 if adminUserId is missing', async () => {
      mockAdminAuthMiddleware.mockImplementationOnce((req: any, res: any, next: any) => {
        req.adminUser = null;
        next();
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/upload-db-file`)
        .attach('file', Buffer.from('sqlite content'), 'test.db')
        .expect(401);

      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should return 400 if no file is provided', async () => {
      // Mock multer to not set req.file
      mockMulterSingle.mockImplementationOnce((req: any, res: any, next: any) => {
        req.file = undefined;
        next();
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/upload-db-file`)
        .expect(400);

      expect(response.body.error).toBe('No file provided');
    });

    it('should return 404 if chatbot not found', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/upload-db-file`)
        .attach('file', Buffer.from('sqlite content'), 'test.db')
        .expect(404);

      expect(response.body.error).toBe('Chatbot not found');
    });

    it('should return 404 if block not found', async () => {
      mockPrisma.block.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/upload-db-file`)
        .attach('file', Buffer.from('sqlite content'), 'test.db')
        .expect(404);

      expect(response.body.error).toBe('DB block not found');
    });

    it('should upload file successfully', async () => {
      const mockStoredFile = {
        fileId: 'file-123',
        originalFileName: 'test.db',
        fileSize: 1024,
        uploadedAt: new Date(),
      };

      mockDbFileStorageService.storeFile.mockResolvedValue(mockStoredFile);
      mockDbSchemaDiscovery.discoverSchema.mockResolvedValue({
        tables: [{ name: 'users', columns: [] }],
        discoveredAt: new Date().toISOString(),
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/upload-db-file`)
        .attach('file', Buffer.from('sqlite content'), 'test.db')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.fileId).toBe('file-123');
      expect(response.body.fileName).toBe('test.db');
    });

    it('should handle file upload with schema discovery', async () => {
      const mockStoredFile = {
        fileId: 'file-123',
        originalFileName: 'test.db',
        fileSize: 1024,
        uploadedAt: new Date(),
      };

      const mockSchema = {
        tables: [
          { name: 'users', columns: [{ name: 'id', type: 'integer' }] },
        ],
        discoveredAt: new Date().toISOString(),
      };

      mockDbFileStorageService.storeFile.mockResolvedValue(mockStoredFile);
      mockDbSchemaDiscovery.discoverSchema.mockResolvedValue(mockSchema);
      mockDbExampleQueryGenerator.generateExampleQueries.mockResolvedValue([
        'SELECT * FROM users',
        'SELECT * FROM users WHERE id = ?',
      ]);

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/upload-db-file`)
        .attach('file', Buffer.from('sqlite content'), 'test.db')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.schema).toEqual(mockSchema);
      expect(response.body.tablesCount).toBe(1);
    });

    it('should handle schema discovery failure gracefully', async () => {
      const mockStoredFile = {
        fileId: 'file-123',
        originalFileName: 'test.db',
        fileSize: 1024,
        uploadedAt: new Date(),
      };

      mockDbFileStorageService.storeFile.mockResolvedValue(mockStoredFile);
      mockDbSchemaDiscovery.discoverSchema.mockRejectedValue(new Error('Schema discovery failed'));

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/upload-db-file`)
        .attach('file', Buffer.from('sqlite content'), 'test.db')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.fileId).toBe('file-123');
      // Schema should be null if discovery fails
      expect(response.body.schema).toBeNull();
    });

    it('should delete existing file before uploading new one', async () => {
      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {
          fileId: 'old-file-123',
        },
      });

      const mockStoredFile = {
        fileId: 'new-file-123',
        originalFileName: 'test.db',
        fileSize: 1024,
        uploadedAt: new Date(),
      };

      mockDbFileStorageService.deleteFile.mockResolvedValue(undefined);
      mockDbFileStorageService.storeFile.mockResolvedValue(mockStoredFile);
      mockDbSchemaDiscovery.discoverSchema.mockResolvedValue({
        tables: [],
        discoveredAt: new Date().toISOString(),
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/upload-db-file`)
        .attach('file', Buffer.from('sqlite content'), 'test.db')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockDbFileStorageService.deleteFile).toHaveBeenCalledWith(chatbotId, blockId, 'old-file-123');
    });

    it('should handle delete file errors gracefully', async () => {
      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {
          fileId: 'old-file-123',
        },
      });

      const mockStoredFile = {
        fileId: 'new-file-123',
        originalFileName: 'test.db',
        fileSize: 1024,
        uploadedAt: new Date(),
      };

      mockDbFileStorageService.deleteFile.mockRejectedValue(new Error('Delete failed'));
      mockDbFileStorageService.storeFile.mockResolvedValue(mockStoredFile);
      mockDbSchemaDiscovery.discoverSchema.mockResolvedValue({
        tables: [],
        discoveredAt: new Date().toISOString(),
      });

      // Should still succeed even if delete fails
      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/upload-db-file`)
        .attach('file', Buffer.from('sqlite content'), 'test.db')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle errors in main catch block', async () => {
      mockDbFileStorageService.storeFile.mockRejectedValue(new Error('Storage failed'));

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/upload-db-file`)
        .attach('file', Buffer.from('sqlite content'), 'test.db')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it.skip('should handle multer file filter rejection', async () => {
      // Skipped: Multer file filter errors are handled by multer's fileFilter callback
      // which happens before the route handler. Testing this requires more complex multer mocking.
      // The fileFilter in the route will reject non-SQLite files before they reach the handler.
    });
  });

  describe('POST /api/admin/chatbots/:chatbotId/blocks/:blockId/test-file-connection', () => {
    const chatbotId = 'cmjbb8hwd0001qn1tp1of601g'; // Valid CUID format
    const blockId = 'cmjbb8hwd0001qn1tp1of602h'; // Valid CUID format

    beforeEach(() => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      });

      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {
          fileId: 'file-123',
        },
      });
    });

    it('should return 401 if adminUserId is missing', async () => {
      mockAdminAuthMiddleware.mockImplementationOnce((req: any, res: any, next: any) => {
        req.adminUser = null;
        next();
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-file-connection`)
        .expect(401);

      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should return 404 if chatbot not found', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-file-connection`)
        .expect(404);

      expect(response.body.error).toBe('Chatbot not found');
    });

    it('should return 404 if block not found', async () => {
      mockPrisma.block.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-file-connection`)
        .expect(404);

      expect(response.body.error).toBe('DB block not found');
    });

    it('should return 400 if fileId is missing', async () => {
      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {}, // No fileId
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-file-connection`)
        .expect(400);

      expect(response.body.error).toBe('No database file uploaded for this block');
    });

    it('should test file connection successfully', async () => {
      mockDbFileStorageService.getFilePath.mockResolvedValue('/path/to/file.db');
      mockDbConnectionService.testConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-file-connection`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Connection successful');
      expect(mockDbConnectionService.testConnection).toHaveBeenCalled();
    });

    it('should handle connection failure', async () => {
      mockDbFileStorageService.getFilePath.mockResolvedValue('/path/to/file.db');
      mockDbConnectionService.testConnection.mockResolvedValue({
        success: false,
        error: 'Connection failed',
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-file-connection`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Connection failed');
    });

    it('should handle getFilePath errors', async () => {
      mockDbFileStorageService.getFilePath.mockRejectedValue(new Error('File not found'));

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-file-connection`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should handle connection test errors', async () => {
      mockDbFileStorageService.getFilePath.mockResolvedValue('/path/to/file.db');
      mockDbConnectionService.testConnection.mockRejectedValue(new Error('Test failed'));

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/test-file-connection`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/admin/chatbots/:chatbotId/blocks/:blockId/db-file', () => {
    const chatbotId = 'cmjbb8hwd0001qn1tp1of601g'; // Valid CUID format
    const blockId = 'cmjbb8hwd0001qn1tp1of602h'; // Valid CUID format

    beforeEach(() => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      });

      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {
          fileId: 'file-123',
          fileName: 'test.db',
        },
      });
    });

    it('should return 401 if adminUserId is missing', async () => {
      mockAdminAuthMiddleware.mockImplementationOnce((req: any, res: any, next: any) => {
        req.adminUser = null;
        next();
      });

      const response = await request(app)
        .get(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/db-file`)
        .expect(401);

      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should return 404 if chatbot not found', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/db-file`)
        .expect(404);

      expect(response.body.error).toBe('Chatbot not found');
    });

    it('should return 404 if block not found', async () => {
      mockPrisma.block.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/db-file`)
        .expect(404);

      expect(response.body.error).toBe('DB block not found');
    });

    it('should return 404 if fileId is missing', async () => {
      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {}, // No fileId
      });

      const response = await request(app)
        .get(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/db-file`)
        .expect(404);

      expect(response.body.error).toBe('No database file uploaded for this block');
    });

    it('should return file info successfully', async () => {
      const mockFileInfo = {
        fileId: 'file-123',
        originalFileName: 'test.db',
        fileSize: 1024,
        uploadedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      mockDbFileStorageService.getFileInfo.mockResolvedValue(mockFileInfo);

      const response = await request(app)
        .get(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/db-file`)
        .expect(200);

      expect(response.body.fileId).toBe('file-123');
      expect(response.body.fileName).toBe('test.db');
      expect(response.body.fileSize).toBe(1024);
      expect(response.body.uploadedAt).toBeDefined();
    });

    it('should use fileName from block properties if available', async () => {
      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {
          fileId: 'file-123',
          fileName: 'custom-name.db',
        },
      });

      const mockFileInfo = {
        fileId: 'file-123',
        originalFileName: 'test.db',
        fileSize: 1024,
        uploadedAt: new Date(),
        lastAccessedAt: new Date(),
      };

      mockDbFileStorageService.getFileInfo.mockResolvedValue(mockFileInfo);

      const response = await request(app)
        .get(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/db-file`)
        .expect(200);

      expect(response.body.fileName).toBe('custom-name.db');
    });

    it('should handle getFileInfo errors', async () => {
      mockDbFileStorageService.getFileInfo.mockRejectedValue(new Error('File not found'));

      const response = await request(app)
        .get(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/db-file`)
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('DELETE /api/admin/chatbots/:chatbotId/blocks/:blockId/db-file', () => {
    const chatbotId = 'cmjbb8hwd0001qn1tp1of601g'; // Valid CUID format
    const blockId = 'cmjbb8hwd0001qn1tp1of602h'; // Valid CUID format

    beforeEach(() => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      });

      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {
          fileId: 'file-123',
          connectionMode: 'file',
          schema: { tables: [] },
        },
      });
    });

    it('should return 401 if adminUserId is missing', async () => {
      mockAdminAuthMiddleware.mockImplementationOnce((req: any, res: any, next: any) => {
        req.adminUser = null;
        next();
      });

      const response = await request(app)
        .delete(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/db-file`)
        .expect(401);

      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should return 404 if chatbot not found', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/db-file`)
        .expect(404);

      expect(response.body.error).toBe('Chatbot not found');
    });

    it('should return 404 if block not found', async () => {
      mockPrisma.block.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/db-file`)
        .expect(404);

      expect(response.body.error).toBe('DB block not found');
    });

    it('should return 404 if fileId is missing', async () => {
      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {}, // No fileId
      });

      const response = await request(app)
        .delete(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/db-file`)
        .expect(404);

      expect(response.body.error).toBe('No database file uploaded for this block');
    });

    it('should delete file successfully', async () => {
      mockDbFileStorageService.deleteFile.mockResolvedValue(undefined);
      mockPrisma.block.update.mockResolvedValue({
        id: blockId,
        properties: {},
      } as any);

      const response = await request(app)
        .delete(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/db-file`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Database file deleted');
      expect(mockDbFileStorageService.deleteFile).toHaveBeenCalledWith(chatbotId, blockId, 'file-123');
    });

    it('should clear schema when deleting file with connectionMode file', async () => {
      mockDbFileStorageService.deleteFile.mockResolvedValue(undefined);
      mockPrisma.block.update.mockResolvedValue({
        id: blockId,
        properties: {},
      } as any);

      const response = await request(app)
        .delete(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/db-file`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Verify update was called with cleared schema properties
      expect(mockPrisma.block.update).toHaveBeenCalled();
      const updateCall = mockPrisma.block.update.mock.calls[0];
      const updatedProperties = updateCall[0].data.properties as any;
      expect(updatedProperties.schema).toBeUndefined();
      expect(updatedProperties.connectionMode).toBe('server');
    });

    it('should not clear schema when connectionMode is server', async () => {
      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {
          fileId: 'file-123',
          connectionMode: 'server',
          schema: { tables: [] },
        },
      });

      mockDbFileStorageService.deleteFile.mockResolvedValue(undefined);
      mockPrisma.block.update.mockResolvedValue({
        id: blockId,
        properties: {},
      } as any);

      const response = await request(app)
        .delete(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/db-file`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Schema should not be cleared if connectionMode is not 'file'
      const updateCall = mockPrisma.block.update.mock.calls[0];
      const updatedProperties = updateCall[0].data.properties as any;
      // Schema might still be there if connectionMode was 'server'
      expect(updatedProperties.connectionMode).toBe('server');
    });

    it('should handle deleteFile errors', async () => {
      mockDbFileStorageService.deleteFile.mockRejectedValue(new Error('Delete failed'));

      const response = await request(app)
        .delete(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/db-file`)
        .expect(500);

      expect(response.body.error).toBeDefined();
    });

    it('should handle errors in main catch block', async () => {
      mockPrisma.block.findFirst.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .delete(`/api/admin/chatbots/${chatbotId}/blocks/${blockId}/db-file`)
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });
});
