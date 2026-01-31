---
phase: 07-project-templates-linking
plan: 02
subsystem: api
tags: [mcp-tools, github-api, templates, graphql, executors]

# Dependency graph
requires:
  - phase: 07-01
    provides: Zod schemas and TypeScript interfaces for template operations
provides:
  - 4 MCP tools for project template operations (GHAPI-09 to GHAPI-12)
  - GraphQL mutations and queries for GitHub Project V2 templates
affects: [07-03, 07-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [factory-pattern, executor-pattern, graphql-mutation]

key-files:
  created:
    - src/infrastructure/tools/project-template-tools.ts
  modified:
    - src/infrastructure/tools/ToolSchemas.ts
    - src/infrastructure/tools/ToolRegistry.ts
    - src/index.ts

key-decisions:
  - "Use createFactory helper with placeholder owner/repo for project-level operations"
  - "resolveOrganizationId helper for copy_project_from_template target owner resolution"
  - "Client-side filtering for list_organization_templates (GitHub API returns all projects)"
  - "Follow status-update-tools.ts pattern for standalone executor pattern"

patterns-established:
  - "Template tool executor returns structured { content, structuredContent } format"
  - "GraphQL queries/mutations as module-level constants"
  - "Response interfaces for type-safe GraphQL response handling"

# Metrics
duration: 6min
completed: 2026-01-31
---

# Phase 7 Plan 2: Project Template MCP Tools Summary

**4 MCP tools for GitHub Project V2 template operations with GraphQL integration**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-31T09:49:12Z
- **Completed:** 2026-01-31T09:55:54Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created 4 MCP tool definitions for project template operations
- Implemented 4 executor functions with GraphQL mutations/queries
- Added resolveOrganizationId helper for target owner resolution
- Registered all tools in ToolRegistry and wired executors in index.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create template tool definitions** - `0a3634c` (feat)
2. **Task 2: Register template tools and wire executors** - `b82fcdc` (feat)

## Files Created/Modified

- `src/infrastructure/tools/project-template-tools.ts` - 4 tool definitions + 4 executors (571 lines)
- `src/infrastructure/tools/ToolSchemas.ts` - Re-exports for template tools
- `src/infrastructure/tools/ToolRegistry.ts` - Tool registration
- `src/index.ts` - Executor imports and switch cases

## Tools Implemented

| Tool | API ID | Type | Annotation |
|------|--------|------|------------|
| mark_project_as_template | GHAPI-09 | mutation | updateIdempotent |
| unmark_project_as_template | GHAPI-10 | mutation | updateIdempotent |
| copy_project_from_template | GHAPI-11 | mutation | create |
| list_organization_templates | GHAPI-12 | query | readOnly |

## Decisions Made

- **Factory pattern with placeholders:** Template operations work with project node IDs, not repo context. Factory uses placeholder owner/repo for initialization.
- **Organization ID resolution:** copyProjectV2 requires target owner node ID. Added resolveOrganizationId helper to convert org login to node ID.
- **Client-side template filtering:** GitHub's projectsV2 query returns all projects. Filter by `template: true` client-side for list_organization_templates.
- **Structured executor response:** Executors return `{ content: [...], structuredContent: {...} }` for MCP SDK compatibility.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- External file modification added linking tool imports that don't exist yet
- Fixed by removing the premature linking tool references from ToolRegistry.ts

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 4 template tools ready for testing (07-04)
- Linking tools (07-03) can proceed independently
- No blockers identified

---
*Phase: 07-project-templates-linking*
*Completed: 2026-01-31*
