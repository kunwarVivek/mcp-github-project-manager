---
phase: 08-project-lifecycle-advanced
plan: 01
subsystem: tools-schemas
tags: [zod, schemas, typescript, mcp-tools, lifecycle, advanced]
dependency_graph:
  requires: [phase-7, project-template-linking-schemas]
  provides: [project-lifecycle-schemas, repository-types]
  affects: [08-02, 08-03, 08-04]
tech_stack:
  added: []
  patterns: [zod-schemas, z-infer-types, nullable-for-graphql]
key_files:
  created:
    - src/infrastructure/tools/schemas/project-lifecycle-schemas.ts
  modified:
    - src/infrastructure/github/repositories/types.ts
decisions:
  - id: SCHEMA-01
    choice: "15 Zod schemas total (6 input + 1 filter helper + 8 output)"
    rationale: "Comprehensive coverage for all 6 Phase 8 tools"
  - id: SCHEMA-02
    choice: "Reuse PageInfoSchema pattern from Phase 7"
    rationale: "Consistency with project-template-linking-schemas.ts"
  - id: SCHEMA-03
    choice: "Use z.string().nullable() for optional GraphQL fields"
    rationale: "GraphQL returns null for unset fields, not undefined"
metrics:
  duration: "5 minutes"
  completed: "2026-01-31"
---

# Phase 8 Plan 01: Schema Definitions Summary

**One-liner:** Zod schemas for 6 Phase 8 MCP tools covering project lifecycle (close/reopen), draft conversion, item positioning, and advanced search/filter operations.

## What Was Done

### Task 1: Create project lifecycle schemas file
Created `src/infrastructure/tools/schemas/project-lifecycle-schemas.ts` with 15 Zod schemas:

**Input Schemas (6):**
1. `CloseProjectInputSchema` - GHAPI-19: projectId required
2. `ReopenProjectInputSchema` - GHAPI-20: projectId required
3. `ConvertDraftIssueInputSchema` - GHAPI-21: itemId, owner, repo required
4. `UpdateItemPositionInputSchema` - GHAPI-22: projectId, itemId required, afterId optional
5. `SearchIssuesAdvancedInputSchema` - GHAPI-23: query required, first/after optional
6. `FilterProjectItemsInputSchema` - GHAPI-24: projectId, filter required, first/after optional

**Helper Schema (1):**
- `ProjectItemFilterSchema` - status, labels, assignee, type all optional

**Output Schemas (8):**
1. `ProjectLifecycleOutputSchema` - id, title, closed, url
2. `ConvertedIssueOutputSchema` - itemId, issueId, issueNumber, title, url, repository
3. `ItemPositionOutputSchema` - success, itemId, position
4. `PageInfoSchema` - hasNextPage, endCursor (nullable)
5. `SearchIssueItemSchema` - id, number, title, state, url, labels, assignees, repository
6. `SearchIssuesOutputSchema` - totalCount, issues, pageInfo
7. `ProjectItemSchema` - id, type, contentId (nullable), title, state (nullable), labels, fieldValues
8. `FilterProjectItemsOutputSchema` - totalCount, filteredCount, items, pageInfo

### Task 2: Add TypeScript interfaces to repository types
Added 5 interfaces to `src/infrastructure/github/repositories/types.ts`:

1. `ProjectLifecycleResult` - for close/reopen operations
2. `ConvertedDraftIssueResult` - for draft issue conversion
3. `ItemPositionResult` - for position updates
4. `SearchIssueResult` - for advanced search results
5. `FilteredProjectItem` - for filtered project items

### Task 3: Verify schemas are importable
Verified TypeScript compilation passes with no errors.

## Commits

| Commit | Description |
|--------|-------------|
| `4b5b5b1` | feat(08-01): add Zod schemas for Phase 8 lifecycle tools |
| `0318313` | feat(08-01): add TypeScript interfaces for Phase 8 repository layer |

## Verification Results

| Check | Result |
|-------|--------|
| TypeScript compilation | PASS (no errors) |
| Schema exports | 30 (includes z.object calls) |
| Type exports | 15 (z.infer types) |
| Zod schema definitions | 15 unique schemas |

## Deviations from Plan

None - plan executed exactly as written.

## Key Patterns Established

1. **Schema file organization:** Input schemas first, then output schemas, with helper schemas grouped logically
2. **Consistent naming:** `{ToolName}InputSchema`, `{ToolName}OutputSchema`, `{Helper}Schema`
3. **nullable() for GraphQL:** Use `z.string().nullable()` for optional fields that can be null
4. **PageInfoSchema reuse:** Same pattern as Phase 7 for pagination
5. **Enum for item types:** `z.enum(["Issue", "PullRequest", "DraftIssue"])` for content type

## Next Phase Readiness

Ready for 08-02 (Project Lifecycle Tools):
- All 6 input schemas defined and exported
- All 8 output schemas defined and exported
- TypeScript types available via z.infer
- Repository types ready for tool executors

## Files Changed

| File | Lines | Change |
|------|-------|--------|
| `src/infrastructure/tools/schemas/project-lifecycle-schemas.ts` | +331 | Created |
| `src/infrastructure/github/repositories/types.ts` | +69 | Modified |
