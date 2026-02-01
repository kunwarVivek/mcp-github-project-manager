# Phase 10: AI Sprint and Roadmap Planning - Research

**Researched:** 2026-02-01
**Domain:** AI-powered sprint capacity planning, prioritization, risk assessment, and roadmap generation
**Confidence:** MEDIUM-HIGH

## Summary

Phase 10 adds AI intelligence to sprint composition and roadmap generation. The codebase has a solid foundation with `SprintPlanningService` for basic sprint CRUD, `RoadmapPlanningService` for roadmap generation, and Phase 9's `ConfidenceScorer`, `DependencyGraph`, and `EstimationCalibrator` for AI-enhanced analysis.

This phase builds on these foundations to add:
1. **Sprint Capacity Planning** - AI suggests sprint composition based on velocity and team capacity
2. **Backlog Prioritization** - Multi-factor AI prioritization with business value, dependencies, and risk
3. **Sprint Risk Assessment** - Identify and quantify risks with mitigation suggestions
4. **Sprint Scope Recommendations** - Velocity-based scope suggestions with buffer factors
5. **Roadmap Generation** - Structured roadmap from requirements with phases, milestones, dependencies

**Primary recommendation:** Extend existing services (SprintPlanningService, RoadmapPlanningService) with AI-powered suggestion methods. Use Phase 9 patterns (ConfidenceScorer for confidence signals, DependencyGraph for dependency analysis, EstimationCalibrator for effort calibration). New AI prompts should follow existing AITaskProcessor patterns with structured Zod output schemas.

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| ai | ^4.3.16 | Vercel AI SDK for structured generation | Installed |
| zod | ^3.25.32 | Schema validation and type inference | Installed |
| graphlib | ^2.1.8 | Graph algorithms (from Phase 9) | Installed |
| uuid | ^11.1.0 | Unique ID generation | Installed |
| cockatiel | ^3.2.1 | Resilience policies for AI calls | Installed |

### From Phase 9 (Reuse)

| Service/Module | Location | Purpose for Phase 10 |
|----------------|----------|----------------------|
| ConfidenceScorer | `src/services/ai/ConfidenceScorer.ts` | Confidence scoring for sprint suggestions |
| EstimationCalibrator | `src/analysis/EstimationCalibrator.ts` | Velocity-based effort estimation |
| DependencyGraph | `src/analysis/DependencyGraph.ts` | Dependency analysis for prioritization |
| AIServiceFactory | `src/services/ai/AIServiceFactory.ts` | Model selection with resilience |
| AITaskProcessor | `src/services/ai/AITaskProcessor.ts` | Prompt formatting patterns |

### No New Dependencies Required

This phase reuses existing infrastructure. No new packages needed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── domain/
│   ├── ai-types.ts              # MODIFY: Add sprint suggestion types
│   └── sprint-planning-types.ts # NEW: Sprint AI types with confidence
├── services/
│   ├── SprintPlanningService.ts    # MODIFY: Add AI suggestion methods
│   ├── RoadmapPlanningService.ts   # MODIFY: Enhance with confidence + velocity
│   ├── ai/
│   │   ├── SprintSuggestionService.ts    # NEW: AI sprint suggestions
│   │   ├── RoadmapAIService.ts           # NEW: Enhanced roadmap AI
│   │   └── prompts/
│   │       ├── SprintPlanningPrompts.ts  # NEW: Sprint AI prompts
│   │       └── RoadmapPrompts.ts         # NEW: Roadmap generation prompts
│   └── analysis/
│       ├── SprintCapacityAnalyzer.ts     # NEW: Capacity analysis
│       ├── SprintRiskAssessor.ts         # NEW: Risk assessment
│       └── BacklogPrioritizer.ts         # NEW: Multi-factor prioritization
└── infrastructure/
    └── tools/
        └── sprint-planning-tools.ts      # NEW: MCP tools for sprint AI
