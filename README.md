# GitHub Project Manager

A Model Context Protocol (MCP) compliant tool for managing GitHub Projects v2 with advanced roadmap and sprint planning capabilities.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

### Project Management
- Full GitHub Projects v2 support
- Custom views (Board, Table, Roadmap)
- Custom fields with various data types
- Advanced project configuration
- Visibility control

**Issue Management**
- Create and manage issues with priorities
- Assign users and labels
- Link issues to milestones
- Track issue status and progress

**Milestone Management**
- Create and track milestones
- Due date management
- Progress tracking
- Overdue milestone alerts
  
### Sprint Planning
- Iteration-based sprint management
- Sprint metrics and progress tracking
- Custom sprint goals
- Issue assignment and tracking
- Sprint velocity metrics

### Roadmap Planning
- Milestone management
- Issue tracking and organization
- Progress metrics
- Due date management
- Overdue milestone tracking

### Advanced Features
- Custom field types (text, number, date, single select, iteration)
- Project view customization
- Sorting and filtering capabilities
- Real-time progress tracking
- Sprint and milestone metrics

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

Create a `.env` file with your GitHub credentials:

```env
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_OWNER=your_github_username_or_org
GITHUB_REPO=your_repository_name
```

Required token permissions:
- `repo` (full access)
- `project` (full access)
- `workflow`
- `write:org`
- `admin:org`

## Usage

### Basic Usage

```typescript
import { ProjectManagementService } from 'github-project-manager';

const service = new ProjectManagementService(
  process.env.GITHUB_OWNER,
  process.env.GITHUB_REPO,
  process.env.GITHUB_TOKEN
);

// Create a new roadmap
const roadmap = await service.createRoadmap({
  project: {
    title: "Q1 2025 Roadmap",
    description: "Product roadmap for Q1 2025",
    visibility: "private",
    status: "open"
  },
  milestones: [
    {
      milestone: {
        title: "Release 1.0",
        description: "Initial release",
        dueDate: new Date("2025-03-31"),
        status: "open"
      },
      issues: [
        {
          title: "Core Feature Implementation",
          description: "Implement core features",
          priority: "high",
          type: "feature",
          labels: ["priority-high", "feature"],
          status: "open"
        }
      ]
    }
  ]
});

// Plan a sprint
const sprint = await service.planSprint({
  sprint: {
    title: "Sprint 1",
    startDate: new Date(),
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    status: "planned",
    goals: ["Complete core features"],
    issues: []
  },
  issueIds: [1, 2, 3]
});

// Get sprint metrics
const metrics = await service.getSprintMetrics(sprint.id);
```

## Development

### Prerequisites
- Node.js >= 18.0.0
- npm, yarn, or pnpm

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/yourusername/github-project-manager.git
cd github-project-manager

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test                 # Run unit tests
npm run test:integration # Run integration tests
npm run test:e2e        # Run end-to-end tests
```

### Testing

The project includes:
- Unit tests for individual components
- Integration tests for API interactions
- End-to-end tests for complete workflows
- Custom test environment for GitHub API interactions

## Architecture

@ARCHITECTURE.MD
## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
