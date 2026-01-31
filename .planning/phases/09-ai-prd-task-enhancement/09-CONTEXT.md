# Phase 9: AI PRD and Task Enhancement - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve AI-powered PRD and task generation with confidence signals, customization, and iterative refinement. Covers:
- Feature extraction accuracy improvements (AI-01)
- Confidence scores for generated sections (AI-02)
- PRD template customization (AI-03)
- PRD validation against best practices (AI-04)
- Task complexity estimation accuracy (AI-05)
- Dependency detection between tasks (AI-06)
- Effort estimation for tasks (AI-07)
- Task templates (AI-08)

</domain>

<decisions>
## Implementation Decisions

### Confidence Scoring
- **Display format:** Tiered labels (High/Medium/Low) with percentage on hover/expand
- **Scoring factors:** Weighted combination of:
  1. Input completeness (description length, examples, constraints provided)
  2. AI model certainty (self-assessment or token probabilities)
  3. Pattern matching (similarity to known successful PRD/task patterns)
- **Low-confidence actions:** All three responses:
  1. Auto-generate clarifying questions for low-confidence areas
  2. Highlight sections for human review
  3. Iteratively fetch more context via MCP tools and re-generate
- **Thresholds:** Smart defaults (70% for warnings, 50% for errors) with org-configurable override

### Template Customization
- **Input formats:** Auto-detect and support all three:
  1. Markdown with `{{placeholders}}`
  2. JSON schema with field types and constraints
  3. Example-based (provide sample, AI learns pattern)
- **Storage locations:** Precedence order:
  1. Project-level (`.planning/templates/`)
  2. Org repo (`.github/templates/`)
  3. External URL reference
- **Composition:** Full flexibility - both inheritance (base + overrides) AND section composition (mix-and-match)
- **Validation:** All three checks:
  1. Syntax validation (placeholders valid, structure parses)
  2. Coverage validation (warn if missing recommended sections)
  3. Live preview with sample data before saving

### Validation Feedback
- **Issue categorization:** Severity (critical/major/minor) + category (completeness/clarity/feasibility)
- **Auto-fix behavior:** Configurable per issue type:
  - Trivial issues (formatting, typos): auto-fix with undo
  - Substantive issues (missing sections, unclear scope): suggest diff, user approves
- **Best practices:** Layered ruleset:
  1. Built-in curated rules (completeness, clarity, testability, scope)
  2. Optional industry standards (IEEE/ISO/PMBOK)
  3. Organization-specific custom rules
- **Integration:** Hybrid validation timing:
  - Continuous for quick syntax/formatting checks
  - Stage-gated comprehensive validation at checkpoints (draft complete, before planning)

### Estimation Accuracy
- **Effort units:** Configurable per org (story points 1-13, T-shirt sizes, or hours/days)
  - Default: Story points (Fibonacci) as most common agile practice
- **Calibration:** Multi-signal approach:
  1. Retrospective comparison (estimate vs actual)
  2. Team velocity tracking
  3. Cross-project learning from similar tasks (anonymized)
- **Dependency detection:** Graph-based reasoning:
  - Allow explicit dependency marking
  - Auto-detect implicit dependencies via keyword analysis and code impact
  - Build task graph for critical path identification
- **MCP integration:** Recursive context expansion:
  - When confidence is low, automatically fetch related context via MCP tools
  - Iterate until confidence threshold met or user intervention needed

### Claude's Discretion
- Specific AI model prompting strategies
- Caching and performance optimization for recursive calls
- Internal data structures for graph-based dependency analysis
- Specific UI/UX for confidence display beyond format decisions
- Technical implementation of template parsing

</decisions>

<specifics>
## Specific Ideas

- **"Never compromise for a world class product"** - User expects best-in-class defaults that work out of the box
- **"Smart defaults yet configurable for orgs"** - Pattern: sensible defaults + org-level override capability
- **Recursive context expansion via MCP** - Key feature: when AI lacks confidence, it should autonomously gather more context using available MCP tools and re-attempt generation
- **Iterative refinement loop** - Low confidence should trigger: questions → more context → re-generate → validate → repeat until satisfactory

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-ai-prd-task-enhancement*
*Context gathered: 2026-01-31*
