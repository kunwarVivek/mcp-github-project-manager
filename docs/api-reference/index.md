# GitHub Project Manager MCP API Reference

This section provides comprehensive documentation for all tools available in the GitHub Project Manager MCP Server.

## Available Tools

| Tool Name | Description | Documentation |
|-----------|-------------|---------------|
| `create_roadmap` | Create a project roadmap with milestones and tasks | [Documentation](create-roadmap.md) |
| `plan_sprint` | Plan a new sprint with selected issues | [Documentation](plan-sprint.md) |
| `get_milestone_metrics` | Get progress metrics for a specific milestone | [Documentation](get-milestone-metrics.md) |
| `get_sprint_metrics` | Get progress metrics for a specific sprint | [Documentation](get-sprint-metrics.md) |
| `get_overdue_milestones` | Get a list of overdue milestones | [Documentation](get-overdue-milestones.md) |
| `get_upcoming_milestones` | Get a list of upcoming milestones | [Documentation](get-upcoming-milestones.md) |

## Enhanced Features

| Feature | Description | Documentation |
|---------|-------------|---------------|
| Enhanced Field Support | Complete coverage of GitHub Project v2 field types | [Documentation](enhanced-field-support.md) |

## Using the API

All tools follow the Model Context Protocol (MCP) standard for request and response formats. To use a tool:

1. Send a request to the MCP server with the tool name and parameters
2. Process the response according to the MCP specification

### Example Request

```json
{
  "name": "create_roadmap",
  "arguments": {
    "project": {
      "title": "New Project",
      "shortDescription": "Project description",
      "owner": "repository_owner",
      "visibility": "private"
    },
    "milestones": [
      {
        "milestone": {
          "title": "Phase 1",
          "description": "Initial phase",
          "dueDate": "2023-12-31T00:00:00Z"
        },
        "issues": [
          {
            "title": "Task 1",
            "description": "Task description",
            "priority": "medium",
            "type": "feature"
          }
        ]
      }
    ]
  }
}
```

### Example Response

```json
{
  "content": [
    {
      "type": "json",
      "text": "{\"project\":{\"id\":\"proj_123\",\"title\":\"New Project\",\"description\":\"Project description\",\"visibility\":\"private\",\"status\":\"active\",\"createdAt\":\"2023-01-01T00:00:00Z\",\"updatedAt\":\"2023-01-01T00:00:00Z\"},\"milestones\":[{\"id\":\"ms_123\",\"title\":\"Phase 1\",\"description\":\"Initial phase\",\"dueDate\":\"2023-12-31T00:00:00Z\",\"status\":\"active\",\"progress\":{\"openIssues\":1,\"closedIssues\":0,\"completionPercentage\":0},\"issues\":[{\"id\":\"issue_123\",\"title\":\"Task 1\",\"description\":\"Task description\",\"priority\":\"medium\",\"type\":\"feature\",\"status\":\"active\"}]}]}",
      "contentType": "application/json"
    }
  ],
  "metadata": {
    "timestamp": "2023-01-01T00:00:00Z",
    "status": 200,
    "requestId": "req_123"
  }
}
```

## Error Handling

All tools use standardized error codes and formats:

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| MCP-001 | Internal Error | 500 |
| MCP-002 | Validation Error | 400 |
| MCP-003 | Resource Not Found | 404 |
| MCP-004 | Invalid Request | 400 |
| MCP-005 | Unauthorized | 401 |
| MCP-006 | Rate Limited | 429 |

### Example Error Response

```json
{
  "error": {
    "code": "MCP-002",
    "message": "Validation error: Project title is required",
    "details": [
      {
        "code": "details",
        "message": "{\"path\":\"project.title\",\"message\":\"Required\"}"
      }
    ]
  },
  "metadata": {
    "timestamp": "2023-01-01T00:00:00Z",
    "status": 400,
    "requestId": "req_123"
  }
}
```

## Next Steps

- Check out the [User Guide](../user-guide.md) for general usage instructions
- See the [Examples](../../examples/README.md) directory for code samples
- Review the [Tutorials](../tutorials/getting-started.md) for step-by-step guides
