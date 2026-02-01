# Use Node.js 22 LTS as the base image
FROM node:22-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Copy TypeScript config for build
COPY tsconfig.json tsconfig.build.json ./

# Install dependencies
RUN npm ci --only=production=false

# Copy source code and build scripts
COPY src/ ./src/
COPY scripts/fix-imports.js ./scripts/

# Build the project
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Set environment variables
ENV NODE_ENV=production

# Start the MCP server
CMD ["node", "build/index.js"]