```

### Pattern 1: Sprint Capacity Planning with Velocity

**What:** AI-powered capacity calculation using historical velocity and team availability.

**When to use:** Before sprint planning to determine achievable scope.

**Source:** Existing `EstimationCalibrator` pattern + [Sprint Capacity Planning research](https://www.scrum-institute.org/blog/How_To_Plan_Capacity_Of_Your_Scrum_Teams)

**Example:**
```typescript
// Source: Extend EstimationCalibrator pattern for sprint-level capacity
interface SprintCapacity {
  totalPoints: number;           // Calculated from velocity + buffer
  recommendedLoad: number;       // 80% of total for sustainability
  teamAvailability: TeamAvailability;
  buffer: {
    percentage: number;          // Default 20%
    reasoning: string;
  };
  confidence: SectionConfidence;
}

interface CapacityInput {
  velocity: number | 'auto';     // Points/sprint or auto-calculate
  sprintDurationDays: number;
  teamMembers: TeamMember[];
  historicalSprints?: Sprint[];  // For velocity calculation
}

class SprintCapacityAnalyzer {
  constructor(
    private estimationCalibrator: EstimationCalibrator,
    private confidenceScorer: ConfidenceScorer
  ) {}

  async calculateCapacity(input: CapacityInput): Promise<SprintCapacity> {
    // 1. Determine velocity (from input or historical data)
    const velocity = input.velocity === 'auto'
      ? this.calculateVelocityFromHistory(input.historicalSprints)
      : input.velocity;

    // 2. Calculate team availability
    const availability = this.calculateTeamAvailability(input.teamMembers);

    // 3. Apply calibration factor from EstimationCalibrator
    const calibrationFactor = this.estimationCalibrator.getCalibrationFactor('medium');
    const calibratedVelocity = velocity * (calibrationFactor ?? 1.0);

    // 4. Apply buffer (default 20% for breathing room)
    const bufferPercentage = 0.20;
    const recommendedLoad = Math.floor(calibratedVelocity * (1 - bufferPercentage));

    // 5. Calculate confidence
    const confidence = this.confidenceScorer.calculateSectionConfidence({
      sectionId: 'capacity',
      sectionName: 'Sprint Capacity',
      inputData: {
        description: `Velocity: ${velocity}, Team: ${input.teamMembers.length}`,
        examples: input.historicalSprints?.map(s => s.title)
      },
      aiSelfAssessment: input.historicalSprints?.length >= 3 ? 0.8 : 0.5,
      patternMatchScore: availability.confidence
    });

    return {
      totalPoints: Math.floor(calibratedVelocity),
      recommendedLoad,
      teamAvailability: availability,
      buffer: {
        percentage: bufferPercentage * 100,
        reasoning: 'Standard 20% buffer for unexpected work and sustainable pace'
      },
      confidence
    };
  }
}
```

### Pattern 2: Multi-Factor Backlog Prioritization

**What:** AI prioritizes backlog items using business value, dependencies, risk, and effort.

**When to use:** Sprint planning to determine which items to include.

**Source:** [LLM-based Sprint Planning research](https://arxiv.org/html/2512.18966) + existing `DependencyGraph` pattern

**Example:**
```typescript
// Source: Extend DependencyGraph for prioritization with AI reasoning
interface PrioritizationResult {
  prioritizedItems: PrioritizedItem[];
  reasoning: PrioritizationReasoning;
  confidence: SectionConfidence;
}

interface PrioritizedItem {
  itemId: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  score: number;                 // 0-100 weighted score
  factors: {
    businessValue: number;       // 0-1
    dependencyScore: number;     // 0-1 (higher = fewer blockers)
    riskScore: number;           // 0-1 (higher = lower risk)
    effortFit: number;           // 0-1 (how well it fits capacity)
  };
  reasoning: string;
}

interface PrioritizationReasoning {
  methodology: string;           // Description of prioritization approach
  weightings: {
    businessValue: number;
    dependencies: number;
    risk: number;
    effort: number;
  };
  tradeoffs: string[];           // Key tradeoff decisions made
}

