import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SQLiteDriver } from '../../dbDrivers/sqliteDriver';
import { DbConnectionConfig, SQLiteDatabase } from '@shared/types';

// Mock dependencies
const { mockDatabase, mockPrepare, mockGet, mockAll, mockPragma, mockClose } = vi.hoisted(() => {
  const mockPrepareFn = vi.fn();
  const mockGetFn = vi.fn();
  const mockAllFn = vi.fn();
  const mockPragmaFn = vi.fn();
  const mockCloseFn = vi.fn();

  const mockDbInstance = {
    prepare: mockPrepareFn,
    pragma: mockPragmaFn,
    close: mockCloseFn,
  } as any;

  // Create proper class constructor
  class MockDatabase {
    prepare = mockPrepareFn;
    pragma = mockPragmaFn;
    close = mockCloseFn;

    constructor(filePath: string, options?: any) {
      // Store for assertions if needed
    }
  }

  // Wrap in vi.fn() to track calls
  const MockDatabaseFn = vi.fn(function(this: any, ...args: any[]) {
    return new MockDatabase(args[0], args[1]);
  }) as any;
  MockDatabaseFn.prototype = MockDatabase.prototype;

  return {
    mockDatabase: MockDatabaseFn,
    mockDbInstance,
    mockPrepare: mockPrepareFn,
    mockGet: mockGetFn,
    mockAll: mockAllFn,
    mockPragma: mockPragmaFn,
    mockClose: mockCloseFn,
  };
});

const { mockAccess } = vi.hoisted(() => {
  const mockAccessFn = vi.fn();
  return {
    mockAccess: mockAccessFn,
  };
});

vi.mock('better-sqlite3', () => ({
  default: mockDatabase,
}));

vi.mock('fs/promises', () => ({
  access: mockAccess,
}));

