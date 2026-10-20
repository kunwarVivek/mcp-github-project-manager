# --- Builder stage ---
FROM node:24-slim AS builder

WORKDIR /app

# package.json + package-lock.json are copied first so the dependency layer
# is cached independently of the source tree. The repo also ships a
# pnpm-lock.yaml for contributors who prefer pnpm; both lockfiles are kept
# in sync, and CI verifies the build under both package managers.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY src/ ./src/
COPY tsconfig.json tsconfig.build.json ./
COPY scripts/fix-imports.js ./scripts/

# Build TypeScript → ESM JavaScript with .js extension fixes
# (prebuild cleans, build runs tsc, postbuild chmods + fixes imports)
RUN npm run build

# --- Runtime stage ---
FROM node:24-slim

WORKDIR /app

# Run as non-root
RUN groupadd -r mcpuser && useradd -r -g mcpuser -d /app mcpuser

# Production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy only production artifacts
COPY --from=builder /app/build ./build/

ENV NODE_ENV=production
ENV NODE_OPTIONS="--no-warnings"

# Health check — server writes to stderr, so check process is alive
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

USER mcpuser

ENTRYPOINT ["node", "build/index.js"]
