# Phase 9: AI PRD and Task Enhancement - Research

**Researched:** 2026-01-31
**Domain:** AI-powered PRD generation, task estimation, confidence scoring, and template customization
**Confidence:** MEDIUM-HIGH

## Summary

Phase 9 enhances the existing AI-powered PRD and task generation with confidence signals, customization, and iterative refinement. The codebase has a solid foundation with `PRDGenerationService`, `TaskGenerationService`, `AITaskProcessor`, and the `ai` package (Vercel AI SDK) for structured generation.

The key enhancements involve:
1. **Confidence Scoring** - Add multi-factor confidence scores to all AI-generated content with tiered display (High/Medium/Low)
2. **Template Systems** - Support custom PRD/task templates with auto-detection (Markdown/JSON/example-based)
3. **Validation Framework** - Layered validation rules with severity-based feedback and auto-fix suggestions
4. **Estimation Calibration** - Story point estimation with retrospective comparison and cross-project learning
5. **Dependency Detection** - Graph-based dependency analysis with NLP keyword extraction
6. **Iterative Refinement** - Recursive context expansion via MCP tools when confidence is low

**Primary recommendation:** Extend existing AI types with confidence metadata per section, implement Handlebars-based template engine with Zod schema validation, add graph-based dependency analysis, and create a feedback loop for estimation calibration.

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| ai | ^4.3.16 | Vercel AI SDK for structured generation | Installed |
| zod | ^3.25.32 | Schema validation and type inference | Installed |
| zod-to-json-schema | ^3.25.1 | JSON Schema generation from Zod | Installed |
| uuid | ^11.1.0 | Unique ID generation | Installed |
| cockatiel | ^3.2.1 | Resilience policies for AI calls | Installed |

### New Dependencies

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| handlebars | ^4.7.8 | Template engine | Logic-less, supports partials/helpers, compatible with Mustache syntax for `{{placeholders}}` |
| graphlib | ^2.1.8 | Graph algorithms for dependency analysis | Stable, well-tested, supports topological sort and cycle detection |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| handlebars | mustache | Handlebars has helpers/conditionals; Mustache is simpler but less flexible |
| handlebars | nunjucks | Nunjucks more powerful but heavier; Handlebars is sufficient for PRD templates |
| graphlib | cytoscape.js | Cytoscape is for visualization; graphlib is lightweight for analysis only |

**Installation:**
```bash
npm install handlebars graphlib @types/graphlib
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── domain/
│   ├── ai-types.ts           # MODIFY: Add confidence types
│   └── template-types.ts     # NEW: Template schema types
├── services/
│   ├── PRDGenerationService.ts    # MODIFY: Add confidence scoring
│   ├── TaskGenerationService.ts   # MODIFY: Add estimation calibration
│   ├── ai/
│   │   ├── ConfidenceScorer.ts          # NEW: Multi-factor confidence
│   │   ├── ConfidenceCalibrator.ts      # NEW: Calibration feedback loop
│   │   └── prompts/
│   │       └── ConfidencePrompts.ts     # NEW: Self-assessment prompts
│   └── templates/
│       ├── TemplateEngine.ts            # NEW: Handlebars wrapper
│       ├── TemplateParser.ts            # NEW: Auto-detect format
│       └── TemplateValidator.ts         # NEW: Syntax/coverage validation
├── infrastructure/
│   └── validation/
│       ├── PRDValidator.ts              # NEW: Best practices validation
│       ├── ValidationRuleEngine.ts      # NEW: Layered ruleset
│       └── rules/
│           ├── CompletenessRules.ts     # NEW
│           ├── ClarityRules.ts          # NEW
│           └── FeasibilityRules.ts      # NEW
└── analysis/
    ├── DependencyGraph.ts               # NEW: Graph-based analysis
    ├── KeywordExtractor.ts              # NEW: NLP for implicit deps
    └── EstimationCalibrator.ts          # NEW: Historical comparison
```

### Pattern 1: Multi-Factor Confidence Scoring

