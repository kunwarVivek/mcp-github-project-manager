---
phase: 08-project-lifecycle-advanced
plan: 02
subsystem: tools
tags: [mcp, graphql, project-lifecycle, draft-issues]

# Dependency graph
requires:
  - phase: 08-01
    provides: Zod schemas for lifecycle tool inputs/outputs
provides:
  - closeProjectTool (GHAPI-19): closes a GitHub ProjectV2
  - reopenProjectTool (GHAPI-20): reopens a closed ProjectV2
  - convertDraftIssueTool (GHAPI-21): converts draft issue to real issue
  - Tool registration in ToolRegistry (106 total tools)
affects: [08-03, 08-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Project lifecycle tool pattern (close/reopen via updateProjectV2)
    - Draft issue conversion with repository ID resolution

key-files:
  created:
    - src/infrastructure/tools/project-lifecycle-tools.ts
  modified:
    - src/infrastructure/tools/ToolRegistry.ts
    - src/infrastructure/tools/ToolSchemas.ts

key-decisions:
  - "updateIdempotent annotation for close/reopen (same result if repeated)"
  - "resolveRepositoryId helper for draft conversion (owner/name to node ID)"
  - "Single UPDATE_PROJECT_MUTATION for both close and reopen (closed: boolean)"

patterns-established:
  - "Project lifecycle tools: close/reopen use same mutation with different closed value"
  - "Draft conversion: resolve repository ID before calling convert mutation"

# Metrics
duration: 8min
completed: 2026-01-31
---

# Phase 8 Plan 02: Project Lifecycle Tools Summary

**3 MCP tools for project lifecycle: close/reopen projects and convert draft issues to real GitHub issues**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-31
- **Completed:** 2026-01-31
- **Tasks:** 2
- **Files created:** 1
- **Files modified:** 2

## Accomplishments
- closeProjectTool (GHAPI-19): closes a ProjectV2, hiding it from default views
- reopenProjectTool (GHAPI-20): reopens a closed ProjectV2, restoring visibility
- convertDraftIssueTool (GHAPI-21): converts draft issue to real issue in specified repository
- All 3 tools registered in ToolRegistry (total: 106 MCP tools)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create project-lifecycle-tools.ts with 3 tools** - `ce85ed6` (feat)
2. **Task 2: Register tools in ToolRegistry** - `6e7dd92` (feat)

## Files Created/Modified
- `src/infrastructure/tools/project-lifecycle-tools.ts` - 3 tool definitions + executors + GraphQL mutations
- `src/infrastructure/tools/ToolRegistry.ts` - Import and register 3 lifecycle tools
- `src/infrastructure/tools/ToolSchemas.ts` - Re-export tools and executors

## Decisions Made
- **updateIdempotent annotation**: Close/reopen are idempotent operations (calling twice produces same result)
- **Single mutation for close/reopen**: Both use updateProjectV2 mutation with closed=true/false
- **Repository ID resolution**: Draft conversion requires repository node ID, resolved from owner/name

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed ANNOTATION_PATTERNS.update to updateIdempotent**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Plan specified `ANNOTATION_PATTERNS.update` but only `updateIdempotent` and `updateNonIdempotent` exist
- **Fix:** Changed to `ANNOTATION_PATTERNS.updateIdempotent` for both close and reopen tools
- **Files modified:** src/infrastructure/tools/project-lifecycle-tools.ts
- **Verification:** TypeScript compilation succeeds
- **Committed in:** ce85ed6 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** Minor annotation pattern correction. No scope creep.

## Issues Encountered
- Found orphaned project-advanced-tools.ts from abandoned 08-03 execution - removed to unblock compilation

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 3 lifecycle tools ready for testing in 08-04
- Remaining 08-03 tools: updateItemPositionTool, searchIssuesAdvancedTool, filterProjectItemsTool
- Total tools after phase: 106 (103 + 3 lifecycle)

---
*Phase: 08-project-lifecycle-advanced*
*Completed: 2026-01-31*
