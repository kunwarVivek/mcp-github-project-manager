# GitHub Project Manager MCP Server

A Model Context Protocol (MCP) server implementation that provides GitHub Projects functionality through standardized tools and resources. This server enables LLM clients to manage GitHub Projects programmatically through the MCP interface.

## Overview

This server implements the [Model Context Protocol](https://modelcontextprotocol.io) to expose GitHub Projects functionality to LLM clients. It provides tools for managing projects, milestones, sprints, and metrics through GitHub's GraphQL API while maintaining state and handling errors according to MCP specifications.

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
  - Standardized tool definitions
  - Resource state management
  - Progressive response handling
  - Comprehensive error handling

- **GitHub Integration**
  - GraphQL API integration
  - Rate limit handling
  - Optimistic concurrency
  - Webhook support (planned)

## Installation

```bash
# Install dependencies
npm install
# or
pnpm install

# Set up environment variables
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

```bash
# Start the MCP server
npm start

# Run tests
npm test
npm run test:e2e
```

See the [User Guide](docs/user-guide.md) for detailed usage instructions.

## Architecture

The server follows Clean Architecture principles with distinct layers:

- **Domain Layer**: Core entities and repository interfaces
- **Infrastructure Layer**: GitHub API integration and implementations
- **Service Layer**: Business logic coordination
- **MCP Layer**: Tool definitions and request handling

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

## Current Status

### Core Features
| Feature | Status | Notes |
|---------|--------|-------|
| Project Creation | ✅ Complete | Full support for v2 projects |
| Milestone Management | ✅ Complete | CRUD operations implemented |
| Sprint Planning | ✅ Complete | Including metrics tracking |
| Issue Management | ✅ Complete | With custom fields support |
| Resource Versioning | 🏗️ In Progress | Basic versioning implemented |
| Webhook Integration | 📅 Planned | Real-time updates |

### MCP Implementation
| Component | Status | Notes |
|-----------|--------|-------|
| Tool Definitions | ✅ Complete | All core tools implemented |
| Resource Management | ✅ Complete | With optimistic locking |
| Response Handling | 🏗️ In Progress | Progressive responses WIP |
| Error Handling | 🏗️ In Progress | Comprehensive error mapping |
| State Management | ✅ Complete | With conflict resolution |

See [docs/mcp/gaps-analysis.md](docs/mcp/gaps-analysis.md) for detailed implementation status.

## Documentation

- [User Guide](docs/user-guide.md) - Detailed usage instructions
- [Architecture](ARCHITECTURE.md) - System architecture and design
- [Contributing](CONTRIBUTING.md) - Development guidelines
- [MCP Documentation](docs/mcp/) - MCP-specific details

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

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

[MIT](LICENSE)
