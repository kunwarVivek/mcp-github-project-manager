/**
 * Sprint Planning AI Prompt Templates
 *
 * System and user prompts for AI-powered sprint planning operations:
 * - Capacity analysis
 * - Backlog prioritization
 * - Risk assessment
 * - Sprint composition suggestions
 */

// ============================================================================
// Capacity Analysis Prompts
// ============================================================================

/**
 * System prompt for sprint capacity analysis.
 * Used by SprintCapacityAnalyzer for velocity-based capacity planning.
 */
export const SPRINT_CAPACITY_SYSTEM_PROMPT = `You are an expert sprint planning assistant specializing in capacity analysis.

Your role is to help teams calculate realistic sprint capacity by considering:
- Historical velocity data and trends
- Team availability and time off
- Buffer for unexpected work
- Sustainable pace principles

Key principles:
1. SUSTAINABILITY: Always recommend 20-30% buffer for unexpected work, meetings, and technical debt
2. VELOCITY: Use rolling average of last 3-5 sprints, filtering outliers
3. AVAILABILITY: Account for holidays, vacations, and partial availability
4. CALIBRATION: Adjust for known estimation biases (over/under-estimation patterns)

Output requirements:
- Provide clear reasoning for capacity recommendations
- Flag uncertainty when historical data is limited
- Suggest confidence levels based on data quality`;

/**
 * User prompt template for capacity calculation.
 */
export function formatCapacityPrompt(params: {
  velocity: number;
  sprintDurationDays: number;
  teamSize: number;
  availabilityFactor: number;
  historicalSprintsCount: number;
}): string {
  return `Calculate sprint capacity for the following parameters:

Team Configuration:
- Team size: ${params.teamSize} members
- Sprint duration: ${params.sprintDurationDays} days
- Average availability: ${Math.round(params.availabilityFactor * 100)}%

Velocity Data:
- Current velocity: ${params.velocity} points/sprint
- Historical sprints available: ${params.historicalSprintsCount}

Please provide:
1. Recommended sprint capacity in story points
2. Suggested buffer percentage with reasoning
3. Confidence level in the recommendation
4. Any flags or concerns`;
}

// ============================================================================
// Prioritization Prompts
// ============================================================================

/**
 * System prompt for backlog prioritization.
 * Used by BacklogPrioritizer for multi-factor scoring.
 */
export const SPRINT_PRIORITIZATION_SYSTEM_PROMPT = `You are an expert product prioritization assistant.

Your role is to assess business value of backlog items by considering:
- Strategic alignment with business goals
- Customer impact and value delivery
- Revenue/cost implications
- Technical dependencies and sequencing
- Risk and uncertainty factors

Prioritization framework:
1. BUSINESS VALUE (40%): Direct impact on business objectives
2. DEPENDENCIES (25%): Enabling value for other items, blocking relationships
3. RISK (20%): Uncertainty, complexity, and potential for delays
4. EFFORT FIT (15%): How well the item fits current capacity

Output requirements:
- Score each item's business value from 0.0 to 1.0
- Provide clear reasoning for each score
- Identify key tradeoffs between competing priorities
- Flag items that should be grouped or split`;

/**
 * User prompt template for business value scoring.
 */
export function formatPrioritizationPrompt(
  items: Array<{ id: string; title: string; description?: string; priority?: string; labels?: string[] }>,
  businessGoals: string[]
): string {
  const itemsList = items.map((item, i) =>
    `${i + 1}. [${item.id}] ${item.title}${item.description ? `\n   Description: ${item.description}` : ''}${item.priority ? `\n   Current priority: ${item.priority}` : ''}${item.labels?.length ? `\n   Labels: ${item.labels.join(', ')}` : ''}`
  ).join('\n\n');

  const goalsSection = businessGoals.length > 0
    ? `\nBusiness Goals:\n${businessGoals.map((g, i) => `${i + 1}. ${g}`).join('\n')}`
    : '';

  return `Score the business value of each backlog item.
${goalsSection}

Backlog Items:
${itemsList}

For each item, provide:
1. Business value score (0.0 to 1.0)
2. Brief reasoning for the score

Also identify any key tradeoffs between items.`;
}

// ============================================================================
// Risk Assessment Prompts
// ============================================================================

/**
 * System prompt for sprint risk assessment.
 * Used by SprintRiskAssessor for identifying and mitigating risks.
 */
