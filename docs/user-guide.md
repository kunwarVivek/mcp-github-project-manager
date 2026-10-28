# GitHub Project Manager MCP Server - User Guide

## Overview

The GitHub Project Manager MCP Server provides a Model Context Protocol (MCP) interface for managing GitHub Projects. This guide explains how to set up, configure, and use the server effectively.

The server exposes **20 compound tools covering 169 actions** to MCP clients.
See [TOOLS.md](TOOLS.md) for the full reference.

## Getting Started

### Prerequisites

- Node.js 22.12+ (24 is the supported target)
- npm or pnpm
- A GitHub account with appropriate permissions
- A GitHub Personal Access Token with the following scopes:
  - `repo` (Full repository access)
  - `project` (Project access)
  - `write:org` (Organization access)

> A working `gh` CLI login is enough on its own — the server falls back to
> `gh auth token` when no token is configured. See
> [CONFIGURATION.md](CONFIGURATION.md#credential-chain).

### Installation

1. Install from npm (recommended):
   ```bash
   npm install -g mcp-github-project-manager
   ```

   Or clone the repository for development:
   ```bash
   git clone https://github.com/kunwarVivek/mcp-github-project-manager.git
   cd mcp-github-project-manager
   npm install        # or: pnpm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` with your GitHub credentials:
   ```env
   GITHUB_TOKEN=your_personal_access_token
   GITHUB_OWNER=repository_owner
   GITHUB_REPO=repository_name
   ```

## Features

### Project Management

1. **Roadmap Creation**
   - Create project roadmaps with milestones
   - Define project scope and objectives
   - Set project visibility and access controls

2. **Sprint Planning**
   - Create and manage sprints
   - Assign issues to sprints
   - Track sprint progress and metrics

3. **Milestone Management**
   - Create project milestones
   - Track milestone progress
   - Manage milestone deadlines

4. **Issue Tracking**
   - Create and manage issues
   - Track issue status and progress
   - Link related issues
   - Add custom fields

### Resource Types

1. **Projects**
   ```typescript
   interface Project {
     id: ProjectId;
     type: ResourceType;
     title: string;
     description: string;
     owner: string;
     number: number;
     url: string;
     fields: CustomField[];
     views?: ProjectView[];
     closed: boolean;
     createdAt: string;
     updatedAt: string;
     status?: ResourceStatus;
     visibility?: string;
   }
   ```

2. **Milestones**
   ```typescript
   interface Milestone {
     id: MilestoneId;
     number: number;
     title: string;
     description: string;
     dueDate?: string;
     status: ResourceStatus;
     createdAt: string;
     updatedAt: string;
     url: string;
     progress?: { percent: number; complete: number; total: number };
   }
   ```

3. **Sprints**
   ```typescript
   interface Sprint {
     id: SprintId;
     title: string;
     description: string;
     startDate: string;
     endDate: string;
     status: ResourceStatus;
     issues: IssueId[];
     createdAt: string;
     updatedAt: string;
   }
   ```

## API Usage

MCP clients call **compound tools** with an `action` parameter. Every action
belongs to exactly one tool, and `discover_tools` will list the tools, their
actions, and their parameter schemas at runtime.

### Project Operations

1. **Create Project** — `manage_project`
   ```json
   {"tool": "manage_project", "arguments": {
     "action": "create",
     "title": "Project Name",
     "owner": "repository_owner",
     "visibility": "private"
   }}
   ```

2. **Plan Sprint** — `manage_sprints`
   ```json
   {"tool": "manage_sprints", "arguments": {
     "action": "create",
     "title": "Sprint 1",
     "startDate": "2026-01-01",
     "endDate": "2026-01-14",
     "goals": ["Complete initial project setup"]
   }}
   ```

3. **Track Progress** — `manage_sprints`
   ```json
   {"tool": "manage_sprints", "arguments": {"action": "get_metrics", "sprintId": "sprint_1"}}
   ```

4. **Discover the surface** — `discover_tools`
   ```json
   {"tool": "discover_tools", "arguments": {"group": "manage_project", "includeSchemas": true}}
   ```

## Error Handling

The server implements comprehensive error handling:

1. **API Errors**
   - Rate limiting
   - Authentication failures
   - Permission issues

2. **Resource Errors**
   - Not found errors
   - Version conflicts
   - Validation errors

Under MCP v2 the two error shapes are distinct:

- A tool that **runs and fails** returns `{ content, isError: true }` — the
  model sees the failure and can recover from it.
- A **JSON-RPC error** is reserved for protocol faults, such as calling a tool
  that does not exist.

Arguments are validated against each tool's declared `inputSchema` *before* the
handler runs, so a malformed call is rejected without touching business logic.

## Best Practices

1. **Resource Management**
   - Use meaningful titles and descriptions
   - Keep project structure consistent
   - Regularly update status and progress

2. **Performance**
   - Batch related operations
   - Use pagination for large datasets
   - Handle rate limits appropriately

3. **Error Handling**
   - Implement proper error handling
   - Handle rate limits gracefully
   - Validate inputs before submission

## Troubleshooting

Common issues and solutions:

1. **Authentication Errors**
   - Verify token permissions
   - Check token expiration
   - Ensure correct environment variables

2. **Rate Limiting**
   - Implement request batching
   - Add retry logic
   - Monitor rate limit headers

3. **Resource Conflicts**
   - Handle version conflicts
   - Implement proper locking
   - Use optimistic concurrency

## Support

For issues and feature requests:
1. Check existing GitHub issues
2. Create a new issue with detailed description
3. Follow the contribution guidelines

## References

- [Tool Reference](TOOLS.md) - All 20 compound tools and their 169 actions
- [Configuration Guide](CONFIGURATION.md) - Environment variables and client setup
- [GitHub Projects API Documentation](https://docs.github.com/en/rest/projects)
- [MCP Specification](https://modelcontextprotocol.io)
- [Architecture](architecture.md)