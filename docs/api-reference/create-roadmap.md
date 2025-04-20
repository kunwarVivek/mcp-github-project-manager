# Create Roadmap Tool

## Overview

The `create_roadmap` tool allows you to create a complete project roadmap with milestones and issues in a single operation. This is useful for initializing new projects with a predefined structure.

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| project | Object | Yes | Project configuration |
| project.title | String | Yes | Project title (1-255 characters) |
| project.description | String | Yes | Project description |
| project.visibility | String | Yes | Project visibility ("private" or "public") |
| milestones | Array | Yes | List of milestones to create |
| milestones[].milestone | Object | Yes | Milestone configuration |
| milestones[].milestone.title | String | Yes | Milestone title |
| milestones[].milestone.description | String | Yes | Milestone description |
| milestones[].milestone.dueDate | String | No | Due date (ISO format) |
| milestones[].issues | Array | No | List of issues for this milestone |
| milestones[].issues[].title | String | Yes | Issue title |
| milestones[].issues[].description | String | Yes | Issue description |
| milestones[].issues[].priority | String | No | Priority ("high", "medium", "low") |
| milestones[].issues[].type | String | No | Issue type ("bug", "feature", "enhancement", "documentation") |
| milestones[].issues[].assignees | Array | No | List of assignee usernames |
| milestones[].issues[].labels | Array | No | List of label names |

## Response

### Success Response

```json
{
  "project": {
    "id": "proj_123",
    "title": "Project Title",
    "description": "Project Description",
    "visibility": "private",
    "status": "active",
    "createdAt": "2023-01-01T00:00:00Z",
    "updatedAt": "2023-01-01T00:00:00Z"
  },
  "milestones": [
    {
      "id": "ms_123",
      "title": "Milestone Title",
      "description": "Milestone Description",
      "dueDate": "2023-03-01T00:00:00Z",
      "status": "active",
      "progress": {
        "openIssues": 2,
        "closedIssues": 0,
        "completionPercentage": 0
      },
      "issues": [
        {
          "id": "issue_123",
          "title": "Issue Title",
          "description": "Issue Description",
          "priority": "medium",
          "type": "feature",
          "status": "active"
        }
      ]
    }
  ]
}
```

### Error Responses

| Error Code | Description |
|------------|-------------|
| MCP-002 | Validation error (invalid parameters) |
| MCP-005 | Unauthorized (invalid GitHub token) |
| MCP-006 | Rate limited (GitHub API rate limit exceeded) |

## Examples

### Basic Example

```typescript
const result = await service.createRoadmap({
  project: {
    title: "Mobile App Development",
    description: "Develop a new mobile application for our users",
    visibility: "private"
  },
  milestones: [
    {
      milestone: {
        title: "Phase 1: Design",
        description: "Design phase of the mobile app",
        dueDate: "2023-02-15T00:00:00Z"
      },
      issues: [
        {
          title: "Create wireframes",
          description: "Create wireframes for all app screens",
          priority: "high",
          type: "feature"
        },
        {
          title: "Design system",
          description: "Create design system with components",
          priority: "medium",
          type: "feature"
        }
      ]
    }
  ]
});
```

### Advanced Example

```typescript
// Example with multiple milestones and custom fields
const result = await service.createRoadmap({
  project: {
    title: "Enterprise CRM",
    description: "Customer Relationship Management System",
    visibility: "private"
  },
  milestones: [
    {
      milestone: {
        title: "Q1 Goals",
        description: "First quarter objectives",
        dueDate: "2023-03-31T00:00:00Z"
      },
      issues: [
        {
          title: "User authentication",
          description: "Implement OAuth2 authentication",
          priority: "high",
          type: "feature",
          assignees: ["developer1"],
          labels: ["security", "backend"]
        }
      ]
    },
    {
      milestone: {
        title: "Q2 Goals",
        description: "Second quarter objectives",
        dueDate: "2023-06-30T00:00:00Z"
      },
      issues: [
        {
          title: "Reporting dashboard",
          description: "Create analytics dashboard",
          priority: "medium",
          type: "feature",
          assignees: ["designer1", "developer2"],
          labels: ["frontend", "analytics"]
        }
      ]
    }
  ]
});
```

## Implementation Details

The `create_roadmap` tool performs the following operations:

1. Creates a new GitHub Project with the specified title, description, and visibility
2. Creates each milestone with the specified properties
3. Creates issues for each milestone and links them appropriately
4. Sets up any specified custom fields, labels, and assignees
5. Returns the complete structure with all created resources and their IDs

## Best Practices

- Use meaningful titles and descriptions for projects, milestones, and issues
- Set realistic due dates for milestones
- Group related issues under appropriate milestones
- Use consistent priority and type values across issues
- Consider using labels for better categorization

## Rate Limiting Considerations

This tool makes multiple GitHub API calls (one for project creation, one per milestone, and one per issue). Be mindful of GitHub API rate limits, especially when creating large roadmaps with many milestones and issues.

## Related Tools

- [Plan Sprint](plan-sprint.md) - Plan sprints with issues from your roadmap
- [Get Milestone Metrics](get-milestone-metrics.md) - Track progress of roadmap milestones
