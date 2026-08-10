# MCP Tools Reference

This document provides comprehensive documentation for the 16 compound MCP tools exposed by the MCP GitHub Project Manager. Each compound tool groups related actions behind a single `action` parameter, reducing tool-selection overhead for AI agents while preserving full access to all 152 underlying operations.

## Overview

| Metric | Value |
|--------|-------|
| Compound Tools | 16 |
| Total Actions | 152 |
| SDK Version | 1.29 |
| All tools have | Behavior annotations, Output schemas |

### Design: Progressive Disclosure

MCP clients see 16 tools instead of 131. Each tool accepts an `action` string that routes to the appropriate internal executor. Use `discover_tools` to explore available actions at runtime.

### Behavior Annotations

All tools are annotated with behavior hints that help MCP clients understand their impact:

| Annotation | Meaning | Example |
|------------|---------|---------|
| `readOnlyHint: true` | Does not modify data | `manage_project` (action: `list`, `get`) |
| `destructiveHint: true` | Permanently deletes data | `manage_project` (action: `delete`) |
| `idempotentHint: true` | Safe to retry | `manage_project` (action: `update`) |
| `openWorldHint: true` | Makes external calls | `ai_generate` (all actions) |

### Tool Selection via `MCP_TOOL_GROUPS`

The `MCP_TOOL_GROUPS` environment variable controls which compound tools are exposed to the MCP client. Set it to a comma-separated list of group tags, or `all` (default) to expose everything.

Available group tags: `core`, `ai`, `agents`, `events`, `system`

```bash
# Expose only core project management tools
MCP_TOOL_GROUPS=core

# Expose everything (default)
MCP_TOOL_GROUPS=all
```

`discover_tools` is always available regardless of this setting.

---

## Compound Tools