class BacklogPrioritizer {
  constructor(
    private dependencyGraph: DependencyGraph,
    private aiFactory: AIServiceFactory,
    private confidenceScorer: ConfidenceScorer
  ) {}

  async prioritize(params: {
    backlogItems: BacklogItem[];
    sprintCapacity: number;
    businessGoals?: string[];
    riskTolerance?: 'low' | 'medium' | 'high';
  }): Promise<PrioritizationResult> {
    // 1. Build dependency graph
    this.dependencyGraph = new DependencyGraph();
    params.backlogItems.forEach(item => this.dependencyGraph.addTask(item as any));

    // 2. Detect implicit dependencies
    this.dependencyGraph.detectImplicitDependencies(0.5);

    // 3. Get graph analysis (orphans, critical path)
    const graphAnalysis = this.dependencyGraph.analyze();

    // 4. Use AI to score business value and generate reasoning
    const aiScoring = await this.aiScoreItems(params);

    // 5. Calculate composite scores
    const weights = { businessValue: 0.4, dependencies: 0.25, risk: 0.2, effort: 0.15 };
    const scored = this.calculateCompositeScores(
      params.backlogItems,
      aiScoring,
      graphAnalysis,
      weights
    );

    // 6. Sort and assign priority tiers
    const prioritized = this.assignPriorityTiers(scored, params.sprintCapacity);

    return {
      prioritizedItems: prioritized,
      reasoning: {
        methodology: 'Multi-factor weighted prioritization with AI-assessed business value',
        weightings: weights,
        tradeoffs: aiScoring.tradeoffs
      },
      confidence: this.calculateConfidence(params.backlogItems, aiScoring)
    };
  }
}
```

### Pattern 3: Sprint Risk Assessment

**What:** Identify and quantify sprint risks with probability, impact, and mitigation suggestions.

**When to use:** During sprint planning to surface potential issues.

**Source:** [AI Risk Assessment patterns](https://community.trustcloud.ai/docs/grc-launchpad/grc-101/risk-management/risk-mitigation-strategies-the-role-of-artificial-intelligence-in-enhancements/) + existing confidence scoring

**Example:**
```typescript
// Source: New service following AITaskProcessor prompt patterns
interface SprintRiskAssessment {
  overallRisk: 'high' | 'medium' | 'low';
  riskScore: number;             // 0-100
  risks: SprintRisk[];
  mitigations: MitigationSuggestion[];
  confidence: SectionConfidence;
}

interface SprintRisk {
  id: string;
  category: 'scope' | 'dependency' | 'capacity' | 'technical' | 'external';
  title: string;
  description: string;
  probability: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  relatedItems: string[];        // Item IDs affected
}

interface MitigationSuggestion {
  riskId: string;
  strategy: 'avoid' | 'mitigate' | 'transfer' | 'accept';
  action: string;
  effort: 'low' | 'medium' | 'high';
  effectiveness: number;         // 0-1 expected risk reduction
}

// Zod schema for structured AI output
const SprintRiskAssessmentSchema = z.object({
  overallRisk: z.enum(['high', 'medium', 'low']),
  riskScore: z.number().min(0).max(100),
  risks: z.array(z.object({
    id: z.string(),
    category: z.enum(['scope', 'dependency', 'capacity', 'technical', 'external']),
    title: z.string(),
    description: z.string(),
    probability: z.enum(['high', 'medium', 'low']),
    impact: z.enum(['high', 'medium', 'low']),
    relatedItems: z.array(z.string())
  })),
  mitigations: z.array(z.object({
    riskId: z.string(),
    strategy: z.enum(['avoid', 'mitigate', 'transfer', 'accept']),
    action: z.string(),
    effort: z.enum(['low', 'medium', 'high']),
    effectiveness: z.number().min(0).max(1)
  })),
  reasoning: z.string()
});

