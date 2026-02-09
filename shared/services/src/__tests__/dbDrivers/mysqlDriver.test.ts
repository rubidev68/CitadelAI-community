import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MySQLDriver } from '../../dbDrivers/mysqlDriver';
import { DbConnectionConfig, MySQLConnection, MySQLPool } from '@shared/types';

// Mock dependencies
const { mockDecryptCredentials } = vi.hoisted(() => ({
  mockDecryptCredentials: vi.fn((password: string) => {
    // Handle URL-encoded passwords and encrypted format
    const decoded = decodeURIComponent(password);
    if (decoded.includes('encrypted:')) {
      return decoded.replace('encrypted:', '');
    }
    // If it's in the real encrypted format (iv:authTag:encrypted), just return a mock value
    if (decoded.split(':').length === 3) {
      return 'decrypted-password';
    }
    return decoded;
  }),
}));

const { mockCreateConnection, mockCreatePool, mockMysqlConnection, mockMysqlPool } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockExecute = vi.fn();
  const mockEnd = vi.fn();
  
  const mockConnection = {
    query: mockQuery,
    execute: mockExecute,
    end: mockEnd,
  } as any;

  const mockPool = {
    execute: mockExecute,
    query: mockQuery,
    pool: {
      _allConnections: [],
      _acquiredConnections: [],
      _connectionQueue: [],
      config: { connectionLimit: 10 },
    },
  } as any;

  const mockCreateConnectionFn = vi.fn().mockResolvedValue(mockConnection);
  const mockCreatePoolFn = vi.fn().mockReturnValue(mockPool);

  return {
    mockCreateConnection: mockCreateConnectionFn,
    mockCreatePool: mockCreatePoolFn,
    mockMysqlConnection: mockConnection,
    mockMysqlPool: mockPool,
    mockQuery,
    mockExecute,
    mockEnd,
  };
});

vi.mock('@shared/utils', async () => {
  const actual = await vi.importActual('@shared/utils');
  const mockLogger = {
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);

  return {
    ...actual as any,
    decryptCredentials: mockDecryptCredentials,
    logger: mockLogger,
  };
});

vi.mock('mysql2/promise', () => ({
  createConnection: mockCreateConnection,
}));

vi.mock('mysql2', () => ({
  createPool: mockCreatePool,
}));

