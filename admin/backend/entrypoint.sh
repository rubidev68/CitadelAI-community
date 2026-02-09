#!/bin/sh

# Wait for database to be ready
echo "Waiting for database to be ready..."
while ! nc -z ${DB_HOST:-db} ${DB_PORT:-5432}; do
  sleep 1
done
echo "Database is ready!"

# Generate Prisma client (migrations are handled by db-migration-service)
echo "Generating Prisma client..."
npx prisma generate

# Start the application
echo "Starting application..."
exec "$@"
