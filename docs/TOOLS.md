# MCP Tools Reference

This document provides comprehensive documentation for the 20 compound MCP tools exposed by the MCP GitHub Project Manager. Each compound tool groups related actions behind a single `action` parameter, reducing tool-selection overhead for AI agents while preserving full access to all 169 underlying operations.

> This file is the **reference** for the tool surface. The README links here rather
> than duplicating it.

## Overview

| Metric | Value |
|--------|-------|
| Compound Tools | 20 |
| Total Actions | 169 |
| MCP SDK | `@modelcontextprotocol/server` v2 (2026-07-28 spec) |
| All tools have | Behavior annotations, an `action` parameter, and a JSON Schema input |

### Design: Progressive Disclosure

MCP clients see 20 tools. Each tool accepts an `action` string that routes to the appropriate internal executor. Use `discover_tools` to explore available actions at runtime.

### Behavior Annotations

Annotations are declared **per tool**, not per action — a tool that mixes reads
and writes is annotated for the strongest behaviour it allows.

| Annotation | Meaning | Tools |
|------------|---------|-------|
| `readOnlyHint: true` | The tool only reads | `discover_tools` |
| `destructiveHint: true` | The tool can permanently delete data | `manage_project`, `manage_issues`, `manage_milestones`, `manage_automation`, `manage_branches`, `manage_releases`, `manage_workflows`, `agent_manage` |
| `idempotentHint: true` | Safe to retry | `discover_tools`, `system` |
| `openWorldHint: true` | Makes external calls | every tool that talks to GitHub or an AI provider |

### Error Semantics

A tool that runs and fails returns `{ content, isError: true }` — the model sees
the failure and can recover from it. A JSON-RPC error is reserved for protocol
faults, such as calling a tool that does not exist. Under MCP v2 the server
validates arguments against the declared `inputSchema` **before** the handler
runs, so a malformed call never reaches business logic.

### Tool Selection via `MCP_TOOL_GROUPS`

The `MCP_TOOL_GROUPS` environment variable controls which compound tools are exposed to the MCP client. It filters by **group name** — not by tool name. Set it to a comma-separated list of group names, or `all` (default) to expose everything.

Available group names: `core`, `ai`, `agents`, `events`, `system`.

> A tool name in `MCP_TOOL_GROUPS` (e.g. `manage_issues`) exposes **nothing** —
> the value must be a group name (`core`, `ai`, `agents`, `events`, `system`).

```bash
# Expose only the core project management group
MCP_TOOL_GROUPS=core

# Expose everything (default)
MCP_TOOL_GROUPS=all
```

`discover_tools` is always available regardless of this setting. Every other
tool — including the `system` tool — is subject to the filter.

| Group | Tools in the group |
|-------|--------------------|
| `core` | `manage_project`, `manage_issues`, `manage_prs`, `manage_milestones`, `manage_sprints`, `manage_labels`, `manage_automation`, `manage_iterations`, `manage_status_updates`, `manage_branches`, `manage_releases`, `manage_workflows` |
| `ai` | `ai_generate`, `ai_analyze`, `ai_plan` |
| `agents` | `agent_work`, `agent_manage` |
| `events` | `manage_events` |
| `system` | `system`, `discover_tools` (only `discover_tools` is force-exposed) |

---

## Compound Tools

