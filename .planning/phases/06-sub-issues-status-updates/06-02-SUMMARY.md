---
phase: 06-sub-issues-status-updates
plan: 02
subsystem: mcp-tools
tags: [mcp, tools, sub-issues, github-api]
status: complete

dependency_graph:
  requires: ["06-01"]
  provides: ["sub-issue-mcp-tools", "5-new-tools"]
  affects: ["06-03"]

tech_stack:
  added: []
  patterns: ["tool-definition-pattern", "executor-pattern", "node-id-resolution"]

key_files:
  created:
    - src/infrastructure/tools/schemas/sub-issue-schemas.ts
    - src/infrastructure/tools/sub-issue-tools.ts
  modified:
    - src/infrastructure/tools/ToolSchemas.ts
    - src/infrastructure/tools/ToolRegistry.ts
    - src/index.ts

decisions:
  - id: node-id-resolution-in-executor
    description: "Resolve issue numbers to node IDs within executors, not in repository"
    rationale: "MCP users provide issue numbers; repository methods require node IDs"
  - id: parallel-node-id-resolution
    description: "Use Promise.all to resolve multiple issue numbers in parallel"
    rationale: "Reduces latency for operations like add_sub_issue that need 2 IDs"
  - id: state-normalization
    description: "Convert OPEN/CLOSED to open/closed for MCP output"
    rationale: "GitHub API returns uppercase; MCP schemas use lowercase"

metrics:
  duration: "10 minutes"
  completed: "2026-01-31"
---

# Phase 06 Plan 02: Sub-Issue MCP Tools Summary

5 MCP tools for sub-issue management with Zod schemas, executors, and proper MCP annotations.

## One-liner

5 sub-issue MCP tools (GHAPI-01 to GHAPI-05) with node ID resolution and annotation patterns.

## What Was Built

### Task 1: Sub-Issue Zod Schemas

Created `/src/infrastructure/tools/schemas/sub-issue-schemas.ts` with:

**Input Schemas (5):**
- `AddSubIssueInputSchema` - owner, repo, parentIssueNumber, subIssueNumber, replaceParent
- `ListSubIssuesInputSchema` - owner, repo, issueNumber, first, after
- `GetParentIssueInputSchema` - owner, repo, issueNumber
- `ReprioritizeSubIssueInputSchema` - owner, repo, parentIssueNumber, subIssueNumber, afterIssueNumber
- `RemoveSubIssueInputSchema` - owner, repo, parentIssueNumber, subIssueNumber

**Output Schemas (5):**
- `SubIssueOutputSchema` - id, number, title, state, url
- `SubIssueListOutputSchema` - subIssues[], summary, pageInfo, totalCount
- `ParentIssueOutputSchema` - parent (nullable)
- `RemoveSubIssueOutputSchema` - success, message
- `SubIssueOperationOutputSchema` - parentIssue, subIssue

### Task 2: Tool Definitions and Executors

Created `/src/infrastructure/tools/sub-issue-tools.ts` with:

**Tools:**
| Tool | GHAPI ID | Annotation | Description |
|------|----------|------------|-------------|
| add_sub_issue | GHAPI-01 | updateIdempotent | Adds issue as sub-issue of parent |
| list_sub_issues | GHAPI-02 | readOnly | Lists sub-issues with pagination |
| get_parent_issue | GHAPI-03 | readOnly | Gets parent issue if any |
| reprioritize_sub_issue | GHAPI-04 | updateIdempotent | Changes sub-issue position |
| remove_sub_issue | GHAPI-05 | delete | Removes sub-issue relationship |

**Executor Pattern:**
1. Create GitHubRepositoryFactory with owner/repo/token
2. Resolve issue numbers to node IDs (parallel when possible)
3. Call GitHubSubIssueRepository method
4. Normalize state from OPEN/CLOSED to open/closed
5. Return structured result

### Task 3: Tool Registration

Updated `/src/infrastructure/tools/ToolRegistry.ts`:
- Added imports for 5 tools and 5 executors
- Registered all tools in registerBuiltInTools()

Updated `/src/infrastructure/tools/ToolSchemas.ts`:
- Added re-exports for sub-issue tools

Updated `/src/index.ts`:
- Added imports for sub-issue executors
- Added case statements in tool handler switch

## Commits

| Hash | Description |
|------|-------------|
| cd97587 | feat(06-02): create sub-issue Zod schemas |
| a7bd6bd | feat(06-02): create sub-issue MCP tool definitions and executors |
| 98f269d | feat(06-02): register sub-issue tools in ToolRegistry |

## Verification Results

| Check | Status |
|-------|--------|
| npm run build succeeds | PASS |
| 5 tools have annotations | PASS |
| 5 tools have output schemas | PASS |
| All tools registered in ToolRegistry | PASS |
| ANNOTATION_PATTERNS used correctly | PASS |

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

### Node ID Resolution

GitHub sub-issue mutations require node IDs (e.g., `I_kwDO...`), not issue numbers. The executors handle this conversion internally so MCP users only need to provide familiar issue numbers.

```typescript
// Resolve in parallel for operations needing multiple IDs
const [parentNodeId, subIssueNodeId] = await Promise.all([
  resolveIssueNodeId(factory, args.parentIssueNumber),
  resolveIssueNodeId(factory, args.subIssueNumber),
]);
```

### State Normalization

GitHub returns uppercase state (`OPEN`/`CLOSED`), but MCP schemas use lowercase. The `normalizeState` helper handles this:

```typescript
function normalizeState(state: "OPEN" | "CLOSED"): "open" | "closed" {
  return state === "OPEN" ? "open" : "closed";
}
```

## Next Phase Readiness

- [x] Repository infrastructure complete (06-01)
- [x] MCP tools defined and registered (06-02)
- [ ] Integration tests needed (06-03)

Ready for 06-03: Testing and Verification.
