/**
 * Database Driver Type Definitions
 * Proper type definitions for pg, mysql2, and sqlite3 drivers
 */

// ============================================================================
// PostgreSQL (pg) Types
// ============================================================================

export interface PostgresConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | {
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
  connectionString?: string;
  max?: number;
  min?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface PostgresQueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
  command: string;
  oid: number;
  fields: Array<{
    name: string;
    tableID: number;
    columnID: number;
    dataTypeID: number;
    dataTypeSize: number;
    dataTypeModifier: number;
    format: string;
  }>;
}

export interface PostgresPool {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<PostgresQueryResult<T>>;
  end(): Promise<void>;
  connect(): Promise<PostgresClient>;
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

export interface PostgresClient {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<PostgresQueryResult<T>>;
  end(): Promise<void>;
  connect(): Promise<void>;
}

// ============================================================================
// MySQL (mysql2) Types
// ============================================================================

export interface MySQLConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | object;
  connectionString?: string;
  waitForConnections?: boolean;
  connectionLimit?: number;
  queueLimit?: number;
  enableKeepAlive?: boolean;
  keepAliveInitialDelay?: number;
  idleTimeout?: number;
  connectTimeout?: number;
}

export interface MySQLField {
  name: string;
  type: number;
  length: number;
  db: string;
  table: string;
  orgTable: string;
  orgName: string;
  charsetNr: number;
  flags: number;
  decimals: number;
  default?: string;
  zeroFill: boolean;
  protocol41: boolean;
}

export interface MySQLQueryResult<T = Record<string, unknown>> {
  rows: T[];
  fields: MySQLField[];
}

export interface MySQLConnection {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<[T[], MySQLField[]]>;
  execute<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<[T[], MySQLField[]]>;
  end(): Promise<void>;
  destroy(): void;
}

export interface MySQLPool {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<[T[], MySQLField[]]>;
  execute<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<[T[], MySQLField[]]>;
  end(): Promise<void>;
  getConnection(): Promise<MySQLConnection>;
  releaseConnection(connection: MySQLConnection): void;
}

// ============================================================================
// SQLite (better-sqlite3) Types
// ============================================================================

export interface SQLiteConfig {
  filename: string;
  options?: {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: (message: string) => void;
  };
}

export interface SQLiteStatement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get<T = Record<string, unknown>>(...params: unknown[]): T | undefined;
  all<T = Record<string, unknown>>(...params: unknown[]): T[];
  iterate<T = Record<string, unknown>>(...params: unknown[]): IterableIterator<T>;
  bind(...params: unknown[]): SQLiteStatement;
  reset(): SQLiteStatement;
  finalize(): void;
}

export interface SQLiteDatabase {
  prepare(sql: string): SQLiteStatement;
  exec(sql: string): { changes: number; lastInsertRowid: number | bigint };
  close(): void;
  backup(destination: SQLiteDatabase): Promise<void>;
  serialize(options?: { attach?: string; detach?: string }): Buffer;
  function(name: string, options?: { varargs?: boolean; deterministic?: boolean; directOnly?: boolean }): void;
  aggregate(name: string, options?: { varargs?: boolean; deterministic?: boolean; directOnly?: boolean }): void;
  table(name: string, factory: (table: unknown) => void): void;
  pragma(pragma: string, options?: { simple?: boolean }): unknown;
  checkpoint(databaseName?: string): void;
  register(customFunction: (...args: unknown[]) => unknown): void;
  unsafeMode(enabled?: boolean): void;
}

// Module augmentations are defined in service-specific db-drivers.d.ts files
// to avoid circular import issues