1. [manage_project](#manage_project) (38 actions)
2. [manage_issues](#manage_issues) (22 actions)
3. [manage_prs](#manage_prs) (7 actions)
4. [manage_milestones](#manage_milestones) (7 actions)
5. [manage_sprints](#manage_sprints) (8 actions)
6. [manage_labels](#manage_labels) (2 actions)
7. [manage_automation](#manage_automation) (3 actions)
8. [manage_iterations](#manage_iterations) (5 actions)
9. [manage_events](#manage_events) (3 actions)
10. [manage_status_updates](#manage_status_updates) (3 actions)
11. [ai_generate](#ai_generate) (9 actions)
12. [ai_analyze](#ai_analyze) (8 actions)
13. [ai_plan](#ai_plan) (6 actions)
14. [agent_work](#agent_work) (12 actions)
15. [agent_manage](#agent_manage) (18 actions)
16. [system](#system) (2 actions)
17. [discover_tools](#discover_tools) (meta-tool)
18. [manage_workflows](#manage_workflows) (6 actions)
19. [manage_releases](#manage_releases) (6 actions)
20. [manage_branches](#manage_branches) (4 actions)

---

## manage_project

Manage GitHub Projects v2: create, configure, and organize projects with fields, views, items, templates, and linking.

**Action enum:** `create` | `list` | `get` | `update` | `delete` | `get_readme` | `update_readme` | `create_field` | `list_fields` | `update_field` | `create_view` | `list_views` | `update_view` | `delete_view` | `add_item` | `remove_item` | `list_items` | `archive_item` | `unarchive_item` | `set_field_value` | `get_field_value` | `clear_field_value` | `close` | `reopen` | `mark_as_template` | `unmark_as_template` | `copy_from_template` | `list_templates` | `link_to_repo` | `unlink_from_repo` | `link_to_team` | `unlink_from_team` | `list_linked_repos` | `list_linked_teams` | `update_item_position` | `filter_items` | `setup_agent_fields` | `set_collaborators`

### Common Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| action | string | Yes | The operation to perform |
| projectId | string | Most actions | Project ID (not required for `create`, `list`, `list_templates`) |

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `create` | `title` (req), `owner` (req), `shortDescription`, `visibility` | Create a new project |
| `list` | `status`, `limit` | List projects |
| `get` | `projectId` (req) | Get project details |
| `update` | `projectId` (req), `title`, `shortDescription`, `visibility`, `closed` | Update project |
| `delete` | `projectId` (req) | Delete project (destructive) |
| `get_readme` | `projectId` (req) | Get project README |
| `update_readme` | `projectId` (req), `readme` (req) | Update project README |
| `create_field` | `projectId` (req), `name` (req), `type` (req), `description`, `options` | Create custom field — `type` is one of `text`, `number`, `date`, `single_select`, `multi_select`, `iteration` |
| `list_fields` | `projectId` (req) | List project fields |
| `update_field` | `projectId` (req), `fieldId` (req), `name`, `options` | Update field |
| `create_view` | `projectId` (req), `name` (req), `layout` (req), `groupByField`, `sortByField`, `filterQuery` | Create view — `layout` is one of `board`, `table`, `roadmap` |
| `list_views` | `projectId` (req), `name`, `viewId` | List views, with the configuration GitHub stores for each view — `name` / `viewId` narrow the result to a single view |
| `update_view` | `projectId` (req), `viewId` (req), `layout` | Update view — `layout` is one of `board`, `table`, `roadmap` |
| `delete_view` | `projectId` (req), `viewId` (req) | Delete view |
| `add_item` | `projectId` (req), `contentId` (req) | Add issue/PR to project |
| `remove_item` | `projectId` (req), `itemId` (req) | Remove item |
| `list_items` | `projectId` (req), `limit` | List project items |
| `archive_item` | `projectId` (req), `itemId` (req) | Archive item |
| `unarchive_item` | `projectId` (req), `itemId` (req) | Unarchive item |
| `set_field_value` | `projectId` (req), `itemId` (req), `fieldId` (req), `value` (req) | Set field value |
| `get_field_value` | `projectId` (req), `itemId` (req), `fieldId` (req) | Get field value |
| `clear_field_value` | `projectId` (req), `itemId` (req), `fieldId` (req) | Clear field value |
| `close` | `projectId` (req) | Close project |
| `reopen` | `projectId` (req) | Reopen project |
| `mark_as_template` | `projectId` (req) | Mark as template |
| `unmark_as_template` | `projectId` (req) | Unmark as template |
| `copy_from_template` | `templateProjectId` (req), `title` (req), `owner` (req) | Copy from template |
| `list_templates` | — | List available templates |
| `link_to_repo` | `projectId` (req), `repoId` (req) | Link project to repo |
| `unlink_from_repo` | `projectId` (req), `repoId` (req) | Unlink from repo |
| `link_to_team` | `projectId` (req), `teamId` (req) | Link to team |
| `unlink_from_team` | `projectId` (req), `teamId` (req) | Unlink from team |
| `list_linked_repos` | `projectId` (req) | List linked repos |
| `list_linked_teams` | `projectId` (req) | List linked teams |
| `update_item_position` | `projectId` (req), `itemId` (req), `position` (req) | Reorder item |
| `filter_items` | `projectId` (req), `filterQuery` (req) | Filter items |
| `setup_agent_fields` | `projectId` (req) | Provision agent orchestration fields |
| `set_collaborators` | `projectId` (req), `collaborators` (req), `org` | Set the roles of a project's collaborators — one entry per user or team |

### Field Types and View Layouts

The values below are the ones GitHub's GraphQL API accepts — the tool schemas
enumerate them, so an unsupported value is rejected before the call is made.

**Field types** (`create_field` → `type`):

| Value | GraphQL type | Notes |
|-------|--------------|-------|
| `text` | `TEXT` | Plain text |
| `number` | `NUMBER` | Numeric |
| `date` | `DATE` | `YYYY-MM-DD` |
| `single_select` | `SINGLE_SELECT` | One option; pass `options` |
| `multi_select` | `MULTI_SELECT` | Several options; pass `options` |
| `iteration` | `ITERATION` | Sprint/iteration field |

These are exactly the members of GitHub's `ProjectV2CustomFieldType`. The
other project fields — **Assignees, Labels, Milestone, Repository, Tracked
by, Tracks** — are built-in fields that GitHub adds to every project
itself; the API cannot create them, so they are not offered here.

**View layouts** (`create_view` / `update_view` → `layout`):

| Value | GraphQL layout |
|-------|----------------|
| `board` | `BOARD_LAYOUT` |
| `table` | `TABLE_LAYOUT` |
| `roadmap` | `ROADMAP_LAYOUT` |

These are exactly the members of GitHub's `ProjectV2ViewLayout`. There is no
timeline layout.

### Project Access (`set_collaborators`)

`set_collaborators` sets the role of a project's collaborators through
GitHub's native `updateProjectV2Collaborators` mutation. Each entry names
one actor and the role it should hold:

```json
{"tool": "manage_project", "arguments": {"action": "set_collaborators", "projectId": "PVT_kwDOAB...", "collaborators": [{"userLogin": "octocat", "role": "WRITER"}, {"teamSlug": "platform", "role": "READER"}]}}
```

- `userLogin` or `teamSlug` — exactly one of the two per entry. `org` is the
  organization that owns the team; it defaults to the configured owner.
- `role` — one of `ADMIN`, `WRITER`, `READER`, `NONE`, exactly the members
  of GitHub's `ProjectV2Roles` enum. `NONE` takes the access away.

The roles are exactly the members of GitHub's `ProjectV2Roles` enum, so no
other value is accepted. The answer lists the project's collaborators — the
users and teams that have access — with the role that was granted for the
ones this call touched. GitHub has no read path for collaborator roles
(`ProjectV2` has no `collaborators` field), so a role that was not granted
by this call comes back unknown rather than guessed.

### Views as Server-Side Pools (`list_views`)

`list_views` answers with the configuration GitHub stores for each view:

| Field | GitHub field | Meaning |
|-------|--------------|---------|
| `filter` | `ProjectV2View.filter` | The server-side filter expression the view selects its items with (`null` when the view has none) |
| `groupByFields` | `ProjectV2View.groupByFields` | The names of the fields the view groups by, in order |
| `sortBy` | `ProjectV2View.sortByFields` | The fields the view sorts by, with the direction of each (`ASC` / `DESC`) |
| `visibleFields` | `ProjectV2View.configuration.visibleFields` | The names of the fields the view shows, in configured order |

Because the filter lives in GitHub, a named view is a pool the server
selects from: pass `name` (or `viewId`) to get the configuration of that
one view.

### Examples

```json
// Create a project
{"tool": "manage_project", "arguments": {"action": "create", "title": "Backend API", "owner": "myorg", "visibility": "public"}}

// List projects
{"tool": "manage_project", "arguments": {"action": "list", "status": "active", "limit": 20}}

// Create a custom field
{"tool": "manage_project", "arguments": {"action": "create_field", "projectId": "PVT_kwDOAB...", "name": "Priority", "type": "single_select", "options": [{"name": "P0", "color": "red"}, {"name": "P1", "color": "yellow"}, {"name": "P2", "color": "green"}]}}
```

---

## manage_issues

Manage GitHub issues: CRUD, comments, draft issues, advanced search, and sub-issue hierarchy.

**Action enum:** `create` | `list` | `get` | `update` | `create_comment` | `update_comment` | `delete_comment` | `list_comments` | `create_draft` | `update_draft` | `delete_draft` | `convert_draft` | `search_advanced` | `add_sub_issue` | `list_sub_issues` | `get_parent_issue` | `reprioritize_sub_issue` | `remove_sub_issue`

### Common Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| action | string | Yes | The operation to perform |
| owner | string | Most | Repository owner |
| repo | string | Most | Repository name |

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `create` | `title` (req), `body`, `labels`, `assignees`, `milestone` | Create issue |
| `list` | `state`, `labels`, `milestone`, `assignee`, `limit` | List issues |
| `get` | `issueNumber` (req) | Get issue details |
| `update` | `issueNumber` (req), `title`, `body`, `state`, `labels`, `assignees`, `milestone` | Update issue |
| `create_comment` | `issueNumber` (req), `body` (req) | Add comment |
| `update_comment` | `commentId` (req), `body` (req) | Update comment |
| `delete_comment` | `commentId` (req) | Delete comment (destructive) |
| `list_comments` | `issueNumber` (req) | List comments |
| `create_draft` | `projectId` (req), `title` (req), `body` | Create draft issue |
| `update_draft` | `projectId` (req), `draftId` (req), `title`, `body` | Update draft |
| `delete_draft` | `projectId` (req), `draftId` (req) | Delete draft |
| `convert_draft` | `projectId` (req), `draftId` (req), `repositoryId` (req) | Convert draft to issue |
| `search_advanced` | `query` (req), `limit` | Advanced search |
| `add_sub_issue` | `issueNumber` (req), `subIssueNumber` (req) | Add sub-issue |
| `list_sub_issues` | `issueNumber` (req) | List sub-issues |
| `get_parent_issue` | `issueNumber` (req) | Get parent issue |
| `reprioritize_sub_issue` | `issueNumber` (req), `subIssueNumber` (req), `position` (req) | Reorder sub-issue |
| `remove_sub_issue` | `issueNumber` (req), `subIssueNumber` (req) | Remove sub-issue |
| `list_dependencies` | `issueId` (req), `dependencyDirection` | The native "blocked by" edges — `blocked_by` (default) lists the issues that block this one, `blocking` the ones it blocks |
| `add_blocker` | `issueId` (req), `blockingIssueId` (req) | Make an issue blocked by another one (native edge) |
| `remove_blocker` | `issueId` (req), `blockingIssueId` (req) | Remove a native "blocked by" edge |
| `list_issue_types` | — | The issue types the organization defines (native issue types) |

### Examples

```json
// Create an issue
{"tool": "manage_issues", "arguments": {"action": "create", "title": "Fix auth bug", "body": "Users cannot log in", "labels": ["bug"], "assignees": ["dev1"]}}

// List open issues
{"tool": "manage_issues", "arguments": {"action": "list", "state": "open", "limit": 50}}

// Add a sub-issue
{"tool": "manage_issues", "arguments": {"action": "add_sub_issue", "issueNumber": 10, "subIssueNumber": 15}}
```

---

## manage_prs

Manage pull requests: create, list, update, merge, and review.

**Action enum:** `create` | `get` | `list` | `update` | `merge` | `list_reviews` | `create_review`

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `create` | `title` (req), `head` (req), `base` (req), `body`, `draft` | Create PR |
| `get` | `pullNumber` (req) | Get PR details |
| `list` | `state`, `head`, `base`, `limit` | List PRs |
| `update` | `pullNumber` (req), `title`, `body`, `state` | Update PR |
| `merge` | `pullNumber` (req), `mergeMethod`, `commitTitle` | Merge PR |
| `list_reviews` | `pullNumber` (req) | List reviews |
| `create_review` | `pullNumber` (req), `event` (req), `body`, `comments` | Create review |

### Examples

```json
// Create a PR
{"tool": "manage_prs", "arguments": {"action": "create", "title": "Add login form", "head": "feat/login", "base": "main", "body": "Implements #42"}}

// List open PRs
{"tool": "manage_prs", "arguments": {"action": "list", "state": "open"}}

// Merge a PR
{"tool": "manage_prs", "arguments": {"action": "merge", "pullNumber": 99, "mergeMethod": "squash"}}
```

---

## manage_milestones

Manage milestones: CRUD, metrics, and deadline tracking.

**Action enum:** `create` | `list` | `update` | `delete` | `get_metrics` | `get_overdue` | `get_upcoming`

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `create` | `title` (req), `description`, `dueDate`, `state` | Create milestone |
| `list` | `state`, `limit` | List milestones |
| `update` | `milestoneNumber` (req), `title`, `description`, `dueDate`, `state` | Update milestone |
| `delete` | `milestoneNumber` (req) | Delete milestone (destructive) |
| `get_metrics` | `milestoneNumber` (req) | Get milestone metrics |
| `get_overdue` | — | List overdue milestones |
| `get_upcoming` | `days` | List upcoming milestones |

### Examples

```json
// Create a milestone
{"tool": "manage_milestones", "arguments": {"action": "create", "title": "v2.0 Release", "dueDate": "2026-09-01"}}

// List milestones
{"tool": "manage_milestones", "arguments": {"action": "list", "state": "open"}}

// Get metrics
{"tool": "manage_milestones", "arguments": {"action": "get_metrics", "milestoneNumber": 3}}
```

---

## manage_sprints

Manage sprints: create, plan, track progress, and analyze velocity.

**Action enum:** `create` | `list` | `get_current` | `update` | `add_issues` | `remove_issues` | `get_metrics` | `plan`

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `create` | `title` (req), `startDate` (req), `endDate` (req), `goals` | Create sprint |
| `list` | `status`, `limit` | List sprints |
| `get_current` | — | Get the current active sprint |
| `update` | `sprintId` (req), `title`, `status`, `goals` | Update sprint |
| `add_issues` | `sprintId` (req), `issueNumbers` (req) | Add issues to sprint |
| `remove_issues` | `sprintId` (req), `issueNumbers` (req) | Remove issues from sprint |
| `get_metrics` | `sprintId` (req) | Get sprint metrics (velocity, burndown) |
| `plan` | `sprintId` (req), `capacity`, `teamSkills` | AI-assisted sprint planning |

### Examples

```json
// Create a sprint
{"tool": "manage_sprints", "arguments": {"action": "create", "title": "Sprint 5", "startDate": "2026-08-04", "endDate": "2026-08-18"}}

// List sprints
{"tool": "manage_sprints", "arguments": {"action": "list", "status": "active"}}

// Plan a sprint with AI
{"tool": "manage_sprints", "arguments": {"action": "plan", "sprintId": "sprint-5", "capacity": 40, "teamSkills": ["typescript", "react"]}}
```

---

## manage_labels

Manage repository labels.

**Action enum:** `create` | `list`

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `create` | `name` (req), `color`, `description` | Create label |
| `list` | `limit` | List labels |

### Examples

```json
// Create a label
{"tool": "manage_labels", "arguments": {"action": "create", "name": "priority:high", "color": "ff0000", "description": "High priority issues"}}

// List labels
{"tool": "manage_labels", "arguments": {"action": "list"}}
```

---

## manage_automation

Manage project automations: list, read and delete the automation workflows of a GitHub project.

Workflows are GitHub `ProjectV2Workflow` objects. The Projects API exposes them read-only apart from
deletion - they are authored in the GitHub UI - so there is no create, update, enable or disable action.

**Action enum:** `list_workflows` | `get_workflow` | `delete_workflow`

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `list_workflows` | `projectId` (req) | List the workflows of a project |
| `get_workflow` | `workflowId` (req) | Get workflow details |
| `delete_workflow` | `workflowId` (req) | Delete workflow (destructive) |

### Examples

```json
// List the workflows of a project
{"tool": "manage_automation", "arguments": {"action": "list_workflows", "projectId": "PVT_kwDOAB..."}}

// Get one workflow
{"tool": "manage_automation", "arguments": {"action": "get_workflow", "workflowId": "PVW_kwDOAB..."}}

// Delete a workflow
{"tool": "manage_automation", "arguments": {"action": "delete_workflow", "workflowId": "PVW_kwDOAB..."}}
```

---

## manage_iterations

Manage project iteration fields: configuration, current iteration, and item assignment.

**Action enum:** `get_config` | `get_current` | `get_items` | `get_by_date` | `assign_items`

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `get_config` | `projectId` (req), `fieldId` (req) | Get iteration field configuration |
| `get_current` | `projectId` (req), `fieldId` (req) | Get current active iteration |
| `get_items` | `projectId` (req), `fieldId` (req), `iterationId` (req) | Get items in an iteration |
| `get_by_date` | `projectId` (req), `fieldId` (req), `date` (req) | Find iteration by date |
| `assign_items` | `projectId` (req), `fieldId` (req), `iterationId` (req), `itemIds` (req) | Assign items to iteration |

### Examples

```json
// Get current iteration
{"tool": "manage_iterations", "arguments": {"action": "get_current", "projectId": "PVT_kwDOAB...", "fieldId": "PVTF_..."}}

// Get items in an iteration
{"tool": "manage_iterations", "arguments": {"action": "get_items", "projectId": "PVT_kwDOAB...", "fieldId": "PVTF_...", "iterationId": "iter-1"}}

// Assign items
{"tool": "manage_iterations", "arguments": {"action": "assign_items", "projectId": "PVT_kwDOAB...", "fieldId": "PVTF_...", "iterationId": "iter-1", "itemIds": ["PVTI_1", "PVTI_2"]}}
```

---

## manage_events

Manage project events: subscribe to event types, query recent events, and replay event history.

**Action enum:** `subscribe` | `get_recent` | `replay`

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `subscribe` | `eventTypes` (req), `callback` | Subscribe to events |
| `get_recent` | `limit`, `eventType` | Get recent events |
| `replay` | `fromTimestamp`, `toTimestamp`, `eventType` | Replay event history |

### Examples

```json
// Get recent events
{"tool": "manage_events", "arguments": {"action": "get_recent", "limit": 20, "eventType": "issue_created"}}

// Subscribe to events
{"tool": "manage_events", "arguments": {"action": "subscribe", "eventTypes": ["issue_created", "pr_merged"]}}

// Replay events
{"tool": "manage_events", "arguments": {"action": "replay", "fromTimestamp": "2026-08-01T00:00:00Z", "eventType": "issue_created"}}
```

---

## manage_status_updates

Create and manage project status updates.

**Action enum:** `create` | `list` | `get`

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `create` | `projectId` (req), `status` (req), `body` (req), `startDate`, `targetDate` | Create status update |
| `list` | `projectId` (req), `limit` | List status updates |
| `get` | `statusUpdateId` (req) | Get status update |

### Examples

```json
// Create a status update
{"tool": "manage_status_updates", "arguments": {"action": "create", "projectId": "PVT_kwDOAB...", "status": "ON_TRACK", "body": "Sprint 5 progressing well, 80% of stories complete"}}

// List status updates
{"tool": "manage_status_updates", "arguments": {"action": "list", "projectId": "PVT_kwDOAB...", "limit": 10}}

// Get a status update
{"tool": "manage_status_updates", "arguments": {"action": "get", "statusUpdateId": "PSU_123"}}
```

---

## ai_generate

AI-powered generation: PRDs, task breakdowns, feature addition, and traceability matrices.

**Action enum:** `generate_prd` | `enhance_prd` | `parse_prd` | `add_feature` | `get_next_task` | `analyze_complexity` | `expand_task` | `create_traceability_matrix` | `materialize_tasks`

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `generate_prd` | `projectIdea` (req), `projectName`, `author`, `complexity`, `timeline`, `includeResearch` | Generate PRD from idea |
| `enhance_prd` | `prdContent` (req), `focusAreas` | Enhance existing PRD |
| `parse_prd` | `prdContent` (req), `maxTasks`, `createTraceabilityMatrix`, `includeUseCases`, `projectId` | Parse PRD into tasks |
| `add_feature` | `featureIdea` (req), `description`, `requestedBy`, `businessJustification`, `targetUsers`, `autoApprove`, `expandToTasks` | Add feature with impact analysis |
| `get_next_task` | `sprintCapacity`, `teamSkills`, `maxComplexity`, `includeAnalysis` | AI-powered next task recommendation |
| `analyze_complexity` | `taskTitle` (req), `taskDescription`, `teamExperience`, `includeBreakdown`, `includeRisks` | Analyze task complexity |
| `expand_task` | `taskTitle` (req), `taskDescription`, `currentComplexity`, `targetComplexity`, `includeEstimates`, `includeDependencies` | Break down complex task |
| `create_traceability_matrix` | `projectId` (req), `prdContent`, `features`, `tasks`, `validateCompleteness` | Create requirements traceability matrix |
| `materialize_tasks` | `projectId` (req), `labelPrefix`, `prdContent`, `tasks` (array of {id, title, description, complexity, estimatedHours, priority, dependencies, acceptanceCriteria, tags}) | Materialize AI-generated tasks into GitHub issues grouped into milestones/sprints with dependency-driven phase ordering |

### Examples

```json
// Generate a PRD
{"tool": "ai_generate", "arguments": {"action": "generate_prd", "projectIdea": "AI-powered task management with real-time collaboration", "projectName": "TaskAI Pro", "complexity": "high"}}

// Parse PRD into tasks
{"tool": "ai_generate", "arguments": {"action": "parse_prd", "prdContent": "...", "maxTasks": 30, "createTraceabilityMatrix": true}}

// Analyze task complexity
{"tool": "ai_generate", "arguments": {"action": "analyze_complexity", "taskTitle": "Implement WebSocket collaboration", "includeRisks": true}}
```

```json
// Materialize tasks into project hierarchy
{"tool": "ai_generate", "arguments": {"action": "materialize_tasks", "projectId": "PVT_...", "labelPrefix": "sprint-1", "tasks": [{"id": "t1", "title": "Setup project", "description": "Initialize", "priority": "high", "dependencies": []}]}}
```

---

## ai_analyze

AI-powered analysis: issue enrichment, triage, label suggestions, and duplicate detection.

**Action enum:** `enrich_issue` | `enrich_issue_sections` | `enrich_bulk` | `triage_issue` | `triage_all` | `suggest_labels` | `detect_duplicates` | `find_related`

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `enrich_issue` | `issueTitle` (req), `issueDescription`, `projectContext`, `autoApply` | AI-enrich a single issue (labels, priority, type, complexity, effort) |
| `enrich_issue_sections` | `issueTitle` (req), `issueDescription`, `projectContext`, `repositoryLabels` | Enrich an issue into structured sections (Problem / Solution / Context / Impact / AcceptanceCriteria) with per-section confidence |
| `enrich_bulk` | `issueIds` (req) | Bulk enrich multiple issues |
| `triage_issue` | `issueTitle` (req), `issueDescription`, `projectContext` | AI triage a single issue |
| `triage_all` | `projectId`, `onlyUntriaged` | Triage all untriaged issues |
| `suggest_labels` | `issueTitle` (req), `issueDescription`, `existingLabels` (req), `issueHistory`, `config` | Suggest labels for an issue |
| `detect_duplicates` | `issueTitle` (req), `issueDescription`, `existingIssues` (req), `thresholds`, `maxResults` | Detect duplicate issues |
| `find_related` | `issueId` (req), `issueTitle` (req), `issueDescription`, `repositoryIssues` (req), `issueLabels`, `relationConfig` | Find related issues |

> A missing required parameter is reported as a tool error naming it, e.g.
> `existingLabels is required for suggest_labels` — the compound schema is flat,
> so per-action requirements are enforced by the action, not by the schema.

### Examples

```json
// Enrich an issue with AI
{"tool": "ai_analyze", "arguments": {"action": "enrich_issue", "issueNumber": 42}}

// Rewrite an issue into structured sections with confidence scores
{"tool": "ai_analyze", "arguments": {"action": "enrich_issue_sections", "issueTitle": "Add OAuth login", "issueDescription": "Users need SSO"}}

// Triage all untriaged issues
{"tool": "ai_analyze", "arguments": {"action": "triage_all", "limit": 50}}

// Detect duplicate issues
{"tool": "ai_analyze", "arguments": {"action": "detect_duplicates", "issueNumber": 42}}
```

---

## ai_plan

AI-powered planning: capacity analysis, backlog prioritization, risk assessment, sprint composition, and roadmap generation.

**Action enum:** `calculate_capacity` | `prioritize_backlog` | `assess_risk` | `suggest_composition` | `generate_roadmap` | `generate_visualization`

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `calculate_capacity` | `velocity`, `sprintDurationDays`, `teamMembers` (req), `historicalSprints` | Calculate sprint capacity |
| `prioritize_backlog` | `backlogItems` (req), `sprintCapacity`, `businessGoals`, `riskTolerance` | AI-prioritize the backlog |
| `assess_risk` | `sprintItems` (req), `capacity`, `dependencies` | Assess sprint risk |
| `suggest_composition` | `backlogItems` (req), `velocity`, `sprintDurationDays`, `teamMembers`, `businessGoals`, `riskTolerance` | Suggest sprint composition |
| `generate_roadmap` | `requirements` (req), `constraints`, `businessContext` — or `projectId` (+ `projectTitle`, `autoCreate`) to plan from an existing project and create the milestones | Generate project roadmap |
| `generate_visualization` | `roadmap` (req) | Generate visualization data |

`teamMembers[]` accepts `name`, `availabilityPercent` (0-100), `skills` and the
optional `role`, `timezone`, `hoursPerDay`, `daysOff`; `historicalSprints[]`
accepts `sprintId`, `name`, `startDate`, `endDate`, `plannedPoints`,
`completedPoints`.

### Examples

```json
// Calculate sprint capacity
{"tool": "ai_plan", "arguments": {"action": "calculate_capacity", "velocity": 20, "sprintDurationDays": 14, "teamMembers": [{"name": "ada", "availabilityPercent": 80, "skills": ["typescript"]}]}}

// Prioritize backlog
{"tool": "ai_plan", "arguments": {"action": "prioritize_backlog", "backlogItems": [{"id": "1", "title": "Fix login", "points": 3}], "sprintCapacity": 20, "businessGoals": ["ship v1"]}}

// Plan a roadmap for an existing project and create its milestones
{"tool": "ai_plan", "arguments": {"action": "generate_roadmap", "projectId": "PVT_kwDOAB...", "autoCreate": true}}
```

---

## agent_work

Agent task lifecycle: register, check out tasks, report progress, and complete work.

**Action enum:** `register` | `checkout_task` | `release_task` | `complete_task` | `heartbeat` | `check_work_status` | `get_task_context` | `submit_for_review` | `approve_task` | `reject_task` | `validate_work_product` | `get_handoff_context`

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `register` | `name` (req), `role` (req), `runtime`, `capabilities`, `parentAgentId` | Register an AI agent |
| `checkout_task` | `agentId` (req), `strategy`, `labels`, `projectId`, `view`, `skipBlocked`, `reviewQueue` | Claim next available task (strategies: `highest_priority` (default), `oldest_first`, `skills_match`, `milestone_deadline`, `ai`; `skipBlocked: true` skips tasks with open blockers; `reviewQueue: true` claims from the review queue for reviewers; `view` claims from a named project view — the view's own order decides which task is handed out first) |
| `release_task` | `agentId` (req), `taskId` (req), `reason` | Return task to pool |
| `complete_task` | `agentId` (req), `taskId` (req), `summary` (req) | Mark task completed |
| `heartbeat` | `agentId` (req), `status`, `taskId`, `progress`, `progressSummary`, `currentBranch`, `blockers` | Report liveness and progress. Written to the claimed project item (`agent_heartbeat_at`, `agent_progress`, `agent_work_branch`), not committed to the registry. A project missing any `agent_*` field is provisioned additively on first use (same for `checkout_task`); if the token cannot create fields the call errors with a `setup_fields` / project-admin message. Errors too if the agent no longer holds the claim. No history is kept. |
| `check_work_status` | `agentId` (req), `taskId` (req) | Check PR review/merge status |
| `get_task_context` | `issueNumber` (req) | Get enriched task context (incl. AI suggestions when configured) |
| `submit_for_review` | `agentId` (req), `taskId` (req), `summary` | Move a task into the review queue |
| `approve_task` | `reviewerId` (req), `taskId` (req), `summary` | Approve a reviewed task (completes + closes) |
| `reject_task` | `reviewerId` (req), `taskId` (req), `feedback` | Reject a reviewed task (returns to pool with feedback) |
| `validate_work_product` | `agentId` (req), `taskId` (req) | Inspect work product against acceptance criteria — returns findings + recommendation (approve/reject/needs_work) |
| `get_handoff_context` | `taskId` (req) | Cross-agent context for subtasks: parent issue, prior work product, rejection feedback, acceptance criteria |

### Examples

```json
// Register an agent
{"tool": "agent_work", "arguments": {"action": "register", "name": "claude-eng-1", "role": "engineer", "runtime": "claude-code", "capabilities": ["typescript", "react"]}}

// Check out a task
{"tool": "agent_work", "arguments": {"action": "checkout_task", "agentId": "agent-abc123", "strategy": "highest_priority"}}

// Send a heartbeat
{"tool": "agent_work", "arguments": {"action": "heartbeat", "agentId": "agent-abc123", "status": "working", "taskId": "issue-42", "progress": 60, "progressSummary": "Tests passing, working on edge cases"}}

// Validate a work product against acceptance criteria
{"tool": "agent_work", "arguments": {"action": "validate_work_product", "agentId": "reviewer-agent-1", "taskId": "issue-42"}}

// Get handoff context for a subtask
{"tool": "agent_work", "arguments": {"action": "get_handoff_context", "taskId": "issue-43"}}
```

---

## agent_manage

Agent administration: list agents, manage budgets, view activity, submit work products, redistribute work, and drive PM convergence.

**Action enum:** `list` | `deregister` | `get_activity` | `submit_work_product` | `get_budget` | `set_budget` | `reclaim_stale` | `record_usage` | `get_metrics` | `setup_fields` | `assign_task` | `get_swarm_status` | `rebalance_workload` | `decompose_task` | `smart_assign` | `converge_project` | `converge_until_done` | `cleanup_registry`

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `list` | `role`, `status` | List registered agents |
| `deregister` | `agentId` (req) | Remove agent (cascades to children) |
| `get_activity` | `agentId` | Get agent activity dashboard: `lastHeartbeat` (newer of the claimed item's `agent_heartbeat_at` and the registry beat), `heartbeatSource` (`project_item` \| `registry`), `currentTask.progress`/`branch`. `heartbeatHistory` is no longer returned. |
| `submit_work_product` | `agentId` (req), `taskId` (req), `issueNumber` (req), `branch`, `prNumber`, `commitShas`, `filesChanged`, `testsPassed`, `testsFailed`, `testsTotal`, `summary` | Submit work product |
| `get_budget` | `agentId` (req) | Check token budget status |
| `set_budget` | `agentId` (req), `totalTokens` (req), `warningFraction` or `warningThreshold`, `hardStop`, `resetPeriod` | Configure token budget (`warningThreshold` is accepted as a compatibility alias for `warningFraction`) |
| `reclaim_stale` | `timeoutMinutes` | Reclaim tasks from agents with stale heartbeats (default 30 min). Also run automatically by the server-side **auto-reclaim scheduler** (see below). |
| `record_usage` | `agentId` (req), `tokensUsed` (req) | Report token usage against an agent's budget |
| `get_metrics` | `staleAfterMinutes` | Aggregate + per-agent metrics (throughput, cycle time, budget burn, staleness) |
| `setup_fields` | `projectId` (req) | Idempotently provision the agent orchestration fields (`agent_claimed_by`, `agent_claimed_at`, `agent_status`, `agent_work_branch`, `agent_pr_number`) on a project |
| `assign_task` | `agentId` (req), `projectId` (req), `issueNumber` (req) | PM assigns a specific issue to a specific agent, bypassing self-service checkout |
| `get_swarm_status` | `staleAfterMinutes` | Dashboard of all agents: tasks, heartbeats, budgets, blocked/stale detection |
| `rebalance_workload` | `projectId` (req), `staleAfterMinutes`, `agentIds`, `roleFilter`, `maxAssignments` | Reclaim stale work, then redistribute available project tasks to eligible idle agents via smart assignment |
| `decompose_task` | `projectId` (req), `issueNumber` (req), `subtasks` (req: array of {title, description, acceptanceCriteria?}) | PM splits a rejected task into sub-issues linked to parent |
| `smart_assign` | `projectId` (req), `agentIds`, `roleFilter`, `maxAssignments` | Capability-matched, budget-aware task assignment |
| `converge_project` | `projectId` (req), `reviewerId` | Auto-approve passing work and auto-reject failing work through normal lifecycle cleanup when `reviewerId` is supplied; otherwise applies equivalent claim/status cleanup before fallback comments |
| `converge_until_done` | `projectId` (req), `iteration`, `maxIterations` | Multi-iteration convergence: progress report + next actions |
| `cleanup_registry` | `staleAfterMinutes` | Remove stale agents with no heartbeat |

> **Auto-reclaim scheduler:** the server runs a background sweep every
> `AGENT_RECLAIM_INTERVAL_MS` (default 5 min, enabled by default) that reclaims
> tasks from agents whose heartbeat is older than `AGENT_STALE_AFTER_MINUTES`
> (default 30) and marks those agents `offline`. Each reclamation is recorded as
> an audit comment on the issue. Disable with `AGENT_RECLAIM_ENABLED=false` or
> `AGENT_RECLAIM_INTERVAL_MS=0`. This is what makes the swarm self-healing — a
> crashed harness no longer blocks a task forever.

### Examples

```json
// List all agents
{"tool": "agent_manage", "arguments": {"action": "list"}}

// Submit work product
{"tool": "agent_manage", "arguments": {"action": "submit_work_product", "agentId": "agent-abc123", "taskId": "issue-42", "issueNumber": 42, "branch": "feat/42-login", "prNumber": 99, "summary": "Added login form"}}

// Set agent budget
{"tool": "agent_manage", "arguments": {"action": "set_budget", "agentId": "agent-abc123", "totalTokens": 500000, "warningFraction": 0.8, "hardStop": true, "resetPeriod": "daily"}}
// Compatibility alias for older clients
{"tool": "agent_manage", "arguments": {"action": "set_budget", "agentId": "agent-abc123", "totalTokens": 500000, "warningThreshold": 0.8}}
```

```json
// PM assigns issue #42 to an agent
{"tool": "agent_manage", "arguments": {"action": "assign_task", "agentId": "agent-abc123", "projectId": "PVT_...", "issueNumber": 42}}

// Check swarm status
{"tool": "agent_manage", "arguments": {"action": "get_swarm_status"}}
```

```json
// Capability-matched, budget-aware assignment
{"tool": "agent_manage", "arguments": {"action": "smart_assign", "projectId": "PVT_kwDOAB...", "roleFilter": "engineer", "maxAssignments": 5}}

// Converge a project: auto-approve, auto-reject, auto-decompose
{"tool": "agent_manage", "arguments": {"action": "converge_project", "projectId": "PVT_kwDOAB..."}}
```

---

## discover_tools

Meta-tool for runtime tool discovery. Returns available compound tools, their actions, and parameter schemas. Always available regardless of `MCP_TOOL_GROUPS` setting.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| group | string | No | Filter by a specific compound tool name |
| action | string | No | Get detailed schema for a specific action within a group |
| includeSchemas | boolean | No | Include full parameter schemas in response (default: false) |

### Examples

```json
// List all available compound tools
{"tool": "discover_tools", "arguments": {}}

// List actions for a specific tool
{"tool": "discover_tools", "arguments": {"group": "manage_issues"}}

// Get full schema for a specific action
{"tool": "discover_tools", "arguments": {"group": "manage_issues", "action": "create", "includeSchemas": true}}
```

---

## manage_workflows

Manage GitHub Actions workflows: list, trigger, monitor runs, and download logs.

**Action enum:** `list_workflows` | `trigger_dispatch` | `get_run` | `list_runs` | `get_run_logs` | `cancel_run`

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `list_workflows` | `owner`, `repo` | List repository workflows |
| `trigger_dispatch` | `workflowId` (req), `ref` (req), `inputs` | Trigger a workflow dispatch |
| `get_run` | `runId` (req) | Get workflow run details |
| `list_runs` | `workflowId` (req), `status`, `branch` | List workflow runs |
| `get_run_logs` | `runId` (req) | Download workflow run logs URL |
| `cancel_run` | `runId` (req) | Cancel a running workflow (destructive) |

### Examples

```json
// List repository workflows
{"tool": "manage_workflows", "arguments": {"action": "list_workflows"}}

// Trigger a workflow dispatch
{"tool": "manage_workflows", "arguments": {"action": "trigger_dispatch", "workflowId": "ci.yml", "ref": "main", "inputs": {"environment": "staging"}}}

// Get a workflow run's status
{"tool": "manage_workflows", "arguments": {"action": "get_run", "runId": 123456789}}

// List recent failed runs and cancel one
{"tool": "manage_workflows", "arguments": {"action": "list_runs", "workflowId": "ci.yml", "status": "in_progress"}}
{"tool": "manage_workflows", "arguments": {"action": "cancel_run", "runId": 123456789}}
```

---

## manage_releases

Manage GitHub releases: create, update, delete, and query releases.

**Action enum:** `create` | `list` | `get` | `update` | `delete` | `get_latest`

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `create` | `tag_name` (req), `name`, `body`, `draft`, `prerelease`, `target_commitish`, `generate_release_notes` | Create release |
| `list` | `owner`, `repo` | List releases |
| `get` | `releaseId` (req) | Get release details |
| `update` | `releaseId` (req), `tag_name`, `name`, `body`, `draft`, `prerelease` | Update release |
| `delete` | `releaseId` (req) | Delete release (destructive) |
| `get_latest` | — | Get the latest release |

### Examples

```json
// Create a release with auto-generated notes
{"tool": "manage_releases", "arguments": {"action": "create", "tag_name": "v2.1.0", "name": "v2.1.0", "generate_release_notes": true}}

// List releases
{"tool": "manage_releases", "arguments": {"action": "list"}}

// Update a release to remove draft status
{"tool": "manage_releases", "arguments": {"action": "update", "releaseId": 123456, "draft": false}}

// Get the latest release
{"tool": "manage_releases", "arguments": {"action": "get_latest"}}
```

---

## manage_branches

Manage branches and branch protection rules.

**Action enum:** `get_protection` | `update_protection` | `delete_protection` | `list_branches`

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `get_protection` | `branch` (req) | Get branch protection rules |
| `update_protection` | `branch` (req), `required_status_checks`, `enforce_admins`, `required_pull_request_reviews`, `restrictions` | Update protection |
| `delete_protection` | `branch` (req) | Delete branch protection (destructive) |
| `list_branches` | `owner`, `repo` | List repository branches |

### Examples

```json
// Get branch protection rules
{"tool": "manage_branches", "arguments": {"action": "get_protection", "branch": "main"}}

// Require 2 approving reviews and admin enforcement
{"tool": "manage_branches", "arguments": {"action": "update_protection", "branch": "main", "enforce_admins": true, "required_pull_request_reviews": {"required_approving_review_count": 2}}}

// List repository branches
{"tool": "manage_branches", "arguments": {"action": "list_branches"}}
```

---

## system

Infrastructure operations exposed by the `system` group.

**Action enum:** `health_check` | `setup_project_fields`

| Action | Description |
|--------|-------------|
| `health_check` | Check server health, GitHub API status, and rate limits |
| `setup_project_fields` | Provision custom project fields for agent orchestration |

```json
// Health check
{"tool": "system", "arguments": {"action": "health_check"}}
```

---

## Granular Tools (Internal)

The compound API is the recommended interface for MCP clients:
- **Fewer tools** — 20 tools covering 169 actions, instead of one tool per operation
- **Progressive disclosure** — `discover_tools` lets agents explore capabilities at runtime
- **Same underlying operations** — compound tools delegate directly to the same internal executors
- **Configurable exposure** — `MCP_TOOL_GROUPS` (group names: `core`, `ai`, `agents`, `events`, `system`) lets you limit which tool groups are visible

To restore granular tool exposure (not recommended), consult the `ToolRegistry` source in `src/infrastructure/tools/`.

---

*Reference for `mcp-github-project-manager` v2.4.0 — MCP SDK v2 (2026-07-28 spec).*
