import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PostgreSQLDriver } from '../../dbDrivers/postgresqlDriver';
import { DbConnectionConfig, PostgresClient, PostgresPool } from '@shared/types';

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

const { mockPool, mockClient, mockQuery, mockConnect, mockEnd } = vi.hoisted(() => {
  const mockQueryFn = vi.fn();
  const mockConnectFn = vi.fn();
  const mockEndFn = vi.fn();
  
  // Create proper class constructors
  class MockClient {
    query = mockQueryFn;
    connect = mockConnectFn;
    end = mockEndFn;
  }

  class MockPool {
    query = mockQueryFn;
    totalCount = 0;
    idleCount = 0;
    waitingCount = 0;
    options = { max: 10 };
  }

  // Wrap in vi.fn() to track calls
  const MockClientFn = vi.fn(function(this: any, ...args: any[]) {
    return new MockClient();
  }) as any;
  MockClientFn.prototype = MockClient.prototype;

  const MockPoolFn = vi.fn(function(this: any, ...args: any[]) {
    return new MockPool();
  }) as any;
  MockPoolFn.prototype = MockPool.prototype;

  return {
    mockPool: MockPoolFn,
    mockClient: MockClientFn,
    mockQuery: mockQueryFn,
    mockConnect: mockConnectFn,
    mockEnd: mockEndFn,
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

vi.mock('pg', () => {
  return {
    Pool: mockPool,
    Client: mockClient,
  };
});

describe('PostgreSQL Driver', () => {
  let driver: PostgreSQLDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    driver = new PostgreSQLDriver();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('connect', () => {
    it('should create connection with host and port', async () => {
      mockConnect.mockResolvedValue(undefined);

      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'encrypted:testpass',
        ssl: false,
      };

      const connection = await driver.connect(config);

      expect(mockClient).toHaveBeenCalled();
      expect(mockConnect).toHaveBeenCalled();
      expect(connection).toBeDefined();
    });

    it('should use default values when not provided', async () => {
      mockConnect.mockResolvedValue(undefined);

      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
      };

      await driver.connect(config);

      expect(mockClient).toHaveBeenCalled();
    });

    it('should decrypt password before connecting', async () => {
      mockConnect.mockResolvedValue(undefined);

      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
        username: 'user',
        password: 'encrypted:secret',
      };

      await driver.connect(config);

      expect(mockDecryptCredentials).toHaveBeenCalledWith('encrypted:secret');
      expect(mockClient).toHaveBeenCalled();
    });

    it('should handle SSL configuration', async () => {
      mockConnect.mockResolvedValue(undefined);

      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
        ssl: true,
      };

      await driver.connect(config);

      expect(mockClient).toHaveBeenCalled();
    });

    it('should parse connection string', async () => {
      mockConnect.mockResolvedValue(undefined);

      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        connectionString: 'postgresql://user:encrypted:pass@localhost:5432/mydb',
      };

      await driver.connect(config);

      // URL password is URL-encoded
      expect(mockDecryptCredentials).toHaveBeenCalled();
      expect(mockClient).toHaveBeenCalled();
    });

    it('should parse connection string without port', async () => {
      mockConnect.mockResolvedValue(undefined);

      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        connectionString: 'postgresql://user:encrypted:pass@localhost/mydb',
      };

      await driver.connect(config);

      expect(mockClient).toHaveBeenCalled();
    });

    it('should parse connection string without password', async () => {
      mockConnect.mockResolvedValue(undefined);

      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        connectionString: 'postgresql://user@localhost/mydb',
      };

      await driver.connect(config);

      expect(mockClient).toHaveBeenCalled();
    });

    it('should handle empty password', async () => {
      mockConnect.mockResolvedValue(undefined);

      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
        username: 'user',
        password: '',
      };

      await driver.connect(config);

      expect(mockClient).toHaveBeenCalled();
    });

    it('should handle undefined password', async () => {
      mockConnect.mockResolvedValue(undefined);

      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
        username: 'user',
      };

      await driver.connect(config);

      expect(mockClient).toHaveBeenCalled();
    });

    it('should call client.connect() after creating client', async () => {
      mockConnect.mockResolvedValue(undefined);

      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
      };

      await driver.connect(config);

      expect(mockClient).toHaveBeenCalled();
      expect(mockConnect).toHaveBeenCalled();
    });
  });

  describe('testConnection', () => {
    it('should return true when connection test succeeds', async () => {
      mockConnect.mockResolvedValue(undefined);
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      mockEnd.mockResolvedValue(undefined);

      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
      };

      const result = await driver.testConnection(config);

      expect(mockClient).toHaveBeenCalled();
      expect(mockConnect).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
      expect(mockEnd).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when connection test fails', async () => {
      const error = new Error('Connection failed');
      // Make the constructor throw
      mockClient.mockImplementationOnce(function() {
        throw error;
      });

      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
      };

      const { logger } = await import('@shared/utils');

      const result = await driver.testConnection(config);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'PostgreSQL connection test failed',
        expect.objectContaining({
          error: error,
        })
      );
    });

    it('should return false when query fails', async () => {
      mockConnect.mockResolvedValue(undefined);
      mockQuery.mockRejectedValueOnce(new Error('Query failed'));

      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
      };

      const result = await driver.testConnection(config);

      expect(result).toBe(false);
    });

    it('should return false when close fails', async () => {
      mockConnect.mockResolvedValue(undefined);
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      mockEnd.mockRejectedValueOnce(new Error('Close failed'));

      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
      };

      const result = await driver.testConnection(config);

      expect(result).toBe(false);
    });

    it('should handle non-Error exceptions', async () => {
      // Make the constructor throw
      mockClient.mockImplementationOnce(function() {
        throw 'String error';
      });

      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
      };

      const { logger } = await import('@shared/utils');

      const result = await driver.testConnection(config);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'PostgreSQL connection test failed',
        expect.objectContaining({
          error: expect.any(Error),
        })
      );
    });
  });

  describe('executeQuery', () => {
    it('should execute query and return results', async () => {
      const mockRows = [{ id: 1, name: 'Test' }];
      mockQuery.mockResolvedValue({ rows: mockRows, rowCount: 1 });

      const clientInstance = new mockClient();
      const result = await driver.executeQuery(clientInstance as any, 'SELECT * FROM users', []);

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users', []);
      expect(result.rows).toEqual(mockRows);
      expect(result.rowCount).toBe(1);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should execute query with parameters', async () => {
      const mockRows = [{ id: 1 }];
      const params = [123, 'test@example.com'];
      mockQuery.mockResolvedValue({ rows: mockRows, rowCount: 1 });

      const clientInstance = new mockClient();
      const result = await driver.executeQuery(
        clientInstance as any,
        'SELECT * FROM users WHERE id = $1 AND email = $2',
        params
      );

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1 AND email = $2',
        params
      );
      expect(result.rows).toEqual(mockRows);
    });

    it('should handle empty result set', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      const clientInstance = new mockClient();
      const result = await driver.executeQuery(clientInstance as any, 'SELECT * FROM users WHERE id = 999', []);

      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('should handle result without rows', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });

      const clientInstance = new mockClient();
      const result = await driver.executeQuery(clientInstance as any, 'SELECT * FROM users', []);

      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('should handle result without rowCount', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 1 }] });

      const clientInstance = new mockClient();
      const result = await driver.executeQuery(clientInstance as any, 'SELECT * FROM users', []);

      expect(result.rows).toEqual([{ id: 1 }]);
      expect(result.rowCount).toBe(0);
    });

    it('should calculate execution time', async () => {
      mockQuery.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ rows: [], rowCount: 0 }), 100)));

      const clientInstance = new mockClient();
      const startTime = Date.now();
      await driver.executeQuery(clientInstance as any, 'SELECT * FROM users', []);
      const endTime = Date.now();

      // Execution time should be approximately 100ms
      expect(endTime - startTime).toBeGreaterThanOrEqual(90);
    });

    it('should handle query execution errors', async () => {
      const error = new Error('Query execution failed');
      mockQuery.mockRejectedValue(error);

      const clientInstance = new mockClient();
      await expect(
        driver.executeQuery(clientInstance as any, 'SELECT * FROM users', [])
      ).rejects.toThrow('Query execution failed');
    });

    it('should work with PostgresPool', async () => {
      const mockRows = [{ id: 1 }];
      mockQuery.mockResolvedValue({ rows: mockRows, rowCount: 1 });

      const poolInstance = new mockPool();
      const result = await driver.executeQuery(poolInstance as any, 'SELECT * FROM users', []);

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users', []);
      expect(result.rows).toEqual(mockRows);
    });
  });

  describe('close', () => {
    it('should close connection', async () => {
      mockEnd.mockResolvedValue(undefined);

      const clientInstance = new mockClient();
      await driver.close(clientInstance as any);

      expect(mockEnd).toHaveBeenCalled();
    });

    it('should handle close errors', async () => {
      const error = new Error('Close failed');
      mockEnd.mockRejectedValue(error);

      const clientInstance = new mockClient();
      await expect(driver.close(clientInstance as any)).rejects.toThrow('Close failed');
    });
  });

  describe('buildConnectionString', () => {
    it('should build connection string from config', () => {
      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'encrypted:testpass',
        ssl: false,
      };

      const connectionString = driver.buildConnectionString(config);

      expect(mockDecryptCredentials).toHaveBeenCalledWith('encrypted:testpass');
      expect(connectionString).toBe('postgresql://testuser:testpass@localhost:5432/testdb');
    });

    it('should return connection string if provided', () => {
      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        connectionString: 'postgresql://user:pass@host:5432/db',
      };

      const connectionString = driver.buildConnectionString(config);

      expect(connectionString).toBe('postgresql://user:pass@host:5432/db');
      expect(mockDecryptCredentials).not.toHaveBeenCalled();
    });

    it('should use default values when not provided', () => {
      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
      };

      const connectionString = driver.buildConnectionString(config);

      expect(connectionString).toBe('postgresql://:@localhost:5432/');
    });

    it('should include SSL mode when SSL is enabled', () => {
      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
        ssl: true,
      };

      const connectionString = driver.buildConnectionString(config);

      expect(connectionString).toBe('postgresql://:@localhost:5432/?sslmode=require');
    });

    it('should not include SSL mode when SSL is disabled', () => {
      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
        ssl: false,
      };

      const connectionString = driver.buildConnectionString(config);

      expect(connectionString).toBe('postgresql://:@localhost:5432/');
    });

    it('should handle empty password', () => {
      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
        username: 'user',
        password: '',
      };

      const connectionString = driver.buildConnectionString(config);

      expect(connectionString).toBe('postgresql://user:@localhost:5432/');
    });

    it('should decrypt password in connection string', () => {
      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
        username: 'user',
        password: 'encrypted:secret',
      };

      const connectionString = driver.buildConnectionString(config);

      expect(mockDecryptCredentials).toHaveBeenCalledWith('encrypted:secret');
      expect(connectionString).toBe('postgresql://user:secret@localhost:5432/');
    });
  });

  describe('createPool', () => {
    it('should create pool with default config', async () => {
      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'encrypted:testpass',
        ssl: false,
      };

      const pool = await driver.createPool(config);

      expect(mockPool).toHaveBeenCalled();
      expect(pool).toBeDefined();
    });

    it('should create pool with custom pool config', async () => {
      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
      };

      const poolConfig = {
        maxConnections: 20,
        minIdleConnections: 5,
        idleTimeout: 60000,
        connectionTimeout: 5000,
      };

      await driver.createPool(config, poolConfig);

      expect(mockPool).toHaveBeenCalled();
    });

    it('should decrypt password before creating pool', async () => {
      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
        username: 'user',
        password: 'encrypted:secret',
      };

      await driver.createPool(config);

      expect(mockDecryptCredentials).toHaveBeenCalledWith('encrypted:secret');
      expect(mockPool).toHaveBeenCalled();
    });

    it('should parse connection string for pool', async () => {
      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        connectionString: 'postgresql://user:encrypted:pass@localhost:5432/mydb',
      };

      await driver.createPool(config);

      // URL password is URL-encoded
      expect(mockDecryptCredentials).toHaveBeenCalled();
      expect(mockPool).toHaveBeenCalled();
    });

    it('should handle SSL configuration for pool', async () => {
      const config: DbConnectionConfig = {
        dbType: 'postgresql',
        connectionMode: 'server',
        host: 'localhost',
        ssl: true,
      };

      await driver.createPool(config);

      expect(mockPool).toHaveBeenCalled();
    });
  });

  describe('getPoolStats', () => {
    it('should return pool statistics', () => {
      const pool = {
        totalCount: 5,
        idleCount: 2,
        waitingCount: 1,
        options: { max: 10 },
      } as any;

      const stats = driver.getPoolStats(pool);

      expect(stats).toEqual({
        totalConnections: 5,
        activeConnections: 3, // 5 - 2
        idleConnections: 2,
        waitingRequests: 1,
        maxConnections: 10,
        poolUtilization: 30, // 3/10 * 100
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

    it('should handle missing pool properties', () => {
      const pool = {
        options: { max: 10 },
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
        totalCount: 8,
        idleCount: 3,
        waitingCount: 2,
        options: { max: 10 },
      } as any;

      const stats = driver.getPoolStats(pool);

      expect(stats?.poolUtilization).toBe(50); // 5/10 * 100
      expect(stats?.waitingRequests).toBe(2);
    });

    it('should handle zero maxConnections', () => {
      const pool = {
        totalCount: 2,
        idleCount: 1,
        waitingCount: 0,
        options: { max: 0 },
      } as any;

      const stats = driver.getPoolStats(pool);

      // The code uses `|| 10` which means 0 becomes 10, so utilization is 1/10 * 100 = 10
      // This is a quirk of using || instead of ??
      expect(stats?.maxConnections).toBe(10); // 0 || 10 = 10
      expect(stats?.poolUtilization).toBe(10); // 1/10 * 100
    });

    it('should use default maxConnections when not provided', () => {
      const pool = {
        totalCount: 5,
        idleCount: 2,
        waitingCount: 0,
        options: {},
      } as any;

      const stats = driver.getPoolStats(pool);

      expect(stats?.maxConnections).toBe(10); // default
    });

    it('should handle missing options', () => {
      const pool = {
        totalCount: 5,
        idleCount: 2,
        waitingCount: 0,
      } as any;

      const stats = driver.getPoolStats(pool);

      expect(stats?.maxConnections).toBe(10); // default
    });

    it('should handle errors gracefully', async () => {
      const pool = {
        get totalCount() {
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

    it('should log errors when getting pool stats fails', async () => {
      const pool = {
        get totalCount() {
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
    it('should return true for healthy connection with query method', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      const clientInstance = new mockClient();
      const result = await driver.healthCheck(clientInstance as any);

      expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
      expect(result).toBe(true);
    });

    it('should return true for healthy pool', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      const poolInstance = new mockPool();
      const result = await driver.healthCheck(poolInstance as any);

      expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
      expect(result).toBe(true);
    });

    it('should return false when query fails', async () => {
      mockQuery.mockRejectedValue(new Error('Health check failed'));

      const clientInstance = new mockClient();
      const result = await driver.healthCheck(clientInstance as any);

      expect(result).toBe(false);
    });

    it('should return false for connection without query method', async () => {
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
  });
});
