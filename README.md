# GitHub Project Manager MCP Server

A Model Context Protocol (MCP) server implementation that provides GitHub Projects functionality through standardized tools and resources.

## Overview

This server implements the [Model Context Protocol](https://modelcontextprotocol.io) to expose GitHub Projects functionality to LLM clients. It provides tools for creating and managing projects, milestones, sprints, and metrics through a standardized interface.

## Features

- **Project Management Tools**
  - Create project roadmaps with milestones
  - Plan and manage sprints
  - Track milestone progress
  - Monitor sprint metrics
  - Handle overdue tasks
  - Track upcoming milestones

- **MCP Implementation**
  - Follows MCP specification
  - Uses @modelcontextprotocol/sdk
  - Implements StdioTransport
  - Provides tool schemas
  - Handles MCP errors

## Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your GitHub token and details
```

## Configuration

Required environment variables:
```
GITHUB_TOKEN=your_github_token
GITHUB_OWNER=repository_owner
GITHUB_REPO=repository_name
```

## Usage

```bash
# Start the MCP server
npm start

# Run tests
npm test
npm run test:e2e
```

## Architecture

The server follows Clean Architecture principles with MCP-specific layers:
- MCP Layer: Tool definitions and request handling
- Domain Layer: Core entities and interfaces
- Infrastructure Layer: GitHub API integration
- Service Layer: Business logic coordination

## Development Status

Current implementation status:
- Core MCP Server: ✅ Complete
- Tool Definitions: ✅ Complete
- Request Handling: ✅ Complete
- Response Formatting: 🏗️ In Progress
- Resource Implementation: 📅 Planned
- Error Handling: 🏗️ In Progress

See [ROADMAP.md](ROADMAP.md) for development plans.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

[MIT](LICENSE)