class SprintRiskAssessor {
  async assessRisks(params: {
    sprintItems: BacklogItem[];
    sprintCapacity: SprintCapacity;
    dependencies: DetectedDependency[];
    historicalData?: SprintMetrics[];
  }): Promise<SprintRiskAssessment> {
    const model = this.aiFactory.getModel('main') || this.aiFactory.getBestAvailableModel();

    const prompt = this.formatRiskAssessmentPrompt(params);

    const result = await generateObject({
      model,
      system: SPRINT_RISK_SYSTEM_PROMPT,
      prompt,
      schema: SprintRiskAssessmentSchema,
      temperature: 0.3  // Lower temperature for consistent risk assessment
    });

    // Add confidence scoring
    const confidence = this.confidenceScorer.calculateSectionConfidence({
      sectionId: 'risk-assessment',
      sectionName: 'Sprint Risk Assessment',
      inputData: {
        description: `${params.sprintItems.length} items, ${params.dependencies.length} dependencies`,
        context: params.historicalData ? `${params.historicalData.length} historical sprints` : undefined
      },
      aiSelfAssessment: result.object.riskScore / 100,
      aiReasoning: result.object.reasoning
    });

    return {
      ...result.object,
      confidence
    };
  }
}
```

### Pattern 4: Roadmap Generation with Milestones and Dependencies

**What:** Generate structured roadmap from requirements with phases, milestones, and calculated dates.

**When to use:** Project planning from requirements list.

**Source:** Existing `RoadmapPlanningService` + [LLM structured output patterns](https://www.instill-ai.com/blog/llm-structured-outputs)

**Example:**
```typescript
// Source: Extend RoadmapPlanningService pattern with confidence and velocity
interface GeneratedRoadmap {
  phases: RoadmapPhase[];
  milestones: RoadmapMilestone[];
  dependencies: MilestoneDependency[];
  timeline: {
    startDate: string;
    endDate: string;
    totalWeeks: number;
  };
  confidence: SectionConfidence;
}

interface RoadmapPhase {
  id: string;
  name: string;
  description: string;
  objectives: string[];
  durationWeeks: number;
  startWeek: number;
  endWeek: number;
  milestones: string[];          // Milestone IDs in this phase
}

interface RoadmapMilestone {
  id: string;
  title: string;
  description: string;
  phaseId: string;
  targetDate: string;
  deliverables: string[];
  dependencies: string[];        // Other milestone IDs
  confidence: number;            // 0-1 for date accuracy
}

interface RoadmapGenerationInput {
  requirements: string | RequirementItem[];
  constraints?: {
    timeline?: string;           // e.g., "6 months", "Q3 2026"
    teamSize?: number;
    velocity?: number;           // Points per sprint
    sprintDurationWeeks?: number;
  };
  businessContext?: string;
}

class RoadmapAIService {
  constructor(
    private aiFactory: AIServiceFactory,
    private estimationCalibrator: EstimationCalibrator,
    private confidenceScorer: ConfidenceScorer
  ) {}