1. [manage_project](#manage_project) (37 actions)
2. [manage_issues](#manage_issues) (18 actions)
3. [manage_prs](#manage_prs) (7 actions)
4. [manage_milestones](#manage_milestones) (7 actions)
5. [manage_sprints](#manage_sprints) (8 actions)
6. [manage_labels](#manage_labels) (2 actions)
7. [manage_automation](#manage_automation) (7 actions)
8. [manage_iterations](#manage_iterations) (5 actions)
9. [manage_events](#manage_events) (3 actions)
10. [manage_status_updates](#manage_status_updates) (3 actions)
11. [ai_generate](#ai_generate) (9 actions)
12. [ai_analyze](#ai_analyze) (8 actions)
13. [ai_plan](#ai_plan) (6 actions)
14. [agent_work](#agent_work) (12 actions)
15. [agent_manage](#agent_manage) (18 actions)
16. [discover_tools](#discover_tools) (meta-tool)

---

## manage_project

Manage GitHub Projects v2: create, configure, and organize projects with fields, views, items, templates, and linking.

**Action enum:** `create` | `list` | `get` | `update` | `delete` | `get_readme` | `update_readme` | `create_field` | `list_fields` | `update_field` | `create_view` | `list_views` | `update_view` | `delete_view` | `add_item` | `remove_item` | `list_items` | `archive_item` | `unarchive_item` | `set_field_value` | `get_field_value` | `clear_field_value` | `close` | `reopen` | `mark_as_template` | `unmark_as_template` | `copy_from_template` | `list_templates` | `link_to_repo` | `unlink_from_repo` | `link_to_team` | `unlink_from_team` | `list_linked_repos` | `list_linked_teams` | `update_item_position` | `filter_items` | `setup_agent_fields`

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
| `create_field` | `projectId` (req), `name` (req), `dataType` (req), `description`, `options` | Create custom field |
| `list_fields` | `projectId` (req) | List project fields |
| `update_field` | `projectId` (req), `fieldId` (req), `name`, `options` | Update field |
| `create_view` | `projectId` (req), `name` (req), `layout` (req), `groupByField`, `sortByField`, `filterQuery` | Create view |
| `list_views` | `projectId` (req) | List views |
| `update_view` | `projectId` (req), `viewId` (req), ... | Update view |
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

### Examples

```json
// Create a project
{"tool": "manage_project", "arguments": {"action": "create", "title": "Backend API", "owner": "myorg", "visibility": "public"}}

// List projects
{"tool": "manage_project", "arguments": {"action": "list", "status": "active", "limit": 20}}

// Create a custom field
{"tool": "manage_project", "arguments": {"action": "create_field", "projectId": "PVT_kwDOAB...", "name": "Priority", "dataType": "SINGLE_SELECT", "options": [{"name": "P0", "color": "red"}, {"name": "P1", "color": "yellow"}, {"name": "P2", "color": "green"}]}}
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

Manage project automation rules: create, update, enable/disable, and delete.

**Action enum:** `create_rule` | `update_rule` | `delete_rule` | `get_rule` | `list_rules` | `enable_rule` | `disable_rule`

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `create_rule` | `projectId` (req), `name` (req), `trigger` (req), `conditions`, `actions` (req) | Create automation rule |
| `update_rule` | `ruleId` (req), `name`, `trigger`, `conditions`, `actions` | Update rule |
| `delete_rule` | `ruleId` (req) | Delete rule (destructive) |
| `get_rule` | `ruleId` (req) | Get rule details |
| `list_rules` | `projectId` (req) | List rules |
| `enable_rule` | `ruleId` (req) | Enable rule |
| `disable_rule` | `ruleId` (req) | Disable rule |

### Examples

```json
// Create an automation rule
{"tool": "manage_automation", "arguments": {"action": "create_rule", "projectId": "PVT_kwDOAB...", "name": "Auto-assign reviewers", "trigger": "pr_opened", "actions": [{"type": "add_assignee", "value": "reviewer-team"}]}}

// List rules
{"tool": "manage_automation", "arguments": {"action": "list_rules", "projectId": "PVT_kwDOAB..."}}

// Disable a rule
{"tool": "manage_automation", "arguments": {"action": "disable_rule", "ruleId": "rule-123"}}
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

**Action enum:** `enrich_issue` | `enrich_bulk` | `triage_issue` | `triage_all` | `schedule_triaging` | `suggest_labels` | `detect_duplicates` | `find_related`

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `enrich_issue` | `issueNumber` (req) | AI-enrich a single issue |
| `enrich_bulk` | `issueNumbers` (req) | Bulk enrich multiple issues |
| `triage_issue` | `issueNumber` (req) | AI triage a single issue |
| `triage_all` | `limit` | Triage all untriaged issues |
| `schedule_triaging` | `interval`, `batchSize` | Schedule automatic triaging |
| `suggest_labels` | `issueNumber` (req) | Suggest labels for an issue |
| `detect_duplicates` | `issueNumber` (req) | Detect duplicate issues |
| `find_related` | `issueNumber` (req), `limit` | Find related issues |

### Examples

```json
// Enrich an issue with AI
{"tool": "ai_analyze", "arguments": {"action": "enrich_issue", "issueNumber": 42}}

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
| `calculate_capacity` | `sprintId` (req), `teamMembers` | Calculate sprint capacity |
| `prioritize_backlog` | `projectId` (req), `criteria` | AI-prioritize the backlog |
| `assess_risk` | `sprintId` (req) | Assess sprint risk |
| `suggest_composition` | `sprintId` (req), `capacity` | Suggest sprint composition |
| `generate_roadmap` | `projectId` (req), `timeframe`, `themes` | Generate project roadmap |
| `generate_visualization` | `projectId` (req), `type` | Generate visualization data |

### Examples

```json
// Calculate sprint capacity
{"tool": "ai_plan", "arguments": {"action": "calculate_capacity", "sprintId": "sprint-5"}}

// Prioritize backlog
{"tool": "ai_plan", "arguments": {"action": "prioritize_backlog", "projectId": "PVT_kwDOAB...", "criteria": ["business_value", "urgency"]}}

// Generate roadmap
{"tool": "ai_plan", "arguments": {"action": "generate_roadmap", "projectId": "PVT_kwDOAB...", "timeframe": "6 months"}}
```

---

## agent_work

Agent task lifecycle: register, check out tasks, report progress, and complete work.

**Action enum:** `register` | `checkout_task` | `release_task` | `complete_task` | `heartbeat` | `check_work_status` | `get_task_context` | `submit_for_review` | `approve_task` | `reject_task` | `validate_work_product` | `get_handoff_context`

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `register` | `name` (req), `role` (req), `runtime`, `capabilities`, `parentAgentId` | Register an AI agent |
| `checkout_task` | `agentId` (req), `strategy`, `labels`, `projectId`, `skipBlocked`, `reviewQueue` | Claim next available task (strategies: `highest_priority` (default), `oldest_first`, `skills_match`, `milestone_deadline`, `ai`; `skipBlocked: true` skips tasks with open blockers; `reviewQueue: true` claims from the review queue for reviewers) |
| `release_task` | `agentId` (req), `taskId` (req), `reason` | Return task to pool |
| `complete_task` | `agentId` (req), `taskId` (req), `summary` (req) | Mark task completed |
| `heartbeat` | `agentId` (req), `status`, `taskId`, `progress`, `progressSummary`, `currentBranch`, `blockers` | Report liveness and progress (history retained) |
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

Agent administration: list agents, manage budgets, view activity, and submit work products.

**Action enum:** `list` | `deregister` | `get_activity` | `submit_work_product` | `get_budget` | `set_budget` | `reclaim_stale` | `record_usage` | `get_metrics` | `setup_fields` | `assign_task` | `get_swarm_status` | `rebalance_workload` | `decompose_task` | `smart_assign` | `converge_project` | `converge_until_done` | `cleanup_registry`

### Per-Action Parameters

| Action | Additional Parameters | Description |
|--------|----------------------|-------------|
| `list` | `role`, `status` | List registered agents |
| `deregister` | `agentId` (req) | Remove agent (cascades to children) |
| `get_activity` | `agentId` | Get agent activity dashboard (incl. heartbeat history) |
| `submit_work_product` | `agentId` (req), `taskId` (req), `issueNumber` (req), `branch`, `prNumber`, `commitShas`, `filesChanged`, `testsPassed`, `testsFailed`, `testsTotal`, `summary` | Submit work product |
| `get_budget` | `agentId` (req) | Check token budget status |
| `set_budget` | `agentId` (req), `totalTokens` (req), `warningThreshold`, `hardStop`, `resetPeriod` | Configure token budget |
| `reclaim_stale` | `timeoutMinutes` | Reclaim tasks from agents with stale heartbeats (default 30 min). Also run automatically by the server-side **auto-reclaim scheduler** (see below). |
| `record_usage` | `agentId` (req), `tokensUsed` (req) | Report token usage against an agent's budget |
| `get_metrics` | `staleAfterMinutes` | Aggregate + per-agent metrics (throughput, cycle time, budget burn, staleness) |
| `setup_fields` | `projectId` (req) | Idempotently provision the agent orchestration fields (`agent_claimed_by`, `agent_claimed_at`, `agent_status`, `agent_work_branch`, `agent_pr_number`) on a project |
| `assign_task` | `agentId` (req), `projectId` (req), `issueNumber` (req) | PM assigns a specific issue to a specific agent, bypassing self-service checkout |
| `get_swarm_status` | `staleAfterMinutes` | Dashboard of all agents: tasks, heartbeats, budgets, blocked/stale detection |
| `rebalance_workload` | — | Redistribute tasks from overloaded agents to idle ones |
| `decompose_task` | `projectId` (req), `issueNumber` (req), `subtasks` (req: array of {title, description, acceptanceCriteria?}) | PM splits a rejected task into sub-issues linked to parent |
| `smart_assign` | `projectId` (req), `agentIds`, `roleFilter`, `maxAssignments` | Capability-matched, budget-aware task assignment |
| `converge_project` | `projectId` (req) | Auto-approve passing work, auto-reject failing, auto-decompose fix subtasks |
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
{"tool": "agent_manage", "arguments": {"action": "set_budget", "agentId": "agent-abc123", "totalTokens": 500000, "warningThreshold": 0.8, "hardStop": true, "resetPeriod": "daily"}}
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

## System Tools

The `system` group provides infrastructure operations:

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
- **Fewer tools** — 16 instead of 131 reduces tool-selection overhead for AI agents
- **Progressive disclosure** — `discover_tools` lets agents explore capabilities at runtime
- **Same underlying operations** — compound tools delegate directly to the same internal executors
- **Configurable exposure** — `MCP_TOOL_GROUPS` (group tags: `core`, `ai`, `agents`, `events`, `system`) lets you limit which tool groups are visible

To restore granular tool exposure (not recommended), consult the `ToolRegistry` source in `src/infrastructure/tools/`.

---

*MCP SDK: 1.29*
