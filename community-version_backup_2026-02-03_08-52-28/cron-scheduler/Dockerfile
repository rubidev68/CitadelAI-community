# Cron Scheduler Dockerfile
# Build context should be project root

FROM node:20-slim

# Install OpenSSL and other required dependencies
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy base TypeScript configs first (needed for extends)
COPY tsconfig.base.json ./
COPY tsconfig.base.frontend.json ./

# Copy and build shared resilience library first
COPY shared/resilience/package*.json ./shared/resilience/
COPY shared/resilience/tsconfig.json ./shared/resilience/
WORKDIR /app/shared/resilience
RUN npm install --legacy-peer-deps
COPY shared/resilience/src ./src
RUN npm run build

# Copy and build shared config library
WORKDIR /app
COPY shared/config/package.json ./shared/config/
COPY shared/config/tsconfig.json ./shared/config/
WORKDIR /app/shared/config
RUN npm install --legacy-peer-deps
COPY shared/config/src ./src
RUN npm run build

# Copy and build shared utils library
WORKDIR /app
COPY shared/utils/package.json ./shared/utils/
COPY shared/utils/tsconfig.json ./shared/utils/
WORKDIR /app/shared/utils
RUN npm install --legacy-peer-deps
COPY shared/utils/src ./src
RUN npm run build

# Copy and build shared middleware library (depends on shared/utils and shared/config)
WORKDIR /app
COPY shared/middleware/package.json ./shared/middleware/
COPY shared/middleware/tsconfig.json ./shared/middleware/
WORKDIR /app/shared/middleware
RUN npm install --legacy-peer-deps
COPY shared/middleware/src ./src
RUN npm run build

# Now build cron-scheduler
WORKDIR /app
COPY cron-scheduler/package*.json ./cron-scheduler/
COPY cron-scheduler/prisma ./cron-scheduler/prisma
WORKDIR /app/cron-scheduler
RUN npm install --legacy-peer-deps

# Generate Prisma client
RUN npx prisma generate

# Install shared libraries as local packages so TypeScript can resolve them
RUN npm install --legacy-peer-deps /app/shared/resilience /app/shared/config /app/shared/utils /app/shared/middleware && \
    test -d node_modules/@shared/resilience && \
    test -d node_modules/@shared/config && \
    test -d node_modules/@shared/utils && \
    test -d node_modules/@shared/middleware && \
    echo "✓ Shared libraries installed" || \
    (echo "✗ Failed to install shared libraries!" && exit 1)

# Copy source code
COPY cron-scheduler/src ./src
COPY cron-scheduler/tsconfig.json ./

# Build the application
RUN npm run build

# Keep Prisma CLI for runtime migrations
RUN npm install prisma --save

# Copy built files and dependencies for production
WORKDIR /app/cron-scheduler

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]