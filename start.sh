#!/bin/sh
set -e

echo "🏥 Starting Swetha Saiphani Clinics Backend..."

# Run Prisma migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma 2>&1 || echo "⚠️ Migration skipped (using db push workflow)"

# If migrate deploy fails (no migrations folder), try db push
if [ ! -d "./prisma/migrations" ]; then
  echo "📦 No migrations folder found, running prisma db push..."
  npx prisma db push --schema=./prisma/schema.prisma 2>&1 || echo "⚠️ db push skipped"
fi

# Start the application
echo "🚀 Starting server on port ${PORT:-8080}..."
exec node dist/src/server.js