vi.mock('@shared/utils', () => {
  const mockLogger = {
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  
  return {
    logger: mockLogger,
  };
});

describe('SQLite Driver', () => {
  let driver: SQLiteDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    driver = new SQLiteDriver();
    mockAccess.mockResolvedValue(undefined);
    mockPragma.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('connect', () => {
    it('should create connection with file path', async () => {
      const config: DbConnectionConfig = {
        dbType: 'sqlite',
        connectionMode: 'file',
        filePath: '/path/to/database.db',
      };

      const connection = await driver.connect(config);

      expect(mockAccess).toHaveBeenCalledWith('/path/to/database.db');
      expect(mockDatabase).toHaveBeenCalledWith('/path/to/database.db', { readonly: true });
      expect(mockPragma).toHaveBeenCalledWith('journal_mode = WAL');
      expect(connection).toBeDefined();
    });

    it('should throw error when filePath is not provided', async () => {
      const config: DbConnectionConfig = {
        dbType: 'sqlite',
        connectionMode: 'file',
      };

      await expect(driver.connect(config)).rejects.toThrow(
        'SQLite requires a file path. Use connectionMode: "file" and provide a fileId.'
      );
    });

    it('should throw error when file does not exist', async () => {
      mockAccess.mockRejectedValueOnce(new Error('File not found'));

      const config: DbConnectionConfig = {
        dbType: 'sqlite',
        connectionMode: 'file',
        filePath: '/nonexistent/database.db',
      };

      await expect(driver.connect(config)).rejects.toThrow(
        'SQLite database file not found: /nonexistent/database.db'
      );
    });

    it('should open database in readonly mode', async () => {
      const config: DbConnectionConfig = {
        dbType: 'sqlite',
        connectionMode: 'file',
        filePath: '/path/to/database.db',
      };

      await driver.connect(config);

      expect(mockDatabase).toHaveBeenCalledWith('/path/to/database.db', { readonly: true });
    });

    it('should enable WAL mode', async () => {
      const config: DbConnectionConfig = {
        dbType: 'sqlite',
        connectionMode: 'file',
        filePath: '/path/to/database.db',
      };

      await driver.connect(config);

      expect(mockPragma).toHaveBeenCalledWith('journal_mode = WAL');
    });

    it('should handle WAL mode failure gracefully', async () => {
      mockPragma.mockImplementationOnce(() => {
        throw new Error('WAL mode not available');
      });

      const config: DbConnectionConfig = {
        dbType: 'sqlite',
        connectionMode: 'file',
        filePath: '/path/to/database.db',
      };

      // Should not throw
      const connection = await driver.connect(config);
      expect(connection).toBeDefined();
    });
  });

  describe('testConnection', () => {
    it('should return true when connection test succeeds', async () => {
      const mockStmt = {
        get: mockGet,
      };
      mockPrepare.mockReturnValue(mockStmt);
      mockGet.mockReturnValue({ '1': 1 });
      mockClose.mockReturnValue(undefined);

      const config: DbConnectionConfig = {
        dbType: 'sqlite',
        connectionMode: 'file',
        filePath: '/path/to/database.db',
      };

      const result = await driver.testConnection(config);

      expect(mockPrepare).toHaveBeenCalledWith('SELECT 1');
      expect(mockGet).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when connection test fails', async () => {
      mockAccess.mockRejectedValueOnce(new Error('File not found'));

      const config: DbConnectionConfig = {
        dbType: 'sqlite',
        connectionMode: 'file',
        filePath: '/nonexistent/database.db',
      };

      const { logger } = await import('@shared/utils');

      const result = await driver.testConnection(config);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'SQLite connection test failed',
        expect.objectContaining({
          error: expect.any(Error),
        })
      );
    });

    it('should return false when prepare fails', async () => {
      const mockStmt = {
        get: mockGet,
      };
      mockPrepare.mockReturnValue(mockStmt);
      mockGet.mockImplementationOnce(() => {
        throw new Error('Prepare failed');
      });

      const config: DbConnectionConfig = {
        dbType: 'sqlite',
        connectionMode: 'file',
        filePath: '/path/to/database.db',
      };

      const { logger } = await import('@shared/utils');

      const result = await driver.testConnection(config);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'SQLite connection test failed',
        expect.objectContaining({
          error: expect.any(Error),
        })
      );
    });

    it('should return true even when close fails (close catches errors)', async () => {
      const mockStmt = {
        get: mockGet,
      };
      mockPrepare.mockReturnValue(mockStmt);
      mockGet.mockReturnValue({ '1': 1 });
      mockClose.mockImplementationOnce(() => {
        throw new Error('Close failed');
      });

      const config: DbConnectionConfig = {
        dbType: 'sqlite',
        connectionMode: 'file',
        filePath: '/path/to/database.db',
      };

      const { logger } = await import('@shared/utils');

      const result = await driver.testConnection(config);

      // close() catches errors internally, so testConnection still succeeds
      expect(result).toBe(true);
      // But close() should log the error
      expect(logger.error).toHaveBeenCalledWith(
        'Error closing SQLite connection',
        expect.objectContaining({
          error: expect.any(Error),
        })
      );
    });

    it('should handle non-Error exceptions', async () => {
      // Make connect throw a non-Error by making access throw a string
      // But connect() will wrap it in an Error, so we need to make connect itself throw
      // Actually, connect() throws an Error with the message, so we need to check what happens
      mockAccess.mockRejectedValueOnce('String error');

      const config: DbConnectionConfig = {
        dbType: 'sqlite',
        connectionMode: 'file',
        filePath: '/path/to/database.db',
      };

      const { logger } = await import('@shared/utils');

      const result = await driver.testConnection(config);

      expect(result).toBe(false);
      // connect() throws an Error with the message, so error instanceof Error will be true
      expect(logger.error).toHaveBeenCalledWith(
        'SQLite connection test failed',
        expect.objectContaining({
          error: expect.any(Error),
        })
      );
    });
  });

  describe('executeQuery', () => {
    it('should execute query and return results', async () => {
      const mockRows = [{ id: 1, name: 'Test' }];
      const mockStmt = {
        all: mockAll,
      };
      mockPrepare.mockReturnValue(mockStmt);
      mockAll.mockReturnValue(mockRows);

      const db = new mockDatabase('/path/to/db.db') as SQLiteDatabase;
      const result = await driver.executeQuery(db, 'SELECT * FROM users', []);

      expect(mockPrepare).toHaveBeenCalledWith('SELECT * FROM users');
      expect(mockAll).toHaveBeenCalledWith();
      expect(result.rows).toEqual(mockRows);
      expect(result.rowCount).toBe(1);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should execute query with parameters', async () => {
      const mockRows = [{ id: 1 }];
      const params = [123, 'test@example.com'];
      const mockStmt = {
        all: mockAll,
      };
      mockPrepare.mockReturnValue(mockStmt);
      mockAll.mockReturnValue(mockRows);

      const db = new mockDatabase('/path/to/db.db') as SQLiteDatabase;
      const result = await driver.executeQuery(
        db,
        'SELECT * FROM users WHERE id = ? AND email = ?',
        params
      );

      expect(mockPrepare).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ? AND email = ?');
      expect(mockAll).toHaveBeenCalledWith(...params);
      expect(result.rows).toEqual(mockRows);
    });

    it('should handle empty result set', async () => {
      const mockStmt = {
        all: mockAll,
      };
      mockPrepare.mockReturnValue(mockStmt);
      mockAll.mockReturnValue([]);

      const db = new mockDatabase('/path/to/db.db') as SQLiteDatabase;
      const result = await driver.executeQuery(db, 'SELECT * FROM users WHERE id = 999', []);

      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('should calculate execution time', async () => {
      const mockStmt = {
        all: mockAll,
      };
      mockPrepare.mockReturnValue(mockStmt);
      // better-sqlite3 is synchronous, so we'll just verify executionTime is set
      mockAll.mockReturnValue([]);

      const db = new mockDatabase('/path/to/db.db') as SQLiteDatabase;
      const result = await driver.executeQuery(db, 'SELECT * FROM users', []);

      // Execution time should be set (even if very small for synchronous operations)
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle query execution errors', async () => {
      mockPrepare.mockImplementationOnce(() => {
        throw new Error('Query execution failed');
      });

      const db = new mockDatabase('/path/to/db.db') as SQLiteDatabase;

      await expect(
        driver.executeQuery(db, 'SELECT * FROM users', [])
      ).rejects.toThrow('SQLite query execution failed: Query execution failed');
    });

    it('should handle non-Error exceptions in query execution', async () => {
      mockPrepare.mockImplementationOnce(() => {
        throw 'String error';
      });

      const db = new mockDatabase('/path/to/db.db') as SQLiteDatabase;

      await expect(
        driver.executeQuery(db, 'SELECT * FROM users', [])
      ).rejects.toThrow('SQLite query execution failed: Unknown error');
    });
  });

  describe('close', () => {
    it('should close connection', async () => {
      mockClose.mockReturnValue(undefined);

      const db = new mockDatabase('/path/to/db.db') as SQLiteDatabase;
      await driver.close(db);

      expect(mockClose).toHaveBeenCalled();
    });

    it('should handle close errors gracefully', async () => {
      const error = new Error('Close failed');
      mockClose.mockImplementationOnce(() => {
        throw error;
      });

      const db = new mockDatabase('/path/to/db.db') as SQLiteDatabase;
      const { logger } = await import('@shared/utils');

      // Should not throw
      await driver.close(db);

      expect(logger.error).toHaveBeenCalledWith(
        'Error closing SQLite connection',
        expect.objectContaining({
          error: error,
        })
      );
    });

    it('should handle non-Error exceptions in close', async () => {
      mockClose.mockImplementationOnce(() => {
        throw 'String error';
      });

      const db = new mockDatabase('/path/to/db.db') as SQLiteDatabase;
      const { logger } = await import('@shared/utils');

      // Should not throw
      await driver.close(db);

      expect(logger.error).toHaveBeenCalledWith(
        'Error closing SQLite connection',
        expect.objectContaining({
          error: expect.any(Error),
        })
      );
    });
  });

  describe('buildConnectionString', () => {
    it('should build connection string from file path', () => {
      const config: DbConnectionConfig = {
        dbType: 'sqlite',
        connectionMode: 'file',
        filePath: '/path/to/database.db',
      };

      const connectionString = driver.buildConnectionString(config);

      expect(connectionString).toBe('sqlite:////path/to/database.db');
    });

    it('should return memory database connection string when filePath is not provided', () => {
      const config: DbConnectionConfig = {
        dbType: 'sqlite',
        connectionMode: 'file',
      };

      const connectionString = driver.buildConnectionString(config);

      expect(connectionString).toBe('sqlite:///:memory:');
    });

    it('should handle Windows file paths', () => {
      const config: DbConnectionConfig = {
        dbType: 'sqlite',
        connectionMode: 'file',
        filePath: 'C:\\path\\to\\database.db',
      };

      const connectionString = driver.buildConnectionString(config);

      expect(connectionString).toBe('sqlite:///C:\\path\\to\\database.db');
    });
  });

  describe('createPool', () => {
    it('should create pool wrapper with default config', async () => {
      const config: DbConnectionConfig = {
        dbType: 'sqlite',
        connectionMode: 'file',
        filePath: '/path/to/database.db',
      };

      const pool = await driver.createPool(config);

      expect(pool._isPool).toBe(true);
      expect(pool._maxConnections).toBe(1);
      expect(pool._activeConnections).toBe(1);
      expect(pool.connection).toBeDefined();
    });

    it('should create pool wrapper with custom pool config', async () => {
      const config: DbConnectionConfig = {
        dbType: 'sqlite',
        connectionMode: 'file',
        filePath: '/path/to/database.db',
      };

      const poolConfig = {
        maxConnections: 5,
        minIdleConnections: 1,
        idleTimeout: 30000,
        connectionTimeout: 5000,
      };

      const pool = await driver.createPool(config, poolConfig);

      expect(pool._isPool).toBe(true);
      expect(pool._maxConnections).toBe(5);
      expect(pool._activeConnections).toBe(1);
      expect(pool.connection).toBeDefined();
    });

    it('should use connection from connect method', async () => {
      const config: DbConnectionConfig = {
        dbType: 'sqlite',
        connectionMode: 'file',
        filePath: '/path/to/database.db',
      };

      const pool = await driver.createPool(config);

      expect(mockAccess).toHaveBeenCalledWith('/path/to/database.db');
      expect(mockDatabase).toHaveBeenCalled();
      expect(pool.connection).toBeDefined();
    });
  });

  describe('getPoolStats', () => {
    it('should return pool statistics for pool wrapper', () => {
      const pool = {
        connection: new mockDatabase('/path/to/db.db'),
        _isPool: true,
        _maxConnections: 5,
        _activeConnections: 1,
      } as any;

      const stats = driver.getPoolStats(pool);

      expect(stats).toEqual({
        totalConnections: 1,
        activeConnections: 1,
        idleConnections: 0,
        waitingRequests: 0,
        maxConnections: 5,
        poolUtilization: 100,
      });
    });

    it('should return pool statistics for single connection', () => {
      const db = new mockDatabase('/path/to/db.db') as SQLiteDatabase;

      const stats = driver.getPoolStats(db);

      expect(stats).toEqual({
        totalConnections: 1,
        activeConnections: 1,
        idleConnections: 0,
        waitingRequests: 0,
        maxConnections: 1,
        poolUtilization: 100,
      });
    });

    it('should return null for null pool', () => {
      const stats = driver.getPoolStats(null as any);

      expect(stats).toBeNull();
    });

    it('should return null for undefined pool', () => {
      const stats = driver.getPoolStats(undefined as any);

      expect(stats).toBeNull();
    });

    it('should use default maxConnections when not provided in pool wrapper', () => {
      const pool = {
        connection: new mockDatabase('/path/to/db.db'),
        _isPool: true,
        _activeConnections: 1,
      } as any;

      const stats = driver.getPoolStats(pool);

      expect(stats?.maxConnections).toBe(1); // default
    });

    it('should use default activeConnections when not provided in pool wrapper', () => {
      const pool = {
        connection: new mockDatabase('/path/to/db.db'),
        _isPool: true,
        _maxConnections: 5,
      } as any;

      const stats = driver.getPoolStats(pool);

      expect(stats?.activeConnections).toBe(1); // default
    });
  });

  describe('healthCheck', () => {
    it('should return true for healthy connection', async () => {
      const mockStmt = {
        get: mockGet,
      };
      mockPrepare.mockReturnValue(mockStmt);
      mockGet.mockReturnValue({ '1': 1 });

      const db = new mockDatabase('/path/to/db.db') as SQLiteDatabase;
      const result = await driver.healthCheck(db);

      expect(mockPrepare).toHaveBeenCalledWith('SELECT 1');
      expect(mockGet).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return true for healthy pool wrapper', async () => {
      const mockStmt = {
        get: mockGet,
      };
      mockPrepare.mockReturnValue(mockStmt);
      mockGet.mockReturnValue({ '1': 1 });

      const pool = {
        connection: new mockDatabase('/path/to/db.db'),
        _isPool: true,
        _maxConnections: 5,
        _activeConnections: 1,
      } as any;

      const result = await driver.healthCheck(pool);

      expect(mockPrepare).toHaveBeenCalledWith('SELECT 1');
      expect(mockGet).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when prepare fails', async () => {
      mockPrepare.mockImplementationOnce(() => {
        throw new Error('Health check failed');
      });

      const db = new mockDatabase('/path/to/db.db') as SQLiteDatabase;
      const result = await driver.healthCheck(db);

      expect(result).toBe(false);
    });

    it('should return false when get fails', async () => {
      const mockStmt = {
        get: mockGet,
      };
      mockPrepare.mockReturnValue(mockStmt);
      mockGet.mockImplementationOnce(() => {
        throw new Error('Get failed');
      });

      const db = new mockDatabase('/path/to/db.db') as SQLiteDatabase;
      const result = await driver.healthCheck(db);

      expect(result).toBe(false);
    });

    it('should return false for connection without prepare method', async () => {
      const invalidConnection = {} as any;

      const result = await driver.healthCheck(invalidConnection);

      expect(result).toBe(false);
    });

    it('should return false for null connection', async () => {
      const result = await driver.healthCheck(null as any);

      expect(result).toBe(false);
    });

    it('should return false for undefined connection', async () => {
      const result = await driver.healthCheck(undefined as any);

      expect(result).toBe(false);
    });

    it('should return false for pool wrapper without prepare method', async () => {
      const pool = {
        connection: {},
        _isPool: true,
        _maxConnections: 5,
        _activeConnections: 1,
      } as any;

      const result = await driver.healthCheck(pool);

      expect(result).toBe(false);
    });
  });
});
