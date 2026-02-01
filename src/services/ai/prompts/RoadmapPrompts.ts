/**
 * AI Prompts for Roadmap Generation
 *
 * Provides structured prompts for AI-powered roadmap generation including
 * requirements parsing, phase sequencing, and milestone estimation.
 *
 * Phase 10 Requirements:
 * - AI-13: Roadmap generation from requirements
 * - AI-14: Phase sequencing with dependencies
 * - AI-15: Milestone estimation (velocity-grounded)
 * - AI-16: Visualization data generation
 */

export const ROADMAP_GENERATION_SYSTEM_PROMPT = `You are a product roadmap planning expert.
You create structured roadmaps with clear phases, realistic milestones, and explicit dependencies.

KEY PRINCIPLES:
1. Phases should be logically grouped by theme or capability area
2. Each phase should have 2-4 milestones
3. Milestones should be measurable and have clear deliverables
4. Dependencies should be explicit - what must complete before what starts
5. Later phases should build on earlier ones (progressive capability development)

PHASE GUIDELINES:
- Foundation phases (infrastructure, setup) come first
- Core features follow foundation
- Advanced features build on core
- Polish/optimization phases come last
- Each phase should be independently valuable (shippable)

MILESTONE GUIDELINES:
- Each milestone should have 3-5 deliverables
- Deliverables should be concrete, not abstract
- Include both technical and user-facing deliverables where appropriate
- Milestones within a phase can have internal dependencies

OUTPUT RULES:
- Use weekNumber for timing (relative weeks from start)
- Assign confidence based on how well-defined the requirements are
- Provide reasoning for phase ordering decisions`;

export const REQUIREMENTS_PARSING_PROMPT = `Parse the following requirements into structured format.
For each requirement, identify:
- A unique ID (if not provided, generate one like REQ-001)
- Title (concise summary)
- Description (detailed explanation)
- Priority (critical/high/medium/low based on language used)
- Estimated complexity (1-10 based on scope)
- Category (group related requirements)

Be conservative with priorities - not everything is critical.`;

export const PHASE_SEQUENCING_PROMPT = `Given the following requirements, group them into logical phases.

SEQUENCING RULES:
1. Infrastructure/setup requirements go in Phase 1
2. Data model/schema requirements follow infrastructure
3. Core API/backend requirements follow data model
4. UI/frontend requirements follow backend
5. Integration/external service requirements follow core
6. Advanced features follow basic features
7. Optimization/polish follows feature completion

For each phase:
- Give it a clear, descriptive name
- List 3-5 objectives
- Identify dependencies on prior phases
- Estimate duration in weeks`;

export const MILESTONE_ESTIMATION_PROMPT = `Create milestones for the given phase.

For each milestone:
- Title: Clear, outcome-focused name
- Description: What success looks like
- Deliverables: 3-5 specific outputs
- Dependencies: Other milestones that must complete first
- Confidence: 0-1 based on requirement clarity

ESTIMATION RULES:
- Milestones should be 1-3 weeks of work (at given velocity)
- Include buffer for integration and testing
- Earlier milestones in a phase should be more concrete
- Later milestones can be broader`;

export const VISUALIZATION_DATA_PROMPT = `Generate visualization-ready data for a Gantt chart.

For each phase:
- Color assignment (distinct, accessible colors)
- Start and end week positions
- Row grouping for display

For each milestone:
- Position within phase
- Dependency arrows to draw
- Status indicator placement`;

/**
 * Format requirements for AI prompt
 *
 * @param requirements - Array of requirement objects
 * @returns Formatted string for AI prompt
 */
export function formatRequirementsForPrompt(
  requirements: Array<{
    id?: string;
    title: string;
    description?: string;
    priority?: string;
    estimatedPoints?: number;
    category?: string;
  }>
): string {
  return requirements
    .map((req, i) => {
      const id = req.id || `REQ-${String(i + 1).padStart(3, '0')}`;
      const lines = [`${i + 1}. ${id}: ${req.title}`];

      if (req.description) {
        lines.push(`   Description: ${req.description}`);
      }
      if (req.priority) {
        lines.push(`   Priority: ${req.priority}`);
      }
      if (req.estimatedPoints) {
        lines.push(`   Estimated Points: ${req.estimatedPoints}`);
      }
      if (req.category) {
        lines.push(`   Category: ${req.category}`);
      }

      return lines.join('\n');
    })
    .join('\n\n');
}

/**
 * Format constraints for AI prompt
 *
 * @param constraints - Optional constraint parameters
 * @returns Formatted string for AI prompt
 */
export function formatConstraintsForPrompt(constraints?: {
  timeline?: string;
  teamSize?: number;
  velocity?: number;
  sprintDurationWeeks?: number;
}): string {
  if (!constraints) return '';

  const parts: string[] = [];

  if (constraints.timeline) {
    parts.push(`Target timeline: ${constraints.timeline}`);
  }
  if (constraints.teamSize) {
    parts.push(`Team size: ${constraints.teamSize} people`);
  }
  if (constraints.velocity) {
    parts.push(`Team velocity: ${constraints.velocity} points/sprint`);
  }
  if (constraints.sprintDurationWeeks) {
    parts.push(`Sprint duration: ${constraints.sprintDurationWeeks} weeks`);
  }

  return parts.length > 0 ? `\nCONSTRAINTS:\n${parts.join('\n')}` : '';
}

/**
 * Format phase context for milestone generation
 *
 * @param phase - Phase information
 * @returns Formatted string for AI prompt
 */
export function formatPhaseContextForPrompt(phase: {
  name: string;
  description: string;
  objectives: string[];
  durationWeeks: number;
}): string {
  return `PHASE: ${phase.name}
Description: ${phase.description}
Objectives:
${phase.objectives.map((obj, i) => `  ${i + 1}. ${obj}`).join('\n')}
Duration: ${phase.durationWeeks} weeks`;
}

/**
 * Roadmap prompt configurations
 */
export const ROADMAP_PROMPT_CONFIGS = {
  parseRequirements: {
    systemPrompt: REQUIREMENTS_PARSING_PROMPT,
    maxTokens: 2000,
    temperature: 0.3
  },

  generateStructure: {
    systemPrompt: ROADMAP_GENERATION_SYSTEM_PROMPT,
    maxTokens: 4000,
    temperature: 0.5
  },

  sequencePhases: {
    systemPrompt: PHASE_SEQUENCING_PROMPT,
    maxTokens: 2500,
    temperature: 0.4
  },

  estimateMilestones: {
    systemPrompt: MILESTONE_ESTIMATION_PROMPT,
    maxTokens: 2000,
    temperature: 0.4
  },

  generateVisualization: {
    systemPrompt: VISUALIZATION_DATA_PROMPT,
    maxTokens: 1500,
    temperature: 0.3
  }
};
