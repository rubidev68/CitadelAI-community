import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDbConnection,
  testConnection,
  executeSelectQuery,
  closeConnection,
  prepareCredentialsForStorage,
  TypedDatabaseConnection,
} from '../dbConnectionService';
import { getDatabaseDriver } from '../dbDrivers';
import { validateSelectQuery } from '../dbQueryValidator';
import { encryptCredentials } from '@shared/utils';
import { dbFileStorageService } from '../dbFileStorageService';
import { getPoolManager } from '../dbConnectionPoolManager';
import { DbConnectionConfig } from '@shared/types';

// Mock dependencies
vi.mock('../dbDrivers', () => ({
  getDatabaseDriver: vi.fn(),
}));

vi.mock('../dbQueryValidator', () => ({
  validateSelectQuery: vi.fn(),
}));

vi.mock('@shared/utils', async () => {
  const actual = await vi.importActual('@shared/utils');
  return {
    ...actual as any,
    encryptCredentials: vi.fn(),
    logger: {
      child: () => ({
        error: vi.fn(),
        info: vi.fn(),
      }),
      error: vi.fn(),
    }
  };
});

vi.mock('../dbFileStorageService', () => ({
  dbFileStorageService: {
    getFilePath: vi.fn(),
    updateLastAccessed: vi.fn(),
  },
}));

vi.mock('../dbConnectionPoolManager', () => ({
  getPoolManager: vi.fn(),
}));

