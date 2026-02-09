/**
 * Database Connection Management Types
 * Shared types for database drivers, connection pooling, and health checks
 */

export type DatabaseType = 'postgresql' | 'mysql' | 'sqlite' | 'mssql';

export interface DbConnectionConfig {
  dbType: DatabaseType;
  connectionMode?: 'server' | 'file'; // Default: 'server'
  
  // Server-based connection
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string; // Encrypted password
  ssl?: boolean;
  
  // File-based connection
  fileId?: string; // Reference to stored file
  filePath?: string; // Direct file path (for internal use)
}

export interface QueryResult {
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  executionTime: number; // milliseconds
}

/**
 * Connection Pool Configuration
 */
export interface ConnectionPoolConfig {
  /** Maximum number of connections in the pool */
  maxConnections?: number;
  /** Minimum number of idle connections to maintain */
  minIdleConnections?: number;
  /** Maximum time (ms) to wait for a connection from the pool */
  connectionTimeout?: number;
  /** Maximum time (ms) a connection can be idle before being closed */
  idleTimeout?: number;
  /** Maximum lifetime (ms) of a connection before it's recycled */
  maxLifetime?: number;
  /** Enable connection health checks */
  healthCheckEnabled?: boolean;
  /** Interval (ms) for periodic health checks */
  healthCheckInterval?: number;
}

/**
 * Connection Pool Statistics
 */
export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  maxConnections: number;
  poolUtilization: number; // percentage (0-100)
}

/**
 * Enhanced Database Driver Interface
 * All drivers must implement this interface
 */
export interface DatabaseDriver {
  // Core connection methods
  connect(config: DbConnectionConfig): Promise<unknown>;
  testConnection(config: DbConnectionConfig): Promise<boolean>;
  executeQuery(connection: unknown, query: string, params: unknown[]): Promise<QueryResult>;
  close(connection: unknown): Promise<void>;
  buildConnectionString(config: DbConnectionConfig): string;
  
  // Optional pool management methods
  createPool?(config: DbConnectionConfig, poolConfig?: ConnectionPoolConfig): Promise<unknown>;
  getPoolStats?(pool: unknown): ConnectionPoolStats | null;
  healthCheck?(connection: unknown): Promise<boolean>;
}

/**
 * Health Check Result
 */
export interface HealthCheckResult {
  healthy: boolean;
  latency?: number; // milliseconds
  error?: string;
  timestamp: Date;
}

/**
 * Pool Information (internal use)
 */
export interface PoolInfo {
  pool: unknown;
  config: DbConnectionConfig;
  poolConfig: ConnectionPoolConfig;
  stats: ConnectionPoolStats;
  lastHealthCheck?: Date;
  healthStatus?: boolean;
  driver: DatabaseDriver;
}
