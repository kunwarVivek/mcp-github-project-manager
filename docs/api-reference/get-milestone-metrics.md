# Get Milestone Metrics Tool

## Overview

The `get_milestone_metrics` tool retrieves detailed progress metrics for a specific milestone. This is useful for tracking milestone completion, understanding issue distribution, and monitoring progress against deadlines.

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| milestoneId | Number | Yes | ID of the milestone to retrieve metrics for |
| includeIssues | Boolean | No | Whether to include detailed issue information (default: false) |

## Response

### Success Response

```json
{
  "milestone": {
    "id": "ms_123",
    "title": "Phase 1: MVP",
    "description": "Minimum Viable Product Release",
    "dueDate": "2023-03-15T00:00:00Z",
    "status": "active"
  },
  "progress": {
    "openIssues": 8,
    "closedIssues": 12,
    "completionPercentage": 60,
    "daysRemaining": 15,
    "isOverdue": false
  },
  "issueBreakdown": {
    "byType": {
      "bug": 5,
      "feature": 10,
      "enhancement": 3,
      "documentation": 2
    },
    "byPriority": {
      "high": 4,
      "medium": 12,
      "low": 4
    }
  },
  "issues": [
    {
      "id": "issue_123",
      "title": "Implement user authentication",
      "status": "closed",
      "priority": "high",
      "type": "feature"
    },
    // Additional issues if includeIssues=true
  ]
}
```

### Error Responses

| Error Code | Description |
|------------|-------------|
| MCP-003 | Resource not found (milestone not found) |
| MCP-005 | Unauthorized (invalid GitHub token) |
| MCP-006 | Rate limited (GitHub API rate limit exceeded) |

## Examples

### Basic Example

```typescript
// Get basic milestone metrics
const metrics = await service.getMilestoneMetrics(123, false);
console.log(`Milestone: ${metrics.milestone.title}`);
console.log(`Progress: ${metrics.progress.completionPercentage}%`);
console.log(`Open issues: ${metrics.progress.openIssues}`);
console.log(`Closed issues: ${metrics.progress.closedIssues}`);
```

### Advanced Example

```typescript
// Get detailed milestone metrics with issues
const metrics = await service.getMilestoneMetrics(123, true);

// Check if milestone is at risk
const isAtRisk = metrics.progress.daysRemaining < 7 && 
                 metrics.progress.completionPercentage < 70;

if (isAtRisk) {
  console.warn(`⚠️ Milestone "${metrics.milestone.title}" is at risk!`);
  console.warn(`Only ${metrics.progress.daysRemaining} days remaining with ${metrics.progress.completionPercentage}% completion`);
  
  // Find high priority open issues
  const highPriorityIssues = metrics.issues.filter(
    issue => issue.priority === 'high' && issue.status !== 'closed'
  );
  
  console.warn(`High priority issues to focus on:`);
  highPriorityIssues.forEach(issue => {
    console.warn(`- ${issue.title} (${issue.id})`);
  });
}

// Generate issue type distribution
console.log(`Issue type distribution:`);
Object.entries(metrics.issueBreakdown.byType).forEach(([type, count]) => {
  const percentage = (count / (metrics.progress.openIssues + metrics.progress.closedIssues)) * 100;
  console.log(`- ${type}: ${count} (${percentage.toFixed(1)}%)`);
});
```

## Implementation Details

The `get_milestone_metrics` tool performs the following operations:

1. Retrieves the milestone with the specified ID
2. Fetches all issues associated with the milestone
3. Calculates progress metrics based on issue status
4. Generates breakdown statistics by issue type and priority
5. Returns the compiled metrics data

## Metrics Explanation

| Metric | Description |
|--------|-------------|
| openIssues | Number of issues in the milestone that are not closed |
| closedIssues | Number of issues in the milestone that are closed |
| completionPercentage | Percentage of issues that are closed (0-100) |
| daysRemaining | Number of days until the milestone due date (negative if overdue) |
| isOverdue | Boolean indicating if the milestone is past its due date |

## Best Practices

- Regularly check milestone metrics to track progress
- Pay attention to the completion percentage relative to days remaining
- Address high priority issues first when a milestone is at risk
- Use the issue breakdown to ensure balanced progress across different types of work

## Related Tools

- [Get Overdue Milestones](get-overdue-milestones.md) - Find milestones that are past their due date
- [Get Upcoming Milestones](get-upcoming-milestones.md) - Find milestones with approaching due dates