describe('DB Connection Service', () => {
  let mockDriver: any;
  let mockPoolManager: any;
  let mockConnection: TypedDatabaseConnection;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConnection = {
      dbType: 'postgresql',
      query: vi.fn(),
    } as any;

    mockDriver = {
      testConnection: vi.fn(),
      executeQuery: vi.fn(),
      close: vi.fn(),
    };

    mockPoolManager = {
      getConnection: vi.fn(),
    };

    vi.mocked(getDatabaseDriver).mockReturnValue(mockDriver as any);
    vi.mocked(getPoolManager).mockReturnValue(mockPoolManager as any);
  });

  describe('getDbConnection', () => {
    it('should get server-based connection', async () => {
      const properties = {
        connectionMode: 'server' as const,
        dbType: 'postgresql' as const,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'encrypted:password',
      };

      mockPoolManager.getConnection.mockResolvedValue(mockConnection);

      const result = await getDbConnection(properties);

      expect(getDatabaseDriver).toHaveBeenCalledWith('postgresql');
      expect(mockPoolManager.getConnection).toHaveBeenCalledWith(
        {
          dbType: 'postgresql',
          connectionMode: 'server',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
          username: 'user',
          password: 'encrypted:password',
        },
        mockDriver,
        undefined
      );
      expect(result.dbType).toBe('postgresql');
    });

    it('should get file-based connection', async () => {
      const properties = {
        connectionMode: 'file' as const,
        dbType: 'sqlite' as const,
        fileId: 'file-123',
        chatbotId: 'chatbot-123',
        blockId: 'block-123',
      };

      const filePath = '/path/to/database.db';
      vi.mocked(dbFileStorageService.getFilePath).mockResolvedValue(filePath);
      vi.mocked(dbFileStorageService.updateLastAccessed).mockResolvedValue();
      mockPoolManager.getConnection.mockResolvedValue(mockConnection);

      const result = await getDbConnection(properties);

      expect(dbFileStorageService.getFilePath).toHaveBeenCalledWith(
        'chatbot-123',
        'block-123',
        'file-123'
      );
      expect(dbFileStorageService.updateLastAccessed).toHaveBeenCalledWith(filePath);
      expect(mockPoolManager.getConnection).toHaveBeenCalledWith(
        {
          dbType: 'sqlite',
          connectionMode: 'file',
          filePath,
        },
        mockDriver,
        undefined
      );
      expect(result.dbType).toBe('sqlite');
    });

    it('should throw error for file-based connection without required fields', async () => {
      const properties = {
        connectionMode: 'file' as const,
        dbType: 'sqlite' as const,
        // Missing fileId, chatbotId, blockId
      };

      await expect(getDbConnection(properties)).rejects.toThrow(
        'fileId, chatbotId, and blockId are required for file-based connections'
      );
    });

    it('should use default connection mode as server', async () => {
      const properties = {
        dbType: 'postgresql' as const,
        host: 'localhost',
      };

      mockPoolManager.getConnection.mockResolvedValue(mockConnection);

      await getDbConnection(properties);

      expect(mockPoolManager.getConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionMode: 'server',
        }),
        mockDriver,
        undefined
      );
    });

    it('should pass pool config to pool manager', async () => {
      const properties = {
        dbType: 'postgresql' as const,
        host: 'localhost',
      };
      const poolConfig = { maxConnections: 10 };

      mockPoolManager.getConnection.mockResolvedValue(mockConnection);

      await getDbConnection(properties, poolConfig);

      expect(mockPoolManager.getConnection).toHaveBeenCalledWith(
        expect.any(Object),
        mockDriver,
        poolConfig
      );
    });
  });

  describe('testConnection', () => {
    it('should return success on successful connection test', async () => {
      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
      };

      mockDriver.testConnection.mockResolvedValue(true);

      const result = await testConnection(config);

      expect(getDatabaseDriver).toHaveBeenCalledWith('postgresql');
      expect(mockDriver.testConnection).toHaveBeenCalledWith(config);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return failure on failed connection test', async () => {
      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
      };

      mockDriver.testConnection.mockResolvedValue(false);

      const result = await testConnection(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection test failed');
    });

    it('should return error message on exception', async () => {
      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
      };

      mockDriver.testConnection.mockRejectedValue(new Error('Connection refused'));

      const result = await testConnection(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });

  describe('executeSelectQuery', () => {
    it('should execute valid SELECT query', async () => {
      const query = 'SELECT * FROM users';
      const params: unknown[] = [];
      const mockResult = {
        rows: [{ id: 1, name: 'User 1' }],
        rowCount: 1,
        executionTime: 10,
      };

      vi.mocked(validateSelectQuery).mockReturnValue({ valid: true });
      mockConnection.query = vi.fn().mockResolvedValue({
        rows: mockResult.rows,
        rowCount: mockResult.rowCount,
      }) as any;

      const result = await executeSelectQuery(mockConnection, query, params);

      expect(validateSelectQuery).toHaveBeenCalledWith(query);
      expect(mockConnection.query).toHaveBeenCalledWith(query, params);
      expect(result.rows).toEqual(mockResult.rows);
    });

    it('should throw error for invalid query', async () => {
      const query = 'DELETE FROM users';
      const params: unknown[] = [];

      vi.mocked(validateSelectQuery).mockReturnValue({
        valid: false,
        error: 'Only SELECT queries are allowed',
      });

      await expect(executeSelectQuery(mockConnection, query, params)).rejects.toThrow(
        'Only SELECT queries are allowed'
      );
    });

    it('should use driver.executeQuery for non-postgresql connections', async () => {
      const mysqlConnection: TypedDatabaseConnection = {
        dbType: 'mysql',
      } as any;
      const query = 'SELECT * FROM users';
      const params: unknown[] = [];
      const mockResult = {
        rows: [{ id: 1 }],
        rowCount: 1,
        executionTime: 5,
      };

      vi.mocked(validateSelectQuery).mockReturnValue({ valid: true });
      mockDriver.executeQuery.mockResolvedValue(mockResult);

      const result = await executeSelectQuery(mysqlConnection, query, params);

      expect(mockDriver.executeQuery).toHaveBeenCalledWith(mysqlConnection, query, params);
      expect(result).toEqual(mockResult);
    });

    it('should enforce query timeout', async () => {
      const query = 'SELECT * FROM users';
      const params: unknown[] = [];
      const maxQueryTime = 0.1; // 100ms for fast timeout

      vi.mocked(validateSelectQuery).mockReturnValue({ valid: true });
      mockConnection.query = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ rows: [] }), 200))
      ) as any;

      await expect(
        executeSelectQuery(mockConnection, query, params, maxQueryTime)
      ).rejects.toThrow('Query timeout');
    });

    it('should calculate execution time for postgresql', async () => {
      const query = 'SELECT * FROM users';
      const params: unknown[] = [];

      vi.mocked(validateSelectQuery).mockReturnValue({ valid: true });
      mockConnection.query = vi.fn().mockResolvedValue({
        rows: [{ id: 1 }],
        rowCount: 1,
      }) as any;

      const result = await executeSelectQuery(mockConnection, query, params);

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.rows).toBeDefined();
    });
  });

  describe('closeConnection', () => {
    it('should close connection successfully', async () => {
      mockDriver.close.mockResolvedValue(undefined);

      await closeConnection(mockConnection);

      expect(getDatabaseDriver).toHaveBeenCalledWith('postgresql');
      expect(mockDriver.close).toHaveBeenCalledWith(mockConnection);
    });

    it('should handle close errors gracefully', async () => {
      mockDriver.close.mockRejectedValue(new Error('Close failed'));

      // Should not throw
      await expect(closeConnection(mockConnection)).resolves.toBeUndefined();
    });

    it('should use connection dbType', async () => {
      const mysqlConnection: TypedDatabaseConnection = {
        dbType: 'mysql',
      } as any;

      mockDriver.close.mockResolvedValue(undefined);

      await closeConnection(mysqlConnection);

      expect(getDatabaseDriver).toHaveBeenCalledWith('mysql');
    });

    it('should default to postgresql if dbType not set', async () => {
      const connectionWithoutType = {} as TypedDatabaseConnection;

      mockDriver.close.mockResolvedValue(undefined);

      await closeConnection(connectionWithoutType);

      expect(getDatabaseDriver).toHaveBeenCalledWith('postgresql');
    });
  });

  describe('prepareCredentialsForStorage', () => {
    it('should encrypt unencrypted password', () => {
      const config: Partial<DbConnectionConfig> = {
        password: 'plaintext',
      };

      vi.mocked(encryptCredentials).mockReturnValue('encrypted:password');

      const result = prepareCredentialsForStorage(config);

      expect(encryptCredentials).toHaveBeenCalledWith('plaintext');
      expect(result.password).toBe('encrypted:password');
    });

    it('should not encrypt already encrypted password', () => {
      const config: Partial<DbConnectionConfig> = {
        password: 'encrypted:already-encrypted',
      };

      const result = prepareCredentialsForStorage(config);

      expect(encryptCredentials).not.toHaveBeenCalled();
      expect(result.password).toBe('encrypted:already-encrypted');
    });

    it('should preserve other config properties', () => {
      const config: Partial<DbConnectionConfig> = {
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'plaintext',
      };

      vi.mocked(encryptCredentials).mockReturnValue('encrypted:password');

      const result = prepareCredentialsForStorage(config);

      expect(result.host).toBe('localhost');
      expect(result.port).toBe(5432);
      expect(result.database).toBe('testdb');
      expect(result.username).toBe('user');
      expect(result.password).toBe('encrypted:password');
    });

    it('should handle config without password', () => {
      const config: Partial<DbConnectionConfig> = {
        host: 'localhost',
      };

      const result = prepareCredentialsForStorage(config);

      expect(encryptCredentials).not.toHaveBeenCalled();
      expect(result.host).toBe('localhost');
    });
  });
});
