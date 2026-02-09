# Crawling Service Dockerfile
# Build context should be project root (to access shared packages)

# 1. Build stage
FROM node:20 AS builder

# Install puppeteer dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy base TypeScript configs first (needed for extends)
COPY tsconfig.base.json ./
COPY tsconfig.base.frontend.json ./

# Build shared/config first
COPY shared/config/package.json ./shared/config/
COPY shared/config/tsconfig.json ./shared/config/
WORKDIR /app/shared/config
RUN npm install --legacy-peer-deps
COPY shared/config/src ./src
RUN npm run build

# Build shared/utils
WORKDIR /app
COPY shared/utils/package.json ./shared/utils/
COPY shared/utils/tsconfig.json ./shared/utils/
WORKDIR /app/shared/utils
RUN npm install --legacy-peer-deps
COPY shared/utils/src ./src
RUN npm run build

# Build shared/middleware (depends on shared/utils and shared/config)
WORKDIR /app
COPY shared/middleware/package.json ./shared/middleware/
COPY shared/middleware/tsconfig.json ./shared/middleware/
WORKDIR /app/shared/middleware
RUN npm install --legacy-peer-deps
COPY shared/middleware/src ./src
RUN npm run build

# Now build crawling-service
WORKDIR /app
COPY crawling-service/package*.json ./crawling-service/
COPY crawling-service/prisma ./crawling-service/prisma
WORKDIR /app/crawling-service
RUN npm install --legacy-peer-deps

# Generate Prisma client
RUN npx prisma generate

# Install shared libraries as local packages so TypeScript can resolve them
RUN npm install --legacy-peer-deps /app/shared/config /app/shared/utils /app/shared/middleware && \
    test -d node_modules/@shared/config && \
    test -d node_modules/@shared/utils && \
    test -d node_modules/@shared/middleware && \
    echo "✓ Shared libraries installed" || \
    (echo "✗ Failed to install shared libraries!" && exit 1)

# Copy source code
COPY crawling-service/tsconfig.json ./
COPY crawling-service/src ./src

# Install Puppeteer Chrome browser
RUN npx puppeteer browsers install chrome

# Build TypeScript
RUN npm run build

# 2. Production stage
FROM node:18

# Install puppeteer dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY --from=builder /app/crawling-service/dist ./dist
COPY --from=builder /app/crawling-service/node_modules ./node_modules
COPY --from=builder /app/crawling-service/package.json ./
COPY --from=builder /app/crawling-service/prisma ./prisma
# Copy Puppeteer Chrome cache
COPY --from=builder /root/.cache/puppeteer /root/.cache/puppeteer
# Copy shared/config for runtime
COPY --from=builder /app/shared/config/dist ./shared/config/dist
COPY --from=builder /app/shared/config/package.json ./shared/config/package.json
COPY --from=builder /app/shared/config/node_modules ./shared/config/node_modules
# Copy shared/utils for runtime
COPY --from=builder /app/shared/utils/dist ./shared/utils/dist
COPY --from=builder /app/shared/utils/package.json ./shared/utils/package.json
COPY --from=builder /app/shared/utils/node_modules ./shared/utils/node_modules
# Copy shared/middleware for runtime
COPY --from=builder /app/shared/middleware/dist ./shared/middleware/dist
COPY --from=builder /app/shared/middleware/package.json ./shared/middleware/package.json
COPY --from=builder /app/shared/middleware/node_modules ./shared/middleware/node_modules
# Ensure symlinks point to correct location
RUN mkdir -p node_modules/@shared && \
    if [ -L "node_modules/@shared/config" ]; then \
      rm "node_modules/@shared/config"; \
    fi && \
    ln -s "/usr/src/app/shared/config" "node_modules/@shared/config" && \
    if [ -L "node_modules/@shared/utils" ]; then \
      rm "node_modules/@shared/utils"; \
    fi && \
    ln -s "/usr/src/app/shared/utils" "node_modules/@shared/utils" && \
    if [ -L "node_modules/@shared/middleware" ]; then \
      rm "node_modules/@shared/middleware"; \
    fi && \
    ln -s "/usr/src/app/shared/middleware" "node_modules/@shared/middleware"

EXPOSE 3001
CMD [ "sh", "-c", "npm run serve" ]
