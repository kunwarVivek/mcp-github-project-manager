# Phase 11: AI Issue Intelligence - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

AI-powered assistance for issue management. Users get intelligent suggestions when working with issues: enriched descriptions, label recommendations, duplicate detection, and related issue linking. This phase delivers the AI analysis layer — it does not create new issue types or workflow automation.

</domain>

<decisions>
## Implementation Decisions

### Issue Enrichment
- Full enrichment: description expansion, acceptance criteria, and structured sections (Problem/Solution/Context/Impact)
- Per-section confidence scores (e.g., "Acceptance Criteria (85%)")
- Enriched output includes suggested labels and potential assignees
- Preserve vs rewrite: Claude decides based on context (short originals → integrated rewrite, long → preserve original at top with AI sections below)

### Label Suggestions
- Prefer existing repository labels, but suggest new labels when no good match exists
- Show all suggestions grouped by confidence tier: High/Medium/Low
- Include rationale for each suggestion (why this label was suggested)
- Learn from issue history (past labeling decisions improve future suggestions)
- All configurable at organization level

### Duplicate Detection
- Search entire issue history (open and closed)
- Tiered response based on confidence:
  - High confidence: auto-link as duplicate
  - Medium confidence: flag for user review
  - Low confidence: don't surface
- Configurable thresholds per organization

### Related Issue Linking
- Detect all relationship types:
  - Semantic similarity (same topic/feature)
  - Dependency chains (blocks/blocked-by)
  - Component grouping (same area of codebase)
- Surface relationships with confidence and relationship type

### Claude's Discretion
- Exact similarity thresholds for duplicate detection
- How to weight different relationship types
- Fallback behavior when AI service is unavailable
- Caching strategy for issue embeddings/analysis

</decisions>

<specifics>
## Specific Ideas

- "World-class defaults, configurable for organizations" — every AI feature should work great out of the box but allow orgs to tune thresholds, enable/disable features, and customize behavior
- Smart defaults that never compromise quality — err on the side of providing more information (rationale, confidence scores, tiered suggestions) rather than less

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-ai-issue-intelligence*
*Context gathered: 2026-02-01*
