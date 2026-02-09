import { MigrationConfig } from './migrations/types';
import * as path from 'path';
import { logger } from './logger';

export interface Config {
  databaseUrl: string;
  migrations: MigrationConfig[];
  migrationTimeout: number;
  logLevel: string;
}

function getDefaultMigrations(): MigrationConfig[] {
  const basePath = process.env.MIGRATIONS_BASE_PATH || '/app/migrations';
  
  return [
    {
      service: 'admin',
      type: 'prisma',
      path: path.join(basePath, 'admin/prisma'),
      order: 1,
    },
    {
      service: 'user',
      type: 'prisma',
      path: path.join(basePath, 'user/prisma'),
      order: 2,
      dependsOn: ['admin'],
    },
    {
      service: 'superadmin',
      type: 'sql',
      path: path.join(basePath, 'superadmin/sql'),
      order: 3,
      dependsOn: ['admin'],
      files: ['add_2fa_fields.sql', 'add_draft_status.sql'],
    },
    {
      service: 'cron',
      type: 'prisma',
      path: path.join(basePath, 'cron/prisma'),
      order: 4,
      dependsOn: ['admin'],
    },
    {
      service: 'crawling',
      type: 'prisma',
      path: path.join(basePath, 'crawling/prisma'),
      order: 5,
      dependsOn: ['admin'],
    },
  ];
}

export function loadConfig(): Config {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const migrationOrder = process.env.MIGRATION_ORDER;
  const migrations = migrationOrder
    ? getMigrationsFromOrder(migrationOrder)
    : getDefaultMigrations();

  return {
    databaseUrl,
    migrations: sortMigrationsByDependencies(migrations),
    migrationTimeout: parseInt(process.env.MIGRATION_TIMEOUT || '300000', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}

function getMigrationsFromOrder(order: string): MigrationConfig[] {
  const services = order.split(',').map(s => s.trim());
  const defaultMigrations = getDefaultMigrations();
  const migrationMap = new Map(defaultMigrations.map(m => [m.service, m]));
  
  return services
    .map((service, index) => {
      const migration = migrationMap.get(service);
      if (!migration) {
        logger.warn(`Unknown service in MIGRATION_ORDER: ${service}`);
        return null;
      }
      return { ...migration, order: index + 1 };
    })
    .filter((m): m is MigrationConfig => m !== null);
}

function sortMigrationsByDependencies(migrations: MigrationConfig[]): MigrationConfig[] {
  const sorted: MigrationConfig[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(migration: MigrationConfig): void {
    if (visiting.has(migration.service)) {
      throw new Error(`Circular dependency detected involving service: ${migration.service}`);
    }
    if (visited.has(migration.service)) {
      return;
    }

    visiting.add(migration.service);

    if (migration.dependsOn) {
      for (const dep of migration.dependsOn) {
        const depMigration = migrations.find(m => m.service === dep);
        if (depMigration) {
          visit(depMigration);
        }
      }
    }

    visiting.delete(migration.service);
    visited.add(migration.service);
    sorted.push(migration);
  }

  for (const migration of migrations) {
    if (!visited.has(migration.service)) {
      visit(migration);
    }
  }

  return sorted;
}
