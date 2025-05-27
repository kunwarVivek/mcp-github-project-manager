# GitHub Project Manager MCP Server - User Guide

## Overview

The GitHub Project Manager MCP Server provides a Model Context Protocol (MCP) interface for managing GitHub Projects. This guide explains how to set up, configure, and use the server effectively.

## Getting Started

### Prerequisites

- Node.js 14.x or higher
- npm or pnpm
- A GitHub account with appropriate permissions
- A GitHub Personal Access Token with the following scopes:
  - `repo` (Full repository access)
  - `project` (Project access)
  - `write:org` (Organization access)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd mcp-github-project-manager
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   pnpm install
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` with your GitHub credentials:
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
     id: string;
     title: string;
     description: string;
     status: 'active' | 'closed';
     visibility: 'private' | 'public';
   }
   ```

2. **Milestones**
   ```typescript
   interface Milestone {
     id: string;
     title: string;
     description: string;
     dueDate: string;
     status: 'open' | 'closed';
   }
   ```

3. **Sprints**
   ```typescript
   interface Sprint {
     id: string;
     name: string;
     startDate: string;
     endDate: string;
     status: 'planned' | 'active' | 'completed';
   }
   ```

## API Usage

### Project Operations

1. **Create Project**
   ```typescript
   const project = await service.createRoadmap({
     project: {
       title: "Project Name",
       shortDescription: "Project Description",
       owner: "repository_owner",
       visibility: "private"
     },
     milestones: [
       {
         milestone: {
           title: "Phase 1",
           dueDate: "2024-12-31"
         },
         issues: [
           {
             title: "Task 1",
             description: "Task description"
           }
         ]
       }
     ]
   });
   ```

2. **Plan Sprint**
   ```typescript
   const sprint = await service.planSprint({
     sprint: {
       name: "Sprint 1",
       startDate: "2024-01-01",
       endDate: "2024-01-14"
     },
     issueIds: ["issue-1", "issue-2"]
   });
   ```

3. **Track Progress**
   ```typescript
   const metrics = await service.getSprintMetrics(sprintId);
   console.log(metrics.completionPercentage);
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

- [GitHub Projects API Documentation](https://docs.github.com/en/rest/projects)
- [MCP Specification](https://modelcontextprotocol.io)
- [Project Architecture](ARCHITECTURE.md)