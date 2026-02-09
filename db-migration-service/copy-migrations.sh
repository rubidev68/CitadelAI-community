#!/bin/sh
# Copy migrations from build context to final location (only if they exist)
# This script runs from /tmp/build-context (the project root)

# Admin migrations (Prisma)
if [ -d "admin/backend/prisma" ]; then
  echo "Copying admin migrations..."
  cp -r admin/backend/prisma/* /app/migrations/admin/prisma/ 2>/dev/null || true
fi

# User migrations (Prisma)
if [ -d "user/backend/prisma" ]; then
  echo "Copying user migrations..."
  cp -r user/backend/prisma/* /app/migrations/user/prisma/ 2>/dev/null || true
fi

# Superadmin migrations (SQL)
if [ -d "superadmin-dashboard/backend/migrations" ]; then
  echo "Copying superadmin migrations..."
  cp -r superadmin-dashboard/backend/migrations/* /app/migrations/superadmin/sql/ 2>/dev/null || true
fi

# Cron migrations (Prisma)
if [ -d "cron-scheduler/prisma" ]; then
  echo "Copying cron migrations..."
  cp -r cron-scheduler/prisma/* /app/migrations/cron/prisma/ 2>/dev/null || true
fi

# Crawling migrations (Prisma)
if [ -d "crawling-service/prisma" ]; then
  echo "Copying crawling migrations..."
  cp -r crawling-service/prisma/* /app/migrations/crawling/prisma/ 2>/dev/null || true
fi

echo "Migration copy completed."
