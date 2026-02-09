# User Backend Dockerfile
# Build context should be project root (to access shared packages)

# 1. Build stage
FROM node:20-bullseye AS builder
WORKDIR /app

# Copy base TypeScript configs first (needed for extends)
COPY tsconfig.base.json ./
COPY tsconfig.base.frontend.json ./

# Copy and build shared libraries first
# Build shared/utils
COPY shared/utils/package.json ./shared/utils/
COPY shared/utils/tsconfig.json ./shared/utils/
WORKDIR /app/shared/utils
RUN test -f package.json && echo "✓ package.json found" || (echo "✗ package.json not found!" && ls -la && exit 1)
RUN npm install --legacy-peer-deps
COPY shared/utils/src ./src
RUN npm run build

# Build shared/types (must be built before shared/services)
WORKDIR /app
COPY shared/types/package.json ./shared/types/
COPY shared/types/tsconfig.json ./shared/types/
WORKDIR /app/shared/types
RUN test -f package.json && echo "✓ package.json found" || (echo "✗ package.json not found!" && ls -la && exit 1)
RUN npm install --legacy-peer-deps
COPY shared/types/src ./src
RUN npm run build

# Build shared/services (depends on shared/types)
WORKDIR /app
COPY shared/services/package.json ./shared/services/
COPY shared/services/tsconfig.json ./shared/services/
WORKDIR /app/shared/services
RUN test -f package.json && echo "✓ package.json found" || (echo "✗ package.json not found!" && ls -la && exit 1)
# Install dependencies (npm will resolve file:../types automatically since types is already built)
RUN npm install --legacy-peer-deps
COPY shared/services/src ./src
RUN npm run build

# Build shared/config (needed by middleware)
WORKDIR /app
COPY shared/config/package.json ./shared/config/
COPY shared/config/tsconfig.json ./shared/config/
WORKDIR /app/shared/config
RUN npm install --legacy-peer-deps
COPY shared/config/src ./src
RUN npm run build

# Build shared/middleware (depends on shared/utils and shared/config)
WORKDIR /app
COPY shared/middleware/package.json ./shared/middleware/
COPY shared/middleware/tsconfig.json ./shared/middleware/
WORKDIR /app/shared/middleware
RUN test -f package.json && echo "✓ package.json found" || (echo "✗ package.json not found!" && ls -la && exit 1)
# Install dependencies (npm will resolve file:../utils and file:../config automatically since they are already built)
RUN npm install --legacy-peer-deps
COPY shared/middleware/src ./src
RUN npm run build

# Now build user-backend
WORKDIR /app
COPY user/backend/package*.json ./user/backend/
COPY user/backend/prisma ./user/backend/prisma
WORKDIR /app/user/backend
RUN npm install --legacy-peer-deps

# Generate Prisma client
# Install shared libraries as local package dependencies
RUN npm install --legacy-peer-deps /app/shared/utils /app/shared/services /app/shared/types /app/shared/middleware /app/shared/config && \
    test -d node_modules/@shared/utils && \
    test -d node_modules/@shared/services && \
    test -d node_modules/@shared/types && \
    test -d node_modules/@shared/middleware && \
    test -d node_modules/@shared/config && \
    echo "✓ Shared libraries installed" || \
    (echo "✗ Failed to install shared libraries!" && exit 1)

# Generate Prisma client AFTER installing shared libraries.
# Installing local packages can modify node_modules and overwrite the generated Prisma client.
RUN npx prisma generate

# Copy source code
COPY user/backend/tsconfig.json ./
COPY user/backend/src ./src
RUN npx puppeteer browsers install chrome

# Build TypeScript
RUN npm run build

# 2. Production stage
FROM node:18-bullseye
WORKDIR /app

RUN apt-get update && apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget libgbm1 postgresql-client netcat-openbsd

COPY --from=builder /app/user/backend/dist ./dist
COPY --from=builder /app/user/backend/node_modules ./node_modules
COPY --from=builder /app/user/backend/prisma ./prisma
COPY --from=builder /root/.cache/puppeteer /root/.cache/puppeteer
# Copy shared libraries
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
# Ensure symlinks point to correct locations
RUN for lib in utils services types middleware config; do \
      if [ -L "node_modules/@shared/$lib" ]; then \
        rm "node_modules/@shared/$lib" && \
        ln -s "/app/shared/$lib" "node_modules/@shared/$lib"; \
      fi; \
    done
COPY user/backend/package.json ./
COPY user/backend/entrypoint.sh ./
RUN chmod +x ./entrypoint.sh

EXPOSE 3003
ENTRYPOINT ["/bin/sh", "./entrypoint.sh"]
