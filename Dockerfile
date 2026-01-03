# =============================================================================
# Zentla API - Production Dockerfile
# Multi-stage build for optimal image size
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:25-alpine AS deps

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Enable Corepack for Yarn 4
RUN corepack enable

# Copy package files
COPY package.json yarn.lock .yarnrc.yml ./
COPY packages/api/package.json ./packages/api/
COPY packages/core/package.json ./packages/core/
COPY packages/database/package.json ./packages/database/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/adapters/stripe/package.json ./packages/adapters/stripe/
COPY packages/adapters/zuora/package.json ./packages/adapters/zuora/

# Install all dependencies (including devDependencies for build)
RUN yarn install

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:25-alpine AS builder

WORKDIR /app

# Enable Corepack for Yarn 4
RUN corepack enable

# Copy dependencies from deps stage (Yarn 4 hoists all deps to root node_modules)
COPY --from=deps /app/node_modules ./node_modules

# Copy only API-related source code (not admin-ui)
COPY package.json yarn.lock .yarnrc.yml ./
COPY tsconfig.base.json ./
COPY packages/core ./packages/core
COPY packages/database ./packages/database
COPY packages/sdk ./packages/sdk
COPY packages/adapters ./packages/adapters
COPY packages/api ./packages/api

# Generate Prisma client
RUN yarn db:generate

# Build API-related packages only (exclude admin-ui)
RUN yarn workspace @zentla/core build && \
    yarn workspace @zentla/database build && \
    yarn workspace @zentla/sdk build && \
    yarn workspace @zentla/stripe-adapter build && \
    yarn workspace @zentla/zuora-adapter build && \
    yarn workspace @zentla/api build

# -----------------------------------------------------------------------------
# Stage 3: Production
# -----------------------------------------------------------------------------
FROM node:25-alpine AS runner

WORKDIR /app

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 zentla

# Install OpenSSL for Prisma runtime detection
RUN apk add --no-cache openssl

# Install production dependencies only
ENV NODE_ENV=production

# Enable Corepack for Yarn 4
RUN corepack enable

# Copy package files for production install
COPY package.json yarn.lock .yarnrc.yml ./
COPY packages/api/package.json ./packages/api/
COPY packages/core/package.json ./packages/core/
COPY packages/database/package.json ./packages/database/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/adapters/stripe/package.json ./packages/adapters/stripe/
COPY packages/adapters/zuora/package.json ./packages/adapters/zuora/

# Install production dependencies only
RUN yarn workspaces focus --production @zentla/api && \
    yarn cache clean

# Copy built artifacts
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/packages/sdk/dist ./packages/sdk/dist
COPY --from=builder /app/packages/adapters/stripe/dist ./packages/adapters/stripe/dist
COPY --from=builder /app/packages/adapters/zuora/dist ./packages/adapters/zuora/dist

# Copy generated Prisma client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Set ownership
RUN chown -R zentla:nodejs /app

USER zentla

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "packages/api/dist/main.js"]
