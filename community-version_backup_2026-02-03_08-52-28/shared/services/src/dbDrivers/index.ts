import { DatabaseDriver, DatabaseType } from './types';
import { PostgreSQLDriver } from './postgresqlDriver';
import { MySQLDriver } from './mysqlDriver';
import { SQLiteDriver } from './sqliteDriver';

/**
 * Get database driver for a specific database type
 */
export function getDatabaseDriver(dbType: DatabaseType): DatabaseDriver {
  switch (dbType) {
    case 'postgresql':
      return new PostgreSQLDriver();
    case 'mysql':
      return new MySQLDriver();
    case 'sqlite':
      return new SQLiteDriver();
    case 'mssql':
      throw new Error('MSSQL driver not yet implemented');
    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }
}

/**
 * Get all supported database types
 */
export function getSupportedDatabaseTypes(): DatabaseType[] {
  return ['postgresql', 'mysql', 'sqlite'];
}
