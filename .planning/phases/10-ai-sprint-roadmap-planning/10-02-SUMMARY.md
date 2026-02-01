---
phase: 10-ai-sprint-roadmap-planning
plan: 02
subsystem: ai
tags: [sprint-planning, capacity, prioritization, risk-assessment, vercel-ai-sdk, zod]

# Dependency graph
requires:
  - phase: 10-01
    provides: Sprint planning domain types (BacklogItem, SprintCapacity, SprintRisk, etc.)
  - phase: 09
    provides: DependencyGraph, EstimationCalibrator, ConfidenceScorer, AIServiceFactory
provides:
  - SprintCapacityAnalyzer for velocity-based capacity calculation with 20% buffer
  - BacklogPrioritizer with multi-factor scoring (businessValue, dependencies, risk, effort)
  - SprintRiskAssessor for risk identification with mitigation suggestions
  - SprintSuggestionService combining all services for sprint composition
  - SprintPlanningPrompts for AI system prompts
affects:
  - 10-03: Roadmap AI Service
  - 10-04: MCP integration

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Multi-factor weighted scoring for prioritization
    - AI with algorithmic fallback pattern
    - Confidence scoring with SectionConfidence structure
    - DependencyGraph integration for execution order

key-files:
  created:
    - src/services/ai/SprintCapacityAnalyzer.ts
    - src/services/ai/BacklogPrioritizer.ts
    - src/services/ai/SprintRiskAssessor.ts
    - src/services/ai/SprintSuggestionService.ts
    - src/services/ai/prompts/SprintPlanningPrompts.ts
  modified: []

key-decisions:
  - "20% default buffer for sprint capacity (sustainable pace)"
  - "Multi-factor weights: businessValue 0.4, dependencies 0.25, risk 0.2, effort 0.15"
  - "Fallback to priority-based scoring when AI unavailable"
  - "Use TaskStatus/TaskPriority enums for AITask compatibility"

patterns-established:
  - "AI Service with getFallbackAssessment for graceful degradation"
  - "SectionConfidence with sectionId, sectionName, needsReview fields"
  - "DependencyGraph building from BacklogItems for graph-aware scoring"

# Metrics
duration: 10min
completed: 2026-02-01
---

# Phase 10 Plan 02: Sprint Planning AI Services Summary

**AI sprint planning with capacity analysis, multi-factor prioritization, risk assessment, and composition suggestions**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-01T03:06:00Z
- **Completed:** 2026-02-01T03:16:21Z
- **Tasks:** 3
- **Files created:** 5

## Accomplishments
- SprintCapacityAnalyzer calculates capacity with velocity calibration, team availability, and 20% buffer
- BacklogPrioritizer combines AI business value with algorithmic dependency/effort scoring
- SprintRiskAssessor identifies risks (scope, dependency, capacity, technical, external) with mitigations
- SprintSuggestionService orchestrates all services for optimal sprint composition
- All services include fallback behavior when AI is unavailable

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SprintCapacityAnalyzer and SprintPlanningPrompts** - `b39d2d6` (feat)
2. **Task 2: Create BacklogPrioritizer with multi-factor scoring** - `2099a87` (feat)
3. **Task 3: Create SprintRiskAssessor and SprintSuggestionService** - `3a82306` (feat)

## Files Created

- `src/services/ai/prompts/SprintPlanningPrompts.ts` - AI system prompts for capacity, prioritization, risk, and suggestions
- `src/services/ai/SprintCapacityAnalyzer.ts` - Velocity-based capacity calculation with buffer and confidence
- `src/services/ai/BacklogPrioritizer.ts` - Multi-factor prioritization with DependencyGraph integration
- `src/services/ai/SprintRiskAssessor.ts` - Risk identification with mitigation strategies
- `src/services/ai/SprintSuggestionService.ts` - Combined sprint composition service

## Decisions Made

1. **Default 20% buffer** - Standard buffer for unexpected work and sustainable pace
2. **Multi-factor weights** - Business value (0.4), dependencies (0.25), risk (0.2), effort (0.15) based on industry practice
3. **Fallback behavior** - All services degrade gracefully when AI unavailable using priority-based scoring
4. **Enum usage** - Use TaskStatus/TaskPriority enums for AITask compatibility with DependencyGraph
5. **SectionConfidence structure** - Include sectionId, sectionName, needsReview for proper typing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SectionConfidence type compliance**
- **Found during:** Task 1 (SprintCapacityAnalyzer)
- **Issue:** Return type missing required sectionId, sectionName, needsReview fields
- **Fix:** Added required fields to calculateConfidence method
- **Files modified:** src/services/ai/SprintCapacityAnalyzer.ts
- **Committed in:** b39d2d6

**2. [Rule 3 - Blocking] Fixed TaskStatus/TaskPriority enum usage**
- **Found during:** Task 2 (BacklogPrioritizer)
- **Issue:** String literals not assignable to TaskStatus enum in AITask
- **Fix:** Imported and used TaskStatus.PENDING, TaskPriority enums
- **Files modified:** src/services/ai/BacklogPrioritizer.ts
- **Committed in:** 2099a87

**3. [Rule 1 - Bug] Fixed type spread issue in SprintRiskAssessor**
- **Found during:** Task 3 (SprintRiskAssessor)
- **Issue:** Spread operator made required fields optional in mapped types
- **Fix:** Explicitly mapped all fields instead of spreading
- **Files modified:** src/services/ai/SprintRiskAssessor.ts
- **Committed in:** 3a82306

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered

None - TypeScript type mismatches were resolved as auto-fixes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Sprint planning AI services complete and ready for MCP tool integration
- All services follow fallback pattern for AI unavailability
- Ready for 10-03 (Roadmap AI Service) which builds on these services
- Phase 10-04 will expose these services through MCP tools

---
*Phase: 10-ai-sprint-roadmap-planning*
*Completed: 2026-02-01*
