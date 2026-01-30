---
phase: 02-mcp-protocol-compliance
plan: 02
subsystem: tools
tags: [mcp, zod, json-schema, annotations, typescript]

# Dependency graph
requires:
  - phase: 02-01
    provides: zod-to-json-schema library, MCP SDK 1.25.3
provides:
  - Extended ToolDefinition interface with annotations and outputSchema
  - ANNOTATION_PATTERNS constants for tool behavior classification
  - getToolsForMCP method using zod-to-json-schema
affects: [02-03, 02-04, 02-05, tool-implementations]

# Tech tracking
tech-stack:
  added: []
  patterns: [tool-annotation-patterns, mcp-tool-output-format]

key-files:
  created:
    - src/infrastructure/tools/annotations/tool-annotations.ts
  modified:
    - src/infrastructure/tools/ToolValidator.ts
    - src/infrastructure/tools/ToolRegistry.ts

key-decisions:
  - "Use TOutput generic with unknown default for backward compatibility"
  - "Mark deprecated methods instead of removing them"
  - "Use $refStrategy: none for inlined JSON Schema"

patterns-established:
  - "ToolAnnotations interface: standardized behavior hints per MCP 2025-11-25"
  - "ANNOTATION_PATTERNS: 6 canonical patterns (readOnly, create, updateIdempotent, updateNonIdempotent, delete, aiOperation)"

# Metrics
duration: 12min
completed: 2026-01-30
---

# Phase 02 Plan 02: Tool Annotations Summary

**Extended ToolDefinition with MCP annotations, outputSchema, and zod-to-json-schema for proper JSON Schema conversion**

## Performance

- **Duration:** 12 min
- **Started:** 2026-01-30T04:34:29Z
- **Completed:** 2026-01-30T04:46:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Extended ToolDefinition interface with `title`, `outputSchema`, and `annotations` fields
- Created ANNOTATION_PATTERNS with 6 behavior types for tool classification
- Updated getToolsForMCP to use zod-to-json-schema library instead of manual conversion
- Maintained backward compatibility - all existing tools continue to work

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend ToolDefinition interface** - `372cd21` (feat)
2. **Task 2: Create annotation pattern constants** - `36b0297` (feat)
3. **Task 3: Update getToolsForMCP** - `c3cc0ff` (feat)

## Files Created/Modified

- `src/infrastructure/tools/ToolValidator.ts` - Added ToolAnnotations interface, extended ToolDefinition with title/outputSchema/annotations
- `src/infrastructure/tools/annotations/tool-annotations.ts` - New file with ANNOTATION_PATTERNS constants for 6 behavior types
- `src/infrastructure/tools/ToolRegistry.ts` - Updated getToolsForMCP to use zodToJsonSchema, marked old methods deprecated

## Decisions Made

1. **TOutput generic defaults to unknown** - Ensures backward compatibility with existing ToolDefinition<T> usages
2. **Mark deprecated vs remove** - Kept convertZodToJsonSchema and zodTypeToJsonSchemaType as deprecated rather than removing, avoiding any runtime breaks
3. **$refStrategy: "none"** - Inlines all JSON Schema definitions rather than using $ref, simplifying MCP client consumption

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Tool infrastructure ready for annotation application (02-03 will add annotations to all 71 tools)
- Output schemas ready to be defined (02-04 will add outputSchema to tools)
- Build and tests passing (341 unit tests)

---
*Phase: 02-mcp-protocol-compliance*
*Completed: 2026-01-30*
