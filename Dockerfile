# Build stage
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install system dependencies required by Prisma
RUN apt-get update -y && \
  apt-get install -y openssl ca-certificates && \
  rm -rf /var/lib/apt/lists/*

# Copy package files for dependency installation
COPY package.json ./
COPY package-lock.json* ./

# Install all dependencies (including devDependencies for build)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source configuration and files
COPY tsconfig.json ./
COPY src ./src/

# Build the application
RUN export NODE_OPTIONS="--max-old-space-size=2048" && npm run build

# Production stage
FROM node:20-bookworm-slim

WORKDIR /app

# Install production-only system dependencies
RUN apt-get update -y && \
  apt-get install -y openssl ca-certificates wget && \
  rm -rf /var/lib/apt/lists/*

# Copy production artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./
COPY start.sh ./

RUN chmod +x start.sh

# Environment settings
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Note: tsconfig rootDir is "./", so server.js is at dist/src/server.js
CMD ["./start.sh"]