  async generateRoadmap(input: RoadmapGenerationInput): Promise<GeneratedRoadmap> {
    const model = this.aiFactory.getModel('prd') || this.aiFactory.getBestAvailableModel();

    // 1. Parse requirements if string
    const requirements = typeof input.requirements === 'string'
      ? await this.parseRequirements(input.requirements)
      : input.requirements;

    // 2. Estimate effort for each requirement
    const estimatedRequirements = await this.estimateRequirements(requirements);

    // 3. Calculate timeline using velocity
    const velocity = input.constraints?.velocity ?? 20;  // Default 20 points/sprint
    const bufferFactor = 1.2;  // 20% buffer
    const totalPoints = estimatedRequirements.reduce((sum, r) => sum + r.points, 0);
    const sprints = Math.ceil((totalPoints * bufferFactor) / velocity);
    const weeks = sprints * (input.constraints?.sprintDurationWeeks ?? 2);

    // 4. Generate roadmap structure with AI
    const result = await generateObject({
      model,
      system: ROADMAP_GENERATION_SYSTEM_PROMPT,
      prompt: this.formatRoadmapPrompt(estimatedRequirements, input.constraints, weeks),
      schema: GeneratedRoadmapSchema,
      temperature: 0.5
    });

    // 5. Calculate milestone dates from velocity
    const roadmap = this.calculateMilestoneDates(result.object, velocity, weeks);

    // 6. Add confidence
    roadmap.confidence = this.confidenceScorer.calculateSectionConfidence({
      sectionId: 'roadmap',
      sectionName: 'Project Roadmap',
      inputData: {
        description: `${requirements.length} requirements, ${weeks} weeks`,
        context: input.businessContext
      },
      aiSelfAssessment: 0.7,
      patternMatchScore: requirements.length >= 5 ? 0.8 : 0.5
    });

    return roadmap;
  }
}
```

### Anti-Patterns to Avoid

- **Blocking on AI unavailability:** Always provide fallback (use existing non-AI methods)
- **Single-factor prioritization:** Use multiple factors; business value alone is insufficient
- **Ignoring historical data:** Velocity and estimation calibration require historical sprints
- **Fixed buffer percentages:** Make buffer configurable; different teams need different buffers
- **AI as final decision-maker:** Suggestions are advisory; user decides what to accept

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Velocity calculation | Average of last N sprints | EstimationCalibrator | Handles calibration, outliers, complexity bands |
| Dependency detection | Simple keyword matching | DependencyGraph | Graph algorithms, cycle detection, critical path |
| Confidence scoring | Single AI score | ConfidenceScorer | Multi-factor, calibrated, with tiered display |
| Graph algorithms | BFS/DFS from scratch | graphlib | Topological sort, cycle detection, tested |
| Structured AI output | JSON parsing | Vercel AI SDK + Zod | Type-safe, validated, handles edge cases |

**Key insight:** Research on LLM-based sprint planning shows that "all three models (GPT-3.5, GPT-4.0, Val) don't provide good enough prioritisation results" without additional training or fine-tuning. Use AI as one signal among many, not the sole decision-maker.

## Common Pitfalls

### Pitfall 1: LLM Prioritization Inconsistency

**What goes wrong:** AI prioritization varies across sessions; same input gives different results.
**Why it happens:** LLMs are non-deterministic; prompt engineering alone is insufficient.
**How to avoid:**
1. Use low temperature (0.3) for prioritization tasks
2. Combine AI scoring with algorithmic factors (dependencies, effort fit)
3. Present AI reasoning alongside scores for transparency
**Warning signs:** Priority order changes when re-running with same inputs.

**Source:** [Scrum Sprint Planning: LLM-based and algorithmic solutions](https://arxiv.org/html/2512.18966) - "GPT-4.0 generally performed better" but still only 59% correct prioritization.

### Pitfall 2: Overcommitment Without Buffer

**What goes wrong:** Sprint scope matches 100% of velocity; no room for unexpected work.
**Why it happens:** Optimism bias; pressure to commit to more work.
**How to avoid:**
1. Default to 80% capacity utilization
2. Make buffer percentage visible and configurable
3. Track historical buffer usage to calibrate
**Warning signs:** Consistent sprint spillover; team burnout.

**Source:** [Sprint Planning Best Practices](https://www.easyagile.com/blog/2026-sprint-planning-team-alignment-challenges-best-practices) - "Plan for 80% of total capacity to leave breathing room."

### Pitfall 3: Risk Assessment Without Historical Context

**What goes wrong:** Risk assessment misses patterns that repeat across sprints.
**Why it happens:** No learning from past sprint outcomes.
**How to avoid:**
1. Include historical sprint metrics in risk assessment prompt
2. Track which predicted risks materialized
3. Calibrate risk probabilities based on actuals
**Warning signs:** Same risks occur repeatedly without improvement.

### Pitfall 4: Roadmap Dates Without Velocity Grounding

**What goes wrong:** AI generates optimistic dates not grounded in team velocity.
**Why it happens:** AI lacks context on team capacity and historical performance.
**How to avoid:**
1. Calculate dates algorithmically from scope + velocity + buffer
2. Use AI for phase/milestone structure, not date calculation
3. Show confidence intervals for dates (not single-point estimates)
**Warning signs:** Roadmap dates consistently slip.

## Code Examples

### Sprint Suggestion Service

```typescript
// Source: New service combining Phase 9 patterns
import { generateObject } from 'ai';
import { z } from 'zod';
import { AIServiceFactory } from './AIServiceFactory';
import { ConfidenceScorer, SectionConfidence } from './ConfidenceScorer';
import { EstimationCalibrator } from '../../analysis/EstimationCalibrator';
import { DependencyGraph } from '../../analysis/DependencyGraph';

