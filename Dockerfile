# Use Node.js 18 as the base image (matches your package.json engine requirement)
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install pnpm (since your project uses pnpm-lock.yaml)
RUN npm install -g pnpm

# Copy package.json, pnpm-lock.yaml and other configuration files
COPY package.json pnpm-lock.yaml tsconfig.json tsconfig.build.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code and other necessary files
COPY src/ ./src/
COPY .env.example ./.env.example

# Build the project
RUN pnpm build

# Create a .env file if one doesn't exist
RUN if [ ! -f .env ]; then cp .env.example .env || echo "No .env.example found"; fi

# Expose any ports your application might need (optional)
# EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Start the MCP server
CMD ["node", "build/index.js"]
