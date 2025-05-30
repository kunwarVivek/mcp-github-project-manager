# Plan Sprint Tool

## Overview

The `plan_sprint` tool allows you to create a new sprint and assign issues to it. This is useful for organizing work into time-boxed iterations and tracking progress against sprint goals.

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sprint | Object | Yes | Sprint configuration |
| sprint.title | String | Yes | Sprint title (1-255 characters) |
| sprint.startDate | String | Yes | Sprint start date (ISO format) |
| sprint.endDate | String | Yes | Sprint end date (ISO format) |
| sprint.goals | Array | No | List of sprint goals |
| issueIds | Array | Yes | List of issue IDs to include in the sprint |

## Response

### Success Response

```json
{
  "id": "sprint_123",
  "title": "Sprint 1",
  "startDate": "2023-01-01T00:00:00Z",
  "endDate": "2023-01-14T00:00:00Z",
  "status": "planned",
  "goals": [
    "Complete user authentication flow",
    "Implement onboarding screens"
  ],
  "issues": [1, 2, 3, 5],
  "createdAt": "2023-01-01T00:00:00Z",
  "updatedAt": "2023-01-01T00:00:00Z"
}
```

### Error Responses

| Error Code | Description |
|------------|-------------|
| MCP-002 | Validation error (invalid parameters) |
| MCP-003 | Resource not found (one or more issues not found) |
| MCP-005 | Unauthorized (invalid GitHub token) |
| MCP-006 | Rate limited (GitHub API rate limit exceeded) |

## Examples

### Basic Example

```typescript
const sprint = await service.planSprint({
  sprint: {
    title: "Sprint 1: Authentication and Onboarding",
    startDate: "2023-01-01T00:00:00Z",
    endDate: "2023-01-14T00:00:00Z",
    goals: [
      "Complete user authentication flow",
      "Implement onboarding screens"
    ]
  },
  issueIds: [1, 2, 3, 5]
});
```

### Advanced Example

```typescript
// Example with custom sprint status and validation
try {
  // Validate that all issues exist before planning the sprint
  const issueIds = [101, 102, 103, 104];
  const issues = await service.getIssuesByIds(issueIds);
  
  if (issues.length !== issueIds.length) {
    const foundIds = issues.map(issue => issue.id);
    const missingIds = issueIds.filter(id => !foundIds.includes(id));
    process.stderr.write(`Issues not found: ${missingIds.join(', ')}`);
    return;
  }
  
  // Calculate sprint capacity based on team velocity
  const teamVelocity = 30; // story points
  const totalStoryPoints = issues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
  
  if (totalStoryPoints > teamVelocity) {
    console.warn(`Warning: Sprint may be overcommitted. ${totalStoryPoints} points planned vs ${teamVelocity} velocity.`);
  }
  
  // Create the sprint with active status
  const sprint = await service.planSprint({
    sprint: {
      title: "Sprint 2: Payment Processing",
      startDate: new Date().toISOString(), // Start today
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks from now
      goals: [
        "Implement payment gateway integration",
        "Add subscription management",
        "Create payment history view"
      ],
      status: "active" // Start as active sprint
    },
    issueIds: issueIds
  });
  
  console.log(`Sprint created: ${sprint.id}`);
  console.log(`${issues.length} issues assigned to sprint`);
  
  return sprint;
} catch (error) {
  process.stderr.write("Failed to plan sprint:", error);
  throw error;
}
```

## Implementation Details

The `plan_sprint` tool performs the following operations:

1. Creates a new sprint with the specified title, dates, and goals
2. Validates that all specified issues exist
3. Associates the issues with the sprint
4. Returns the created sprint with all its properties

## Best Practices

- Set realistic sprint durations (typically 1-4 weeks)
- Define clear sprint goals
- Ensure issues are properly estimated before adding to sprint
- Don't overcommit - be realistic about team capacity
- Include a mix of issue types and priorities

## Sprint Statuses

A sprint can have one of the following statuses:

| Status | Description |
|--------|-------------|
| planned | Sprint is created but not yet started |
| active | Sprint is currently in progress |
| completed | Sprint has been completed |

## Related Tools

- [Get Sprint Metrics](get-sprint-metrics.md) - Track progress of sprint
- [Create Roadmap](create-roadmap.md) - Create a roadmap with milestones and issues
