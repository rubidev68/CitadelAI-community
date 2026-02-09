import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discoverSchema, DatabaseSchema } from '../dbSchemaDiscovery';
import { getDbConnection } from '../dbConnectionService';
import { getDatabaseDriver } from '../dbDrivers';
import { TypedDatabaseConnection } from '../dbConnectionService';
import { DatabaseDriver } from '../dbDrivers/types';

// Mock dependencies
vi.mock('../dbConnectionService', () => ({
  getDbConnection: vi.fn(),
}));

vi.mock('../dbDrivers', () => ({
  getDatabaseDriver: vi.fn(),
}));

describe('DB Schema Discovery Service', () => {
  let mockConnection: TypedDatabaseConnection;
  let mockDriver: DatabaseDriver;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConnection = {
      dbType: 'postgresql',
    } as TypedDatabaseConnection;

    mockDriver = {
      executeQuery: vi.fn(),
    } as any;

    vi.mocked(getDbConnection).mockResolvedValue(mockConnection);
    vi.mocked(getDatabaseDriver).mockReturnValue(mockDriver);
  });

  describe('discoverSchema', () => {
    it('should discover schema for PostgreSQL', async () => {
      const properties = {
        dbType: 'postgresql' as const,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
        password: 'encrypted:password',
      };

      // Mock table names query
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ table_name: 'users' }, { table_name: 'orders' }],
        rowCount: 2,
        executionTime: 10,
      });

      // Mock columns query for users table
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [
          {
            column_name: 'id',
            data_type: 'integer',
            is_nullable: 'NO',
            column_default: null,
            is_primary_key: true,
          },
          {
            column_name: 'name',
            data_type: 'varchar',
            is_nullable: 'YES',
            column_default: null,
            is_primary_key: false,
          },
        ],
        rowCount: 2,
        executionTime: 5,
      });

      // Mock primary keys query for users
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ column_name: 'id' }],
        rowCount: 1,
        executionTime: 2,
      });

      // Mock foreign keys query for users
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 2,
      });

      // Mock indexes query for users
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 2,
      });

      // Mock row count query for users
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ count: 100 }],
        rowCount: 1,
        executionTime: 2,
      });

      // Mock columns query for orders table
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [
          {
            column_name: 'id',
            data_type: 'integer',
            is_nullable: 'NO',
            column_default: null,
            is_primary_key: true,
          },
          {
            column_name: 'user_id',
            data_type: 'integer',
            is_nullable: 'NO',
            column_default: null,
            is_primary_key: false,
          },
        ],
        rowCount: 2,
        executionTime: 5,
      });

      // Mock primary keys query for orders
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ column_name: 'id' }],
        rowCount: 1,
        executionTime: 2,
      });

      // Mock foreign keys query for orders
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [
          {
            column_name: 'user_id',
            referenced_table: 'users',
            referenced_column: 'id',
          },
        ],
        rowCount: 1,
        executionTime: 2,
      });

      // Mock indexes query for orders
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 2,
      });

      // Mock row count query for orders
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ count: 500 }],
        rowCount: 1,
        executionTime: 2,
      });

      const schema = await discoverSchema(properties);

      expect(getDbConnection).toHaveBeenCalled();
      expect(getDatabaseDriver).toHaveBeenCalledWith('postgresql');
      expect(schema.tables).toHaveLength(2);
      expect(schema.discoveredAt).toBeDefined();
      expect(schema.tables[0].name).toBe('users');
      expect(schema.tables[0].columns).toHaveLength(2);
      expect(schema.tables[0].primaryKeys).toEqual(['id']);
      expect(schema.tables[0].rowCount).toBe(100);
      expect(schema.tables[1].name).toBe('orders');
      expect(schema.tables[1].foreignKeys).toHaveLength(1);
      expect(schema.tables[1].foreignKeys[0].column).toBe('user_id');
      expect(schema.tables[1].foreignKeys[0].referencedTable).toBe('users');
    });

    it('should discover schema for MySQL', async () => {
      const properties = {
        dbType: 'mysql' as const,
        host: 'localhost',
        port: 3306,
        database: 'testdb',
      };

      mockConnection.dbType = 'mysql';

      // Mock table names query
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ table_name: 'products' }],
        rowCount: 1,
        executionTime: 5,
      });

      // Mock columns query
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [
          {
            column_name: 'id',
            data_type: 'int',
            is_nullable: 'NO',
            column_default: null,
            is_primary_key: true,
          },
        ],
        rowCount: 1,
        executionTime: 3,
      });

      // Mock primary keys query
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ column_name: 'id' }],
        rowCount: 1,
        executionTime: 2,
      });

      // Mock foreign keys query
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 2,
      });

      // Mock indexes query
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 2,
      });

      // Mock row count query
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ count: 50 }],
        rowCount: 1,
        executionTime: 2,
      });

      const schema = await discoverSchema(properties);

      expect(schema.tables).toHaveLength(1);
      expect(schema.tables[0].name).toBe('products');
    });

    it('should discover schema for SQLite', async () => {
      const properties = {
        dbType: 'sqlite' as const,
        fileId: 'file-1',
        chatbotId: 'chatbot-1',
        blockId: 'block-1',
      };

      mockConnection.dbType = 'sqlite';

      // Mock table names query
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ table_name: 'customers' }],
        rowCount: 1,
        executionTime: 2,
      });

      // Mock columns query
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [
          {
            column_name: 'id',
            data_type: 'INTEGER',
            is_nullable: 'NO',
            column_default: null,
            is_primary_key: true,
          },
        ],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock primary keys query
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ column_name: 'id' }],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock foreign keys query
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 1,
      });

      // Mock indexes query (SQLite returns empty columns initially)
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [
          {
            index_name: 'idx_name',
            columns: '',
            is_unique: false,
          },
        ],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock enrichSqliteIndexColumns query
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ name: 'name' }],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock row count query
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ count: 25 }],
        rowCount: 1,
        executionTime: 1,
      });

      const schema = await discoverSchema(properties);

      expect(schema.tables).toHaveLength(1);
      expect(schema.tables[0].name).toBe('customers');
      expect(schema.tables[0].indexes).toHaveLength(1);
      expect(schema.tables[0].indexes[0].columns).toEqual(['name']);
    });

    it('should handle SQLite indexes with existing columns', async () => {
      const properties = {
        dbType: 'sqlite' as const,
        fileId: 'file-1',
        chatbotId: 'chatbot-1',
        blockId: 'block-1',
      };

      mockConnection.dbType = 'sqlite';

      // Mock table names query
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ table_name: 'items' }],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock columns query
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [
          {
            column_name: 'id',
            data_type: 'INTEGER',
            is_nullable: 'NO',
            is_primary_key: true,
          },
        ],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock primary keys query
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ column_name: 'id' }],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock foreign keys query
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 1,
      });

      // Mock indexes query (with existing columns - should not enrich)
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [
          {
            index_name: 'idx_id',
            columns: 'id',
            is_unique: true,
          },
        ],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock row count query
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ count: 10 }],
        rowCount: 1,
        executionTime: 1,
      });

      const schema = await discoverSchema(properties);

      expect(schema.tables[0].indexes[0].columns).toEqual(['id']);
      expect(schema.tables[0].indexes[0].unique).toBe(true);
    });

    it('should handle empty database', async () => {
      const properties = {
        dbType: 'postgresql' as const,
        host: 'localhost',
      };

      // Mock empty table names query
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 5,
      });

      const schema = await discoverSchema(properties);

      expect(schema.tables).toHaveLength(0);
      expect(schema.discoveredAt).toBeDefined();
    });

    it('should handle nullable columns correctly', async () => {
      const properties = {
        dbType: 'postgresql' as const,
        host: 'localhost',
      };

      // Mock table names
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ table_name: 'users' }],
        rowCount: 1,
        executionTime: 2,
      });

      // Mock columns with nullable
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [
          {
            column_name: 'email',
            data_type: 'varchar',
            is_nullable: 'YES',
            is_primary_key: false,
          },
        ],
        rowCount: 1,
        executionTime: 2,
      });

      // Mock primary keys
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 1,
      });

      // Mock foreign keys
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 1,
      });

      // Mock indexes
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 1,
      });

      // Mock row count
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ count: 0 }],
        rowCount: 1,
        executionTime: 1,
      });

      const schema = await discoverSchema(properties);

      expect(schema.tables[0].columns[0].nullable).toBe(true);
    });

    it('should handle columns with default values', async () => {
      const properties = {
        dbType: 'postgresql' as const,
        host: 'localhost',
      };

      // Mock table names
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ table_name: 'settings' }],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock columns with default
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [
          {
            column_name: 'enabled',
            data_type: 'boolean',
            is_nullable: 'NO',
            column_default: 'true',
            is_primary_key: false,
          },
        ],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock primary keys
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 1,
      });

      // Mock foreign keys
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 1,
      });

      // Mock indexes
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 1,
      });

      // Mock row count
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ count: 1 }],
        rowCount: 1,
        executionTime: 1,
      });

      const schema = await discoverSchema(properties);

      expect(schema.tables[0].columns[0].defaultValue).toBe('true');
    });

    it('should handle row count as string', async () => {
      const properties = {
        dbType: 'postgresql' as const,
        host: 'localhost',
      };

      // Mock table names
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ table_name: 'logs' }],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock columns
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [
          {
            column_name: 'id',
            data_type: 'integer',
            is_nullable: 'NO',
            is_primary_key: true,
          },
        ],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock primary keys
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ column_name: 'id' }],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock foreign keys
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 1,
      });

      // Mock indexes
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 1,
      });

      // Mock row count as string
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ count: '1000' }],
        rowCount: 1,
        executionTime: 1,
      });

      const schema = await discoverSchema(properties);

      expect(schema.tables[0].rowCount).toBe(1000);
    });

    it('should handle row count failure gracefully', async () => {
      const properties = {
        dbType: 'postgresql' as const,
        host: 'localhost',
      };

      // Mock table names
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ table_name: 'temp_table' }],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock columns
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [
          {
            column_name: 'id',
            data_type: 'integer',
            is_nullable: 'NO',
            is_primary_key: true,
          },
        ],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock primary keys
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ column_name: 'id' }],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock foreign keys
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 1,
      });

      // Mock indexes
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 1,
      });

      // Mock row count failure
      vi.mocked(mockDriver.executeQuery).mockRejectedValueOnce(new Error('Table not found'));

      const schema = await discoverSchema(properties);

      expect(schema.tables[0].rowCount).toBeUndefined();
    });

    it('should handle SQLite index enrichment failure', async () => {
      const properties = {
        dbType: 'sqlite' as const,
        fileId: 'file-1',
        chatbotId: 'chatbot-1',
        blockId: 'block-1',
      };

      mockConnection.dbType = 'sqlite';

      // Mock table names
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ table_name: 'test' }],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock columns
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [
          {
            column_name: 'id',
            data_type: 'INTEGER',
            is_nullable: 'NO',
            is_primary_key: true,
          },
        ],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock primary keys
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ column_name: 'id' }],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock foreign keys
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 1,
      });

      // Mock indexes with empty columns
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [
          {
            index_name: 'bad_index',
            columns: '',
            is_unique: false,
          },
        ],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock index enrichment failure
      vi.mocked(mockDriver.executeQuery).mockRejectedValueOnce(new Error('Index not found'));

      // Mock row count
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ count: 0 }],
        rowCount: 1,
        executionTime: 1,
      });

      const schema = await discoverSchema(properties);

      expect(schema.tables[0].indexes).toHaveLength(1);
      expect(schema.tables[0].indexes[0].columns).toEqual([]);
    });

    it('should throw error on discovery failure', async () => {
      const properties = {
        dbType: 'postgresql' as const,
        host: 'localhost',
      };

      // Mock connection failure - this happens before try-catch, so error is not wrapped
      vi.mocked(getDbConnection).mockRejectedValue(new Error('Connection failed'));

      await expect(discoverSchema(properties)).rejects.toThrow('Connection failed');
    });

    it('should wrap error on table discovery failure', async () => {
      const properties = {
        dbType: 'postgresql' as const,
        host: 'localhost',
      };

      // Mock successful connection but table discovery failure
      vi.mocked(mockDriver.executeQuery).mockRejectedValue(new Error('Query failed'));

      await expect(discoverSchema(properties)).rejects.toThrow('Schema discovery failed: Query failed');
    });

    it('should handle MySQL table name format', async () => {
      const properties = {
        dbType: 'mysql' as const,
        host: 'localhost',
      };

      mockConnection.dbType = 'mysql';

      // Mock table names with TABLE_NAME format
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ TABLE_NAME: 'products' }],
        rowCount: 1,
        executionTime: 2,
      });

      // Mock columns
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [
          {
            column_name: 'id',
            data_type: 'int',
            is_nullable: 'NO',
            is_primary_key: true,
          },
        ],
        rowCount: 1,
        executionTime: 2,
      });

      // Mock primary keys
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ column_name: 'id' }],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock foreign keys
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 1,
      });

      // Mock indexes
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 1,
      });

      // Mock row count
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ count: 10 }],
        rowCount: 1,
        executionTime: 1,
      });

      const schema = await discoverSchema(properties);

      expect(schema.tables[0].name).toBe('products');
    });

    it('should handle indexes with comma-separated columns', async () => {
      const properties = {
        dbType: 'mysql' as const,
        host: 'localhost',
      };

      mockConnection.dbType = 'mysql';

      // Mock table names
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ table_name: 'users' }],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock columns
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [
          {
            column_name: 'id',
            data_type: 'int',
            is_nullable: 'NO',
            is_primary_key: true,
          },
        ],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock primary keys
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ column_name: 'id' }],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock foreign keys
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 1,
      });

      // Mock indexes with comma-separated columns
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [
          {
            index_name: 'idx_name_email',
            columns: 'name,email',
            is_unique: false,
          },
        ],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock row count
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ count: 5 }],
        rowCount: 1,
        executionTime: 1,
      });

      const schema = await discoverSchema(properties);

      expect(schema.tables[0].indexes[0].columns).toEqual(['name', 'email']);
    });

    it('should handle indexes with array columns', async () => {
      const properties = {
        dbType: 'postgresql' as const,
        host: 'localhost',
      };

      // Mock table names
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ table_name: 'posts' }],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock columns
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [
          {
            column_name: 'id',
            data_type: 'integer',
            is_nullable: 'NO',
            is_primary_key: true,
          },
        ],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock primary keys
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ column_name: 'id' }],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock foreign keys
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 1,
      });

      // Mock indexes with array columns (PostgreSQL)
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [
          {
            index_name: 'idx_title',
            columns: ['title'],
            is_unique: true,
          },
        ],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock row count
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ count: 20 }],
        rowCount: 1,
        executionTime: 1,
      });

      const schema = await discoverSchema(properties);

      expect(schema.tables[0].indexes[0].columns).toEqual(['title']);
      expect(schema.tables[0].indexes[0].unique).toBe(true);
    });

    it('should handle row count with invalid table name', async () => {
      const properties = {
        dbType: 'postgresql' as const,
        host: 'localhost',
      };

      // Mock table names with invalid characters
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ table_name: 'table-name' }], // Invalid: contains hyphen
        rowCount: 1,
        executionTime: 1,
      });

      // Mock columns
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [
          {
            column_name: 'id',
            data_type: 'integer',
            is_nullable: 'NO',
            is_primary_key: true,
          },
        ],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock primary keys
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ column_name: 'id' }],
        rowCount: 1,
        executionTime: 1,
      });

      // Mock foreign keys
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 1,
      });

      // Mock indexes
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        executionTime: 1,
      });

      // Row count query - the sanitization will remove the hyphen, making it 'tablename'
      // Since sanitized name doesn't match original, it returns undefined
      // But the query might still be called, so we need to handle it
      vi.mocked(mockDriver.executeQuery).mockResolvedValueOnce({
        rows: [{ count: 0 }],
        rowCount: 1,
        executionTime: 1,
      });

      const schema = await discoverSchema(properties);

      // The getRowCount function checks if sanitized name matches original
      // Since 'table-name' becomes 'tablename' (hyphen removed), they don't match
      // So rowCount should be undefined
      expect(schema.tables[0].name).toBe('table-name');
      expect(schema.tables[0].rowCount).toBeUndefined();
    });
  });
});
