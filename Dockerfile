# Dockerfile - includes node_modules to solve ESM issues
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./

# Install all deps to get ESM modules properly
RUN npm install --legacy-peer-deps --ignore-scripts

COPY src/ ./src/
COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY scripts/ ./

# Use tsx to run TypeScript directly (compiles on-the-fly)
RUN npm install -D tsx

ENV NODE_ENV=production
ENV NODE_OPTIONS="--no-warnings"

CMD ["npx", "tsx", "src/index.ts"]