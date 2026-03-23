# Build stage
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Limit memory to prevent OOM
ENV NODE_OPTIONS="--max-old-space-size=256"

# Install system dependencies required by Prisma
RUN apt-get update -y && \
  apt-get install -y openssl ca-certificates && \
  rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Generate Prisma client BEFORE heavy npm installs using the lightweight binary engine
RUN PRISMA_CLI_QUERY_ENGINE_TYPE=binary npx prisma generate

# Install all dependencies (optimized flags for lower memory)
RUN if [ -f package-lock.json ]; then npm ci --prefer-offline --no-audit --progress=false; else npm install --no-audit --progress=false; fi

# Copy source configuration and files
COPY tsconfig.json ./
COPY src ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:20-bookworm-slim

WORKDIR /app

# Ensure garbage collection triggers early in low RAM environments
ENV NODE_OPTIONS="--max-old-space-size=512"

# Install production-only system dependencies
RUN apt-get update -y && \
  apt-get install -y openssl ca-certificates wget && \
  rm -rf /var/lib/apt/lists/*

# Install ONLY production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production --prefer-offline --no-audit --progress=false

# Copy production artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY start.sh ./

# Generate Prisma client for production
RUN PRISMA_CLI_QUERY_ENGINE_TYPE=binary npx prisma generate

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

