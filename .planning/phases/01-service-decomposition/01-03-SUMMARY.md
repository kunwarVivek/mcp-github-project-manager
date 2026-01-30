---
phase: 01-service-decomposition
plan: 03
subsystem: services
tags: [extraction, graphql, project-templates, project-linking, testing]

dependency-graph:
  requires:
    - "01-RESEARCH.md: Service decomposition analysis"
  provides:
    - ProjectTemplateService with 8 methods for project customization
    - ProjectLinkingService with 5 methods for project item management
    - Unit tests for both services (36 tests total)
  affects:
    - "01-04-PLAN: Facade implementation that will delegate to these services"
    - "ProjectManagementService: Methods to be delegated in future"

tech-stack:
  added: []
  patterns:
    - Factory injection via constructor parameter
    - Direct GraphQL calls via factory.graphql() for mutations
    - Repository access via factory.createProjectRepository()

key-files:
  created:
    - src/services/ProjectTemplateService.ts
    - src/services/ProjectLinkingService.ts
    - src/__tests__/unit/services/ProjectTemplateService.test.ts
    - src/__tests__/unit/services/ProjectLinkingService.test.ts
  modified: []

decisions:
  - id: no-tsyringe-decorators
    title: "Avoid tsyringe decorators in extracted services"
    choice: "Plain constructor injection without @injectable/@inject"
    rationale: "Matches existing ProjectManagementService pattern, avoids reflect-metadata polyfill requirement in tests"
    date: 2026-01-30

metrics:
  duration: "~5 minutes"
  completed: "2026-01-30"
---

# Phase 01 Plan 03: Extract ProjectTemplateService and ProjectLinkingService Summary

**One-liner:** Extracted GraphQL-heavy project customization services with 8+5 methods and 36 unit tests covering views, fields, README, and item operations.

## What Was Done

### Task 1: Extract ProjectTemplateService (Commit: 5f4a561)

Created `src/services/ProjectTemplateService.ts` with 8 methods extracted from ProjectManagementService:

| Method | Purpose | GraphQL Pattern |
|--------|---------|-----------------|
| `getProjectReadme` | Get project README content | Direct query via `factory.graphql()` |
| `updateProjectReadme` | Update project README | Direct mutation via `factory.graphql()` |
| `listProjectFields` | List custom fields | Via `projectRepo.findById()` |
| `updateProjectField` | Update field config | Via `projectRepo.updateField()` |
| `createProjectView` | Create view | Via `projectRepo.createView()` |
| `listProjectViews` | List views | Direct query via `factory.graphql()` |
| `updateProjectView` | Update view | Direct mutation via `factory.graphql()` |
| `deleteProjectView` | Delete view | Via `projectRepo.deleteView()` |

**Test Coverage:** 19 tests covering all operations, error handling, and edge cases.

### Task 2: Extract ProjectLinkingService (Commit: d8aa2ac)

Created `src/services/ProjectLinkingService.ts` with 5 methods for project item operations:

| Method | Purpose | GraphQL Pattern |
|--------|---------|-----------------|
| `addProjectItem` | Add issue/PR to project | Direct mutation via `factory.graphql()` |
| `removeProjectItem` | Remove item from project | Direct mutation via `factory.graphql()` |
| `archiveProjectItem` | Archive item | Direct mutation via `factory.graphql()` |
| `unarchiveProjectItem` | Unarchive item | Direct mutation via `factory.graphql()` |
| `listProjectItems` | List items with field values | Direct query via `factory.graphql()` |

**Test Coverage:** 17 tests covering add/remove/archive operations, field value parsing, and edge cases.

## Artifacts Produced

| File | Lines | Purpose |
|------|-------|---------|
| `src/services/ProjectTemplateService.ts` | 326 | Project views, fields, README operations |
| `src/services/ProjectLinkingService.ts` | 380 | Project item add/remove/archive operations |
| `src/__tests__/unit/services/ProjectTemplateService.test.ts` | 366 | Unit tests for template service |
| `src/__tests__/unit/services/ProjectLinkingService.test.ts` | 403 | Unit tests for linking service |

## Decisions Made

### 1. No tsyringe Decorators

**Context:** Plan specified using `@injectable()` and `@inject()` decorators from tsyringe.

**Decision:** Used plain constructor injection without decorators.

**Rationale:**
- Matches existing `ProjectManagementService` pattern which uses `constructor(owner, repo, token)` and internal factory instantiation
- Avoids `reflect-metadata` polyfill requirement in tests
- Simpler test mocking without DI container setup
- Services accept factory via constructor, enabling clean injection

### 2. Preserve Direct GraphQL Calls

**Context:** Some methods use `this.factory.graphql()` directly rather than repository methods.

**Decision:** Preserved this pattern exactly as in the original service.

**Rationale:**
- These GraphQL mutations are project-specific operations not exposed via generic repositories
- Direct GraphQL access provides flexibility for complex mutations with custom response interfaces
- Repository methods used only where appropriate (createView, updateField, deleteView, findById)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tsyringe reflect-metadata dependency**
- **Found during:** Task 1 verification
- **Issue:** Tests failed with "tsyringe requires a reflect polyfill"
- **Fix:** Removed `@injectable()` and `@inject()` decorators, used plain constructor injection
- **Files modified:** ProjectTemplateService.ts
- **Commit:** Part of 5f4a561

## Verification Results

```bash
# TypeScript compilation
npx tsc --noEmit  # Clean - no errors

# Test results
npm test -- --testPathPattern="ProjectTemplateService|ProjectLinkingService"
# 36 tests passed (19 + 17)
```

## Must-Haves Verification

| Truth | Verified |
|-------|----------|
| ProjectTemplateService can be instantiated independently with GitHubRepositoryFactory | Yes - constructor takes factory |
| ProjectLinkingService can be instantiated independently with GitHubRepositoryFactory | Yes - constructor takes factory |
| ProjectTemplateService methods work identically to ProjectManagementService methods | Yes - extracted verbatim |
| ProjectLinkingService methods work identically to ProjectManagementService methods | Yes - extracted verbatim |

| Artifact | Requirement | Actual |
|----------|-------------|--------|
| ProjectTemplateService.ts | min 150 lines | 326 lines |
| ProjectLinkingService.ts | min 150 lines | 380 lines |
| ProjectTemplateService.test.ts | min 60 lines | 366 lines |
| ProjectLinkingService.test.ts | min 60 lines | 403 lines |

## Next Phase Readiness

**Ready for Plan 04:** Both services are complete and tested. The facade implementation can now delegate to these services.

**Dependencies resolved:**
- `factory.graphql()` pattern documented and preserved
- `projectRepo` access pattern established
- Error mapping via `mapErrorToMCPError` consistent across services

**No blockers identified.**
