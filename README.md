# MCP GitHub Project Manager

A Model Context Protocol (MCP) server implementation that provides GitHub Projects functionality through standardized tools and resources. This server enables LLM clients and applications to manage GitHub Projects programmatically through the MCP interface.

[![npm version](https://img.shields.io/npm/v/mcp-github-project-manager.svg)](https://www.npmjs.com/package/mcp-github-project-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/mcp-github-project-manager.svg)](https://nodejs.org/)

## Overview

This server implements the [Model Context Protocol](https://modelcontextprotocol.io) to expose GitHub Projects functionality to LLM clients and applications. It provides tools for managing projects, milestones, sprints, and metrics through GitHub's GraphQL API while maintaining state and handling errors according to MCP specifications.

## Quick Start

### Using NPM
```bash
# Install the package globally
npm install -g mcp-github-project-manager

# Set up your environment variables
export GITHUB_TOKEN="your_github_token"
export GITHUB_OWNER="your_github_username_or_organization"
export GITHUB_REPO="your_repository_name"

# Run the MCP server
mcp-github-project-manager
```

### Using Docker
```bash
# Build the Docker image
docker build -t mcp-github-project-manager .

# Run with environment variables
docker run -it \
  -e GITHUB_TOKEN=your_github_token \
  -e GITHUB_OWNER=your_github_username_or_organization \
  -e GITHUB_REPO=your_repository_name \
  mcp-github-project-manager
```

For more details on Docker usage, see [DOCKER.md](DOCKER.md).

## Key Features

- **Project Management**
  - Create and manage GitHub Projects (v2)
  - Handle project settings and configurations
  - Manage project visibility and access

- **Project Resources**
  - Issues and milestones management
  - Sprint planning and tracking
  - Custom fields and views
  - Resource versioning and locking

- **MCP Implementation**
  - Full MCP specification compliance
  - Standardized tool definitions with Zod validation
  - Resource state management
  - Progressive response handling
  - Comprehensive error handling

- **GitHub Integration**
  - GraphQL API integration with pagination support
  - Intelligent rate limit handling
  - Optimistic concurrency
  - Webhook support (planned)

## Installation

### Option 1: Install from npm (recommended)

```bash
# Install the package globally
npm install -g mcp-github-project-manager

# Or install in your project
npm install mcp-github-project-manager
```

### Option 2: Install from source

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-github-project-manager.git
cd mcp-github-project-manager

# Install dependencies
npm install
# or
pnpm install

# Build the project
npm run build
```

### Set up environment variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your GitHub token and details
```

## Configuration

Required environment variables:
```env
GITHUB_TOKEN=your_github_token
GITHUB_OWNER=repository_owner
GITHUB_REPO=repository_name
```

The GitHub token requires these permissions:
- `repo` (Full repository access)
- `project` (Project access)
- `write:org` (Organization access)

## Usage

### As a command-line tool

If installed globally:

```bash
# Start the MCP server using stdio transport
mcp-github-project-manager

# Start with environment variables
GITHUB_TOKEN=your_token mcp-github-project-manager
```

### As a Node.js module

```javascript
import { Server } from "mcp-github-project-manager";

// Create and start an MCP server instance
const server = new Server({
  transport: "stdio", // or "http" for HTTP server
  config: {
    githubToken: process.env.GITHUB_TOKEN,
    githubOwner: process.env.GITHUB_OWNER,
    githubRepo: process.env.GITHUB_REPO
  }
});

server.start();
```

### Integration with MCP clients

```javascript
// Example using an MCP client library
import { McpClient } from "@modelcontextprotocol/client";
import { spawn } from "child_process";

// Create a child process running the MCP server
const serverProcess = spawn("mcp-github-project-manager", [], {
  env: { ...process.env, GITHUB_TOKEN: "your_token" }
});

// Connect the MCP client to the server
const client = new McpClient({
  transport: {
    type: "process",
    process: serverProcess
  }
});

// Call MCP tools
const result = await client.callTool("create_project", {
  title: "My Project",
  description: "A new GitHub project"
});
```

For more examples, see the [User Guide](docs/user-guide.md) and the [examples/](examples/) directory.

## Architecture

The server follows Clean Architecture principles with distinct layers:

- **Domain Layer**: Core entities, repository interfaces, and Zod schemas
- **Infrastructure Layer**: GitHub API integration and implementations
- **Service Layer**: Business logic coordination
- **MCP Layer**: Tool definitions and request handling

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## References

- [Model Context Protocol](https://modelcontextprotocol.io)
- [GitHub Projects API](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects)
- [Project Roadmap](ROADMAP.md)

## Current Status

### Core Features
| Feature | Status | Notes |
|---------|--------|-------|
| Project Creation | ✅ Complete | Full support for v2 projects |
| Milestone Management | ✅ Complete | CRUD operations implemented |
| Sprint Planning | ✅ Complete | Including metrics tracking |
| Issue Management | ✅ Complete | With custom fields support |
| Resource Versioning | ✅ Complete | With optimistic locking and schema validation |
| Webhook Integration | 📅 Planned | Real-time updates |

### MCP Implementation
| Component | Status | Notes |
|-----------|--------|-------|
| Tool Definitions | ✅ Complete | All core tools implemented with Zod validation |
| Resource Management | ✅ Complete | Full CRUD operations with versioning |
| Security | ✅ Complete | Token validation and scope checking |
| Error Handling | ✅ Complete | According to MCP specifications |
| Transport | ✅ Complete | Stdio and HTTP support |

See [STATUS.md](STATUS.md) for detailed implementation status.
| Resource Management | ✅ Complete | With optimistic locking and relationship tracking |
| Response Handling | ✅ Complete | Rich content formatting with multiple content types |
| Error Handling | ✅ Complete | Comprehensive error mapping to MCP error codes |
| State Management | ✅ Complete | With conflict resolution and rate limiting |

### Recent Improvements

- **Enhanced Resource System**:
  - Added Zod schema validation for all resource types
  - Implemented resource relationship tracking
  - Created a centralized ResourceFactory for consistent resource access

- **Improved GitHub API Integration**:
  - Added intelligent rate limiting with automatic throttling
  - Implemented pagination support for REST and GraphQL APIs
  - Enhanced error handling with specific error types

- **Advanced Tool System**:
  - Created tool definition registry with Zod validation
  - Implemented standardized tool response formatting
  - Added example-based documentation for all tools

- **Rich Response Formatting**:
  - Added support for multiple content types (JSON, Markdown, HTML, Text)
  - Implemented progress updates for long-running operations
  - Added pagination support for large result sets

### Identified Functional Gaps

Despite the recent improvements, the following functional gaps still exist and are prioritized for future development:

1. **Persistent Caching Strategy**:
   - While the ResourceCache provides in-memory caching, it lacks persistence across server restarts
   - No distributed caching for multi-instance deployments
   - Missing cache eviction policies for memory management

2. **Real-time Event Processing**:
   - No webhook integration for real-time updates from GitHub
   - Missing event-based subscription system for clients
   - Lack of server-sent events (SSE) support for streaming updates

3. **Advanced GitHub Projects v2 Features**:
   - Limited support for custom field types and validation
   - Incomplete integration with GitHub's newer Projects v2 field types
   - Missing automation rule management

4. **Performance Optimization**:
   - No query batching for related resources
   - Missing background refresh for frequently accessed resources
   - Incomplete prefetching for related resources

5. **Data Visualization and Reporting**:
   - No built-in visualization generators for metrics
   - Missing report generation capabilities
   - Limited time-series data analysis

See [docs/mcp/gaps-analysis.md](docs/mcp/gaps-analysis.md) for detailed implementation status.

## Documentation

- [User Guide](docs/user-guide.md) - Detailed usage instructions
- [API Reference](docs/api-reference/index.md) - Comprehensive tool documentation
- [Tutorials](docs/tutorials/getting-started.md) - Step-by-step guides
- [Examples](examples/README.md) - Code examples for common tasks
- [Architecture](ARCHITECTURE.md) - System architecture and design
- [Contributing](docs/contributing/index.md) - Development guidelines
- [MCP Documentation](docs/mcp/) - MCP-specific details

### Interactive Documentation

For an interactive exploration of the API, open the [API Explorer](docs/api-explorer.html) in your browser.

## Development

### Testing
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e
```

### Code Quality
```bash
# Lint code
npm run lint

# Type check
npm run type-check

# Format code
npm run format
```

## Contributing

We welcome contributions to the GitHub Project Manager MCP Server! Please see our [Contributing Guide](docs/contributing/index.md) for details on:

- [Development Workflow](docs/contributing/development-workflow.md)
- [Code Standards](docs/contributing/index.md#coding-standards)
- [Testing Guidelines](docs/contributing/index.md#testing-guidelines)
- [Documentation Guidelines](docs/contributing/index.md#documentation-guidelines)

## License

[MIT](LICENSE)
