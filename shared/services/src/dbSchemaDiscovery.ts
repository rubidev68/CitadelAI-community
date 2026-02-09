/**
 * Database Schema Discovery Service
 * Crawls database to understand structure and relationships
 */

import { DatabaseDriver } from '@shared/types';
import { getDatabaseDriver } from './dbDrivers';
import { getDbConnection, type TypedDatabaseConnection } from './dbConnectionService';

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  primaryKeys: string[];
  foreignKeys: ForeignKeySchema[];
  indexes: IndexSchema[];
  rowCount?: number;
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

export interface ForeignKeySchema {
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface IndexSchema {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface DatabaseSchema {
  tables: TableSchema[];
  discoveredAt: string;
}

interface DbBlockProperties {
  connectionMode?: 'server' | 'file';
  dbType: 'postgresql' | 'mysql' | 'sqlite' | 'mssql';
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  // File-based connection
  fileId?: string;
  chatbotId?: string;
  blockId?: string;
}

/**
 * Discover database schema by crawling tables, columns, and relationships
 */
export async function discoverSchema(properties: DbBlockProperties): Promise<DatabaseSchema> {
  const connection = await getDbConnection({
    ...properties,
    chatbotId: properties.chatbotId || '',
    blockId: properties.blockId || '',
  });
  const driver = getDatabaseDriver(properties.dbType);

  try {
    const tables = await discoverTables(connection, driver, properties.dbType);
    
    return {
      tables,
      discoveredAt: new Date().toISOString(),
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Schema discovery failed: ${errorMessage}`);
  }
}

/**
 * Discover all tables in the database
 */
async function discoverTables(
  connection: TypedDatabaseConnection,
  driver: DatabaseDriver,
  dbType: 'postgresql' | 'mysql' | 'sqlite' | 'mssql'
): Promise<TableSchema[]> {
  const tables: TableSchema[] = [];

  // Get list of tables
  const tableNames = await getTableNames(connection, driver, dbType);

  for (const tableName of tableNames) {
    const columns = await getTableColumns(connection, driver, dbType, tableName);
    const primaryKeys = await getPrimaryKeys(connection, driver, dbType, tableName);
    const foreignKeys = await getForeignKeys(connection, driver, dbType, tableName);
    let indexes = await getIndexes(connection, driver, dbType, tableName);
    
    // For SQLite, enrich index columns if empty
    if (dbType === 'sqlite' && indexes.some(idx => !idx.columns || idx.columns.length === 0)) {
      indexes = await enrichSqliteIndexColumns(connection, driver, tableName, indexes);
    }
    
    const rowCount = await getRowCount(connection, driver, tableName);

    tables.push({
      name: tableName,
      columns,
      primaryKeys,
      foreignKeys,
      indexes,
      rowCount,
    });
  }

  return tables;
}

/**
 * Get list of table names
 */
async function getTableNames(
  connection: TypedDatabaseConnection,
  driver: DatabaseDriver,
  dbType: 'postgresql' | 'mysql' | 'sqlite' | 'mssql'
): Promise<string[]> {
  let query: string;

  switch (dbType) {
    case 'postgresql':
      query = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `;
      break;
    case 'mysql':
      query = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE()
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `;
      break;
    case 'sqlite':
      query = `
        SELECT name as table_name
        FROM sqlite_master
        WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
        ORDER BY name;
      `;
      break;
    default:
      throw new Error(`Schema discovery not yet implemented for ${dbType}`);
  }

  const result = await driver.executeQuery(connection, query, []);
  interface TableNameRow {
    table_name?: string;
    TABLE_NAME?: string;
  }
  return result.rows.map((row: TableNameRow) => row.table_name || row.TABLE_NAME || '');
}

/**
 * Get columns for a table
 */
async function getTableColumns(
  connection: TypedDatabaseConnection,
  driver: DatabaseDriver,
  dbType: 'postgresql' | 'mysql' | 'sqlite' | 'mssql',
  tableName: string
): Promise<ColumnSchema[]> {
  let query: string;

  switch (dbType) {
    case 'postgresql':
      query = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku
            ON tc.constraint_name = ku.constraint_name
            AND tc.table_schema = ku.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_name = $1
            AND tc.table_schema = 'public'
        ) pk ON c.column_name = pk.column_name
        WHERE c.table_name = $1
          AND c.table_schema = 'public'
        ORDER BY c.ordinal_position;
      `;
      break;
    case 'mysql':
      query = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku
            ON tc.constraint_name = ku.constraint_name
            AND tc.table_schema = ku.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_name = ?
            AND tc.table_schema = DATABASE()
        ) pk ON c.column_name = pk.column_name
        WHERE c.table_name = ?
          AND c.table_schema = DATABASE()
        ORDER BY c.ordinal_position;
      `;
      break;
    case 'sqlite':
      // SQLite uses PRAGMA table_info for column information
      // Note: This requires a different approach - we'll use a subquery
      query = `
        SELECT 
          name as column_name,
          type as data_type,
          CASE WHEN "notnull" = 0 THEN 'YES' ELSE 'NO' END as is_nullable,
          dflt_value as column_default,
          CASE WHEN pk = 1 THEN true ELSE false END as is_primary_key
        FROM pragma_table_info(?)
        ORDER BY cid;
      `;
      break;
    default:
      throw new Error(`Column discovery not yet implemented for ${dbType}`);
  }

  let params: unknown[];
  if (dbType === 'postgresql') {
    params = [tableName];
  } else if (dbType === 'sqlite') {
    params = [tableName];
  } else {
    params = [tableName, tableName];
  }
  const result = await driver.executeQuery(connection, query, params);

  interface ColumnRow {
    column_name: string;
    data_type: string;
    is_nullable: string | boolean;
    column_default?: string;
    is_primary_key?: boolean;
    is_foreign_key?: boolean;
  }
  return result.rows.map((row: Record<string, unknown>) => {
    const typedRow = row as unknown as ColumnRow;
    return {
      name: typedRow.column_name,
      type: typedRow.data_type,
      nullable: typedRow.is_nullable === 'YES' || typedRow.is_nullable === true,
      defaultValue: typedRow.column_default || undefined,
      isPrimaryKey: typedRow.is_primary_key === true,
      isForeignKey: false, // Will be set by getForeignKeys
    };
  });
}

/**
 * Get primary keys for a table
 */
async function getPrimaryKeys(
  connection: TypedDatabaseConnection,
  driver: DatabaseDriver,
  dbType: 'postgresql' | 'mysql' | 'sqlite' | 'mssql',
  tableName: string
): Promise<string[]> {
  let query: string;

  switch (dbType) {
    case 'postgresql':
      query = `
        SELECT ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku
          ON tc.constraint_name = ku.constraint_name
          AND tc.table_schema = ku.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_name = $1
          AND tc.table_schema = 'public'
        ORDER BY ku.ordinal_position;
      `;
      break;
    case 'mysql':
      query = `
        SELECT ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku
          ON tc.constraint_name = ku.constraint_name
          AND tc.table_schema = ku.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_name = ?
          AND tc.table_schema = DATABASE()
        ORDER BY ku.ordinal_position;
      `;
      break;
    case 'sqlite':
      query = `
        SELECT name as column_name
        FROM pragma_table_info(?)
        WHERE pk = 1
        ORDER BY cid;
      `;
      break;
    default:
      throw new Error(`Primary key discovery not yet implemented for ${dbType}`);
  }

  const params = dbType === 'postgresql' ? [tableName] : [tableName];
  const result = await driver.executeQuery(connection, query, params);
  interface PrimaryKeyRow {
    column_name: string;
  }
  return result.rows.map((row: Record<string, unknown>) => (row as unknown as PrimaryKeyRow).column_name);
}

/**
 * Get foreign keys for a table
 */
async function getForeignKeys(
  connection: TypedDatabaseConnection,
  driver: DatabaseDriver,
  dbType: 'postgresql' | 'mysql' | 'sqlite' | 'mssql',
  tableName: string
): Promise<ForeignKeySchema[]> {
  let query: string;

  switch (dbType) {
    case 'postgresql':
      query = `
        SELECT
          kcu.column_name,
          ccu.table_name AS referenced_table,
          ccu.column_name AS referenced_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1
          AND tc.table_schema = 'public';
      `;
      break;
    case 'mysql':
      query = `
        SELECT
          kcu.column_name,
          kcu.referenced_table_name AS referenced_table,
          kcu.referenced_column_name AS referenced_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = ?
          AND tc.table_schema = DATABASE();
      `;
      break;
    case 'sqlite':
      query = `
        SELECT
          "from" as column_name,
          "table" as referenced_table,
          "to" as referenced_column
        FROM pragma_foreign_key_list(?);
      `;
      break;
    default:
      throw new Error(`Foreign key discovery not yet implemented for ${dbType}`);
  }

  const params = dbType === 'postgresql' ? [tableName] : [tableName];
  const result = await driver.executeQuery(connection, query, params);

  interface ForeignKeyRow {
    column_name: string;
    referenced_table: string;
    referenced_column: string;
  }
  return result.rows.map((row: Record<string, unknown>) => {
    const typedRow = row as unknown as ForeignKeyRow;
    return {
      column: typedRow.column_name,
      referencedTable: typedRow.referenced_table,
      referencedColumn: typedRow.referenced_column,
    };
  });
}

/**
 * Get indexes for a table
 */
async function getIndexes(
  connection: TypedDatabaseConnection,
  driver: DatabaseDriver,
  dbType: 'postgresql' | 'mysql' | 'sqlite' | 'mssql',
  tableName: string
): Promise<IndexSchema[]> {
  let query: string;

  switch (dbType) {
    case 'postgresql':
      query = `
        SELECT
          i.relname AS index_name,
          array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns,
          ix.indisunique AS is_unique
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        WHERE t.relname = $1
          AND t.relkind = 'r'
        GROUP BY i.relname, ix.indisunique
        ORDER BY i.relname;
      `;
      break;
    case 'mysql':
      query = `
        SELECT
          index_name,
          GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns,
          CASE WHEN non_unique = 0 THEN true ELSE false END AS is_unique
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = ?
        GROUP BY index_name, non_unique
        ORDER BY index_name;
      `;
      break;
    case 'sqlite':
      // SQLite index discovery - get index list first, then get columns for each
      // We'll handle this differently - get all indexes, then for each get columns
      // For now, return basic index info without columns (columns can be added later)
      query = `
        SELECT
          name as index_name,
          '' as columns,
          CASE WHEN "unique" = 1 THEN true ELSE false END AS is_unique
        FROM pragma_index_list(?)
        ORDER BY name;
      `;
      break;
    default:
      return []; // Return empty for unsupported databases
  }

  const params = dbType === 'postgresql' ? [tableName] : [tableName];
  const result = await driver.executeQuery(connection, query, params);

  interface IndexRow {
    index_name: string;
    columns?: string | string[];
    is_unique?: boolean | number;
  }
  return result.rows.map((row: Record<string, unknown>) => {
    const typedRow = row as unknown as IndexRow;
    return {
      name: typedRow.index_name,
      columns: Array.isArray(typedRow.columns) ? typedRow.columns : (typedRow.columns ? typedRow.columns.split(',') : []),
      unique: typedRow.is_unique === true || typedRow.is_unique === 1,
    };
  });
}

/**
 * Enrich SQLite indexes with column information
 */
async function enrichSqliteIndexColumns(
  connection: TypedDatabaseConnection,
  driver: DatabaseDriver,
  tableName: string,
  indexes: IndexSchema[]
): Promise<IndexSchema[]> {
  const enrichedIndexes: IndexSchema[] = [];
  
  for (const index of indexes) {
    if (index.columns && index.columns.length > 0) {
      enrichedIndexes.push(index);
      continue;
    }
    
    try {
      // Get columns for this specific index
      const columnQuery = `SELECT name FROM pragma_index_info(?) ORDER BY seqno`;
      const columnResult = await driver.executeQuery(connection, columnQuery, [index.name]);
      interface IndexColumnRow {
        name: string;
      }
      const columnNames = columnResult.rows.map((row: Record<string, unknown>) => (row as unknown as IndexColumnRow).name).filter((name: string) => name);
      
      enrichedIndexes.push({
        ...index,
        columns: columnNames,
      });
    } catch (error) {
      // If we can't get columns, keep the index without columns
      enrichedIndexes.push(index);
    }
  }
  
  return enrichedIndexes;
}

/**
 * Get row count for a table (approximate for large tables)
 */
async function getRowCount(
  connection: TypedDatabaseConnection,
  driver: DatabaseDriver,
  tableName: string
): Promise<number | undefined> {
  try {
    // Sanitize table name to prevent SQL injection
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    if (!sanitizedTableName || sanitizedTableName !== tableName) {
      return undefined;
    }
    const query = `SELECT COUNT(*) as count FROM ${sanitizedTableName}`;
    const result = await driver.executeQuery(connection, query, []);
    const countValue = result.rows[0]?.count;
    if (typeof countValue === 'string') {
      return parseInt(countValue, 10);
    } else if (typeof countValue === 'number') {
      return countValue;
    }
    return undefined;
  } catch (error) {
    // If count fails, return undefined
    return undefined;
  }
}
