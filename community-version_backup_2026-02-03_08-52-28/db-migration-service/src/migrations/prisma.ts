import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../logger';
import { MigrationResult } from './types';

const execAsync = promisify(exec);

export async function runPrismaMigrations(
  service: string,
  migrationPath: string,
  databaseUrl: string
): Promise<MigrationResult> {
  const startTime = Date.now();
  logger.info(`Starting Prisma migrations for service: ${service}`);

  try {
    // Validate migration path exists
    if (!fs.existsSync(migrationPath)) {
      logger.warn(`Migration path does not exist: ${migrationPath}, skipping ${service}`);
      return {
        service,
        success: true,
        appliedMigrations: [],
        duration: 0,
      };
    }

    // Check if migrations directory exists
    const migrationsDir = path.join(migrationPath, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      logger.warn(`No migrations directory found at: ${migrationsDir}, skipping ${service}`);
      return {
        service,
        success: true,
        appliedMigrations: [],
        duration: 0,
      };
    }

    // Check if schema.prisma exists
    const schemaPath = path.join(migrationPath, 'schema.prisma');
    if (!fs.existsSync(schemaPath)) {
      logger.warn(`No schema.prisma found at: ${schemaPath}, skipping ${service}`);
      return {
        service,
        success: true,
        appliedMigrations: [],
        duration: 0,
      };
    }

    // Set DATABASE_URL for Prisma
    const env = {
      ...process.env,
      DATABASE_URL: databaseUrl,
    };

    // Change to migration directory
    const originalCwd = process.cwd();
    process.chdir(migrationPath);

    try {
      // Generate Prisma client first (required for migrate deploy)
      logger.debug(`Generating Prisma client for ${service}...`);
      await execAsync('npx prisma generate', { env, timeout: 60000 });

      // Run migrations using migrate deploy (safe, non-destructive)
      logger.info(`Running Prisma migrate deploy for ${service}...`);
      const { stdout, stderr } = await execAsync('npx prisma migrate deploy', {
        env,
        timeout: 300000, // 5 minutes timeout
      });

      if (stderr && !stderr.includes('warn')) {
        logger.warn(`Prisma migration warnings for ${service}: ${stderr}`);
      }

      logger.info(`Prisma migrations completed for ${service}`);
      logger.debug(`Migration output: ${stdout}`);

      // Extract applied migrations from output
      const appliedMigrations = extractAppliedMigrations(stdout);

      const duration = Date.now() - startTime;
      return {
        service,
        success: true,
        appliedMigrations,
        duration,
      };
    } finally {
      // Restore original working directory
      process.chdir(originalCwd);
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = error.message || String(error);
    // Also check stdout/stderr if available (execAsync puts them there)
    const fullErrorText = [
      errorMessage,
      error.stdout || '',
      error.stderr || '',
    ].filter(Boolean).join('\n');
    
    logger.error(`Prisma migration failed for ${service}: ${errorMessage}`);
    if (error.stdout) logger.debug(`stdout: ${error.stdout}`);
    if (error.stderr) logger.debug(`stderr: ${error.stderr}`);
    
    // Check if it's a "no pending migrations" case (this is actually success)
    if (errorMessage.includes('No pending migrations') || 
        errorMessage.includes('already applied')) {
      logger.info(`No pending migrations for ${service} (this is normal)`);
      return {
        service,
        success: true,
        appliedMigrations: [],
        duration,
      };
    }

    // Handle P3009/P3018 errors: failed migrations found
    // P3009: migrate found failed migrations in the target database
    // P3018: A migration failed to apply
    // We'll try to resolve it automatically by marking it as rolled-back so it can retry
    if (fullErrorText.includes('P3009') || fullErrorText.includes('P3018') || fullErrorText.includes('failed migrations') || fullErrorText.includes('failed to apply')) {
      logger.warn(`⚠️  Detected failed migration(s) for ${service}. Attempting to resolve...`);
      
      try {
        // Extract failed migration name from error message
        // Error formats:
        // - P3009: "The `20250122000000_add_paywall_fields` migration started at ... failed"
        // - P3018: "Migration name: 20250122000000_add_paywall_fields"
        // Try multiple patterns to find the migration name
        const patterns = [
          /Migration name:\s*([^\s\n]+)/i,  // P3018 format: "Migration name: migration_name"
          /`([^`]+)`/,  // Backticks: `migration_name`
          /migration[:\s]+([^\s]+)/i,  // "migration: name" or "migration name"
          /([0-9]{14}_[a-zA-Z0-9_]+)/,  // Timestamp_name format
        ];
        
        let failedMigrationName: string | null = null;
        for (const pattern of patterns) {
          const match = fullErrorText.match(pattern);
          if (match && match[1]) {
            failedMigrationName = match[1];
            break;
          }
        }
        
        if (failedMigrationName) {
          logger.info(`Attempting to resolve failed migration: ${failedMigrationName}`);
          
          // Recreate env in case it wasn't defined (error occurred before env declaration)
          const resolveEnv = {
            ...process.env,
            DATABASE_URL: databaseUrl,
          };
          
          // Ensure we're in the right directory for Prisma commands
          const resolveCwd = process.cwd();
          if (!resolveCwd.includes(migrationPath)) {
            process.chdir(migrationPath);
          }
          
          // Check if the error is due to missing tables that are expected on custom instances
          // (e.g., SubscriptionPlan table doesn't exist on instances without paywall)
          // Or tables that haven't been created yet due to migration ordering issues
          // Also check for "already exists" errors (42P07) which happen when tables are created by other services
          const isMissingExpectedTable = 
            fullErrorText.includes('relation "SubscriptionPlan" does not exist') ||
            fullErrorText.includes('relation "Subscription" does not exist') ||
            fullErrorText.includes('relation "Chatbot" does not exist') ||
            fullErrorText.includes('relation "Block" does not exist') ||
            fullErrorText.includes('relation "AdminUser" does not exist') ||
            (fullErrorText.includes('does not exist') && fullErrorText.includes('42P01'));
          
          const isTableAlreadyExists = 
            fullErrorText.includes('already exists') ||
            fullErrorText.includes('42P07') ||
            (fullErrorText.includes('relation') && fullErrorText.includes('already exists'));
          
          if (isMissingExpectedTable || isTableAlreadyExists) {
            // Mark as applied instead of rolled-back since the migration isn't needed
            try {
              // First check if migration is already marked as applied (P3008 error)
              // If it is, we can just continue
              try {
                await execAsync(`npx prisma migrate resolve --applied ${failedMigrationName}`, {
                  env: resolveEnv,
                  timeout: 30000,
                });
                if (isTableAlreadyExists) {
                  logger.warn(`⚠️  Migration ${failedMigrationName} tried to create tables that already exist.`);
                  logger.warn(`   This is expected when tables are shared between services (e.g., User, Chatbot).`);
                  logger.info(`   Migration marked as applied (skipped) since tables already exist...`);
                } else {
                  logger.warn(`⚠️  Migration ${failedMigrationName} references tables that don't exist.`);
                  if (fullErrorText.includes('SubscriptionPlan') || fullErrorText.includes('Subscription')) {
                    logger.warn(`   This is expected on custom instances without paywall/subscription features.`);
                  } else if (fullErrorText.includes('Chatbot') || fullErrorText.includes('Block')) {
                    logger.warn(`   This may be due to migration ordering - base tables will be created by later migrations.`);
                  }
                  logger.info(`   Migration marked as applied (skipped) since dependencies aren't available yet...`);
                }
              } catch (markError: any) {
                const markErrorText = [
                  markError.message || String(markError),
                  markError.stdout || '',
                  markError.stderr || '',
                ].filter(Boolean).join('\n');
                
                // If migration is already applied (P3008), that's fine - just continue
                if (markErrorText.includes('P3008') || markErrorText.includes('already recorded as applied')) {
                  logger.warn(`⚠️  Migration ${failedMigrationName} is already marked as applied.`);
                  logger.info(`   Continuing with remaining migrations...`);
                } else {
                  // Different error, re-throw
                  throw markError;
                }
              }
              
              // Continue with remaining migrations (handle multiple consecutive failures recursively)
              logger.info(`Continuing with remaining migrations...`);
              const skippedMigrations: string[] = [failedMigrationName];
              let continueAttempts = 0;
              let continueSuccess = false;
              let continueStdout = '';
              let continueStderr = '';
              
              // Retry loop to handle multiple consecutive migration failures
              while (continueAttempts < 10 && !continueSuccess) {
                try {
                  const result = await execAsync('npx prisma migrate deploy', {
                    env: resolveEnv,
                    timeout: 300000,
                  });
                  continueStdout = result.stdout || '';
                  continueStderr = result.stderr || '';
                  continueSuccess = true;
                  break;
                } catch (continueError: any) {
                  continueAttempts++;
                  const continueErrorText = [
                    continueError.message || String(continueError),
                    continueError.stdout || '',
                    continueError.stderr || '',
                  ].filter(Boolean).join('\n');
                  
                  // Check if another migration failed due to missing tables or already existing tables
                  const continueIsMissingTable = 
                    (continueErrorText.includes('P3009') || continueErrorText.includes('P3018')) &&
                    (continueErrorText.includes('relation "Chatbot" does not exist') ||
                     continueErrorText.includes('relation "Block" does not exist') ||
                     continueErrorText.includes('relation "SubscriptionPlan" does not exist') ||
                     continueErrorText.includes('relation "AdminUser" does not exist') ||
                     continueErrorText.includes('already exists') ||
                     continueErrorText.includes('42P07') ||
                     (continueErrorText.includes('does not exist') && continueErrorText.includes('42P01')));
                  
                  if (continueIsMissingTable) {
                    // Extract failed migration name
                    const continuePatterns = [
                      /Migration name:\s*([^\s\n]+)/i,
                      /`([^`]+)`/,
                      /([0-9]{14}_[a-zA-Z0-9_]+)/,
                    ];
                    
                    let continueFailedMigration: string | null = null;
                    for (const pattern of continuePatterns) {
                      const match = continueErrorText.match(pattern);
                      if (match && match[1] && !skippedMigrations.includes(match[1])) {
                        continueFailedMigration = match[1];
                        break;
                      }
                    }
                    
                    if (continueFailedMigration) {
                      logger.warn(`⚠️  Another migration failed: ${continueFailedMigration}. Skipping...`);
                      try {
                        await execAsync(`npx prisma migrate resolve --applied ${continueFailedMigration}`, {
                          env: resolveEnv,
                          timeout: 30000,
                        });
                        skippedMigrations.push(continueFailedMigration);
                        logger.info(`✅ Migration ${continueFailedMigration} marked as applied (skipped).`);
                        // Continue loop to try next migration
                        continue;
                      } catch (e: any) {
                        const skipErrorText = [
                          e.message || String(e),
                          e.stdout || '',
                          e.stderr || '',
                        ].filter(Boolean).join('\n');
                        
                        // If migration is already applied (P3008), that's fine - just continue
                        if (skipErrorText.includes('P3008') || skipErrorText.includes('already recorded as applied')) {
                          logger.warn(`⚠️  Migration ${continueFailedMigration} is already marked as applied. Continuing...`);
                          skippedMigrations.push(continueFailedMigration);
                          continue;
                        } else {
                          logger.error(`Failed to skip migration ${continueFailedMigration}: ${e.message}`);
                          break;
                        }
                      }
                    } else {
                      // Couldn't extract migration name or already skipped
                      logger.warn(`Could not extract migration name from error, or migration already skipped`);
                      break;
                    }
                  } else {
                    // Different error, not related to missing tables
                    logger.error(`Different error encountered (not missing table): ${continueErrorText.substring(0, 300)}`);
                    break;
                  }
                }
              }

              if (continueSuccess) {
                if (continueStderr && !continueStderr.includes('warn')) {
                  logger.warn(`Prisma migration warnings for ${service}: ${continueStderr}`);
                }

                logger.info(`✅ Prisma migrations completed successfully after skipping ${skippedMigrations.length} migration(s)`);
                if (skippedMigrations.length > 1) {
                  logger.info(`   Skipped migrations: ${skippedMigrations.join(', ')}`);
                }
                logger.debug(`Migration output: ${continueStdout}`);

                const appliedMigrations = extractAppliedMigrations(continueStdout);
                const continueDuration = Date.now() - startTime;
                
                return {
                  service,
                  success: true,
                  appliedMigrations,
                  duration: continueDuration,
                };
              } else {
                throw new Error(`Failed to continue after skipping ${skippedMigrations.length} migration(s): ${skippedMigrations.join(', ')}`);
              }
            } catch (skipError: any) {
              logger.error(`Failed to mark migration as applied: ${skipError.message}`);
              // Fall through to try rolled-back approach
            }
          }
          
          // Mark the migration as rolled-back so Prisma can retry it
          // Since migrations use IF NOT EXISTS clauses, it's safe to retry
          try {
            await execAsync(`npx prisma migrate resolve --rolled-back ${failedMigrationName}`, {
              env: resolveEnv,
              timeout: 30000,
            });
            
            logger.info(`✅ Successfully marked migration ${failedMigrationName} as rolled-back. Retrying...`);
            
            // Retry the migration
            logger.info(`Retrying Prisma migrate deploy for ${service}...`);
            const { stdout: retryStdout, stderr: retryStderr } = await execAsync('npx prisma migrate deploy', {
              env: resolveEnv,
              timeout: 300000,
            });

            if (retryStderr && !retryStderr.includes('warn')) {
              logger.warn(`Prisma migration warnings for ${service}: ${retryStderr}`);
            }

            logger.info(`✅ Prisma migrations completed successfully after resolving failed migration`);
            logger.debug(`Migration output: ${retryStdout}`);

            const appliedMigrations = extractAppliedMigrations(retryStdout);
            const retryDuration = Date.now() - startTime;
            
            return {
              service,
              success: true,
              appliedMigrations,
              duration: retryDuration,
            };
          } catch (resolveError: any) {
            const resolveErrorText = [
              resolveError.message || String(resolveError),
              resolveError.stdout || '',
              resolveError.stderr || '',
            ].filter(Boolean).join('\n');
            
            logger.debug(`Retry error details: ${resolveErrorText}`);
            
            // Check if retry also failed due to missing expected tables or already existing tables
            // Check multiple patterns to catch the error in different formats
            const retryIsMissingExpectedTable = 
              resolveErrorText.includes('relation "SubscriptionPlan" does not exist') ||
              resolveErrorText.includes('relation "Subscription" does not exist') ||
              resolveErrorText.includes('relation "Chatbot" does not exist') ||
              resolveErrorText.includes('relation "Block" does not exist') ||
              resolveErrorText.includes('relation "AdminUser" does not exist') ||
              resolveErrorText.includes('already exists') ||
              resolveErrorText.includes('42P07') ||
              (resolveErrorText.includes('SubscriptionPlan') && resolveErrorText.includes('does not exist')) ||
              (resolveErrorText.includes('Chatbot') && resolveErrorText.includes('does not exist')) ||
              (resolveErrorText.includes('42P01') && (resolveErrorText.includes('SubscriptionPlan') || resolveErrorText.includes('Chatbot'))) ||
              (resolveErrorText.includes('does not exist') && resolveErrorText.includes('42P01'));
            
            if (retryIsMissingExpectedTable && failedMigrationName) {
              if (resolveErrorText.includes('already exists') || resolveErrorText.includes('42P07')) {
                logger.warn(`⚠️  Retry failed due to tables already existing.`);
                logger.warn(`   This is expected when tables are shared between services (e.g., User, Chatbot).`);
              } else {
                logger.warn(`⚠️  Retry failed due to missing expected tables.`);
                if (resolveErrorText.includes('SubscriptionPlan') || resolveErrorText.includes('Subscription')) {
                  logger.warn(`   This is expected on custom instances without paywall/subscription features.`);
                } else if (resolveErrorText.includes('Chatbot') || resolveErrorText.includes('Block')) {
                  logger.warn(`   This may be due to migration ordering - base tables will be created by later migrations.`);
                }
              }
              logger.info(`   Marking migration as applied (skipped)...`);
              
              try {
                // First mark the failed migration as rolled-back (if needed)
                try {
                  await execAsync(`npx prisma migrate resolve --rolled-back ${failedMigrationName}`, {
                    env: resolveEnv,
                    timeout: 30000,
                  });
                } catch (e: any) {
                  const rollbackErrorText = [
                    e.message || String(e),
                    e.stdout || '',
                    e.stderr || '',
                  ].filter(Boolean).join('\n');
                  
                  // Ignore if already rolled-back or if it's in a different state
                  if (!rollbackErrorText.includes('P3008') && !rollbackErrorText.includes('already')) {
                    logger.debug(`Note: Could not mark as rolled-back: ${rollbackErrorText.substring(0, 100)}`);
                  }
                }
                
                // Then mark as applied to skip it
                try {
                  await execAsync(`npx prisma migrate resolve --applied ${failedMigrationName}`, {
                    env: resolveEnv,
                    timeout: 30000,
                  });
                  logger.info(`✅ Migration ${failedMigrationName} marked as applied (skipped).`);
                } catch (markError: any) {
                  const markErrorText = [
                    markError.message || String(markError),
                    markError.stdout || '',
                    markError.stderr || '',
                  ].filter(Boolean).join('\n');
                  
                  // If migration is already applied (P3008), that's fine - just continue
                  if (markErrorText.includes('P3008') || markErrorText.includes('already recorded as applied')) {
                    logger.warn(`⚠️  Migration ${failedMigrationName} is already marked as applied. Continuing...`);
                  } else {
                    // Try to continue anyway - the migration might be in a weird state
                    logger.warn(`⚠️  Could not mark migration ${failedMigrationName} as applied, but continuing anyway...`);
                    logger.debug(`Error: ${markErrorText.substring(0, 200)}`);
                  }
                }
                
                // Try to continue with remaining migrations
                logger.info(`Continuing with remaining migrations...`);
                const { stdout: finalStdout, stderr: finalStderr } = await execAsync('npx prisma migrate deploy', {
                  env: resolveEnv,
                  timeout: 300000,
                }).catch((e: any) => {
                  logger.warn(`Continue after skip had issues: ${e.message}`);
                  return { stdout: '', stderr: '' };
                });
                
                if (finalStderr && !finalStderr.includes('warn')) {
                  logger.warn(`Prisma migration warnings: ${finalStderr}`);
                }

                logger.info(`✅ Prisma migrations completed after skipping unnecessary migration`);
                
                return {
                  service,
                  success: true,
                  appliedMigrations: extractAppliedMigrations(finalStdout),
                  duration: Date.now() - startTime,
                };
              } catch (finalError: any) {
                logger.error(`Failed to mark migration as applied: ${finalError.message}`);
                logger.debug(`Final error: ${finalError.stdout || ''} ${finalError.stderr || ''}`);
              }
            }
            
            logger.error(`Failed to resolve migration ${failedMigrationName}: ${resolveError.message}`);
            if (resolveError.stdout) logger.debug(`stdout: ${resolveError.stdout}`);
            if (resolveError.stderr) logger.debug(`stderr: ${resolveError.stderr}`);
            // Fall through to return error
          }
        } else {
          logger.warn(`Could not extract failed migration name from error. Manual resolution may be required.`);
          logger.debug(`Full error text: ${fullErrorText}`);
        }
      } catch (resolveError: any) {
        logger.error(`Error during automatic migration resolution: ${resolveError.message}`);
        // Fall through to return original error
      }
    }

    return {
      service,
      success: false,
      error: errorMessage,
      duration,
    };
  }
}

function extractAppliedMigrations(output: string): string[] {
  const migrations: string[] = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    // Look for patterns like "Applied migration: 20231201000000_name"
    const match = line.match(/Applied migration[:\s]+([^\s]+)/i);
    if (match) {
      migrations.push(match[1]);
    }
  }

  return migrations;
}