interface SprintSuggestion {
  suggestedItems: SuggestedItem[];
  totalPoints: number;
  capacityUtilization: number;   // 0-1 fraction of capacity
  reasoning: string;
  risks: SprintRisk[];
  confidence: SectionConfidence;
}

interface SuggestedItem {
  itemId: string;
  title: string;
  points: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  includeReason: string;
  dependencies: string[];
}

const SprintSuggestionSchema = z.object({
  suggestedItems: z.array(z.object({
    itemId: z.string(),
    title: z.string(),
    points: z.number(),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    includeReason: z.string(),
    dependencies: z.array(z.string())
  })),
  totalPoints: z.number(),
  capacityUtilization: z.number().min(0).max(1),
  reasoning: z.string(),
  risks: z.array(z.object({
    category: z.string(),
    description: z.string(),
    probability: z.enum(['high', 'medium', 'low']),
    mitigation: z.string()
  }))
});

export class SprintSuggestionService {
  private aiFactory: AIServiceFactory;
  private confidenceScorer: ConfidenceScorer;
  private estimationCalibrator: EstimationCalibrator;
  private dependencyGraph: DependencyGraph;

  constructor() {
    this.aiFactory = AIServiceFactory.getInstance();
    this.confidenceScorer = new ConfidenceScorer();
    this.estimationCalibrator = new EstimationCalibrator();
    this.dependencyGraph = new DependencyGraph();
  }

  async suggestSprintComposition(params: {
    backlogItems: BacklogItem[];
    velocity: number;
    sprintDurationDays: number;
    teamMembers: TeamMember[];
    businessGoals?: string[];
    riskTolerance?: 'low' | 'medium' | 'high';
  }): Promise<SprintSuggestion> {
    const model = this.aiFactory.getModel('main')
      || this.aiFactory.getBestAvailableModel();

    if (!model) {
      throw new Error('AI service is not available');
    }

    // 1. Calculate capacity with buffer
    const bufferPercentage = params.riskTolerance === 'low' ? 0.25
      : params.riskTolerance === 'high' ? 0.15 : 0.20;
    const targetCapacity = Math.floor(params.velocity * (1 - bufferPercentage));

    // 2. Build dependency graph
    this.dependencyGraph = new DependencyGraph();
    params.backlogItems.forEach(item => this.dependencyGraph.addTask(item as any));
    const graphAnalysis = this.dependencyGraph.analyze();

    // 3. Get AI suggestion
    const prompt = this.formatSprintSuggestionPrompt(
      params.backlogItems,
      targetCapacity,
      params.businessGoals,
      graphAnalysis
    );

    const result = await generateObject({
      model,
      system: SPRINT_SUGGESTION_SYSTEM_PROMPT,
      prompt,
      schema: SprintSuggestionSchema,
      temperature: 0.3
    });

    // 4. Validate suggestion doesn't exceed capacity
    const validatedSuggestion = this.validateCapacity(result.object, targetCapacity);

    // 5. Add confidence scoring
    const confidence = this.confidenceScorer.calculateSectionConfidence({
      sectionId: 'sprint-suggestion',
      sectionName: 'Sprint Composition',
      inputData: {
        description: `${params.backlogItems.length} items, ${targetCapacity} point capacity`,
        context: params.businessGoals?.join(', ')
      },
      aiSelfAssessment: 0.7,
      patternMatchScore: params.backlogItems.length >= 10 ? 0.8 : 0.5
    });

    return {
      ...validatedSuggestion,
      confidence
    };
  }

