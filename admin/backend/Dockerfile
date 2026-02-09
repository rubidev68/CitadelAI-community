# Admin Backend Dockerfile
# Build context should be project root (like superadmin-dashboard-backend)

# 1. Build stage
FROM node:20-alpine AS builder
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

# Copy and build shared utils library
WORKDIR /app
COPY shared/utils/package.json ./shared/utils/
COPY shared/utils/tsconfig.json ./shared/utils/
WORKDIR /app/shared/utils
RUN npm install --legacy-peer-deps
COPY shared/utils/src ./src
RUN npm run build

# Copy and build shared types library (must be built before shared/services)
WORKDIR /app
COPY shared/types/package.json ./shared/types/
COPY shared/types/tsconfig.json ./shared/types/
WORKDIR /app/shared/types
RUN npm install --legacy-peer-deps
COPY shared/types/src ./src
RUN npm run build

# Copy and build shared services library (depends on shared/types)
WORKDIR /app
COPY shared/services/package.json ./shared/services/
COPY shared/services/tsconfig.json ./shared/services/
WORKDIR /app/shared/services
# Install dependencies (npm will resolve file:../types automatically since types is already built)
RUN npm install --legacy-peer-deps
COPY shared/services/src ./src
RUN npm run build

# Copy and build shared config library (needed by middleware)
WORKDIR /app
COPY shared/config/package.json ./shared/config/
COPY shared/config/tsconfig.json ./shared/config/
WORKDIR /app/shared/config
RUN npm install --legacy-peer-deps
COPY shared/config/src ./src
RUN npm run build

# Copy and build shared middleware library (depends on shared/utils and shared/config)
WORKDIR /app
COPY shared/middleware/package.json ./shared/middleware/
COPY shared/middleware/tsconfig.json ./shared/middleware/
WORKDIR /app/shared/middleware
# Install dependencies (npm will resolve file:../utils and file:../config automatically since they are already built)
RUN npm install --legacy-peer-deps
COPY shared/middleware/src ./src
RUN npm run build

# Now build admin-backend
WORKDIR /app
COPY admin/backend/package*.json ./admin/backend/
COPY admin/backend/prisma ./admin/backend/prisma
WORKDIR /app/admin/backend
RUN npm install --legacy-peer-deps

# Generate Prisma client
RUN npx prisma generate

# Verify shared libraries are built and accessible
WORKDIR /app
RUN echo "Checking shared libraries..." && \
    for lib in resilience utils services types middleware config; do \
      ls -la "/app/shared/$lib/" && \
      test -f "/app/shared/$lib/package.json" && \
      test -f "/app/shared/$lib/dist/index.js" && \
      test -f "/app/shared/$lib/dist/index.d.ts" && \
      echo "✓ Shared library $lib verified" || \
      (echo "✗ Shared library $lib incomplete!" && exit 1); \
    done

# Build admin-backend
# Install shared library as a local package so TypeScript can resolve it via node_modules
WORKDIR /app/admin/backend
COPY admin/backend/tsconfig.json ./
COPY admin/backend/src ./src
# Install shared libraries as local package dependencies
# This creates symlinks in node_modules/@shared/* -> /app/shared/*
# The source files already use @shared/* imports
RUN npm install --legacy-peer-deps /app/shared/resilience /app/shared/utils /app/shared/services /app/shared/types /app/shared/middleware /app/shared/config && \
    test -d node_modules/@shared/resilience && \
    test -d node_modules/@shared/utils && \
    test -d node_modules/@shared/services && \
    test -d node_modules/@shared/types && \
    test -d node_modules/@shared/middleware && \
    test -d node_modules/@shared/config && \
    echo "✓ Shared libraries installed as local packages" || \
    (echo "✗ Failed to install shared libraries!" && exit 1)
# Re-generate Prisma client AFTER installing shared libraries.
# Installing local packages can modify node_modules and overwrite the generated Prisma client.
RUN npx prisma generate
# Build TypeScript - it should now resolve @shared/resilience via node_modules
RUN npm run build:docker

# serviceRegistry is now part of src/shared/ and will be compiled as part of the main build
# No need to compile separately

# 2. Production stage
FROM node:18-slim
WORKDIR /app

# Install netcat and postgresql-client for database operations
# libc6-compat is NOT needed on Debian (slim) as it uses glibc natively
RUN apt-get update && apt-get install -y netcat-openbsd postgresql-client python3 python3-pip python3-venv && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/admin/backend/dist ./dist
COPY --from=builder /app/admin/backend/node_modules ./node_modules
COPY --from=builder /app/admin/backend/prisma ./prisma
# Copy shared libraries (peer dependencies are available from admin-backend's node_modules)
# The node_modules/@shared/* symlinks should point to these locations
COPY --from=builder /app/shared/resilience/dist ./shared/resilience/dist
COPY --from=builder /app/shared/resilience/package.json ./shared/resilience/package.json
COPY --from=builder /app/shared/utils/dist ./shared/utils/dist
COPY --from=builder /app/shared/utils/package.json ./shared/utils/package.json
COPY --from=builder /app/shared/services/dist ./shared/services/dist
COPY --from=builder /app/shared/services/package.json ./shared/services/package.json
COPY --from=builder /app/shared/types/dist ./shared/types/dist
COPY --from=builder /app/shared/types/package.json ./shared/types/package.json
COPY --from=builder /app/shared/middleware/dist ./shared/middleware/dist
COPY --from=builder /app/shared/middleware/package.json ./shared/middleware/package.json
COPY --from=builder /app/shared/middleware/node_modules ./shared/middleware/node_modules
COPY --from=builder /app/shared/config/dist ./shared/config/dist
COPY --from=builder /app/shared/config/package.json ./shared/config/package.json
COPY --from=builder /app/shared/config/node_modules ./shared/config/node_modules
# Ensure the symlinks in node_modules point to the correct locations
RUN for lib in resilience utils services types middleware config; do \
      if [ -L "node_modules/@shared/$lib" ]; then \
        rm "node_modules/@shared/$lib" && \
        ln -s "/app/shared/$lib" "node_modules/@shared/$lib"; \
      fi; \
    done
COPY admin/backend/package*.json ./
COPY admin/backend/entrypoint.sh ./
RUN chmod +x ./entrypoint.sh

# Copy migration scripts
COPY scripts ./scripts

# Copy evaluator and install Python dependencies in a virtual environment (PEP 668 compliant)
COPY admin/backend/evaluator ./evaluator
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir --upgrade pip setuptools wheel \
    && /opt/venv/bin/pip install --no-cache-dir -r ./evaluator/requirements.txt

# Ensure the venv python/pip are preferred at runtime
ENV PATH="/opt/venv/bin:${PATH}"

EXPOSE 3002
ENTRYPOINT ["./entrypoint.sh"]
CMD ["npm", "run", "serve"]