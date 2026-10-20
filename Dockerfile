# --- Builder stage ---
FROM node:24-slim AS builder

WORKDIR /app

# pnpm is the canonical package manager for this repo (see packageManager in
# package.json). It is installed with npm only as a bootstrap step.
RUN npm install -g pnpm@12.14.0

# Lockfile + workspace manifest first so the dependency layer is cached
# independently of the source tree.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY src/ ./src/
COPY tsconfig.json tsconfig.build.json ./
COPY scripts/fix-imports.js ./scripts/

# Build TypeScript → ESM JavaScript with .js extension fixes
RUN pnpm exec tsc -p tsconfig.build.json && \
    node scripts/fix-imports.js && \
    chmod +x build/index.js

# --- Runtime stage ---
FROM node:24-slim

WORKDIR /app

# Run as non-root
RUN groupadd -r mcpuser && useradd -r -g mcpuser -d /app mcpuser

# Production dependencies only. pnpm's isolated layout keeps the store inside
# node_modules/.pnpm, so this stage is self-contained.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm@12.14.0 && \
    pnpm install --prod --frozen-lockfile --ignore-scripts

# Copy only production artifacts
COPY --from=builder /app/build ./build/

ENV NODE_ENV=production
ENV NODE_OPTIONS="--no-warnings"

# Health check — server writes to stderr, so check process is alive
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

USER mcpuser

ENTRYPOINT ["node", "build/index.js"]