  private formatSprintSuggestionPrompt(
    items: BacklogItem[],
    capacity: number,
    goals?: string[],
    graphAnalysis?: GraphAnalysisResult
  ): string {
    return `You are a sprint planning expert. Suggest which backlog items to include in the next sprint.

SPRINT CAPACITY: ${capacity} story points

BACKLOG ITEMS (${items.length} total):
${items.map(item => `- ID: ${item.id}
  Title: ${item.title}
  Points: ${item.points}
  Priority: ${item.priority}
  Description: ${item.description?.substring(0, 200) || 'No description'}`).join('\n\n')}

${goals ? `BUSINESS GOALS:\n${goals.map(g => `- ${g}`).join('\n')}` : ''}

${graphAnalysis?.criticalPath.length ? `CRITICAL PATH: ${graphAnalysis.criticalPath.join(' -> ')}` : ''}

REQUIREMENTS:
1. Total points MUST NOT exceed ${capacity}
2. Prioritize items that align with business goals
3. Respect dependencies (don't include item if blocker isn't included)
4. Balance risk - don't put all high-risk items in one sprint
5. Prefer completing work in progress before starting new work

Return your suggestion with reasoning for each item included.`;
  }
}
```

### Roadmap Generation Prompt

```typescript
// Source: Extend existing RoadmapPlanningService prompt patterns
const ROADMAP_GENERATION_SYSTEM_PROMPT = `You are a product roadmap planning expert.
You create structured roadmaps with clear phases, realistic milestones, and explicit dependencies.

KEY PRINCIPLES:
1. Phases should be logically grouped by theme or capability area
2. Milestones should be measurable and time-bound
3. Dependencies should be explicit - what must complete before what starts
4. Each phase should have 2-4 milestones
5. Milestone durations should account for dependencies

OUTPUT RULES:
- Use provided velocity and timeline constraints
- Include buffer for unexpected work (dates are estimates)
- Mark confidence level for each milestone date
- Provide reasoning for phase ordering`;

const GeneratedRoadmapSchema = z.object({
  phases: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    objectives: z.array(z.string()),
    durationWeeks: z.number(),
    startWeek: z.number(),
    endWeek: z.number(),
    milestones: z.array(z.string())
  })),
  milestones: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    phaseId: z.string(),
    weekNumber: z.number(),       // Relative week in roadmap
    deliverables: z.array(z.string()),
    dependencies: z.array(z.string()),
    confidence: z.number().min(0).max(1)
  })),
  reasoning: z.string()
});
```

### MCP Tool Annotations

```typescript
// Source: Follow existing tool-annotations.ts patterns
import { ANNOTATION_PATTERNS } from '../annotations/tool-annotations';

// Sprint suggestion tools are AI operations (non-deterministic)
export const suggestSprintCompositionTool = {
  name: 'suggest_sprint_composition',
  title: 'Suggest Sprint Composition',
  description: 'AI-powered sprint composition suggestion based on velocity and backlog',
  annotations: ANNOTATION_PATTERNS.aiOperation,  // Non-deterministic, external AI
  // ...
};

// Risk assessment is read-only analysis
export const assessSprintRiskTool = {
  name: 'assess_sprint_risk',
  title: 'Assess Sprint Risk',
  description: 'Analyze sprint plan for potential risks and mitigation strategies',
  annotations: ANNOTATION_PATTERNS.readOnly,     // Analysis, safe to cache
  // ...
};

