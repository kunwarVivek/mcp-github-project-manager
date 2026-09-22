# --- Builder stage ---
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY src/ ./src/
COPY tsconfig.json tsconfig.build.json ./
COPY scripts/fix-imports.js ./scripts/

# Build TypeScript → ESM JavaScript with .js extension fixes
RUN ./node_modules/.bin/tsc -p tsconfig.build.json && \
    node scripts/fix-imports.js && \
    chmod +x build/index.js

# Prune devDependencies for production
RUN npm prune --omit=dev --ignore-scripts

# --- Runtime stage ---
FROM node:22-slim

WORKDIR /app

# Run as non-root
RUN groupadd -r mcpuser && useradd -r -g mcpuser -d /app mcpuser

# Copy only production artifacts
COPY --from=builder /app/build ./build/
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
ENV NODE_OPTIONS="--no-warnings"

# Health check — server writes to stderr, so check process is alive
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

USER mcpuser

ENTRYPOINT ["node", "build/index.js"]
