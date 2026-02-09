# ============================================
# Stage 1: Build stage
# ============================================
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache openssl openssl-dev

WORKDIR /app

# Copy package files from db-migration-service
COPY db-migration-service/package*.json ./

# Install all dependencies (including dev for building)
RUN npm install

# Copy source code from db-migration-service
COPY db-migration-service/src ./src
COPY db-migration-service/tsconfig.json ./

# Build TypeScript
RUN npm run build

# ============================================
# Stage 2: Runtime stage (ultra-minimal)
# ============================================
FROM node:18-alpine AS runtime

# Install only runtime dependencies (PostgreSQL client and OpenSSL)
RUN apk add --no-cache postgresql-client openssl

WORKDIR /app

# Copy package files for production install
COPY db-migration-service/package*.json ./

# Install only production dependencies
# Remove unnecessary Prisma query engines (keep only linux-musl for Alpine)
RUN npm install --omit=dev && \
    npm cache clean --force && \
    find node_modules/.prisma -name "query-engine-*" ! -name "*linux-musl*" -delete 2>/dev/null || true && \
    find node_modules/prisma -name "query-engine-*" ! -name "*linux-musl*" -delete 2>/dev/null || true

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy entrypoint script
COPY db-migration-service/entrypoint.sh ./
RUN chmod +x ./entrypoint.sh

# Create migration target directories
RUN mkdir -p /app/migrations/admin/prisma \
    /app/migrations/user/prisma \
    /app/migrations/cron/prisma \
    /app/migrations/crawling/prisma

# Copy migration directories directly (only these specific paths, not entire project)
# If directories don't exist, build will fail (which is acceptable)
COPY admin/backend/prisma /app/migrations/admin/prisma
COPY user/backend/prisma /app/migrations/user/prisma
COPY cron-scheduler/prisma /app/migrations/cron/prisma
COPY crawling-service/prisma /app/migrations/crawling/prisma

# Set environment variables
ENV NODE_ENV=production

ENTRYPOINT ["/app/entrypoint.sh"]
