# Phase 10: AI Sprint and Roadmap Planning - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

AI services that suggest sprint composition and generate roadmaps from requirements. This phase adds AI intelligence to sprint and roadmap operations — the foundational GitHub project operations already exist from prior phases. Focus is on AI-powered suggestions, not new GitHub API integrations.

</domain>

<decisions>
## Implementation Decisions

### Sprint Suggestions Output
- Return structured data with confidence scores (following Phase 9 ConfidenceScorer pattern)
- Include reasoning for each suggestion (capacity, prioritization, risk)
- Suggestions are advisory — user decides what to accept
- Use existing AI service patterns (AIServiceFactory, resilience, fallback)

### Roadmap Generation Flow
- Input: requirements list (text or structured), optional constraints (timeline, team size)
- Output: structured roadmap with phases, milestones, dependencies
- One-shot generation with optional refinement via follow-up calls
- Follow PRDGenerationService pattern for consistent AI integration

### Risk and Prioritization
- Risk levels: high/medium/low with probability scores
- Include mitigation suggestions for high-risk items
- Prioritization uses business value + dependencies + risk as factors
- Return reasoning with each prioritization decision

### Velocity and Estimation
- Accept velocity as input parameter (points/sprint or hours/sprint)
- Use EstimationCalibrator from Phase 9 for effort estimation integration
- Milestone dates calculated from scope + velocity + buffer factor
- Support recalculation when velocity data updates

### Claude's Discretion
- Exact prompt engineering for each AI operation
- Buffer factor percentages for milestone estimation
- Confidence threshold levels for suggestions
- Default values when velocity/capacity not provided

</decisions>

<specifics>
## Specific Ideas

- Follow the existing service patterns: PRDGenerationService, TaskGenerationService
- Integrate with Phase 9 services (ConfidenceScorer, DependencyGraph, EstimationCalibrator)
- MCP tools should match existing annotation patterns (readOnly for analysis, standard for generation)
- Test patterns should match Phase 9 (mock AI, test fallback paths)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-ai-sprint-roadmap-planning*
*Context gathered: 2026-02-01*