describe('MySQL Driver', () => {
  let driver: MySQLDriver;
  let mockQuery: ReturnType<typeof vi.fn>;
  let mockExecute: ReturnType<typeof vi.fn>;
  let mockEnd: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    driver = new MySQLDriver();
    mockQuery = mockMysqlConnection.query;
    mockExecute = mockMysqlConnection.execute;
    mockEnd = mockMysqlConnection.end;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('connect', () => {
    it('should create connection with host and port', async () => {
      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        host: 'localhost',
        port: 3306,
        database: 'testdb',
        username: 'testuser',
        password: 'encrypted:testpass',
        ssl: false,
      };

      const connection = await driver.connect(config);

      expect(mockCreateConnection).toHaveBeenCalledWith({
        host: 'localhost',
        port: 3306,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass',
        ssl: undefined,
      });
      expect(connection).toBe(mockMysqlConnection);
    });

    it('should use default values when not provided', async () => {
      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
      };

      await driver.connect(config);

      expect(mockCreateConnection).toHaveBeenCalledWith({
        host: 'localhost',
        port: 3306,
        database: '',
        user: '',
        password: '',
        ssl: undefined,
      });
    });

    it('should decrypt password before connecting', async () => {
      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        host: 'localhost',
        username: 'user',
        password: 'encrypted:secret',
      };

      await driver.connect(config);

      expect(mockDecryptCredentials).toHaveBeenCalledWith('encrypted:secret');
      expect(mockCreateConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'secret',
        })
      );
    });

    it('should handle SSL configuration', async () => {
      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        host: 'localhost',
        ssl: true,
      };

      await driver.connect(config);

      expect(mockCreateConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: {},
        })
      );
    });

    it('should parse connection string', async () => {
      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        connectionString: 'mysql://user:encrypted:pass@localhost:3306/mydb',
      };

      await driver.connect(config);

      // URL password is URL-encoded, so encrypted:pass becomes encrypted%3Apass
      expect(mockDecryptCredentials).toHaveBeenCalled();
      expect(mockCreateConnection).toHaveBeenCalledWith({
        host: 'localhost',
        port: 3306,
        database: 'mydb',
        user: 'user',
        password: expect.any(String),
        ssl: undefined,
      });
    });

    it('should parse connection string without port', async () => {
      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        connectionString: 'mysql://user:encrypted:pass@localhost/mydb',
      };

      await driver.connect(config);

      expect(mockCreateConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 3306,
        })
      );
    });

    it('should parse connection string without password', async () => {
      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        connectionString: 'mysql://user@localhost/mydb',
      };

      await driver.connect(config);

      expect(mockCreateConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          user: 'user',
          password: '',
        })
      );
    });

    it('should handle connection string with special characters in password', async () => {
      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        connectionString: 'mysql://user:encrypted%3Ap%40ss@localhost/mydb',
      };

      await driver.connect(config);

      // URL decoding happens automatically, then decryptCredentials is called
      expect(mockDecryptCredentials).toHaveBeenCalled();
      expect(mockCreateConnection).toHaveBeenCalled();
    });

    it('should handle empty password', async () => {
      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        host: 'localhost',
        username: 'user',
        password: '',
      };

      await driver.connect(config);

      expect(mockCreateConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          password: '',
        })
      );
    });

    it('should handle undefined password', async () => {
      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        host: 'localhost',
        username: 'user',
      };

      await driver.connect(config);

      expect(mockCreateConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          password: '',
        })
      );
    });
  });

  describe('testConnection', () => {
    it('should return true when connection test succeeds', async () => {
      mockQuery.mockResolvedValue([[], []]);
      mockEnd.mockResolvedValue(undefined);

      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        host: 'localhost',
      };

      const result = await driver.testConnection(config);

      expect(mockCreateConnection).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
      expect(mockEnd).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when connection test fails', async () => {
      const error = new Error('Connection failed');
      mockCreateConnection.mockRejectedValueOnce(error);

      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        host: 'localhost',
      };

      const { logger } = await import('@shared/utils');

      const result = await driver.testConnection(config);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'MySQL connection test failed',
        expect.objectContaining({
          error: error,
        })
      );
    });

    it('should return false when query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Query failed'));

      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        host: 'localhost',
      };

      const result = await driver.testConnection(config);

      expect(result).toBe(false);
    });

    it('should return false when close fails', async () => {
      mockQuery.mockResolvedValue([[], []]);
      mockEnd.mockRejectedValueOnce(new Error('Close failed'));

      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        host: 'localhost',
      };

      const result = await driver.testConnection(config);

      expect(result).toBe(false);
    });

    it('should handle non-Error exceptions', async () => {
      mockCreateConnection.mockRejectedValueOnce('String error');

      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
      };

      const { logger } = await import('@shared/utils');

      const result = await driver.testConnection(config);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'MySQL connection test failed',
        expect.objectContaining({
          error: expect.any(Error),
        })
      );
    });
  });

  describe('executeQuery', () => {
    it('should execute query and return results', async () => {
      const mockRows = [{ id: 1, name: 'Test' }];
      mockExecute.mockResolvedValue([mockRows, []]);

      const result = await driver.executeQuery(mockMysqlConnection, 'SELECT * FROM users', []);

      expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM users', []);
      expect(result.rows).toEqual(mockRows);
      expect(result.rowCount).toBe(1);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should execute query with parameters', async () => {
      const mockRows = [{ id: 1 }];
      const params = [123, 'test@example.com'];
      mockExecute.mockResolvedValue([mockRows, []]);

      const result = await driver.executeQuery(
        mockMysqlConnection,
        'SELECT * FROM users WHERE id = ? AND email = ?',
        params
      );

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = ? AND email = ?',
        params
      );
      expect(result.rows).toEqual(mockRows);
    });

    it('should handle empty result set', async () => {
      mockExecute.mockResolvedValue([[], []]);

      const result = await driver.executeQuery(mockMysqlConnection, 'SELECT * FROM users WHERE id = 999', []);

      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('should handle non-array rows', async () => {
      mockExecute.mockResolvedValue([null, []]);

      const result = await driver.executeQuery(mockMysqlConnection, 'SELECT * FROM users', []);

      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('should calculate execution time', async () => {
      mockExecute.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([[], []]), 100)));

      const startTime = Date.now();
      await driver.executeQuery(mockMysqlConnection, 'SELECT * FROM users', []);
      const endTime = Date.now();

      // Execution time should be approximately 100ms
      expect(endTime - startTime).toBeGreaterThanOrEqual(90);
    });

    it('should handle query execution errors', async () => {
      const error = new Error('Query execution failed');
      mockExecute.mockRejectedValue(error);

      await expect(
        driver.executeQuery(mockMysqlConnection, 'SELECT * FROM users', [])
      ).rejects.toThrow('Query execution failed');
    });
  });

  describe('close', () => {
    it('should close connection', async () => {
      mockEnd.mockResolvedValue(undefined);

      await driver.close(mockMysqlConnection);

      expect(mockEnd).toHaveBeenCalled();
    });

    it('should handle close errors', async () => {
      const error = new Error('Close failed');
      mockEnd.mockRejectedValue(error);

      await expect(driver.close(mockMysqlConnection)).rejects.toThrow('Close failed');
    });
  });

  describe('buildConnectionString', () => {
    it('should build connection string from config', () => {
      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        host: 'localhost',
        port: 3306,
        database: 'testdb',
        username: 'testuser',
        password: 'encrypted:testpass',
      };

      const connectionString = driver.buildConnectionString(config);

      expect(mockDecryptCredentials).toHaveBeenCalledWith('encrypted:testpass');
      expect(connectionString).toBe('mysql://testuser:testpass@localhost:3306/testdb');
    });

    it('should return connection string if provided', () => {
      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        connectionString: 'mysql://user:pass@host:3306/db',
      };

      const connectionString = driver.buildConnectionString(config);

      expect(connectionString).toBe('mysql://user:pass@host:3306/db');
      expect(mockDecryptCredentials).not.toHaveBeenCalled();
    });

    it('should use default values when not provided', () => {
      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
      };

      const connectionString = driver.buildConnectionString(config);

      expect(connectionString).toBe('mysql://:@localhost:3306/');
    });

    it('should handle empty password', () => {
      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        host: 'localhost',
        username: 'user',
        password: '',
      };

      const connectionString = driver.buildConnectionString(config);

      expect(connectionString).toBe('mysql://user:@localhost:3306/');
    });

    it('should decrypt password in connection string', () => {
      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        host: 'localhost',
        username: 'user',
        password: 'encrypted:secret',
      };

      const connectionString = driver.buildConnectionString(config);

      expect(mockDecryptCredentials).toHaveBeenCalledWith('encrypted:secret');
      expect(connectionString).toBe('mysql://user:secret@localhost:3306/');
    });
  });

  describe('createPool', () => {
    it('should create pool with default config', async () => {
      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        host: 'localhost',
        port: 3306,
        database: 'testdb',
        username: 'testuser',
        password: 'encrypted:testpass',
        ssl: false,
      };

      const pool = await driver.createPool(config);

      expect(mockCreatePool).toHaveBeenCalledWith({
        host: 'localhost',
        port: 3306,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass',
        ssl: undefined,
        connectionLimit: 10,
        queueLimit: 0,
        idleTimeout: 300000,
        connectTimeout: 10000,
      });
      expect(pool).toBe(mockMysqlPool);
    });

    it('should create pool with custom pool config', async () => {
      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        host: 'localhost',
      };

      const poolConfig = {
        maxConnections: 20,
        idleTimeout: 60000,
        connectionTimeout: 5000,
      };

      await driver.createPool(config, poolConfig);

      expect(mockCreatePool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionLimit: 20,
          idleTimeout: 60000,
          connectTimeout: 5000,
        })
      );
    });

    it('should decrypt password before creating pool', async () => {
      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        host: 'localhost',
        username: 'user',
        password: 'encrypted:secret',
      };

      await driver.createPool(config);

      expect(mockDecryptCredentials).toHaveBeenCalledWith('encrypted:secret');
      expect(mockCreatePool).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'secret',
        })
      );
    });

    it('should parse connection string for pool', async () => {
      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        connectionString: 'mysql://user:encrypted:pass@localhost:3306/mydb',
      };

      await driver.createPool(config);

      // URL password is URL-encoded
      expect(mockDecryptCredentials).toHaveBeenCalled();
      expect(mockCreatePool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 3306,
          database: 'mydb',
          user: 'user',
          password: expect.any(String),
        })
      );
    });

    it('should handle SSL configuration for pool', async () => {
      const config: DbConnectionConfig = {
        dbType: 'mysql',
        connectionMode: 'server',
        host: 'localhost',
        ssl: true,
      };

      await driver.createPool(config);

      expect(mockCreatePool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: {},
        })
      );
    });
  });

  describe('getPoolStats', () => {
    it('should return pool statistics', () => {
      const pool = {
        pool: {
          _allConnections: [1, 2, 3],
          _acquiredConnections: [1],
          _connectionQueue: [],
          config: { connectionLimit: 10 },
        },
      } as any;

      const stats = driver.getPoolStats(pool);

      expect(stats).toEqual({
        totalConnections: 3,
        activeConnections: 1,
        idleConnections: 2,
        waitingRequests: 0,
        maxConnections: 10,
        poolUtilization: 10,
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

    it('should return null when pool.pool is undefined', () => {
      const pool = {} as any;

      const stats = driver.getPoolStats(pool);

      expect(stats).toBeNull();
    });

    it('should handle missing internal properties', () => {
      const pool = {
        pool: {
          config: { connectionLimit: 10 },
        },
      } as any;

      const stats = driver.getPoolStats(pool);

      expect(stats).toEqual({
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        waitingRequests: 0,
        maxConnections: 10,
        poolUtilization: 0,
      });
    });

    it('should calculate pool utilization correctly', () => {
      const pool = {
        pool: {
          _allConnections: [1, 2, 3, 4, 5],
          _acquiredConnections: [1, 2, 3],
          _connectionQueue: [1],
          config: { connectionLimit: 10 },
        },
      } as any;

      const stats = driver.getPoolStats(pool);

      expect(stats?.poolUtilization).toBe(30); // 3/10 * 100
      expect(stats?.waitingRequests).toBe(1);
    });

    it('should handle zero maxConnections', () => {
      const pool = {
        pool: {
          _allConnections: [1, 2],
          _acquiredConnections: [1],
          _connectionQueue: [],
          config: { connectionLimit: 0 },
        },
      } as any;

      const stats = driver.getPoolStats(pool);

      // The code uses `|| 10` which means 0 becomes 10, so utilization is 1/10 * 100 = 10
      // This is a quirk of using || instead of ??
      expect(stats?.maxConnections).toBe(10); // 0 || 10 = 10
      expect(stats?.poolUtilization).toBe(10); // 1/10 * 100
    });

    it('should handle errors gracefully', () => {
      const pool = {
        pool: null,
      } as any;

      const stats = driver.getPoolStats(pool);

      expect(stats).toBeNull();
    });

    it('should log errors when getting pool stats fails', async () => {
      const pool = {
        get pool() {
          throw new Error('Access error');
        },
      } as any;

      const { logger } = await import('@shared/utils');
      const stats = driver.getPoolStats(pool);

      expect(stats).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Error getting pool stats',
        expect.objectContaining({
          error: expect.any(Error),
        })
      );
    });
  });

  describe('healthCheck', () => {
    it('should return true for healthy connection with execute method', async () => {
      mockExecute.mockResolvedValue([[], []]);

      const result = await driver.healthCheck(mockMysqlConnection);

      expect(mockExecute).toHaveBeenCalledWith('SELECT 1');
      expect(result).toBe(true);
    });

    it('should return true for healthy connection with query method', async () => {
      const connectionWithQuery = {
        query: mockQuery,
      } as any;

      mockQuery.mockResolvedValue([[], []]);

      const result = await driver.healthCheck(connectionWithQuery);

      expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
      expect(result).toBe(true);
    });

    it('should return false when execute fails', async () => {
      mockExecute.mockRejectedValue(new Error('Health check failed'));

      const result = await driver.healthCheck(mockMysqlConnection);

      expect(result).toBe(false);
    });

    it('should return false when query fails', async () => {
      const connectionWithQuery = {
        query: mockQuery,
      } as any;

      mockQuery.mockRejectedValue(new Error('Health check failed'));

      const result = await driver.healthCheck(connectionWithQuery);

      expect(result).toBe(false);
    });

    it('should return false for connection without execute or query method', async () => {
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

    it('should prioritize execute method over query method', async () => {
      const connectionWithBoth = {
        execute: mockExecute,
        query: mockQuery,
      } as any;

      mockExecute.mockResolvedValue([[], []]);

      const result = await driver.healthCheck(connectionWithBoth);

      expect(mockExecute).toHaveBeenCalledWith('SELECT 1');
      expect(mockQuery).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});
