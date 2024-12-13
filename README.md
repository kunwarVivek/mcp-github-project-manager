# GitHub Project Manager MCP

A Model Context Protocol (MCP) server that provides comprehensive tools for managing GitHub projects, milestones, tasks, and sprints. This server integrates deeply with GitHub Projects V2, offering features like automated kanban workflows, sprint planning, and custom field management.

## Features

- **Project Management**
  - Create and manage project boards
  - Configure automated kanban workflows
  - Custom fields and views
  - Project status tracking

- **Issue Management**
  - Create and manage issues with priorities
  - Assign users and labels
  - Link issues to milestones
  - Track issue status and progress

- **Milestone Management**
  - Create and track milestones
  - Due date management
  - Progress tracking
  - Overdue milestone alerts

- **Sprint Management**
  - Sprint planning and execution
  - Sprint metrics and burndown
  - Issue assignment to sprints
  - Sprint status tracking

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/github-project-manager-mcp.git
cd github-project-manager-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the server:
```bash
npm run build
```

## Configuration

Set the following environment variables:

- `GITHUB_TOKEN`: Your GitHub Personal Access Token
- `GITHUB_OWNER`: The GitHub repository owner
- `GITHUB_REPO`: The GitHub repository name

The token needs the following permissions:
- `repo` - Full control of private repositories
- `project` - Full control of organization projects

## Testing

The project includes comprehensive test coverage across all layers:

1. Run all tests:
```bash
npm test
```

2. Run tests with coverage:
```bash
npm run test:coverage
```

3. Run specific test suites:
```bash
# Unit tests only
npm run test -- --testPathPattern=unit

# Integration tests only
npm run test -- --testPathPattern=integration
```

4. Watch mode for development:
```bash
npm run test:watch
```

### Test Structure

- `__tests__/unit/` - Unit tests for individual components
  - `infrastructure/github/` - Tests for GitHub API integration
  - `services/` - Tests for business logic layer
- `__tests__/integration/` - Integration tests for complete workflows
- `__tests__/setup.ts` - Common test setup and mock data

## MCP Tools

### create_roadmap
Create a comprehensive project roadmap with milestones and tasks.

```typescript
await use_mcp_tool({
  server_name: "github-project-manager",
  tool_name: "create_roadmap",
  arguments: {
    project: {
      title: "Q1 2024 Roadmap",
      description: "Product roadmap for Q1 2024",
      visibility: "private",
      status: "open"
    },
    milestones: [
      {
        milestone: {
          title: "MVP Release",
          description: "Initial feature set",
          dueDate: "2024-03-31",
          status: "open"
        },
        issues: [
          {
            title: "User Authentication",
            description: "Implement OAuth login",
            priority: "high",
            type: "feature",
            assignees: ["developer1"],
            labels: ["auth"]
          }
        ]
      }
    ]
  }
});
```

### plan_sprint
Plan a new sprint with selected issues.

```typescript
await use_mcp_tool({
  server_name: "github-project-manager",
  tool_name: "plan_sprint",
  arguments: {
    sprint: {
      title: "Sprint 1",
      startDate: "2024-01-01T00:00:00Z",
      endDate: "2024-01-14T23:59:59Z",
      goals: ["Complete authentication features"]
    },
    issueIds: [1, 2, 3]
  }
});
```

### get_milestone_metrics
Get progress metrics for a milestone.

```typescript
await use_mcp_tool({
  server_name: "github-project-manager",
  tool_name: "get_milestone_metrics",
  arguments: {
    milestoneId: 1
  }
});
```

### get_sprint_metrics
Get metrics for a specific sprint.

```typescript
await use_mcp_tool({
  server_name: "github-project-manager",
  tool_name: "get_sprint_metrics",
  arguments: {
    sprintId: "sprint-1"
  }
});
```

## Architecture

The server follows Clean Architecture principles with clear separation of concerns:

- **Domain Layer**: Core business entities and repository interfaces
- **Infrastructure Layer**: GitHub API integration and repository implementations
- **Service Layer**: Business logic and coordination between repositories
- **MCP Layer**: Tool definitions and request handling

### Project Structure
```
src/
├── domain/           # Domain entities and interfaces
│   └── types.ts
├── infrastructure/   # GitHub API integration
│   ├── github/
│   │   ├── repositories/
│   │   ├── GitHubConfig.ts
│   │   ├── GitHubRepositoryFactory.ts
│   │   ├── graphql-types.ts
│   │   └── rest-types.ts
├── services/        # Business logic layer
│   └── ProjectManagementService.ts
└── index.ts         # MCP server implementation
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests to ensure everything works (`npm test`)
4. Commit your changes (`git commit -m 'Add some amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.
