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

- **Domain Layer**: Core entities, repository interfaces, and Zod schemas
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
| Resource Versioning | ✅ Complete | With optimistic locking and schema validation |
| Webhook Integration | 📅 Planned | Real-time updates |

### MCP Implementation
| Component | Status | Notes |
|-----------|--------|-------|
| Tool Definitions | ✅ Complete | All core tools implemented with Zod validation |
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
