---
phase: 11-ai-issue-intelligence
plan: 02
subsystem: ai
tags: [typescript, ai-services, issue-enrichment, label-suggestions, vercel-ai-sdk]

# Dependency graph
requires:
  - phase: 11-01
    provides: Issue intelligence domain types and Zod schemas
provides:
  - IssueEnrichmentAIService for structured issue enrichment (AI-17)
  - LabelSuggestionService for multi-tier label suggestions (AI-18)
  - Prompt templates for issue intelligence AI operations
affects: [11-03, 11-04, mcp-tools]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AI + fallback pattern matching BacklogPrioritizer"
    - "Tiered confidence output (high/medium/low arrays)"
    - "Per-section confidence scoring for enrichment"
    - "Keyword matching fallback when AI unavailable"

key-files:
  created:
    - src/services/ai/prompts/IssueIntelligencePrompts.ts
    - src/services/ai/IssueEnrichmentAIService.ts
    - src/services/ai/LabelSuggestionService.ts
  modified: []

key-decisions:
  - "Preserve original description when >200 chars (substantial threshold)"
  - "Temperature 0.4 for enrichment, 0.3 for labeling (consistency vs creativity balance)"
  - "Fallback provides low confidence (40) with needsReview=true"
  - "Keyword matching caps at 0.8 confidence (can't exceed AI threshold)"

patterns-established:
  - "AIServiceFactory.getInstance() for model access"
  - "generateObject with Zod schema for structured AI responses"
  - "convertSection for AI confidence (0-1) to domain confidence (0-100)"
  - "calculateWeightedScore and getConfidenceTier from ConfidenceScorer"

# Metrics
duration: 7min
completed: 2026-02-01
---

# Phase 11 Plan 02: AI Services - Enrichment and Labels Summary

**AI-powered issue enrichment and label suggestion services with fallback behavior and confidence scoring**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-01T05:01:45Z
- **Completed:** 2026-02-01T05:08:26Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments
- Created IssueIntelligencePrompts.ts with 4 system prompts and 4 formatter functions
- Implemented IssueEnrichmentAIService with enrichIssue method and structured section generation
- Implemented LabelSuggestionService with tiered output and history learning
- Both services follow BacklogPrioritizer pattern (AI + fallback)
- Per-section confidence scoring integrated with ConfidenceScorer

## Task Commits

Each task was committed atomically:

1. **Task 1: Create IssueIntelligencePrompts.ts** - `2c83809` (feat)
   - 4 system prompts for AI-17 through AI-20
   - 4 formatter functions for structured prompt generation

2. **Task 2: Create IssueEnrichmentAIService.ts** - `e84de0f` (feat)
   - enrichIssue method with AI + fallback
   - Preserves original when >200 chars
   - Generates Problem, Solution, Context, Impact, Acceptance Criteria sections

3. **Task 3: Create LabelSuggestionService.ts** - `f74d234` (feat)
   - suggestLabels method with tiered output
   - Learns from issue history patterns
   - Keyword matching fallback

## Files Created

| File | Purpose |
|------|---------|
| `src/services/ai/prompts/IssueIntelligencePrompts.ts` | Prompt templates for all 4 issue intelligence features |
| `src/services/ai/IssueEnrichmentAIService.ts` | AI-powered issue enrichment with structured sections |
| `src/services/ai/LabelSuggestionService.ts` | Multi-tier label suggestions with rationale |

## Key Implementations

### IssueEnrichmentAIService

```typescript
// Structured enrichment with confidence scoring
async enrichIssue(params: {
  issueTitle: string;
  issueDescription: string;
  projectContext?: string;
  repositoryLabels?: string[];
}): Promise<EnrichedIssue>
```

Features:
- Generates 5 structured sections: Problem, Solution, Context, Impact, Acceptance Criteria
- Per-section confidence (0-100)
- Preserves original description when substantial (>200 chars)
- Falls back to basic structure with low confidence when AI unavailable

### LabelSuggestionService

```typescript
// Tiered label suggestions with rationale
async suggestLabels(params: {
  issueTitle: string;
  issueDescription: string;
  existingLabels: Array<{ name: string; description?: string; color?: string }>;
  issueHistory?: Array<{ labels: string[]; title: string }>;
}): Promise<LabelSuggestionResult>
```

Features:
- Output grouped by confidence tier (high >= 0.8, medium >= 0.5, low < 0.5)
- Rationale explaining why each label was suggested
- Learns from issue history when provided
- Keyword matching fallback with fuzzy matching

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| 200 char threshold for preservation | Balances preserving substantial content vs restructuring brief descriptions |
| Temperature 0.4/0.3 | Higher for enrichment (needs creativity), lower for labeling (needs consistency) |
| Fallback score = 40 | Low but not zero - basic structure has some value |
| Keyword matching caps at 0.8 | Prevents overconfident fallback from competing with AI suggestions |

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - services use existing AIServiceFactory configuration.

## Next Phase Readiness
- AI services ready for MCP tool integration in 11-03
- Prompts ready for duplicate detection (AI-19) and related issue linking (AI-20)
- Pattern established for remaining services

---
*Phase: 11-ai-issue-intelligence*
*Completed: 2026-02-01*
