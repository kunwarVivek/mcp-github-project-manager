---
phase: 06-sub-issues-status-updates
plan: 01
subsystem: infrastructure
tags: [graphql, repositories, sub-issues, status-updates, github-api]
dependency-graph:
  requires: [05-resilience-observability]
  provides: [GitHubSubIssueRepository, GitHubStatusUpdateRepository, graphqlWithFeatures]
  affects: [06-02-mcp-tools]
tech-stack:
  added: []
  patterns: [preview-header-injection, node-id-resolution, factory-pattern]
key-files:
  created:
    - src/infrastructure/github/repositories/GitHubSubIssueRepository.ts
    - src/infrastructure/github/repositories/GitHubStatusUpdateRepository.ts
  modified:
    - src/infrastructure/github/repositories/BaseRepository.ts
    - src/infrastructure/github/repositories/types.ts
    - src/infrastructure/github/GitHubRepositoryFactory.ts
decisions:
  - id: graphql-features-method
    choice: "Add graphqlWithFeatures() to BaseGitHubRepository"
    rationale: "Sub-issues require GraphQL-Features header; centralized method enables any future preview APIs"
  - id: node-id-resolution
    choice: "Add resolveIssueNodeId() helper to BaseGitHubRepository"
    rationale: "GraphQL mutations require node IDs; helper abstracts resolution from issue numbers"
  - id: sub-issues-feature-constant
    choice: "Use static readonly SUB_ISSUES_FEATURE constant"
    rationale: "Single source of truth for feature flag name; easy to update if API changes"
metrics:
  duration: "6m 8s"
  completed: 2026-01-31
---

# Phase 6 Plan 01: Repository Infrastructure Summary

**One-liner:** GraphQL repository layer for sub-issues and status updates with preview header support

## Completed Tasks

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Extend BaseGitHubRepository with graphqlWithFeatures | bc83883 | graphqlWithFeatures(), resolveIssueNodeId(), 9 type interfaces |
| 2 | Create GitHubSubIssueRepository | e47f8e2 | 5 methods: addSubIssue, listSubIssues, getParentIssue, reprioritizeSubIssue, removeSubIssue |
| 3 | Create GitHubStatusUpdateRepository and wire factory | f5fac17 | 3 methods + 2 factory create methods |

## Artifacts Created

### New Files

**src/infrastructure/github/repositories/GitHubSubIssueRepository.ts** (395 lines)
- `addSubIssue(parentIssueId, subIssueId, replaceParent?)` - Add issue as sub-issue
- `listSubIssues(issueId, first?, after?)` - List with pagination and summary
- `getParentIssue(issueId)` - Get parent if exists
- `reprioritizeSubIssue(parentIssueId, subIssueId, afterId?)` - Reorder sub-issues
- `removeSubIssue(parentIssueId, subIssueId)` - Remove sub-issue relationship

**src/infrastructure/github/repositories/GitHubStatusUpdateRepository.ts** (215 lines)
- `createStatusUpdate(projectId, body, options?)` - Create with optional status/dates
- `listStatusUpdates(projectId, first?, after?)` - List ordered by CREATED_AT DESC
- `getStatusUpdate(statusUpdateId)` - Get single status update

### Modified Files

**src/infrastructure/github/repositories/BaseRepository.ts**
- Added `graphqlWithFeatures<T>(query, variables, features)` - GraphQL with preview headers
- Added `resolveIssueNodeId(issueNumber)` - Convert issue number to node ID

**src/infrastructure/github/repositories/types.ts**
- `SubIssueListItem` - Sub-issue in list with id, number, title, state, url, position
- `SubIssueSummary` - total, completed, percentCompleted
- `SubIssueListResult` - List result with pagination
- `SubIssueResult` - Mutation result with issue and subIssue
- `ParentIssueResult` - Parent issue info
- `StatusUpdateStatus` enum - ON_TRACK, AT_RISK, OFF_TRACK, COMPLETE, INACTIVE
- `StatusUpdate` - Full status update with creator
- `StatusUpdateOptions` - Optional fields for creation
- `StatusUpdateListResult` - List result with pagination

**src/infrastructure/github/GitHubRepositoryFactory.ts**
- Added `createSubIssueRepository()` - Factory method for sub-issues
- Added `createStatusUpdateRepository()` - Factory method for status updates

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

### 1. GraphQL Features Method Location

**Decision:** Add `graphqlWithFeatures()` to BaseGitHubRepository rather than creating a separate utility.

**Rationale:**
- Follows existing pattern of `graphql()` method in base class
- Enables retry logic via `withRetry()` wrapper
- Any repository can use preview features without additional dependencies

### 2. Node ID Resolution Helper

**Decision:** Add `resolveIssueNodeId()` to BaseGitHubRepository.

**Rationale:**
- GraphQL mutations require node IDs (e.g., `I_kwDO...`), not issue numbers
- Centralizing this in base class allows any repository to resolve IDs
- Future: Could add caching via ResourceCache if performance becomes an issue

### 3. Status Update Status Enum

**Decision:** Use TypeScript enum for StatusUpdateStatus matching GitHub's exact values.

**Rationale:**
- GitHub requires exact enum values: ON_TRACK, AT_RISK, OFF_TRACK, COMPLETE, INACTIVE
- TypeScript enum provides compile-time safety
- Context file mentioned 4 values but research found 5; included all for completeness

## Verification Results

| Criterion | Result |
|-----------|--------|
| npm run build succeeds | PASS |
| graphqlWithFeatures method exists | PASS (6 usages) |
| sub_issues feature flag used | PASS (5 usages) |
| Factory create methods | PASS (2 methods) |
| All repository methods typed | PASS |

## Next Phase Readiness

**Ready for 06-02:** MCP Tools implementation

The repository layer provides:
- `GitHubSubIssueRepository` with 5 GraphQL operations
- `GitHubStatusUpdateRepository` with 3 GraphQL operations
- Factory methods for dependency injection
- Type definitions for tool input/output schemas

**Dependencies satisfied:**
- `graphqlWithFeatures` enables preview header injection
- `resolveIssueNodeId` enables issue number to node ID conversion
- All types exported from `types.ts` for tool schema creation
