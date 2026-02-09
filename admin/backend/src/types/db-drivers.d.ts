// Type declarations for database drivers
// These types match the definitions in @shared/types/database-drivers
// but are defined here to avoid import issues in module declarations

interface PostgresConfig {
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
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

interface PostgresQueryResult<T = Record<string, unknown>> {
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

interface PostgresPool {
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

interface PostgresClient {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<PostgresQueryResult<T>>;
  end(): Promise<void>;
  connect(): Promise<void>;
}

interface MySQLConfig {
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
}

interface MySQLField {
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

interface MySQLConnection {
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

interface MySQLPool {
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

interface SQLiteConfig {
  filename: string;
  options?: {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: (message: string) => void;
  };
}

interface SQLiteStatement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get<T = Record<string, unknown>>(...params: unknown[]): T | undefined;
  all<T = Record<string, unknown>>(...params: unknown[]): T[];
  iterate<T = Record<string, unknown>>(...params: unknown[]): IterableIterator<T>;
  bind(...params: unknown[]): SQLiteStatement;
  reset(): SQLiteStatement;
  finalize(): void;
}

interface SQLiteDatabase {
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

declare module 'pg' {
  export class Pool implements PostgresPool {
    constructor(config?: PostgresConfig);
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
  
  export class Client implements PostgresClient {
    constructor(config?: PostgresConfig);
    connect(): Promise<void>;
    query<T = Record<string, unknown>>(
      text: string,
      params?: unknown[]
    ): Promise<PostgresQueryResult<T>>;
    end(): Promise<void>;
  }
}

declare module 'mysql2/promise' {
  export interface Connection extends MySQLConnection {}
  
  export function createConnection(config: MySQLConfig): Promise<Connection>;
}

declare module 'mysql2' {
  export interface Pool extends MySQLPool {}
  
  export interface Connection extends MySQLConnection {}
  
  export function createPool(config: MySQLConfig): Pool;
  export function createConnection(config: MySQLConfig): Connection;
}

declare module 'better-sqlite3' {
  class DatabaseClass implements SQLiteDatabase {
    constructor(filename: string, options?: SQLiteConfig['options']);
    prepare(sql: string): SQLiteStatement;
    exec(sql: string): { changes: number; lastInsertRowid: number | bigint };
    close(): void;
    backup(destination: DatabaseClass): Promise<void>;
    serialize(options?: { attach?: string; detach?: string }): Buffer;
    function(name: string, options?: { varargs?: boolean; deterministic?: boolean; directOnly?: boolean }): void;
    aggregate(name: string, options?: { varargs?: boolean; deterministic?: boolean; directOnly?: boolean }): void;
    table(name: string, factory: (table: unknown) => void): void;
    pragma(pragma: string, options?: { simple?: boolean }): unknown;
    checkpoint(databaseName?: string): void;
    register(customFunction: (...args: unknown[]) => unknown): void;
    unsafeMode(enabled?: boolean): void;
  }
  
  export class Statement implements SQLiteStatement {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
    get<T = Record<string, unknown>>(...params: unknown[]): T | undefined;
    all<T = Record<string, unknown>>(...params: unknown[]): T[];
    iterate<T = Record<string, unknown>>(...params: unknown[]): IterableIterator<T>;
    bind(...params: unknown[]): Statement;
    reset(): Statement;
    finalize(): void;
  }
  
  // Default export is the Database class constructor
  const Database: {
    new (filename: string, options?: SQLiteConfig['options']): DatabaseClass;
  };
  export default Database;
  export { DatabaseClass as Database };
}
