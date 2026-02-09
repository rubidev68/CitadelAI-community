#!/bin/sh

set -e

echo "=== Database Migration Service Entrypoint ==="

# Wait for database to be ready
echo "Waiting for database to be ready..."
until pg_isready -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${POSTGRES_USER:-citadel_user}" 2>/dev/null; do
  echo "Database not ready, waiting..."
  sleep 1
done

echo "Database is ready!"

# Run the migration service
echo "Starting migration service..."
node dist/index.js

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Migrations completed successfully"
else
  echo "❌ Migrations failed with exit code: $EXIT_CODE"
fi

exit $EXIT_CODE
