FROM node:20-bookworm-slim

WORKDIR /app

# Install system dependencies required by Prisma and health checks
RUN apt-get update -y && \
  apt-get install -y openssl ca-certificates wget && \
  rm -rf /var/lib/apt/lists/*

# Copy package files first for Docker layer caching
COPY package.json ./
COPY package-lock.json* ./

# Install dependencies (use npm ci if lockfile exists, otherwise npm install)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy Prisma schema and generate client inside this container
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source and build
COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# Copy start script
COPY start.sh ./
RUN chmod +x start.sh

# Environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["./start.sh"]
