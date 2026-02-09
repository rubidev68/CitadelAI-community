import { loadConfig } from './config';
import { runPrismaMigrations } from './migrations/prisma';
import { runSqlMigrations } from './migrations/sql';
import { logger } from './logger';
import { MigrationResult, MigrationStatus } from './migrations/types';
import { Client } from 'pg';
import * as fs from 'fs';

async function waitForDatabase(databaseUrl: string, maxRetries = 30, delayMs = 2000): Promise<void> {
  logger.info('Waiting for database to be ready...');
  
  for (let i = 0; i < maxRetries; i++) {
    const client = new Client({ connectionString: databaseUrl });
    
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      logger.info('Database is ready!');
      return;
    } catch (error) {
      logger.debug(`Database connection attempt ${i + 1}/${maxRetries} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw new Error(`Database not ready after ${maxRetries} attempts`);
}

async function acquireMigrationLock(databaseUrl: string): Promise<() => Promise<void>> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  
  // Try to acquire an advisory lock (PostgreSQL feature)
  const lockId = 1234567890; // Arbitrary lock ID
  const result = await client.query('SELECT pg_try_advisory_lock($1)', [lockId]);
  
  if (!result.rows[0].pg_try_advisory_lock) {
    await client.end();
    throw new Error('Another migration process is already running. Please wait for it to complete.');
  }
  
  logger.info('Acquired migration lock');
  
  return async () => {
    await client.query('SELECT pg_advisory_unlock($1)', [lockId]);
    await client.end();
    logger.info('Released migration lock');
  };
}

// Create a completion marker file for health checks
function createCompletionMarker(): void {
  const markerPath = '/tmp/migrations-complete';
  try {
    fs.writeFileSync(markerPath, JSON.stringify({ completed: true, timestamp: new Date().toISOString() }));
  } catch (error) {
    // Ignore errors creating marker file
  }
}

async function runMigrations(): Promise<void> {
  const startTime = Date.now();
  logger.info('=== Starting Database Migration Service ===');
  
  try {
    // Load configuration
    const config = loadConfig();
    logger.info(`Loaded configuration for ${config.migrations.length} migration(s)`);
    
    // Wait for database to be ready
    await waitForDatabase(config.databaseUrl);
    
    // Acquire migration lock
    const releaseLock = await acquireMigrationLock(config.databaseUrl);
    
    try {
      const results: MigrationResult[] = [];
      const errors: string[] = [];
      
      // Execute migrations in order
      for (const migration of config.migrations) {
        logger.info(`\n--- Processing migrations for service: ${migration.service} ---`);
        
        let result: MigrationResult;
        
        if (migration.type === 'prisma') {
          result = await runPrismaMigrations(
            migration.service,
            migration.path,
            config.databaseUrl
          );
        } else if (migration.type === 'sql') {
          result = await runSqlMigrations(
            migration.service,
            migration.path,
            config.databaseUrl,
            migration.files
          );
        } else {
          throw new Error(`Unknown migration type: ${migration.type}`);
        }
        
        results.push(result);
        
        if (!result.success) {
          errors.push(`Migration failed for ${migration.service}: ${result.error}`);
          logger.error(`❌ Migration failed for ${migration.service}`);
          
          // Decide whether to continue or stop
          // For now, we'll stop on first failure to prevent partial migrations
          throw new Error(`Migration failed for ${migration.service}: ${result.error}`);
        } else {
          const appliedCount = result.appliedMigrations?.length || 0;
          if (appliedCount > 0) {
            logger.info(`✅ Applied ${appliedCount} migration(s) for ${migration.service}`);
          } else {
            logger.info(`✅ No pending migrations for ${migration.service}`);
          }
        }
      }
      
      // Summary
      const totalDuration = Date.now() - startTime;
      const status: MigrationStatus = {
        completed: true,
        results,
        totalDuration,
        errors: [],
      };
      
      logger.info('\n=== Migration Summary ===');
      logger.info(`Total duration: ${(totalDuration / 1000).toFixed(2)}s`);
      logger.info(`Services processed: ${results.length}`);
      
      const totalApplied = results.reduce(
        (sum, r) => sum + (r.appliedMigrations?.length || 0),
        0
      );
      logger.info(`Total migrations applied: ${totalApplied}`);
      
      if (totalApplied === 0) {
        logger.info('All migrations are up to date! ✨');
      }
      
      logger.info('=== Migration Service Completed Successfully ===\n');
      
      // Create completion marker for health checks
      createCompletionMarker();
      
    } finally {
      await releaseLock();
    }
    
    // Keep the process running for health checks, but exit after a delay
    // This allows Docker Compose to detect completion via healthcheck
    setTimeout(() => {
      process.exit(0);
    }, 5000);
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('\n=== Migration Service Failed ===');
    logger.error(`Error: ${error.message}`);
    logger.error(`Duration: ${(duration / 1000).toFixed(2)}s`);
    logger.error('=== Exiting with error ===\n');
    
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run migrations
runMigrations();
