# User Frontend Dockerfile

# 1. Build stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Accept build arguments for environment variables
ARG VITE_VERSION_TYPE
ARG VITE_FEATURE_BILLING
ARG VITE_FEATURE_ENTERPRISE
ARG VITE_CATHEDRAL_API_URL
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_EVENT_BUS_URL

# Set environment variables immediately
ENV VITE_VERSION_TYPE=$VITE_VERSION_TYPE
ENV VITE_FEATURE_BILLING=$VITE_FEATURE_BILLING
ENV VITE_FEATURE_ENTERPRISE=$VITE_FEATURE_ENTERPRISE
ENV VITE_CATHEDRAL_API_URL=$VITE_CATHEDRAL_API_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_EVENT_BUS_URL=$VITE_EVENT_BUS_URL

# Create .env file with environment variables
RUN echo "VITE_VERSION_TYPE=$VITE_VERSION_TYPE" > .env && \
    echo "VITE_FEATURE_BILLING=$VITE_FEATURE_BILLING" >> .env && \
    echo "VITE_FEATURE_ENTERPRISE=$VITE_FEATURE_ENTERPRISE" >> .env && \
    echo "VITE_CATHEDRAL_API_URL=$VITE_CATHEDRAL_API_URL" >> .env && \
    echo "VITE_EVENT_BUS_URL=$VITE_EVENT_BUS_URL" >> .env

# Set environment variables for build
ENV VITE_VERSION_TYPE=$VITE_VERSION_TYPE
ENV VITE_FEATURE_BILLING=$VITE_FEATURE_BILLING
ENV VITE_FEATURE_ENTERPRISE=$VITE_FEATURE_ENTERPRISE
ENV VITE_CATHEDRAL_API_URL=$VITE_CATHEDRAL_API_URL
ENV VITE_EVENT_BUS_URL=$VITE_EVENT_BUS_URL

RUN npm run lint
RUN npm run build

# 2. Serve stage
FROM nginx:1.21-alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
