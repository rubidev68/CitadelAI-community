# Database Migration Service

Centralized database migration service for CitadelAI that handles all database migrations across all services in a safe, controlled manner.

## Overview

This service runs before all other services and ensures that:
- All migrations are applied in the correct order
- No race conditions occur between services
- Migrations are idempotent and safe to re-run
- Existing data is preserved (migrations are additive)
- Failed migrations roll back automatically

## Features

- ✅ Supports Prisma migrations (`prisma migrate deploy`)
- ✅ Supports raw SQL migrations
- ✅ Automatic dependency resolution
- ✅ Migration locking to prevent concurrent execution
- ✅ Transaction support for SQL migrations
- ✅ Comprehensive logging
- ✅ Safe, non-destructive migrations

## Configuration

### Environment Variables

- `DATABASE_URL` (required): PostgreSQL connection string
- `MIGRATION_ORDER` (optional): Comma-separated list of services to migrate (default: all)
- `MIGRATION_TIMEOUT` (optional): Migration timeout in ms (default: 300000)
- `LOG_LEVEL` (optional): Log level (DEBUG, INFO, WARN, ERROR, default: INFO)
- `MIGRATIONS_BASE_PATH` (optional): Base path for migration files (default: /app/migrations)
- `DB_HOST` (optional): Database host for health checks (default: postgres)
- `DB_PORT` (optional): Database port (default: 5432)
- `POSTGRES_USER` (optional): Database user (default: citadel_user)

## Migration Order

Migrations are executed in the following order by default:

1. `admin` (Prisma) - Main schema
2. `user` (Prisma) - Depends on admin
3. `superadmin` (SQL) - Additional tables
4. `cron` (Prisma) - If exists
5. `crawling` (Prisma) - If exists

## Data Safety

- **All existing data is preserved** - migrations are additive
- Uses `prisma migrate deploy` (never `db push --accept-data-loss`)
- SQL migrations use `IF NOT EXISTS` clauses (idempotent)
- Transactions ensure atomicity (rollback on failure)
- Default values for new columns preserve existing rows

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
npm start

# Development mode
npm run dev
```

## Docker

```bash
# Build image
docker build -t db-migration-service .

# Run container
docker run --rm \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -v ./admin/backend/prisma:/app/migrations/admin/prisma:ro \
  db-migration-service
```

## Migration Tracking

SQL migrations are tracked in the `db_migration_service_history` table to prevent re-execution.

## Error Handling

- Failed migrations roll back automatically (transaction support)
- Clear error messages indicate what failed and why
- Service exits with non-zero code on failure
- Other services wait for successful migration completion