**What:** Calculate confidence per section using weighted combination of input quality, AI self-assessment, and pattern matching.

**When to use:** Every AI generation call (PRD sections, tasks, estimations).

**Source:** Based on [Vercel AI SDK structured output](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) + research on [LLM confidence calibration](https://arxiv.org/html/2406.03441v1).

**Example:**
```typescript
// Source: Codebase pattern from AIGenerationMetadata + research best practices
interface SectionConfidence {
  sectionId: string;
  score: number;                // 0-100
  tier: 'high' | 'medium' | 'low';
  factors: {
    inputCompleteness: number;  // 0-1, based on input length/examples
    aiSelfAssessment: number;   // 0-1, from AI model
    patternMatch: number;       // 0-1, similarity to known good patterns
  };
  clarifyingQuestions?: string[];  // Generated when low confidence
}

// In AI generation, request self-assessment
const result = await generateObject({
  model,
  schema: z.object({
    content: PRDSectionSchema,
    confidenceAssessment: z.object({
      score: z.number().min(0).max(100),
      reasoning: z.string(),
      uncertainAreas: z.array(z.string()),
      clarifyingQuestions: z.array(z.string()).optional()
    })
  }),
  prompt: formatPrompt(template, { ...input, requestConfidence: true })
});
```

### Pattern 2: Template Auto-Detection and Parsing

**What:** Detect template format (Markdown, JSON Schema, or example-based) and parse accordingly.

**When to use:** When user provides custom PRD or task templates.

**Example:**
```typescript
// Source: Handlebars docs + Zod patterns from codebase
import Handlebars from 'handlebars';
import { z } from 'zod';

type TemplateFormat = 'markdown' | 'json-schema' | 'example-based';

interface ParsedTemplate {
  format: TemplateFormat;
  sections: TemplateSection[];
  placeholders: string[];
  validators: ZodValidator[];
}

function detectTemplateFormat(input: string): TemplateFormat {
  try {
    const parsed = JSON.parse(input);
    if (parsed.$schema || parsed.type === 'object') return 'json-schema';
    if (parsed.example || parsed.sample) return 'example-based';
  } catch {
    // Not JSON, check for markdown with placeholders
    if (input.includes('{{') && input.includes('}}')) return 'markdown';
  }
  return 'example-based'; // Default: treat as example
}

// Compile markdown template with Handlebars
const template = Handlebars.compile(markdownInput);
const output = template({ projectName, features, timeline });
```

### Pattern 3: Graph-Based Dependency Detection

**What:** Build task dependency graph, detect implicit dependencies via keyword analysis, and identify critical path.

**When to use:** After task generation, for dependency auto-detection and validation.

**Example:**
```typescript
// Source: graphlib docs + TaskGenerationService existing patterns
import { Graph, alg } from 'graphlib';

class DependencyGraph {
  private graph: Graph;

  constructor() {
    this.graph = new Graph({ directed: true });
  }

  addTask(task: AITask): void {
    this.graph.setNode(task.id, task);

    // Add explicit dependencies
    for (const dep of task.dependencies) {
      this.graph.setEdge(dep.id, task.id, { type: dep.type });
    }
  }

  detectImplicitDependencies(tasks: AITask[]): TaskDependency[] {
    const implicit: TaskDependency[] = [];

    // Keyword-based detection (existing pattern from TaskGenerationService)
    const patterns = [
      { keywords: ['setup', 'infrastructure', 'database'], dependsOn: [] },
      { keywords: ['api', 'endpoint'], dependsOn: ['setup', 'database'] },
      { keywords: ['ui', 'frontend'], dependsOn: ['api'] },
      { keywords: ['test'], dependsOn: ['implementation'] }
    ];

    // Use existing detectTaskDependencies logic + enhance
    return implicit;
  }

  getCriticalPath(): string[] {
    // Topological sort for execution order
    const sorted = alg.topsort(this.graph);
    // Find longest path (critical path)
    return sorted;
  }

  detectCycles(): string[][] {
    const cycles = alg.findCycles(this.graph);
    return cycles;
  }
}
```

### Pattern 4: Layered Validation Rule Engine

**What:** Validation rules organized in layers (built-in, optional standards, custom) with severity levels.

**When to use:** PRD validation, task validation, before planning stages.

**Example:**
```typescript
// Source: Research on PRD validation best practices
interface ValidationRule {
  id: string;
  name: string;
  layer: 'builtin' | 'standard' | 'custom';
  severity: 'critical' | 'major' | 'minor';
  category: 'completeness' | 'clarity' | 'feasibility' | 'testability';
  check: (prd: PRDDocument) => ValidationResult;
  autoFix?: (prd: PRDDocument) => PRDDocument;
}

interface ValidationResult {
  passed: boolean;
  message: string;
  location?: string;
  suggestedFix?: string;
  diff?: { before: string; after: string };
}

// Built-in rules (always applied)
const completenessRules: ValidationRule[] = [
  {
    id: 'BR-001',
    name: 'Overview Required',
    layer: 'builtin',
    severity: 'critical',
    category: 'completeness',
    check: (prd) => ({
      passed: prd.overview?.length >= 100,
      message: 'PRD overview must be at least 100 characters',
      suggestedFix: 'Expand the overview with project goals and context'
    })
  },
  // ... more rules
];
```

### Anti-Patterns to Avoid

- **Global confidence scores only:** Per-section confidence is more actionable than one overall score
- **Blocking on low confidence:** Low confidence should trigger questions/refinement, not hard failures
- **Ignoring calibration data:** Estimation accuracy requires historical comparison; don't reset each session
- **Tight coupling to template format:** Support multiple formats via auto-detection, not format-specific code

## Don't Hand-Roll

Problems with existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Template engine | Custom placeholder parser | Handlebars | Edge cases (escaping, nested), partials, helpers |
| Graph algorithms | BFS/DFS from scratch | graphlib | Cycle detection, topological sort, tested edge cases |
| Confidence calibration | Simple averaging | Log-linear regression | Token probabilities are overconfident; needs calibration curve |
| Markdown parsing | Regex-based parser | remark/markdown-it | Handles edge cases, extensible |

**Key insight:** LLMs are known to be overconfident in their self-assessments. Research shows calibration is essential - the self-reported confidence needs adjustment based on actual accuracy measured over time.

## Common Pitfalls

### Pitfall 1: LLM Overconfidence

**What goes wrong:** LLMs tend to express high confidence even when wrong.
**Why it happens:** Training on human-like confidence expression leads to overconfidence patterns.
**How to avoid:**
1. Never trust raw AI confidence scores directly
2. Use multi-signal approach: input quality + AI assessment + pattern matching
3. Track actual accuracy and calibrate over time
**Warning signs:** Confidence scores consistently above 80% regardless of input quality.

**Source:** [Research on LLM confidence calibration](https://medium.com/@vatvenger/confidence-unlocked-a-method-to-measure-certainty-in-llm-outputs-1d921a4ca43c)

### Pitfall 2: Template Injection Vulnerabilities

**What goes wrong:** User-provided templates could inject malicious content or break generation.
**Why it happens:** Treating templates as trusted input.
**How to avoid:**
1. Validate template syntax before compilation
2. Limit available Handlebars helpers (no exec, no file access)
3. Sanitize placeholder values
**Warning signs:** Templates with `{{#if}}` blocks containing executable code.

### Pitfall 3: Circular Dependencies in Tasks

**What goes wrong:** AI generates tasks that depend on each other in a cycle.
**Why it happens:** AI doesn't track full dependency graph during generation.
**How to avoid:**
1. Run cycle detection after dependency assignment
2. Present cycles to user for resolution
3. Use topological sort to validate execution order
**Warning signs:** Task A depends on B which depends on C which depends on A.

### Pitfall 4: Estimation Drift Without Calibration

**What goes wrong:** Estimates stay wrong because no feedback loop exists.
**Why it happens:** No comparison of estimates to actuals; no cross-project learning.
**How to avoid:**
1. Store estimate vs actual for completed tasks
2. Calculate calibration factor per complexity band
3. Apply calibration to new estimates
**Warning signs:** Consistent over/under estimation patterns.

## Code Examples

### Confidence-Aware PRD Generation

```typescript
// Source: Extend existing PRDGenerationService pattern
import { generateObject } from 'ai';
import { z } from 'zod';

const PRDWithConfidenceSchema = z.object({
  content: PRDDocumentSchema,
  sectionConfidence: z.array(z.object({
    sectionName: z.string(),
    score: z.number().min(0).max(100),
    tier: z.enum(['high', 'medium', 'low']),
    reasoning: z.string(),
    clarifyingQuestions: z.array(z.string()).optional()
  }))
});

async function generatePRDWithConfidence(
  input: PRDGenerationInput,
  config: ConfidenceConfig
): Promise<PRDWithConfidence> {
  // Calculate input completeness factor
  const inputCompleteness = calculateInputCompleteness(input);

  const result = await generateObject({
    model,
    schema: PRDWithConfidenceSchema,
    prompt: formatPrompt(PRD_CONFIDENCE_PROMPT, {
      ...input,
      requestConfidenceAssessment: true,
      inputCompletenessScore: inputCompleteness
    })
  });

  // Apply confidence thresholds
  const sections = result.object.sectionConfidence;
  const lowConfidenceSections = sections.filter(s => s.score < config.warningThreshold);

  if (lowConfidenceSections.length > 0 && config.enableIterativeRefinement) {
    // Trigger clarifying questions or MCP context fetch
    return await refineWithMoreContext(result.object, lowConfidenceSections);
  }

  return result.object;
}
```

### Template Validation with Zod

```typescript
// Source: Combine Handlebars with Zod validation
import Handlebars from 'handlebars';
import { z } from 'zod';

const TemplateSchema = z.object({
  sections: z.array(z.object({
    name: z.string(),
    required: z.boolean(),
    minLength: z.number().optional()
  })),
  placeholders: z.array(z.string())
});

class TemplateValidator {
  validate(templateSource: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Syntax validation
    try {
      Handlebars.precompile(templateSource);
    } catch (e) {
      errors.push(`Syntax error: ${e.message}`);
    }

    // 2. Extract placeholders
    const placeholders = this.extractPlaceholders(templateSource);

    // 3. Coverage validation (recommended sections)
    const recommended = ['overview', 'objectives', 'features', 'timeline'];
    const missing = recommended.filter(
      r => !placeholders.some(p => p.toLowerCase().includes(r))
    );
    if (missing.length > 0) {
      warnings.push(`Missing recommended sections: ${missing.join(', ')}`);
    }

    return { valid: errors.length === 0, errors, warnings, placeholders };
  }

  private extractPlaceholders(source: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = [...source.matchAll(regex)];
    return matches.map(m => m[1].trim());
  }
}
```

### Estimation Calibration

```typescript
// Source: Research on ML-based story point estimation
interface EstimationRecord {
  taskId: string;
  estimatedPoints: number;
  actualPoints?: number;
  complexityBand: 'low' | 'medium' | 'high';
  completedAt?: string;
}

class EstimationCalibrator {
  private records: EstimationRecord[] = [];

  recordEstimate(task: AITask, estimate: number): void {
    this.records.push({
      taskId: task.id,
      estimatedPoints: estimate,
      complexityBand: this.getComplexityBand(task.complexity)
    });
  }

  recordActual(taskId: string, actual: number): void {
    const record = this.records.find(r => r.taskId === taskId);
    if (record) {
      record.actualPoints = actual;
      record.completedAt = new Date().toISOString();
    }
  }

  getCalibrationFactor(complexityBand: 'low' | 'medium' | 'high'): number {
    const completed = this.records.filter(
      r => r.actualPoints && r.complexityBand === complexityBand
    );

    if (completed.length < 5) return 1.0; // Not enough data

    // Calculate average ratio of actual/estimated
    const ratios = completed.map(r => r.actualPoints! / r.estimatedPoints);
    return ratios.reduce((a, b) => a + b, 0) / ratios.length;
  }

  calibrateEstimate(rawEstimate: number, complexity: TaskComplexity): number {
    const band = this.getComplexityBand(complexity);
    const factor = this.getCalibrationFactor(band);
    return Math.round(rawEstimate * factor);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single overall confidence | Per-section confidence with factors | 2024-2025 | More actionable, supports iterative refinement |
| Static templates | Auto-detecting multi-format templates | 2024 | User flexibility, better adoption |
| Manual dependency marking | NLP + explicit hybrid detection | 2025 | Catches implicit dependencies |
| Point estimates only | Estimate ranges with calibration | 2024-2025 | More realistic, accounts for uncertainty |

**Deprecated/outdated:**
- `generateObject` and `streamObject` in AI SDK: Deprecated in favor of `generateText`/`streamText` with `output` property (AI SDK 6)
- Single-pass PRD generation: Iterative refinement with confidence feedback is now standard

## Open Questions

1. **Calibration Data Persistence**
   - What we know: Need to store estimate vs actual data for calibration
   - What's unclear: Where to persist? File system? Database? Per-project or global?
   - Recommendation: Start with file-based per-project JSON, migrate to DB if needed

2. **MCP Tool Access for Context Expansion**
   - What we know: CONTEXT.md specifies recursive context fetch via MCP tools
   - What's unclear: Which MCP tools to call for what context? Rate limits?
   - Recommendation: Define context-expansion tool registry with fallback order

3. **AI SDK 6 Migration**
   - What we know: `generateObject` is deprecated; should use `generateText` with `output`
   - What's unclear: Current codebase uses `generateObject` extensively
   - Recommendation: Plan migration as part of this phase or defer to maintenance phase

## Sources

### Primary (HIGH confidence)
- [Vercel AI SDK Core: Generating Structured Data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) - Structured output patterns
- [Zod Documentation](https://zod.dev/) - Schema validation patterns
- Codebase: `src/services/ai/AITaskProcessor.ts` - Existing generation patterns
- Codebase: `src/domain/ai-types.ts` - Type definitions with confidence field

### Secondary (MEDIUM confidence)
- [Handlebars.js Documentation](https://handlebarsjs.com/) - Template engine usage
- [graphlib GitHub](https://github.com/dagrejs/graphlib) - Graph algorithms
- [AI Hero: Structured Outputs with Vercel AI SDK](https://www.aihero.dev/structured-outputs-with-vercel-ai-sdk) - Practical patterns
- [ChatPRD: Using AI to write PRD](https://www.chatprd.ai/resources/using-ai-to-write-prd) - PRD generation best practices
- [ML-based Story Point Estimation](https://ieeexplore.ieee.org/document/9582288/) - Industrial experience

### Tertiary (LOW confidence - needs validation)
- [Cycles of Thought: Measuring LLM Confidence](https://arxiv.org/html/2406.03441v1) - Confidence measurement research
- [Confidence in LLM Outputs](https://medium.com/@vatvenger/confidence-unlocked-a-method-to-measure-certainty-in-llm-outputs-1d921a4ca43c) - Calibration approaches
- [How AI Simplifies Task Dependency Management](https://magai.co/ai-task-dependency-management/) - NLP dependency detection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Already installed, well-documented
- Confidence scoring: MEDIUM - Research-backed but implementation patterns vary
- Template system: HIGH - Handlebars well-proven, Zod patterns established
- Dependency detection: MEDIUM - graphlib solid, NLP approach less validated
- Calibration: MEDIUM - ML research solid, implementation specifics TBD
- AI SDK deprecation: HIGH - Documented in official sources

**Research date:** 2026-01-31
**Valid until:** 60 days (stable domain, AI SDK changes to monitor)