// Roadmap generation is AI operation
export const generateRoadmapTool = {
  name: 'generate_roadmap',
  title: 'Generate Roadmap',
  description: 'Generate project roadmap from requirements with phases and milestones',
  annotations: ANNOTATION_PATTERNS.aiOperation,
  // ...
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual capacity calculation | AI-assisted with velocity calibration | 2025-2026 | 40% faster release cycles (Gartner) |
| Single-factor priority | Multi-factor weighted scoring | 2025 | More balanced sprint composition |
| Point estimates | Range estimates with confidence | 2025 | More realistic expectations |
| Static roadmaps | Velocity-grounded with recalculation | 2025-2026 | Better milestone accuracy |
| LLM-only prioritization | Hybrid AI + algorithmic | 2025 | More consistent results |

**Research insight:** LLM-based sprint planning research (2024-2025) shows AI models achieve ~55-70% correct prioritization. Best practice is hybrid approach: use AI for business value assessment and reasoning, use algorithms for dependency ordering and capacity fitting.

## Open Questions

1. **Velocity History Persistence**
   - What we know: Need historical sprint data for velocity calculation
   - What's unclear: Where to store? File-based? Integration with SprintPlanningService?
   - Recommendation: Extend SprintPlanningService to track completion metrics; store in sprint metadata

2. **Risk Probability Calibration**
   - What we know: Risk assessments should improve over time based on outcomes
   - What's unclear: How to track which risks materialized and update probabilities
   - Recommendation: Add `riskOutcome` field to Sprint; build calibration loop similar to EstimationCalibrator

3. **Roadmap Recalculation Triggers**
   - What we know: Roadmaps should update when velocity data changes
   - What's unclear: Automatic vs manual recalculation? How to handle already-passed milestones?
   - Recommendation: Manual trigger via MCP tool; preserve completed milestones, recalculate future

4. **Multi-Team Capacity**
   - What we know: Phase 10 focuses on single-team sprints
   - What's unclear: How to extend for multiple teams with dependencies
   - Recommendation: Defer to future phase; current design should allow multi-team extension

## Sources

### Primary (HIGH confidence)
- Codebase: `src/services/SprintPlanningService.ts` - Existing sprint patterns
- Codebase: `src/services/RoadmapPlanningService.ts` - Existing roadmap patterns
- Codebase: `src/services/ai/ConfidenceScorer.ts` - Phase 9 confidence patterns
- Codebase: `src/analysis/DependencyGraph.ts` - Phase 9 graph patterns
- [Vercel AI SDK Core](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) - Structured output patterns

### Secondary (MEDIUM confidence)
- [Scrum Sprint Planning: LLM-based and algorithmic solutions (arXiv)](https://arxiv.org/html/2512.18966) - LLM prioritization research
- [Sprint Planning Best Practices 2026](https://www.easyagile.com/blog/2026-sprint-planning-team-alignment-challenges-best-practices) - Capacity planning best practices
- [AI-Driven Sprint Planning](https://www.v2solutions.com/blogs/ai-driven-sprint-planning-agile-estimation/) - Predictive estimation
- [AI for Backlog Prioritization](https://premieragile.com/ai-for-product-owners-backlog-prioritization/) - Multi-factor prioritization

### Tertiary (LOW confidence - needs validation)
- [Scrum Capacity Planning](https://www.scrum-institute.org/blog/How_To_Plan_Capacity_Of_Your_Scrum_Teams) - Traditional capacity formulas
- [AI Risk Mitigation](https://community.trustcloud.ai/docs/grc-launchpad/grc-101/risk-management/risk-mitigation-strategies-the-role-of-artificial-intelligence-in-enhancements/) - Risk assessment patterns
- [LLM Structured Output Best Practices](https://www.instill-ai.com/blog/llm-structured-outputs) - Structured generation

## Metadata

**Confidence breakdown:**
- Sprint capacity planning: HIGH - Builds on existing EstimationCalibrator + established formulas
- Backlog prioritization: MEDIUM - Research shows LLMs need hybrid approach
- Risk assessment: MEDIUM - Pattern established, calibration needs more validation
- Roadmap generation: HIGH - Extends existing RoadmapPlanningService pattern
- Velocity integration: HIGH - EstimationCalibrator already supports this

**Research date:** 2026-02-01
**Valid until:** 60 days (stable domain, monitor AI SDK and LLM capability updates)
