---
phase: 07-project-templates-linking
plan: 03
subsystem: api
tags: [mcp, graphql, github-projects, linking, teams, repositories]

# Dependency graph
requires:
  - phase: 07-01
    provides: Zod schemas for linking operations (6 input + 6 output)
provides:
  - 6 MCP tools for project linking operations (GHAPI-13 to GHAPI-18)
  - Helper functions for resolving repository and team node IDs
  - GraphQL mutations for link/unlink operations
affects: [phase-8, phase-9, testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct factory.graphql() calls for linking mutations"
    - "resolveRepositoryId/resolveTeamId helper pattern"
    - "Standalone executor pattern with structuredContent"

key-files:
  created:
    - src/infrastructure/tools/project-linking-tools.ts
  modified:
    - src/infrastructure/tools/ToolSchemas.ts
    - src/infrastructure/tools/ToolRegistry.ts

key-decisions:
  - "Use direct GraphQL mutations instead of repository abstraction"
  - "Resolve owner/repo to node ID before mutations"
  - "Return structuredContent with LinkedRepositoryOutput/LinkedTeamOutput"

patterns-established:
  - "resolveRepositoryId: query repository by owner/name for node ID"
  - "resolveTeamId: query organization.team by slug for node ID"
  - "Linking tools follow status-update-tools.ts pattern"

# Metrics
duration: 5min
completed: 2026-01-31
---

# Phase 7 Plan 3: Project Linking MCP Tools Summary

**6 MCP tools for linking GitHub projects to repositories and teams via GraphQL mutations**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-31T09:49:41Z
- **Completed:** 2026-01-31T09:54:44Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created 6 MCP tool definitions with annotations and output schemas
- Implemented 6 executor functions calling GitHub GraphQL API directly
- Created helper functions for resolving repository and team node IDs
- Registered all tools in ToolRegistry (total now 103 tools)

## Task Commits

1. **Task 1: Create linking tool definitions** - `3258c40` (feat)
2. **Task 2: Register linking tools** - `5d7b849` (feat)

## Files Created/Modified

- `src/infrastructure/tools/project-linking-tools.ts` - 6 tool definitions + 6 executors + 3 helpers (754 lines)
- `src/infrastructure/tools/ToolSchemas.ts` - Re-export linking tools
- `src/infrastructure/tools/ToolRegistry.ts` - Import and register linking tools

## Tools Implemented

| Tool | ID | Type | Description |
|------|-----|------|-------------|
| link_project_to_repository | GHAPI-13 | updateIdempotent | Link repo to project |
| unlink_project_from_repository | GHAPI-14 | delete | Unlink repo from project |
| link_project_to_team | GHAPI-15 | updateIdempotent | Link team to project |
| unlink_project_from_team | GHAPI-16 | delete | Unlink team from project |
| list_linked_repositories | GHAPI-17 | readOnly | List linked repos |
| list_linked_teams | GHAPI-18 | readOnly | List linked teams |

## Helper Functions

- `createFactory(owner, repo)` - Creates GitHubRepositoryFactory
- `resolveRepositoryId(factory, owner, repo)` - Resolves repo to node ID via GraphQL
- `resolveTeamId(factory, orgLogin, teamSlug)` - Resolves team to node ID via GraphQL

## Decisions Made

- **Direct GraphQL mutations:** Tools call factory.graphql() directly rather than using repository layer (matches status-update-tools pattern)
- **Node ID resolution:** Separate helper functions for cleaner executor code
- **structuredContent format:** All executors return { content: [...], structuredContent: {...} }

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 6 linking tools ready for integration testing in 07-04
- Schemas from 07-01 validated by TypeScript compilation
- Total MCP tools: 103 (up from 97)

---
*Phase: 07-project-templates-linking*
*Completed: 2026-01-31*
