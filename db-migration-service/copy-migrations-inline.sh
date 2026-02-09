#!/bin/sh
# Inline script to copy migrations from build context
# This runs inside the Docker container during build

set -e

echo "Copying migrations..."

# Admin migrations (Prisma)
if [ -d "/tmp/migrations/admin" ] && [ "$(ls -A /tmp/migrations/admin 2>/dev/null)" ]; then
  echo "Copying admin migrations..."
  cp -r /tmp/migrations/admin/* /app/migrations/admin/prisma/ 2>/dev/null || true
fi

# User migrations (Prisma)
if [ -d "/tmp/migrations/user" ] && [ "$(ls -A /tmp/migrations/user 2>/dev/null)" ]; then
  echo "Copying user migrations..."
  cp -r /tmp/migrations/user/* /app/migrations/user/prisma/ 2>/dev/null || true
fi

# Superadmin migrations (SQL)
if [ -d "/tmp/migrations/superadmin" ] && [ "$(ls -A /tmp/migrations/superadmin 2>/dev/null)" ]; then
  echo "Copying superadmin migrations..."
  cp -r /tmp/migrations/superadmin/* /app/migrations/superadmin/sql/ 2>/dev/null || true
fi

# Cron migrations (Prisma)
if [ -d "/tmp/migrations/cron" ] && [ "$(ls -A /tmp/migrations/cron 2>/dev/null)" ]; then
  echo "Copying cron migrations..."
  cp -r /tmp/migrations/cron/* /app/migrations/cron/prisma/ 2>/dev/null || true
fi

# Crawling migrations (Prisma)
if [ -d "/tmp/migrations/crawling" ] && [ "$(ls -A /tmp/migrations/crawling 2>/dev/null)" ]; then
  echo "Copying crawling migrations..."
  cp -r /tmp/migrations/crawling/* /app/migrations/crawling/prisma/ 2>/dev/null || true
fi

echo "Migration copy completed."
