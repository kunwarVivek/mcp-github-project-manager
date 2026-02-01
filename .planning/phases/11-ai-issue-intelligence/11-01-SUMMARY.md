---
phase: 11-ai-issue-intelligence
plan: 01
subsystem: ai
tags: [typescript, zod, domain-types, issue-management, ai-intelligence]

# Dependency graph
requires:
  - phase: 10-ai-sprint-roadmap-planning
    provides: SectionConfidence types and SectionConfidenceSchema patterns
provides:
  - Issue enrichment types (AI-17): EnrichedIssue, EnrichedSection, EnrichedIssueSections
  - Label suggestion types (AI-18): LabelSuggestion, LabelSuggestionResult, NewLabelProposal
  - Duplicate detection types (AI-19): DuplicateCandidate, DuplicateDetectionResult
  - Related issue linking types (AI-20): IssueRelationship, RelatedIssueResult
  - Zod schemas for 4 MCP tools input/output validation
affects: [11-02, 11-03, 11-04, ai-services, mcp-tools]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Domain types separate from Zod schemas (same as Phase 10)"
    - "SectionConfidence integration for AI confidence scoring"
    - "Tiered confidence results (high/medium/low) for suggestions"

key-files:
  created:
    - src/domain/issue-intelligence-types.ts
    - src/infrastructure/tools/schemas/issue-intelligence-schemas.ts
  modified: []

key-decisions:
  - "Used tiered confidence (high/medium/low) for label suggestions and duplicate detection"
  - "Separated domain types from Zod schemas following Phase 10 pattern"
  - "Default thresholds: 0.92 high, 0.75 medium for duplicate detection"
  - "Three relationship types: semantic, dependency, component"

patterns-established:
  - "IssueInput as common input type for all issue intelligence tools"
  - "RepositoryLabel/RepositoryContext for repository metadata"
  - "DuplicateAction enum for action recommendations"
  - "RelationshipType/DependencySubType for issue linking semantics"

# Metrics
duration: 4min
completed: 2026-02-01
---

# Phase 11 Plan 01: Domain Types and Schemas Summary

**TypeScript interfaces and Zod schemas for AI-17 to AI-20 issue intelligence features with tiered confidence scoring**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-01T04:48:57Z
- **Completed:** 2026-02-01T04:52:41Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Created 20 TypeScript interfaces for issue enrichment, label suggestions, duplicate detection, and related issue linking
- Created 27 Zod schemas for 4 MCP tools with input/output validation
- Integrated SectionConfidence from ai-types for AI confidence scoring
- Established default configurations for all four AI features

## Task Commits

Each task was committed atomically:

1. **Task 1: Create issue-intelligence-types.ts domain types** - `bd24f1b` (feat)
2. **Task 2: Create issue-intelligence-schemas.ts Zod schemas** - `fc57459` (feat)
3. **Task 3: Verify type consistency and exports** - (verification only, no changes)

## Files Created/Modified
- `src/domain/issue-intelligence-types.ts` - 20 TypeScript interfaces for issue intelligence domain types
- `src/infrastructure/tools/schemas/issue-intelligence-schemas.ts` - 27 Zod schemas for MCP tool input/output validation

## Decisions Made
- **Tiered confidence arrays:** Used high/medium/low arrays instead of single array with tier field for easier consumption
- **Default thresholds:** Set duplicate detection thresholds at 0.92 (high) and 0.75 (medium) based on industry standards
- **Relationship types:** Defined three categories (semantic, dependency, component) with dependency sub-types (blocks, blocked_by, related_to)
- **Separate configs per feature:** Each AI feature (enrichment, labels, duplicates, related) has its own config type

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Domain types ready for AI service implementation in 11-02
- Zod schemas ready for MCP tool registration in 11-03
- All four requirements (AI-17 to AI-20) have type foundation

---
*Phase: 11-ai-issue-intelligence*
*Completed: 2026-02-01*
