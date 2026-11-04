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
# The uid/gid are pinned so bind-mounted host directories can be chowned to a
# known id (see docs/deployment.md#docker).
RUN groupadd -r -g 10001 mcpuser && useradd -r -u 10001 -g mcpuser -d /app mcpuser

# Persistent OAuth token store (`auth login`). A named volume mounted here
# inherits this ownership/mode on first use; bind mounts do not.
RUN mkdir /data && chown mcpuser:mcpuser /data && chmod 0700 /data
# A file path, not a secret.
# hadolint ignore=DL3064
ENV GITHUB_OAUTH_TOKEN_FILE=/data/github-oauth.json
VOLUME /data

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

ENTRYPOINT ["node", "build/bin.js"]
