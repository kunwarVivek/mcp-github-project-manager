# MCP Tools Reference

This document provides comprehensive documentation for all 109 MCP tools available in the MCP GitHub Project Manager.

## Overview

| Metric | Value |
|--------|-------|
| Total Tools | 109 |
| Categories | 15 |
| SDK Version | 1.25.3 |
| All tools have | Behavior annotations, Output schemas |

### Behavior Annotations

All tools are annotated with behavior hints that help MCP clients understand their impact:

| Annotation | Meaning | Example Tools |
|------------|---------|---------------|
| `readOnlyHint: true` | Does not modify data | `get_project`, `list_issues`, `health_check` |
| `destructiveHint: true` | Permanently deletes data | `delete_project`, `delete_issue_comment` |
| `idempotentHint: true` | Safe to retry | `update_project`, `set_field_value` |
| `openWorldHint: true` | Makes external calls | `generate_prd`, `enrich_issue` |

---

## Tool Categories

1. [Project Management Tools](#project-management-tools) (18 tools)
2. [Issue Tools](#issue-tools) (18 tools)
3. [Sub-issue Tools](#sub-issue-tools) (5 tools)
4. [Pull Request Tools](#pull-request-tools) (8 tools)
5. [Sprint & Iteration Tools](#sprint--iteration-tools) (14 tools)
6. [Field Operations Tools](#field-operations-tools) (6 tools)
7. [Automation Tools](#automation-tools) (7 tools)
8. [Events & Triaging Tools](#events--triaging-tools) (5 tools)
9. [AI Task Tools](#ai-task-tools) (8 tools)
10. [Health & Observability Tools](#health--observability-tools) (1 tool)
11. [Status Update Tools](#status-update-tools) (3 tools)
12. [Project Template Tools](#project-template-tools) (4 tools)
13. [Project Linking Tools](#project-linking-tools) (6 tools)
14. [Project Lifecycle Tools](#project-lifecycle-tools) (3 tools)
15. [Advanced Operations Tools](#advanced-operations-tools) (3 tools)

---

## Project Management Tools

### create_project

Create a new GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| title | string | Yes | Project title |
| shortDescription | string | No | Brief description |
| owner | string | Yes | Owner username or org |
| visibility | "private" \| "public" | No | Default: "private" |

**Output:** Project object with id, title, url, fields

**Behavior:** Creates new project (not read-only, not destructive, not idempotent)

**Example:**
```json
{
  "title": "Backend API Development",
  "owner": "myorg",
  "visibility": "public",
  "shortDescription": "REST API for mobile app"
}
```

---

### list_projects

List GitHub projects.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | "active" \| "closed" \| "all" | No | Default: "active" |
| limit | number | No | Default: 10 |

**Output:** Array of Project objects

**Behavior:** Read-only, idempotent

**Example:**
```json
{
  "status": "active",
  "limit": 20
}
```

---

### get_project

Get details of a specific GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |

**Output:** Project object with full details

**Behavior:** Read-only, idempotent

**Example:**
```json
{
  "projectId": "PVT_kwDOAB..."
}
```

---

### update_project

Update an existing GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| title | string | No | New title |
| shortDescription | string | No | New description |
| visibility | "private" \| "public" | No | New visibility |
| closed | boolean | No | Close the project |

**Output:** Updated Project object

**Behavior:** Idempotent (same input produces same result)

**Example:**
```json
{
  "projectId": "PVT_kwDOAB...",
  "title": "Updated API Development",
  "visibility": "public"
}
```

---

### delete_project

Delete a GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID to delete |

**Output:** Success confirmation

**Behavior:** Destructive (permanent deletion)

**Example:**
```json
{
  "projectId": "PVT_kwDOAB..."
}
```

---

### get_project_readme

Get the README content of a GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |

**Output:** README content object

**Behavior:** Read-only, idempotent

---

### update_project_readme

Update the README content of a GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| readme | string | Yes | New README content |

**Output:** Updated README object

**Behavior:** Idempotent

---

### create_project_field

Create a custom field for a GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| name | string | Yes | Field name |
| description | string | No | Field description |
| dataType | string | Yes | Field type (TEXT, NUMBER, DATE, SINGLE_SELECT, ITERATION) |
| options | array | No | Options for SINGLE_SELECT fields |

**Output:** Created field object

**Example:**
```json
{
  "projectId": "PVT_kwDOAB...",
  "name": "Status",
  "description": "Current status of the task",
  "dataType": "SINGLE_SELECT",
  "options": [
    { "name": "To Do", "color": "red" },
    { "name": "In Progress", "color": "yellow" },
    { "name": "Done", "color": "green" }
  ]
}
```

---

### list_project_fields

List all fields in a GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |

**Output:** Array of field objects

**Behavior:** Read-only, idempotent

---

### update_project_field

Update a custom field in a GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| fieldId | string | Yes | Field ID |
| name | string | No | New field name |
| options | array | No | Updated options |

**Output:** Updated field object

**Behavior:** Idempotent

---

### create_project_view

Create a new view for a GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| name | string | Yes | View name |
| layout | "TABLE" \| "BOARD" \| "ROADMAP" | Yes | View layout |
| groupByField | string | No | Field to group by |
| sortByField | string | No | Field to sort by |
| filterQuery | string | No | Filter expression |

**Output:** Created view object

**Example:**
```json
{
  "projectId": "PVT_kwDOAB...",
  "name": "Development Board",
  "layout": "BOARD",
  "groupByField": "Status"
}
```

---

### list_project_views

List all views in a GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |

**Output:** Array of view objects

**Behavior:** Read-only, idempotent

---

### delete_project_view

Delete a view from a GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| viewId | string | Yes | View ID |

**Output:** Success confirmation

**Behavior:** Destructive

---

### add_project_item

Add an item (issue or PR) to a GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| contentId | string | Yes | Issue or PR node ID |

**Output:** Created item object

---

### remove_project_item

Remove an item from a GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| itemId | string | Yes | Project item ID |

**Output:** Success confirmation

---

### list_project_items

List all items in a GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| limit | number | No | Max items to return |

**Output:** Array of project items

**Behavior:** Read-only, idempotent

---

### archive_project_item

Archive an item in a GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| itemId | string | Yes | Item ID |

**Output:** Updated item object

---

### unarchive_project_item

Unarchive an item in a GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| itemId | string | Yes | Item ID |

**Output:** Updated item object

---

## Issue Tools

### create_issue

Create a new GitHub issue.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| title | string | Yes | Issue title |
| body | string | No | Issue description |
| labels | string[] | No | Labels to add |
| assignees | string[] | No | Usernames to assign |
| milestone | number | No | Milestone number |

**Output:** Created issue object

**Example:**
```json
{
  "owner": "myorg",
  "repo": "myrepo",
  "title": "Fix authentication bug",
  "body": "Users cannot log in with social media accounts",
  "labels": ["bug", "high-priority"],
  "assignees": ["developer1"]
}
```

---

### list_issues

List GitHub issues.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| state | "open" \| "closed" \| "all" | No | Issue state filter |
| labels | string[] | No | Filter by labels |
| milestone | string | No | Filter by milestone |
| assignee | string | No | Filter by assignee |
| limit | number | No | Max issues to return |

**Output:** Array of issue objects

**Behavior:** Read-only, idempotent

---

### get_issue

Get details of a specific GitHub issue.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| issueNumber | number | Yes | Issue number |

**Output:** Issue object with full details

**Behavior:** Read-only, idempotent

---

### update_issue

Update a GitHub issue.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| issueNumber | number | Yes | Issue number |
| title | string | No | New title |
| body | string | No | New body |
| state | "open" \| "closed" | No | New state |
| labels | string[] | No | New labels |
| assignees | string[] | No | New assignees |
| milestone | number | No | New milestone |

**Output:** Updated issue object

**Behavior:** Idempotent

---

### create_issue_comment

Add a comment to a GitHub issue.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| issueNumber | number | Yes | Issue number |
| body | string | Yes | Comment content |

**Output:** Created comment object

---

### update_issue_comment

Update an existing comment on a GitHub issue.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| commentId | number | Yes | Comment ID |
| body | string | Yes | New content |

**Output:** Updated comment object

**Behavior:** Idempotent

---

### delete_issue_comment

Delete a comment from a GitHub issue.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| commentId | number | Yes | Comment ID |

**Output:** Success confirmation

**Behavior:** Destructive

---

### list_issue_comments

List all comments on a GitHub issue.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| issueNumber | number | Yes | Issue number |
| limit | number | No | Max comments to return |

**Output:** Array of comment objects

**Behavior:** Read-only, idempotent

---

### create_draft_issue

Create a draft issue in a GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| title | string | Yes | Draft title |
| body | string | No | Draft body |

**Output:** Created draft issue object

**Example:**
```json
{
  "projectId": "PVT_kwDOAB...",
  "title": "Explore new authentication options",
  "body": "Research OAuth providers and SSO solutions"
}
```

---

### update_draft_issue

Update an existing draft issue in a GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| draftIssueId | string | Yes | Draft issue ID |
| title | string | No | New title |
| body | string | No | New body |

**Output:** Updated draft issue object

**Behavior:** Idempotent

---

### delete_draft_issue

Delete a draft issue from a GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| draftIssueId | string | Yes | Draft issue ID |

**Output:** Success confirmation

**Behavior:** Destructive

---

### create_milestone

Create a new milestone.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| title | string | Yes | Milestone title |
| description | string | No | Milestone description |
| dueDate | string | No | ISO date string |
| state | "open" \| "closed" | No | Default: "open" |

**Output:** Created milestone object

**Example:**
```json
{
  "owner": "myorg",
  "repo": "myrepo",
  "title": "Beta Release",
  "description": "Complete all features for beta release",
  "dueDate": "2024-03-31T00:00:00Z"
}
```

---

### list_milestones

List milestones.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| state | "open" \| "closed" \| "all" | No | State filter |
| sort | "due_on" \| "completeness" | No | Sort field |
| direction | "asc" \| "desc" | No | Sort direction |

**Output:** Array of milestone objects

**Behavior:** Read-only, idempotent

---

### update_milestone

Update a GitHub milestone.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| milestoneNumber | number | Yes | Milestone number |
| title | string | No | New title |
| description | string | No | New description |
| dueDate | string | No | New due date |
| state | "open" \| "closed" | No | New state |

**Output:** Updated milestone object

**Behavior:** Idempotent

---

### delete_milestone

Delete a GitHub milestone.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| milestoneNumber | number | Yes | Milestone number |

**Output:** Success confirmation

**Behavior:** Destructive

---

### create_label

Create a new GitHub label.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| name | string | Yes | Label name |
| color | string | Yes | Hex color (without #) |
| description | string | No | Label description |

**Output:** Created label object

**Example:**
```json
{
  "owner": "myorg",
  "repo": "myrepo",
  "name": "bug",
  "color": "d73a4a",
  "description": "Something isn't working"
}
```

---

### list_labels

List all GitHub labels.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |

**Output:** Array of label objects

**Behavior:** Read-only, idempotent

---

## Sub-issue Tools

Sub-issues allow creating parent-child hierarchies between GitHub issues. These tools manage sub-issue relationships using the GitHub GraphQL API with the `sub_issues` feature flag.

### add_sub_issue

Adds an existing issue as a sub-issue of a parent issue.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| parentIssueNumber | number | Yes | Parent issue number |
| subIssueNumber | number | Yes | Issue to add as sub-issue |
| replaceParent | boolean | No | Replace existing parent (default: false) |

**Output:** SubIssueOperationOutput with parent and sub-issue details

**Behavior:** Idempotent update operation

**Example:**
```json
{
  "owner": "myorg",
  "repo": "myrepo",
  "parentIssueNumber": 100,
  "subIssueNumber": 123
}
```

---

### list_sub_issues

Lists all sub-issues for a parent issue with pagination.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| issueNumber | number | Yes | Parent issue number |
| first | number | No | Number of results (default: 20, max: 100) |
| after | string | No | Pagination cursor |

**Output:** SubIssueListOutput with sub-issues, summary, and pagination

**Behavior:** Read-only, idempotent

**Example:**
```json
{
  "owner": "myorg",
  "repo": "myrepo",
  "issueNumber": 100,
  "first": 50
}
```

---

### get_parent_issue

Gets the parent issue for a sub-issue, if any.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| issueNumber | number | Yes | Issue number to check |

**Output:** ParentIssueOutput with parent (or null if no parent)

**Behavior:** Read-only, idempotent

**Example:**
```json
{
  "owner": "myorg",
  "repo": "myrepo",
  "issueNumber": 123
}
```

---

### reprioritize_sub_issue

Changes the position of a sub-issue within its parent's sub-issue list.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| parentIssueNumber | number | Yes | Parent issue number |
| subIssueNumber | number | Yes | Sub-issue to move |
| afterIssueNumber | number | No | Place after this issue (omit for beginning) |

**Output:** SubIssueOperationOutput with updated position

**Behavior:** Idempotent update operation

**Example:**
```json
{
  "owner": "myorg",
  "repo": "myrepo",
  "parentIssueNumber": 100,
  "subIssueNumber": 123,
  "afterIssueNumber": 122
}
```

---

### remove_sub_issue

Removes a sub-issue from its parent. The issue itself remains, only the relationship is removed.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| parentIssueNumber | number | Yes | Parent issue number |
| subIssueNumber | number | Yes | Sub-issue to remove |

**Output:** RemoveSubIssueOutput with success flag and message

**Behavior:** Destructive (removes relationship), idempotent

**Example:**
```json
{
  "owner": "myorg",
  "repo": "myrepo",
  "parentIssueNumber": 100,
  "subIssueNumber": 123
}
```

---

## Pull Request Tools

### create_pull_request

Create a new pull request in a GitHub repository.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| title | string | Yes | PR title |
| body | string | No | PR description |
| head | string | Yes | Source branch |
| base | string | Yes | Target branch |
| draft | boolean | No | Create as draft |

**Output:** Created PR object

**Example:**
```json
{
  "owner": "myorg",
  "repo": "myrepo",
  "title": "Add user authentication",
  "body": "Implements OAuth 2.0 authentication",
  "head": "feature/auth",
  "base": "main"
}
```

---

### get_pull_request

Get details of a specific pull request.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| pullNumber | number | Yes | PR number |

**Output:** PR object with full details

**Behavior:** Read-only, idempotent

---

### list_pull_requests

List pull requests in a GitHub repository.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| state | "open" \| "closed" \| "all" | No | State filter |
| head | string | No | Filter by head branch |
| base | string | No | Filter by base branch |
| sort | string | No | Sort field |
| direction | "asc" \| "desc" | No | Sort direction |
| limit | number | No | Max PRs to return |

**Output:** Array of PR objects

**Behavior:** Read-only, idempotent

---

### update_pull_request

Update a pull request's title, body, or state.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| pullNumber | number | Yes | PR number |
| title | string | No | New title |
| body | string | No | New body |
| state | "open" \| "closed" | No | New state |
| base | string | No | New base branch |

**Output:** Updated PR object

**Behavior:** Idempotent

---

### merge_pull_request

Merge a pull request using merge, squash, or rebase.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| pullNumber | number | Yes | PR number |
| mergeMethod | "merge" \| "squash" \| "rebase" | No | Default: "merge" |
| commitTitle | string | No | Merge commit title |
| commitMessage | string | No | Merge commit message |

**Output:** Merge result object

**Example:**
```json
{
  "owner": "myorg",
  "repo": "myrepo",
  "pullNumber": 42,
  "mergeMethod": "squash"
}
```

---

### list_pull_request_reviews

List all reviews on a pull request.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| pullNumber | number | Yes | PR number |

**Output:** Array of review objects

**Behavior:** Read-only, idempotent

---

### create_pull_request_review

Create a review on a pull request (approve, request changes, or comment).

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| pullNumber | number | Yes | PR number |
| event | "APPROVE" \| "REQUEST_CHANGES" \| "COMMENT" | Yes | Review event |
| body | string | No | Review comment |
| comments | array | No | Line comments |

**Output:** Created review object

**Example:**
```json
{
  "owner": "myorg",
  "repo": "myrepo",
  "pullNumber": 42,
  "event": "APPROVE",
  "body": "LGTM! Great work on the authentication implementation."
}
```

---

## Sprint & Iteration Tools

### create_sprint

Create a new development sprint.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| title | string | Yes | Sprint title |
| description | string | No | Sprint description |
| startDate | string | Yes | ISO date string |
| endDate | string | Yes | ISO date string |
| goals | string[] | No | Sprint goals |
| issueIds | string[] | No | Initial issues |

**Output:** Created sprint object

**Example:**
```json
{
  "title": "Sprint 1: User Authentication",
  "description": "First sprint focused on user authentication features",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-14T00:00:00Z",
  "goals": ["Complete login flow", "Add OAuth support"]
}
```

---

### list_sprints

List all sprints.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | "active" \| "completed" \| "all" | No | Status filter |
| limit | number | No | Max sprints to return |

**Output:** Array of sprint objects

**Behavior:** Read-only, idempotent

---

### get_current_sprint

Get the currently active sprint.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| includeIssues | boolean | No | Include assigned issues |

**Output:** Current sprint object

**Behavior:** Read-only, idempotent

---

### update_sprint

Update a development sprint.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sprintId | string | Yes | Sprint ID |
| title | string | No | New title |
| description | string | No | New description |
| startDate | string | No | New start date |
| endDate | string | No | New end date |
| status | string | No | New status |
| goals | string[] | No | New goals |

**Output:** Updated sprint object

**Behavior:** Idempotent

---

### add_issues_to_sprint

Add issues to an existing sprint.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sprintId | string | Yes | Sprint ID |
| issueIds | string[] | Yes | Issue IDs to add |

**Output:** Updated sprint object

---

### remove_issues_from_sprint

Remove issues from a sprint.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sprintId | string | Yes | Sprint ID |
| issueIds | string[] | Yes | Issue IDs to remove |

**Output:** Updated sprint object

---

### create_roadmap

Create a project roadmap with milestones and tasks.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| project | object | Yes | Project configuration |
| milestones | array | Yes | Array of milestone objects |

**Output:** Created roadmap object

**Example:**
```json
{
  "project": {
    "title": "New Mobile App",
    "shortDescription": "Mobile app development project",
    "visibility": "private"
  },
  "milestones": [
    {
      "milestone": {
        "title": "Design Phase",
        "description": "Complete all design work",
        "dueDate": "2024-02-01T00:00:00Z"
      },
      "issues": [
        {
          "title": "Create wireframes",
          "description": "Create wireframes for all screens",
          "priority": "high",
          "type": "feature"
        }
      ]
    }
  ]
}
```

---

### plan_sprint

Plan a new sprint with selected issues.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sprint | object | Yes | Sprint configuration |
| issueIds | string[] | Yes | Issue IDs to include |

**Output:** Planned sprint object

---

### get_milestone_metrics

Get progress metrics for a specific milestone.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| milestoneId | string | Yes | Milestone ID |
| includeIssues | boolean | No | Include issue details |

**Output:** Milestone metrics object

**Behavior:** Read-only, idempotent

---

### get_sprint_metrics

Get progress metrics for a specific sprint.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sprintId | string | Yes | Sprint ID |
| includeIssues | boolean | No | Include issue details |

**Output:** Sprint metrics object

**Behavior:** Read-only, idempotent

---

### get_overdue_milestones

Get a list of overdue milestones.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | number | No | Max milestones to return |
| includeIssues | boolean | No | Include issue details |

**Output:** Array of overdue milestone objects

**Behavior:** Read-only, idempotent

---

### get_upcoming_milestones

Get a list of upcoming milestones within a time frame.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| daysAhead | number | Yes | Days to look ahead |
| limit | number | No | Max milestones to return |
| includeIssues | boolean | No | Include issue details |

**Output:** Array of upcoming milestone objects

**Behavior:** Read-only, idempotent

---

### get_iteration_configuration

Get iteration field configuration including duration, start date, and list of all iterations.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| fieldId | string | Yes | Iteration field ID |

**Output:** Iteration configuration object

**Behavior:** Read-only, idempotent

---

### get_current_iteration

Get the currently active iteration based on today's date.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| fieldId | string | Yes | Iteration field ID |

**Output:** Current iteration object

**Behavior:** Read-only, idempotent

---

### get_iteration_items

Get all items assigned to a specific iteration.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| fieldId | string | Yes | Iteration field ID |
| iterationId | string | Yes | Iteration ID |

**Output:** Array of items in iteration

**Behavior:** Read-only, idempotent

---

### get_iteration_by_date

Find which iteration contains a specific date.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| fieldId | string | Yes | Iteration field ID |
| date | string | Yes | ISO date string |

**Output:** Matching iteration object

**Behavior:** Read-only, idempotent

---

### assign_items_to_iteration

Bulk assign multiple items to a specific iteration.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| fieldId | string | Yes | Iteration field ID |
| iterationId | string | Yes | Target iteration ID |
| itemIds | string[] | Yes | Item IDs to assign |

**Output:** Assignment results

---

## Field Operations Tools

### set_field_value

Set a field value for a project item.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| itemId | string | Yes | Item ID |
| fieldId | string | Yes | Field ID |
| value | any | Yes | Field value (type depends on field) |

**Output:** Updated field value

**Behavior:** Idempotent

---

### get_field_value

Get a field value for a project item.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| itemId | string | Yes | Item ID |
| fieldId | string | Yes | Field ID |

**Output:** Field value object

**Behavior:** Read-only, idempotent

---

### clear_field_value

Clear a field value for a project item.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| itemId | string | Yes | Item ID |
| fieldId | string | Yes | Field ID |

**Output:** Success confirmation

---

---

## Automation Tools

### create_automation_rule

Create a new automation rule for a GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| name | string | Yes | Rule name |
| description | string | No | Rule description |
| trigger | object | Yes | Trigger configuration |
| action | object | Yes | Action configuration |

**Output:** Created rule object

**Example:**
```json
{
  "projectId": "PVT_kwDOAB...",
  "name": "Auto-label new PRs",
  "description": "Automatically add 'needs-review' label when PR is opened",
  "trigger": {
    "type": "pull_request.opened"
  },
  "action": {
    "type": "add_label",
    "label": "needs-review"
  }
}
```

---

### update_automation_rule

Update an existing automation rule.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| ruleId | string | Yes | Rule ID |
| name | string | No | New name |
| description | string | No | New description |
| trigger | object | No | New trigger |
| action | object | No | New action |
| enabled | boolean | No | Enable/disable |

**Output:** Updated rule object

**Behavior:** Idempotent

---

### delete_automation_rule

Delete an automation rule from a project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| ruleId | string | Yes | Rule ID |

**Output:** Success confirmation

**Behavior:** Destructive

---

### get_automation_rule

Get details of a specific automation rule.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| ruleId | string | Yes | Rule ID |

**Output:** Rule object with full details

**Behavior:** Read-only, idempotent

---

### list_automation_rules

List all automation rules for a GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |

**Output:** Array of rule objects

**Behavior:** Read-only, idempotent

---

### enable_automation_rule

Enable a disabled automation rule.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| ruleId | string | Yes | Rule ID |

**Output:** Enabled rule object

**Behavior:** Idempotent

---

### disable_automation_rule

Disable an automation rule without deleting it.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| ruleId | string | Yes | Rule ID |

**Output:** Disabled rule object

**Behavior:** Idempotent

---

## Events & Triaging Tools

### subscribe_to_events

Subscribe to real-time events for GitHub resources.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| resourceType | string | Yes | Resource type (project, issue, pr) |
| resourceId | string | No | Specific resource ID |
| eventTypes | string[] | No | Event type filter |

**Output:** Subscription object

---

### get_recent_events

Get recent events for GitHub resources.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| resourceType | string | Yes | Resource type |
| resourceId | string | No | Specific resource ID |
| limit | number | No | Max events to return |

**Output:** Array of event objects

**Behavior:** Read-only, idempotent

---

### replay_events

Replay events from a specific timestamp.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| resourceType | string | Yes | Resource type |
| resourceId | string | No | Specific resource ID |
| since | string | Yes | ISO timestamp |

**Output:** Array of replayed events

**Behavior:** Read-only, idempotent

---

### triage_issue

AI-powered issue triaging. Classifies issues, assigns priority, and recommends actions.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| issueNumber | number | Yes | Issue number |

**Output:** Triage result object

**Behavior:** Open-world (makes AI calls)

---

### triage_all_issues

Automatically triage all untriaged issues in a project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| filter | object | No | Filter criteria |

**Output:** Bulk triage results

**Behavior:** Open-world (makes AI calls)

---

### schedule_triaging

Schedule automated issue triaging to run periodically.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| schedule | string | Yes | Cron expression |

**Output:** Scheduled job object

---

## AI Task Tools

These tools use AI for intelligent project management and task generation. They make external API calls to AI providers.

### generate_prd

Generate a comprehensive Product Requirements Document (PRD) from a project idea using AI analysis and industry best practices.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectIdea | string | Yes | Description of the project |
| targetAudience | string | No | Who the product is for |
| constraints | string[] | No | Technical or business constraints |
| preferences | object | No | Generation preferences |

**Output:** Generated PRD document

**Behavior:** Open-world (makes AI calls)

**Example:**
```json
{
  "projectIdea": "A task management application for small teams",
  "targetAudience": "Startups and small businesses",
  "constraints": ["Must work offline", "Mobile-first design"]
}
```

---

### parse_prd

Parse a Product Requirements Document (PRD) and generate a comprehensive list of actionable development tasks with AI-powered analysis.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| prdContent | string | Yes | PRD document content |
| options | object | No | Parsing options |

**Output:** Array of generated tasks with dependencies

**Behavior:** Open-world (makes AI calls)

---

### enhance_prd

Enhance an existing PRD with AI-powered improvements, adding missing elements, improving clarity, and providing comprehensive analysis.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| prdContent | string | Yes | Existing PRD content |
| focusAreas | string[] | No | Areas to focus on |
| enhancementLevel | string | No | Level of enhancement |

**Output:** Enhanced PRD document

**Behavior:** Open-world (makes AI calls)

---

### add_feature

Add a new feature to an existing PRD or project, analyze its impact, and expand it into actionable tasks with complete lifecycle management.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| featureDescription | string | Yes | Feature description |
| priority | string | No | Feature priority |

**Output:** Feature addition result with tasks

**Behavior:** Open-world (makes AI calls)

---

### expand_task

Break down a complex task into smaller, manageable subtasks with AI-powered analysis, dependency detection, and implementation recommendations.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| taskId | string | Yes | Task ID to expand |
| depth | number | No | Expansion depth |
| context | string | No | Additional context |

**Output:** Expanded task with subtasks

**Behavior:** Open-world (makes AI calls)

---

### analyze_task_complexity

Perform detailed AI-powered analysis of task complexity, effort estimation, risk assessment, and provide actionable recommendations.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| taskId | string | Yes | Task ID to analyze |
| includeRisks | boolean | No | Include risk analysis |
| includeRecommendations | boolean | No | Include recommendations |

**Output:** Complexity analysis result

**Behavior:** Open-world (makes AI calls)

---

### get_next_task

Get AI-powered recommendations for the next task to work on based on priorities, dependencies, team capacity, and current project state.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| userId | string | No | User ID for personalization |
| skills | string[] | No | User skills |
| availability | number | No | Hours available |

**Output:** Recommended next task

**Behavior:** Open-world (makes AI calls)

---

### create_traceability_matrix

Create a comprehensive requirements traceability matrix linking PRD business requirements to features to use cases to tasks with full bidirectional traceability.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| prdContent | string | No | PRD content if not linked |
| includeTestCases | boolean | No | Include test case links |

**Output:** Traceability matrix object

**Behavior:** Open-world (makes AI calls)

---

### generate_roadmap

AI-powered roadmap generation from project issues. Creates milestones, sprints, and phases automatically.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project ID |
| timeframe | string | No | Roadmap timeframe |
| options | object | No | Generation options |

**Output:** Generated roadmap

**Behavior:** Open-world (makes AI calls)

---

### enrich_issue

AI-powered issue enrichment. Automatically adds labels, priority, type, complexity, and effort estimates.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| issueNumber | number | Yes | Issue number |

**Output:** Enriched issue object

**Behavior:** Open-world (makes AI calls)

---

### enrich_issues_bulk

Bulk AI-powered issue enrichment for multiple issues at once.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |
| issueNumbers | number[] | No | Issue numbers (all if omitted) |

**Output:** Bulk enrichment results

**Behavior:** Open-world (makes AI calls)

---

## Health & Observability Tools

### health_check

Check system health and service availability. Returns status of GitHub connection, AI services, and cache.

**Input Parameters:** None required

**Output:**
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    github: {
      connected: boolean;
      rateLimit?: { remaining: number; limit: number; };
    };
    ai: {
      available: boolean;
      circuitState: 'closed' | 'open' | 'half-open' | 'disabled';
      models: {
        available: string[];
        unavailable: string[];
      };
    };
    cache: {
      entries: number;
      persistenceEnabled: boolean;
      lastPersist?: string;
    };
  };
}
```

**Behavior:** Read-only, idempotent (safe to call frequently)

**Example:**
```json
{}
```

**Response Example:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-31T12:00:00Z",
  "uptime": 3600.5,
  "services": {
    "github": { "connected": true },
    "ai": {
      "available": true,
      "circuitState": "closed",
      "models": {
        "available": ["main", "fallback"],
        "unavailable": []
      }
    },
    "cache": {
      "entries": 150,
      "persistenceEnabled": true,
      "lastPersist": "2024-01-31T11:55:00Z"
    }
  }
}
```

---

## Status Update Tools

Status updates allow project managers to communicate project progress with optional status indicators. These tools work with GitHub Project V2 status updates via the GraphQL API.

### create_status_update

Creates a new status update for a GitHub project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project node ID (PVT_...) |
| body | string | Yes | Status update body (supports Markdown) |
| status | string | No | ON_TRACK, AT_RISK, OFF_TRACK, COMPLETE, INACTIVE |
| startDate | string | No | ISO date (YYYY-MM-DD) |
| targetDate | string | No | ISO date (YYYY-MM-DD) |

**Output:** StatusUpdateOutput with full status update details

**Behavior:** Creates new resource (not idempotent)

**Example:**
```json
{
  "projectId": "PVT_kwDOLhQ7gc4AOEbH",
  "body": "Sprint 3 is progressing well. All P0 features complete.",
  "status": "ON_TRACK",
  "startDate": "2026-01-15",
  "targetDate": "2026-02-15"
}
```

---

### list_status_updates

Lists status updates for a GitHub project with pagination.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project node ID (PVT_...) |
| first | number | No | Number of results (default: 10, max: 100) |
| after | string | No | Pagination cursor |

**Output:** StatusUpdateListOutput with status updates and pagination

**Behavior:** Read-only, idempotent

**Example:**
```json
{
  "projectId": "PVT_kwDOLhQ7gc4AOEbH",
  "first": 20
}
```

---

### get_status_update

Gets a single status update by its node ID.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| statusUpdateId | string | Yes | Status update node ID |

**Output:** StatusUpdateOutput (or null if not found)

**Behavior:** Read-only, idempotent

**Example:**
```json
{
  "statusUpdateId": "PVTSU_lADOLhQ7gc4AOEbHzM4AOrKa"
}
```

---

## Project Template Tools

Project templates allow organizations to create reusable project structures with views, custom fields, draft issues, workflows, and insights.

### mark_project_as_template

Marks an organization project as a template that can be copied by other users.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project node ID (PVT_...) |

**Output:** TemplateProjectOutput with id, title, isTemplate, url

**Behavior:** Idempotent update operation

**Example:**
```json
{
  "projectId": "PVT_kwDOLhQ7gc4AOEbH"
}
```

---

### unmark_project_as_template

Removes template status from a project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project node ID (PVT_...) |

**Output:** TemplateProjectOutput with id, title, isTemplate=false, url

**Behavior:** Idempotent update operation

**Example:**
```json
{
  "projectId": "PVT_kwDOLhQ7gc4AOEbH"
}
```

---

### copy_project_from_template

Creates a new project by copying from a template. Copies views, custom fields, draft issues (optional), workflows, and insights.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Source template project node ID |
| targetOwner | string | Yes | Organization login for the new project |
| title | string | Yes | Title for the new project |
| includeDraftIssues | boolean | No | Include draft issues from template (default: false) |

**Output:** CopiedProjectOutput with id, title, number, url, createdAt

**Behavior:** Creates new resource (not idempotent)

**Example:**
```json
{
  "projectId": "PVT_kwDOLhQ7gc4AOEbH",
  "targetOwner": "my-organization",
  "title": "Q1 2025 Sprint Board",
  "includeDraftIssues": true
}
```

---

### list_organization_templates

Lists all project templates in an organization.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| org | string | Yes | Organization login |
| first | number | No | Number of templates to return (default: 20, max: 100) |
| after | string | No | Pagination cursor |

**Output:** TemplateListOutput with templates array, pageInfo, totalCount

**Behavior:** Read-only, idempotent

**Example:**
```json
{
  "org": "my-organization",
  "first": 20
}
```

---

## Project Linking Tools

Project linking allows connecting GitHub projects to repositories and teams for better organization and access control.

### link_project_to_repository

Links a GitHub project to a repository. Items from the repository can be added to the project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project node ID (PVT_...) |
| owner | string | Yes | Repository owner (username or organization) |
| repo | string | Yes | Repository name |

**Output:** LinkedRepositoryOutput with id, name, nameWithOwner, url, description

**Behavior:** Idempotent update operation

**Example:**
```json
{
  "projectId": "PVT_kwDOLhQ7gc4AOEbH",
  "owner": "octocat",
  "repo": "hello-world"
}
```

---

### unlink_project_from_repository

Removes a repository linkage from a project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project node ID (PVT_...) |
| owner | string | Yes | Repository owner |
| repo | string | Yes | Repository name |

**Output:** LinkOperationOutput with success, message

**Behavior:** Destructive (removes linkage), idempotent

**Example:**
```json
{
  "projectId": "PVT_kwDOLhQ7gc4AOEbH",
  "owner": "octocat",
  "repo": "hello-world"
}
```

---

### link_project_to_team

Links a GitHub project to a team. Team members will have access to the project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project node ID (PVT_...) |
| org | string | Yes | Organization login |
| teamSlug | string | Yes | Team slug (URL-friendly identifier) |

**Output:** LinkedTeamOutput with id, name, slug, description

**Behavior:** Idempotent update operation

**Example:**
```json
{
  "projectId": "PVT_kwDOLhQ7gc4AOEbH",
  "org": "octocat-org",
  "teamSlug": "engineering"
}
```

---

### unlink_project_from_team

Removes a team linkage from a project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project node ID (PVT_...) |
| org | string | Yes | Organization login |
| teamSlug | string | Yes | Team slug |

**Output:** LinkOperationOutput with success, message

**Behavior:** Destructive (removes linkage), idempotent

**Example:**
```json
{
  "projectId": "PVT_kwDOLhQ7gc4AOEbH",
  "org": "octocat-org",
  "teamSlug": "engineering"
}
```

---

### list_linked_repositories

Lists all repositories linked to a project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project node ID (PVT_...) |
| first | number | No | Number of repositories to return (default: 20, max: 100) |
| after | string | No | Pagination cursor |

**Output:** LinkedRepositoriesListOutput with repositories array, pageInfo, totalCount

**Behavior:** Read-only, idempotent

**Example:**
```json
{
  "projectId": "PVT_kwDOLhQ7gc4AOEbH",
  "first": 20
}
```

---

### list_linked_teams

Lists all teams linked to a project.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project node ID (PVT_...) |
| first | number | No | Number of teams to return (default: 20, max: 100) |
| after | string | No | Pagination cursor |

**Output:** LinkedTeamsListOutput with teams array, pageInfo, totalCount

**Behavior:** Read-only, idempotent

**Example:**
```json
{
  "projectId": "PVT_kwDOLhQ7gc4AOEbH",
  "first": 20
}
```

---

## Project Lifecycle Tools

Project lifecycle tools manage the overall state of GitHub ProjectV2 projects, including closing, reopening, and converting draft issues to real issues.

### close_project

Closes a GitHub ProjectV2. Closed projects are hidden from default views but retain all their data and can be reopened at any time.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project node ID (PVT_...) |

**Output:** ProjectLifecycleOutput with id, title, closed=true, url

**Behavior:** Idempotent update operation (safe to retry)

**Example:**
```json
{
  "projectId": "PVT_kwDOLhQ7gc4AOEbH"
}
```

---

### reopen_project

Reopens a previously closed GitHub ProjectV2. The project becomes visible in default views again with all its data intact.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project node ID (PVT_...) |

**Output:** ProjectLifecycleOutput with id, title, closed=false, url

**Behavior:** Idempotent update operation (safe to retry)

**Example:**
```json
{
  "projectId": "PVT_kwDOLhQ7gc4AOEbH"
}
```

---

### convert_draft_issue

Converts a draft issue in a project to a real GitHub issue in the specified repository. The draft's title and body are preserved in the new issue.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| itemId | string | Yes | ProjectV2Item ID of the draft issue (PVTI_...) |
| owner | string | Yes | Target repository owner (username or organization) |
| repo | string | Yes | Target repository name |

**Output:** ConvertedIssueOutput with itemId, issueId, issueNumber, title, url, repository

**Behavior:** Creates new resource (not idempotent)

**Example:**
```json
{
  "itemId": "PVTI_lADOLhQ7gc4AOEbHzgGF9PM",
  "owner": "my-org",
  "repo": "my-repo"
}
```

---

## Advanced Operations Tools

Advanced operations tools provide powerful search, filtering, and item reordering capabilities for GitHub ProjectV2.

### update_item_position

Reorders an item within a GitHub ProjectV2. Position changes persist across views. If afterId is omitted, the item moves to the first position.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project node ID (PVT_...) |
| itemId | string | Yes | ProjectV2Item ID to move (PVTI_...) |
| afterId | string | No | Item ID to place after (omit to move to first position) |

**Output:** ItemPositionOutput with success, itemId, position

**Behavior:** Idempotent update operation

**Example (move to top):**
```json
{
  "projectId": "PVT_kwDOLhQ7gc4AOEbH",
  "itemId": "PVTI_lADOLhQ7gc4AOEbHzgPYx2Y"
}
```

**Example (move after another item):**
```json
{
  "projectId": "PVT_kwDOLhQ7gc4AOEbH",
  "itemId": "PVTI_lADOLhQ7gc4AOEbHzgPYx2Y",
  "afterId": "PVTI_lADOLhQ7gc4AOEbHzgPYx2Z"
}
```

---

### search_issues_advanced

Searches GitHub issues using advanced query syntax with AND/OR operators. Use explicit 'AND' and 'OR' keywords for complex queries. Supports grouping with parentheses and exclusion with '-' or 'NOT'.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | GitHub search query with AND/OR support |
| first | number | No | Number of results to return (default: 20, max: 100) |
| after | string | No | Pagination cursor |

**Output:** SearchIssuesOutput with totalCount, issues array, pageInfo

**Behavior:** Read-only, idempotent

**Query Examples:**
- `is:issue AND repo:owner/repo AND label:bug`
- `is:issue AND (label:critical OR label:urgent) AND state:open`
- `is:issue AND assignee:@me AND -label:wontfix`

**Example:**
```json
{
  "query": "is:issue AND repo:owner/repo AND (label:bug OR label:critical) AND state:open",
  "first": 50
}
```

---

### filter_project_items

Filters items in a GitHub ProjectV2 by status, labels, assignee, or type. Multiple filter criteria are combined with AND logic.

**Note:** Filtering is performed client-side as GitHub's API does not support server-side filtering for project items. For large projects, this may fetch all items before filtering.

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | string | Yes | Project node ID (PVT_...) |
| filter | object | Yes | Filter criteria (see below) |
| first | number | No | Number of items to return (default: 50, max: 100) |
| after | string | No | Pagination cursor |

**Filter Object:**
| Field | Type | Description |
|-------|------|-------------|
| status | string | Single select field value (e.g., 'In Progress', 'Done') |
| labels | string[] | Label names to match (item must have at least one) |
| assignee | string | Assignee login to match |
| type | "Issue" \| "PullRequest" \| "DraftIssue" | Item content type |

**Output:** FilterProjectItemsOutput with totalCount, filteredCount, items array, pageInfo

**Behavior:** Read-only, idempotent

**Example (filter by status):**
```json
{
  "projectId": "PVT_kwDOLhQ7gc4AOEbH",
  "filter": {
    "status": "In Progress"
  }
}
```

**Example (filter by labels):**
```json
{
  "projectId": "PVT_kwDOLhQ7gc4AOEbH",
  "filter": {
    "labels": ["bug", "critical"]
  }
}
```

**Example (combined filters):**
```json
{
  "projectId": "PVT_kwDOLhQ7gc4AOEbH",
  "filter": {
    "type": "Issue",
    "status": "In Review",
    "assignee": "octocat"
  },
  "first": 50
}
```

---

## AI Enhancement Services (Phase 9)

Phase 9 added advanced AI capabilities for PRD and task generation, including confidence scoring, template customization, validation rules, dependency analysis, and effort estimation.

### Confidence Scoring

The AI generation services now include per-section confidence scoring:

- **ConfidenceScorer**: Calculates multi-factor confidence (0-100) for AI-generated content
  - Input completeness (description length, examples, constraints)
  - AI self-assessment (model's own certainty)
  - Pattern matching (similarity to known successful patterns)

- **Confidence Tiers**:
  - High (70-100): Content is reliable
  - Medium (50-69): Review recommended
  - Low (0-49): Clarifying questions generated

#### Example Usage

```typescript
import { ConfidenceScorer } from './services/ai/ConfidenceScorer';

const scorer = new ConfidenceScorer();
const result = scorer.calculateSectionConfidence({
  sectionId: 'overview',
  sectionName: 'Overview',
  inputData: { description: 'Project description...' },
  aiSelfAssessment: 0.75
});

console.log(`Score: ${result.score}% (${result.tier})`);
if (result.clarifyingQuestions) {
  console.log('Questions:', result.clarifyingQuestions);
}
```

### Template Customization

PRD and task templates support multiple formats:

- **Markdown**: `{{placeholder}}` syntax with sections
- **JSON Schema**: Structured field definitions
- **Example-based**: Learn from sample documents

```typescript
import { TemplateEngine } from './services/templates/TemplateEngine';
import { TemplateParser } from './services/templates/TemplateParser';

const engine = new TemplateEngine();
const template = '# {{title}}\n\n{{list features}}';
const output = engine.render(template, {
  title: 'My Project',
  features: ['Feature 1', 'Feature 2']
});
```

**Custom Helpers:**
- `{{list items}}` - Bullet list
- `{{numbered_list items}}` - Numbered list
- `{{join items ", "}}` - Join with separator
- `{{default value "fallback"}}` - Default value

### PRD Validation

Built-in validation rules check PRD quality against best practices:

- **Completeness Rules** (8 rules):
  - BR-001: Overview required (100+ chars)
  - BR-002: At least 2 objectives
  - BR-003: At least 1 feature
  - BR-004: Success metrics defined
  - BR-005: Target users identified
  - BR-006: Scope defined
  - BR-007: Technical requirements listed
  - BR-008: Timeline provided

- **Clarity Rules** (5 rules):
  - CL-001: Feature descriptions (50+ chars)
  - CL-002: Acceptance criteria present
  - CL-003: No vague language in objectives
  - CL-004: User stories follow format
  - CL-005: Success metrics are measurable

```typescript
import { PRDValidator } from './infrastructure/validation/PRDValidator';

const validator = new PRDValidator();
const results = validator.validate(prd);

console.log(`Score: ${results.score}/100`);
console.log(validator.getValidationSummary(results));
```

### Task Dependency Analysis

Graph-based dependency detection and analysis:

- **Explicit dependencies**: Defined in task relationships
- **Implicit dependencies**: Auto-detected via keyword analysis
- **Analysis outputs**: Execution order, critical path, parallel groups

```typescript
import { DependencyGraph } from './analysis/DependencyGraph';

const graph = new DependencyGraph();
graph.addTasks(tasks);

// Detect implicit dependencies
const implicit = graph.detectImplicitDependencies(0.5);

// Get analysis
const analysis = graph.analyze();
console.log('Execution order:', analysis.executionOrder);
console.log('Critical path:', analysis.criticalPath);
console.log('Parallel groups:', analysis.parallelGroups);
```

**Keyword patterns detected:**
- Infrastructure -> Database -> API -> Frontend -> Integration
- Implementation -> Testing -> Documentation -> Deployment

### Effort Estimation

Calibrated story point estimation with historical learning:

- **Base estimation**: Complexity (1-10) maps to Fibonacci points
- **Calibration**: Learns from actual vs estimated effort
- **Range**: Optimistic/pessimistic estimates with confidence

```typescript
import { EstimationCalibrator } from './analysis/EstimationCalibrator';

const calibrator = new EstimationCalibrator(historicalRecords);

// Get estimate
const estimate = calibrator.estimate({ complexity: 5 });
console.log(`${estimate.points} points (${estimate.confidence}% confident)`);
console.log(`Range: ${estimate.range.low}-${estimate.range.high}`);

// Record actual for future calibration
calibrator.recordActual('task-123', actualPoints);
```

### Integrated Task Generation

The `TaskGenerationService.generateTasksWithAnalysis()` method combines all Phase 9 features:

```typescript
import { TaskGenerationService } from './services/TaskGenerationService';

const service = new TaskGenerationService();
const result = await service.generateTasksWithAnalysis({
  prd: prdDocument,
  projectId: 'my-project',
  confidenceConfig: { warningThreshold: 75 }
});

// Access results
result.tasks.forEach(task => {
  console.log(`${task.title}: ${task.effortEstimate.points} pts`);
  console.log(`  Confidence: ${task.taskConfidence.score}%`);
  console.log(`  Dependencies: ${task.detectedDependencies.length}`);
});

console.log(`Total points: ${result.estimationStats.totalPoints}`);
console.log(`Overall confidence: ${result.overallConfidence.score}%`);
```

---

## Tool Registration

All 109 tools are registered in `src/infrastructure/tools/ToolRegistry.ts`. The registry:

1. Validates tool definitions at registration time
2. Generates MCP-compliant tool descriptors with annotations
3. Converts Zod schemas to JSON Schema for MCP protocol
4. Provides execution handlers for each tool

## Source Files

| Category | Source File |
|----------|-------------|
| Project/Issue/PR/Sprint tools | `src/infrastructure/tools/ToolSchemas.ts` |
| Sub-issue tools | `src/infrastructure/tools/sub-issue-tools.ts` |
| Status update tools | `src/infrastructure/tools/status-update-tools.ts` |
| Template tools | `src/infrastructure/tools/project-template-tools.ts` |
| Linking tools | `src/infrastructure/tools/project-linking-tools.ts` |
| Lifecycle tools | `src/infrastructure/tools/project-lifecycle-tools.ts` |
| Advanced operations tools | `src/infrastructure/tools/project-advanced-tools.ts` |
| AI Task tools | `src/infrastructure/tools/ai-tasks/*.ts` |
| Health tools | `src/infrastructure/tools/health-tools.ts` |
| Tool Registry | `src/infrastructure/tools/ToolRegistry.ts` |
| Output schemas | `src/infrastructure/tools/schemas/*.ts` |
| Behavior annotations | `src/infrastructure/tools/annotations/tool-annotations.ts` |

---

*Generated: 2026-01-31*
*Tool count: 109*
*MCP SDK: 1.25.3*
