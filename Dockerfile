# Multi-stage build for optimal image size
FROM node:20-alpine AS base

# Install git for repo cloning
RUN apk add --no-cache git

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Build the application
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js - NEXT_PUBLIC_ vars must be available at build time.
# These are inlined into the client bundle, so they are never secrets: the
# Supabase key below is the publishable anon key, gated by row-level security.
# Override with --build-arg to point a fork at your own Supabase project.
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_SUPABASE_URL=https://gtvcigyldfjrwzqeymes.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0dmNpZ3lsZGZqcnd6cWV5bWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNjg0MTIsImV4cCI6MjA4NDk0NDQxMn0.u3BhSqpgCMkeFvR1rOWsCZyZVpqkZylFO0sUYkLqdT4
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application (public folder is optional)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy public folder if it exists (Next.js puts assets in .next/static anyway)
RUN mkdir -p ./public

# Create directory for cloned repos with proper permissions
RUN mkdir -p /data/repos && chown -R nextjs:nodejs /data

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV REPOS_BASE_DIR="/data/repos"

CMD ["node", "server.js"]
