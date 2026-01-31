---
phase: 09-ai-prd-task-enhancement
plan: 01
subsystem: ai-services
tags: [confidence-scoring, templates, ai-generation, zod-schemas]

dependency_graph:
  requires: []
  provides:
    - "SectionConfidence and ConfidenceConfig types"
    - "ConfidenceScorer multi-factor scoring service"
    - "CONFIDENCE_PROMPT_CONFIGS for AI self-assessment"
    - "Template types for PRD generation"
  affects:
    - "09-02 (Template Engine)"
    - "09-03 (AI Enhancement Integration)"
    - "09-04 (Review Workflow)"

tech_stack:
  added: []
  patterns:
    - "Multi-factor weighted scoring algorithm"
    - "Zod schema extension with withConfidenceAssessment"
    - "Discriminated union for template sources"

key_files:
  created:
    - src/domain/template-types.ts
    - src/services/ai/ConfidenceScorer.ts
    - src/services/ai/prompts/ConfidencePrompts.ts
  modified:
    - src/domain/ai-types.ts

decisions:
  - key: "confidence-thresholds"
    choice: "warning: 70, error: 50"
    rationale: "Provides actionable tiers (high/medium/low) for review prioritization"
  - key: "scoring-weights"
    choice: "input: 0.3, ai-self: 0.4, pattern: 0.3"
    rationale: "AI self-assessment weighted highest as most contextual signal"
  - key: "max-clarifying-questions"
    choice: "5 questions max"
    rationale: "Keeps user feedback requests focused and actionable"

metrics:
  duration: "5 minutes"
  completed: "2026-01-31"
---

# Phase 09 Plan 01: Confidence Scoring Foundation Summary

**One-liner:** Multi-factor confidence scoring with input completeness, AI self-assessment, and pattern matching for PRD/task generation quality measurement.

## What Was Built

### 1. Confidence Scoring Types (ai-types.ts)

Added foundational types for per-section confidence scoring:

- `ConfidenceTier`: 'high' | 'medium' | 'low' based on score thresholds
- `ConfidenceFactors`: Three-factor scoring (inputCompleteness, aiSelfAssessment, patternMatch)
- `SectionConfidence`: Complete section scoring with reasoning and clarifying questions
- `ConfidenceConfig`: Configurable thresholds with defaults (warning: 70, error: 50)
- Corresponding Zod schemas for runtime validation

### 2. Template Types (template-types.ts)

New file with template-related types for PRD generation:

- `TemplateFormat`: 'markdown' | 'json-schema' | 'example-based'
- `TemplateSection`: Section definition with validation constraints
- `ParsedTemplate`: Full parsed template structure
- `TemplateValidationResult`: Validation errors/warnings
- `TemplateSource`: Discriminated union for project/org/url/inline sources
- `TemplateConfig`: Template configuration with inheritance support

### 3. ConfidenceScorer Service (ConfidenceScorer.ts)

Multi-factor scoring service with exported functions:

- `calculateInputCompleteness(input)`: Scores 0-1 based on description, examples, constraints, context, requirements
- `getConfidenceTier(score, config)`: Converts 0-100 score to tier
- `calculateWeightedScore(factors, weights)`: Combines factors with configurable weights
- `generateClarifyingQuestions(sectionName, factors, uncertainAreas)`: Creates up to 5 targeted questions
- `ConfidenceScorer` class: Full service with `calculateSectionConfidence`, `aggregateConfidence`, config management

### 4. Confidence Prompts (ConfidencePrompts.ts)

AI self-assessment prompts and utilities:

- `AIConfidenceAssessmentSchema`: Zod schema for structured AI confidence responses
- `CONFIDENCE_PROMPT_CONFIGS`: Prompt configurations for:
  - PRD section assessment
  - Task definition assessment
  - Dependency detection assessment
  - Effort estimation assessment
- `selfAssessmentSuffix`: Reusable prompt suffix for any generation
- `formatConfidencePrompt`: Variable substitution helper
- `withConfidenceAssessment<T>`: Zod schema extension function

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 3ba6dd2 | Add confidence scoring and template types to domain |
| 2 | 2b875b6 | Add ConfidenceScorer service for multi-factor scoring |
| 3 | b351547 | Add confidence prompts for AI self-assessment |

## Key Design Decisions

### Weighted Scoring Formula

```
score = (inputCompleteness * 0.3) + (aiSelfAssessment * 0.4) + (patternMatch * 0.3)
```

AI self-assessment weighted highest because it captures contextual understanding that static analysis cannot.

### Pattern Matching Heuristics

Section-type-specific checks:
- Overview sections: Look for "problem", "solution", "value" keywords
- Feature sections: Check for examples and constraints presence
- User/Persona sections: Require substantial description length (>200 chars)

Results cached by section name + input hash prefix.

### Clarifying Question Generation

Questions generated only for `low` tier sections to avoid noise. Sources:
1. Low input completeness triggers generic detail requests
2. Low pattern match triggers standards/pattern questions
3. AI's uncertain areas converted to clarification requests

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Plan 02 (Template Engine) can proceed. Required foundation:
- Template types exported from `template-types.ts`
- Confidence scoring infrastructure ready for integration
- Prompt configurations available for AI-powered template processing
