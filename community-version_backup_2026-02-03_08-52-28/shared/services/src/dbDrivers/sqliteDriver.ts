/**
 * SQLite Database Driver
 * Handles connections to SQLite database files
 */

import {
  DatabaseDriver,
  DbConnectionConfig,
  QueryResult,
  ConnectionPoolConfig,
  ConnectionPoolStats,
  SQLiteDatabase,
} from '@shared/types';
import { logger } from '@shared/utils';

const sqliteDriverLogger = logger.child({ service: 'shared-services', component: 'sqliteDriver' });

// Dynamic import for better-sqlite3
let DatabaseClass: any;

async function loadSqliteDriver() {
  if (!DatabaseClass) {
    try {
      const betterSqlite3 = await import('better-sqlite3');
      DatabaseClass = betterSqlite3.default || betterSqlite3;
    } catch (error) {
      throw new Error('Failed to load better-sqlite3. Please ensure it is installed in the host application.');
    }
  }
}

/**
 * SQLite Pool Wrapper Type
 * SQLite doesn't have native pooling, so we create a simple wrapper
 */
interface SQLitePoolWrapper {
  connection: SQLiteDatabase;
  _isPool: true;
  _maxConnections: number;
  _activeConnections: number;
}

export class SQLiteDriver implements DatabaseDriver {
  async connect(config: DbConnectionConfig): Promise<SQLiteDatabase> {
    // SQLite requires a file path
    const filePath = config.filePath;
    
    if (!filePath) {
      throw new Error('SQLite requires a file path. Use connectionMode: "file" and provide a fileId.');
    }

    // Check if file exists
    const fs = await import('fs/promises');
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`SQLite database file not found: ${filePath}`);
    }

    // Open database in read-only mode for safety
    // Database from better-sqlite3 implements SQLiteDatabase interface
    await loadSqliteDriver();
    const db = new DatabaseClass(filePath, { readonly: true }) as SQLiteDatabase;
    
    // Enable WAL mode for better concurrency (optional, but helps with read-only access)
    try {
      db.pragma('journal_mode = WAL');
    } catch {
      // Ignore if WAL mode is not available (some SQLite versions)
    }

    return db;
  }

  async testConnection(config: DbConnectionConfig): Promise<boolean> {
    try {
      const db = await this.connect(config);
      db.prepare('SELECT 1').get();
      this.close(db);
      return true;
    } catch (error) {
      sqliteDriverLogger.error('SQLite connection test failed', { error: error instanceof Error ? error : new Error(String(error)) });
      return false;
    }
  }

  async executeQuery(
    connection: SQLiteDatabase,
    query: string,
    params: unknown[]
  ): Promise<QueryResult> {
    const startTime = Date.now();
    
    try {
      // Use prepared statements for parameterized queries
      const stmt = connection.prepare(query);
      const rows = stmt.all(...(params as any[])) as Array<Record<string, unknown>>;
      
      const executionTime = Date.now() - startTime;
      
      return {
        rows,
        rowCount: rows.length,
        executionTime,
      };
    } catch (error) {
      throw new Error(`SQLite query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async close(connection: SQLiteDatabase): Promise<void> {
    try {
      connection.close();
    } catch (error) {
      sqliteDriverLogger.error('Error closing SQLite connection', { error: error instanceof Error ? error : new Error(String(error)) });
    }
  }

  buildConnectionString(config: DbConnectionConfig): string {
    // SQLite connection string format: sqlite:///path/to/file.db
    if (config.filePath) {
      return `sqlite:///${config.filePath}`;
    }
    return 'sqlite:///:memory:';
  }

  /**
   * Create a connection pool (SQLite doesn't have native pooling, so we create a simple wrapper)
   */
  async createPool(config: DbConnectionConfig, poolConfig?: ConnectionPoolConfig): Promise<SQLitePoolWrapper> {
    // SQLite doesn't have native connection pooling
    // We return a single connection wrapped in a pool-like interface
    const connection = await this.connect(config);
    return {
      connection,
      _isPool: true as const,
      _maxConnections: poolConfig?.maxConnections || 1,
      _activeConnections: 1,
    };
  }

  /**
   * Get pool statistics (for SQLite, it's always 1 connection)
   */
  getPoolStats(pool: SQLiteDatabase | SQLitePoolWrapper): ConnectionPoolStats | null {
    if (!pool) {
      return null;
    }

    // Type guard to check if it's a pool wrapper
    const isPoolWrapper = (p: SQLiteDatabase | SQLitePoolWrapper): p is SQLitePoolWrapper => {
      return typeof p === 'object' && '_isPool' in p && p._isPool === true;
    };

    // If it's a pool wrapper
    if (isPoolWrapper(pool)) {
      return {
        totalConnections: 1,
        activeConnections: pool._activeConnections || 1,
        idleConnections: 0,
        waitingRequests: 0,
        maxConnections: pool._maxConnections || 1,
        poolUtilization: 100,
      };
    }

    // Single connection
    return {
      totalConnections: 1,
      activeConnections: 1,
      idleConnections: 0,
      waitingRequests: 0,
      maxConnections: 1,
      poolUtilization: 100,
    };
  }

  /**
   * Health check for a connection
   */
  async healthCheck(connection: SQLiteDatabase | SQLitePoolWrapper): Promise<boolean> {
    try {
      if (!connection) {
        return false;
      }

      // Type guard to check if it's a pool wrapper
      const isPoolWrapper = (p: SQLiteDatabase | SQLitePoolWrapper): p is SQLitePoolWrapper => {
        return typeof p === 'object' && '_isPool' in p && p._isPool === true;
      };

      // For pool wrapper, check the underlying connection
      const db = isPoolWrapper(connection) ? connection.connection : connection;
      if (db && typeof db.prepare === 'function') {
        db.prepare('SELECT 1').get();
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
}