export const SPRINT_RISK_SYSTEM_PROMPT = `You are an expert sprint risk assessment assistant.

Your role is to identify and assess risks in sprint planning by considering:
- Scope risks: overcommitment, unclear requirements, scope creep
- Dependency risks: external dependencies, blocking items, integration points
- Capacity risks: team availability, skill gaps, competing priorities
- Technical risks: complexity, unknowns, technical debt
- External risks: third-party dependencies, regulatory, market factors

Risk assessment framework:
1. IDENTIFY: Find potential risks in the sprint composition
2. ASSESS: Rate probability (high/medium/low) and impact (high/medium/low)
3. PRIORITIZE: Focus on high-probability or high-impact risks
4. MITIGATE: Suggest actionable mitigation strategies

Mitigation strategies:
- AVOID: Change scope to eliminate the risk
- MITIGATE: Take actions to reduce probability or impact
- TRANSFER: Move responsibility or get external help
- ACCEPT: Acknowledge and monitor low-priority risks

Output requirements:
- Provide specific, actionable risk descriptions
- Include affected items for each risk
- Suggest practical mitigation actions
- Rate overall sprint risk level`;

/**
 * User prompt template for risk assessment.
 */
export function formatRiskPrompt(params: {
  sprintItems: Array<{ id: string; title: string; points?: number; dependencies?: string[] }>;
  totalPoints: number;
  recommendedCapacity: number;
  dependencyCount: number;
}): string {
  const itemsList = params.sprintItems.map((item, i) =>
    `${i + 1}. [${item.id}] ${item.title} (${item.points || 3} pts)${item.dependencies?.length ? `\n   Dependencies: ${item.dependencies.join(', ')}` : ''}`
  ).join('\n');

  const utilizationPercent = Math.round((params.totalPoints / params.recommendedCapacity) * 100);

  return `Assess risks for this sprint composition:

Sprint Metrics:
- Total points: ${params.totalPoints}
- Recommended capacity: ${params.recommendedCapacity}
- Utilization: ${utilizationPercent}%
- Items with dependencies: ${params.dependencyCount}

Sprint Items:
${itemsList}

Please identify:
1. Key risks (scope, dependency, capacity, technical, external)
2. Probability and impact for each risk
3. Specific mitigation strategies
4. Overall sprint risk level`;
}

// ============================================================================
// Sprint Suggestion Prompts
// ============================================================================

/**
 * System prompt for sprint composition suggestions.
 * Used by SprintSuggestionService for AI-driven sprint planning.
 */
export const SPRINT_SUGGESTION_SYSTEM_PROMPT = `You are an expert sprint planning assistant.

Your role is to suggest optimal sprint composition by balancing:
- Business value delivery
- Technical dependencies and sequencing
- Team capacity and sustainability
- Risk management
- Goal alignment

Sprint composition principles:
1. VALUE FIRST: Prioritize high-value items that fit capacity
2. DEPENDENCIES: Include all necessary dependencies before dependents
3. BUFFER: Leave 20-30% capacity for unexpected work
4. BALANCE: Mix complex and simple items for parallel work
5. COMPLETENESS: Prefer finishing features over starting new ones

Output requirements:
- Suggest specific items to include
- Explain inclusion reasoning for each item
- Flag any excluded high-value items with reasons
- Provide overall sprint goal/theme
- Identify risks and mitigations`;

/**
 * User prompt template for sprint composition.
 */
export function formatSprintSuggestionPrompt(params: {
  availableItems: Array<{ id: string; title: string; points?: number; priority?: string }>;
  capacity: number;
  businessGoals?: string[];
  riskTolerance: 'low' | 'medium' | 'high';
}): string {
  const itemsList = params.availableItems.map((item, i) =>
    `${i + 1}. [${item.id}] ${item.title} (${item.points || 3} pts, ${item.priority || 'medium'} priority)`
  ).join('\n');

  const goalsSection = params.businessGoals?.length
    ? `\nBusiness Goals:\n${params.businessGoals.map((g, i) => `${i + 1}. ${g}`).join('\n')}`
    : '';

  return `Suggest optimal sprint composition:

Capacity: ${params.capacity} story points
Risk tolerance: ${params.riskTolerance}
${goalsSection}

Available Backlog Items:
${itemsList}

Please suggest:
1. Items to include in the sprint (respecting capacity)
2. Reasoning for each inclusion
3. Key items excluded and why
4. Overall sprint theme/goal
5. Risks and recommended mitigations`;
}

// ============================================================================
// Shared Utility Prompts
// ============================================================================

/**
 * Prompt fragment for requesting structured JSON output.
 */
export const JSON_OUTPUT_INSTRUCTION = `
IMPORTANT: Respond with valid JSON only. Do not include markdown code blocks or any other formatting.`;

/**
 * Prompt fragment for confidence scoring.
 */
export const CONFIDENCE_INSTRUCTION = `
Include a self-assessment of your confidence in each recommendation:
- HIGH (0.8-1.0): Clear data, well-defined requirements
- MEDIUM (0.5-0.7): Some uncertainty, assumptions made
- LOW (0.0-0.4): Limited data, significant assumptions`;
