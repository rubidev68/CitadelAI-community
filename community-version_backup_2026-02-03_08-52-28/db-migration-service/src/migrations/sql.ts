import { Client } from 'pg';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../logger';
import { MigrationResult } from './types';

const MIGRATION_TRACKING_TABLE = 'db_migration_service_history';

export async function runSqlMigrations(
  service: string,
  migrationPath: string,
  databaseUrl: string,
  files?: string[]
): Promise<MigrationResult> {
  const startTime = Date.now();
  logger.info(`Starting SQL migrations for service: ${service}`);

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    logger.debug(`Connected to database for ${service}`);

    // Create migration tracking table if it doesn't exist
    await createMigrationTrackingTable(client);

    // Validate migration path exists
    if (!fs.existsSync(migrationPath)) {
      logger.warn(`Migration path does not exist: ${migrationPath}, skipping ${service}`);
      return {
        service,
        success: true,
        appliedMigrations: [],
        duration: Date.now() - startTime,
      };
    }

    // Get list of migration files
    const migrationFiles = files || fs.readdirSync(migrationPath)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort alphabetically for consistent order

    if (migrationFiles.length === 0) {
      logger.info(`No SQL migration files found for ${service}`);
      return {
        service,
        success: true,
        appliedMigrations: [],
        duration: Date.now() - startTime,
      };
    }

    const appliedMigrations: string[] = [];

    // Execute each migration file
    for (const file of migrationFiles) {
      const filePath = path.join(migrationPath, file);
      
      if (!fs.existsSync(filePath)) {
        logger.warn(`Migration file not found: ${filePath}, skipping`);
        continue;
      }

      // Check if migration has already been applied
      const migrationKey = `${service}:${file}`;
      const alreadyApplied = await isMigrationApplied(client, migrationKey);

      if (alreadyApplied) {
        logger.info(`Migration ${file} already applied for ${service}, skipping`);
        continue;
      }

      // Read and validate SQL file
      const sql = fs.readFileSync(filePath, 'utf-8');
      
      // Warn about potentially destructive operations
      validateSqlSafety(sql, file);

      // Execute migration in a transaction
      logger.info(`Applying SQL migration: ${file} for ${service}`);
      
      try {
        await client.query('BEGIN');
        await client.query(sql);
        
        // Record migration as applied
        await recordMigrationApplied(client, migrationKey, file, service);
        await client.query('COMMIT');
        
        appliedMigrations.push(file);
        logger.info(`Successfully applied migration: ${file} for ${service}`);
      } catch (error: any) {
        await client.query('ROLLBACK');
        
        // Check if error is due to missing dependencies (e.g., missing enum types, tables)
        // This is common when a service doesn't exist in certain deployment types
        const errorMessage = error.message || String(error);
        const isMissingDependency = 
          errorMessage.includes('does not exist') ||
          (errorMessage.includes('relation') && errorMessage.includes('does not exist')) ||
          (errorMessage.includes('type') && errorMessage.includes('does not exist'));
        
        if (isMissingDependency) {
          logger.warn(`⚠️  Skipping migration ${file} for ${service}: ${errorMessage}`);
          logger.warn(`   This is expected if ${service} is not deployed in this environment.`);
          // Mark as skipped (not applied) so it can be retried if dependencies are added later
          continue;
        }
        
        // For other errors, fail the migration
        throw new Error(`Failed to apply migration ${file}: ${errorMessage}`);
      }
    }

    const duration = Date.now() - startTime;
    return {
      service,
      success: true,
      appliedMigrations,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = error.message || String(error);
    logger.error(`SQL migration failed for ${service}: ${errorMessage}`);
    
    return {
      service,
      success: false,
      error: errorMessage,
      duration,
    };
  } finally {
    await client.end();
  }
}

async function createMigrationTrackingTable(client: Client): Promise<void> {
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TRACKING_TABLE} (
      id SERIAL PRIMARY KEY,
      migration_key VARCHAR(255) UNIQUE NOT NULL,
      service VARCHAR(100) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_migration_service 
      ON ${MIGRATION_TRACKING_TABLE}(service);
    
    CREATE INDEX IF NOT EXISTS idx_migration_key 
      ON ${MIGRATION_TRACKING_TABLE}(migration_key);
  `;

  await client.query(createTableSql);
}

async function isMigrationApplied(client: Client, migrationKey: string): Promise<boolean> {
  const result = await client.query(
    `SELECT 1 FROM ${MIGRATION_TRACKING_TABLE} WHERE migration_key = $1`,
    [migrationKey]
  );
  return (result.rowCount ?? 0) > 0;
}

async function recordMigrationApplied(
  client: Client,
  migrationKey: string,
  fileName: string,
  service: string
): Promise<void> {
  await client.query(
    `INSERT INTO ${MIGRATION_TRACKING_TABLE} (migration_key, service, file_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (migration_key) DO NOTHING`,
    [migrationKey, service, fileName]
  );
}

function validateSqlSafety(sql: string, fileName: string): void {
  const upperSql = sql.toUpperCase();
  
  // Warn about potentially destructive operations
  const destructivePatterns = [
    /\bDROP\s+TABLE\b/i,
    /\bDROP\s+DATABASE\b/i,
    /\bTRUNCATE\s+TABLE\b/i,
    /\bDELETE\s+FROM\b/i, // Without WHERE clause
  ];

  for (const pattern of destructivePatterns) {
    if (pattern.test(sql)) {
      // Check if it's a safe DROP (IF EXISTS) or DELETE with WHERE
      if (pattern.source.includes('DROP') && sql.includes('IF EXISTS')) {
        continue; // Safe DROP IF EXISTS
      }
      if (pattern.source.includes('DELETE') && sql.match(/DELETE\s+FROM.*WHERE/i)) {
        continue; // DELETE with WHERE is usually safe
      }
      
      logger.warn(
        `⚠️  Potentially destructive operation detected in ${fileName}: ${pattern.source}`
      );
      logger.warn('Please review this migration carefully before applying to production');
    }
  }
}
