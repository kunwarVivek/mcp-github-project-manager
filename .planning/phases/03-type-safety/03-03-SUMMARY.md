---
phase: 03-type-safety
plan: 03
subsystem: infra
tags: [zod, typescript, type-guards, instanceof]

# Dependency graph
requires:
  - phase: 03-01
    provides: Repository method type fixes
  - phase: 03-02
    provides: Type guard infrastructure
provides:
  - Zod instanceof type checking pattern
  - Error type guard helper functions
  - Type-safe schema introspection
affects: [04-error-handling, future type-safety improvements]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zod instanceof checks for type introspection"
    - "Helper type guards for complex type narrowing"

key-files:
  created: []
  modified:
    - src/infrastructure/tools/ToolRegistry.ts
    - src/infrastructure/github/types.ts

key-decisions:
  - "Use instanceof ZodOptional instead of _def.typeName string checks"
  - "Create dedicated helper functions for complex type narrowing"
  - "Type entries as [string, ZodTypeAny][] for proper iteration"

patterns-established:
  - "Pattern: Zod instanceof checks for type introspection instead of internal API access"
  - "Pattern: Helper type guards (hasErrorsArray, isErrorWithMessage) for complex narrowing"

# Metrics
duration: 10min
completed: 2026-01-31
---

# Phase 03 Plan 03: Zod and Type Guard Fixes Summary

**Zod instanceof checks replacing internal API access, plus helper type guards for proper error narrowing**

## Performance

- **Duration:** 10 min
- **Started:** 2026-01-30T12:30:46Z
- **Completed:** 2026-01-30T12:40:46Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Replaced `(zodType as any)._def.typeName` with `zodType instanceof ZodOptional` pattern
- Replaced `(fieldType as any)._def.typeName` with `fieldType instanceof ZodOptional` pattern
- Added Zod type imports: ZodOptional, ZodString, ZodNumber, ZodBoolean, ZodArray, ZodObject, ZodEnum
- Created `hasErrorsArray` and `isErrorWithMessage` helper type guards
- Eliminated all `as any` casts from isGraphQLErrorResponse type guard
- TypeScript compilation passes, no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace Zod internal API access with instanceof checks** - `7ad0f76` (refactor)
2. **Task 2: Fix type guard narrowing in types.ts** - `aa3bc98` (refactor)
3. **Task 3: Verify TypeScript compilation and run tests** - (verification only, no commit)

**Plan metadata:** (pending)

## Files Created/Modified

- `src/infrastructure/tools/ToolRegistry.ts` - Replaced all Zod `as any` casts with instanceof checks, added ZodTypeAny type annotations
- `src/infrastructure/github/types.ts` - Added hasErrorsArray and isErrorWithMessage helper type guards, refactored isGraphQLErrorResponse

## Decisions Made

1. **Used instanceof checks for Zod types** - Zod exports class constructors (ZodOptional, ZodString, etc.) that work with instanceof, which is cleaner than accessing internal _def.typeName
2. **Created helper type guards** - Rather than inline type assertions, created hasErrorsArray() and isErrorWithMessage() for reusable, composable type narrowing
3. **Cast Object.entries result** - Used `as [string, ZodTypeAny][]` for entries iteration since TypeScript infers `unknown` for values

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Linter interference**: Initial edits were being reverted by a linter or file watcher. Resolved by using Write tool to replace entire file content atomically.
- **Pre-existing test failures**: 44 tests failing due to unrelated issues (e2e auth failures, type errors in TaskContextGenerationService.test.ts). These are pre-existing and not related to changes in this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ToolRegistry and types.ts now use proper TypeScript patterns
- 5 fewer `as any` assertions in infrastructure code (2 in ToolRegistry, 3 in types.ts)
- Ready for next type safety improvement plan

---
*Phase: 03-type-safety*
*Completed: 2026-01-31*
