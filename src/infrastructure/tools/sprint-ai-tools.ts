/**
 * MCP tools for AI-powered sprint planning operations.
 *
 * Provides 4 tools (AI-09 to AI-12):
 * - calculate_sprint_capacity: Calculate sprint capacity with velocity (AI-09)
 * - prioritize_backlog: AI-powered multi-factor backlog prioritization (AI-10)
 * - assess_sprint_risk: Analyze sprint plan for risks (AI-11)
 * - suggest_sprint_composition: AI-powered sprint composition suggestion (AI-12)
 *
 * These tools expose Phase 10 AI sprint planning services as MCP tools
 * with proper annotations, input/output schemas, and executors.
 */

import { ToolDefinition, ToolSchema } from "./ToolValidator.js";
import { ANNOTATION_PATTERNS } from "./annotations/tool-annotations.js";
import { SprintCapacityAnalyzer } from "../../services/ai/SprintCapacityAnalyzer.js";
import { BacklogPrioritizer } from "../../services/ai/BacklogPrioritizer.js";
import { SprintRiskAssessor } from "../../services/ai/SprintRiskAssessor.js";
import { SprintSuggestionService } from "../../services/ai/SprintSuggestionService.js";
import {
  SprintCapacityInputSchema,
  SprintCapacityInput,
  SprintCapacityOutputSchema,
  SprintCapacityOutput,
  BacklogPrioritizationInputSchema,
  BacklogPrioritizationInput,
  PrioritizationOutputSchema,
  PrioritizationOutput,
  SprintRiskInputSchema,
  SprintRiskInput,
  SprintRiskOutputSchema,
  SprintRiskOutput,
  SprintSuggestionInputSchema,
  SprintSuggestionInput,
  SprintSuggestionOutputSchema,
  SprintSuggestionOutput,
} from "./schemas/sprint-roadmap-schemas.js";

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * calculate_sprint_capacity - AI-09: Calculate sprint capacity with velocity
 *
 * Calculates sprint capacity based on team velocity, availability, and buffer.
 * Returns recommended story points for the sprint with confidence scoring.
 */
export const calculateSprintCapacityTool: ToolDefinition<SprintCapacityInput, SprintCapacityOutput> = {
  name: "calculate_sprint_capacity",
  title: "Calculate Sprint Capacity",
  description:
    "Calculate sprint capacity based on team velocity, availability, and buffer. " +
    "Returns recommended story points for the sprint with confidence scoring. " +
    "Supports auto-calculating velocity from historical sprint data.",
  annotations: ANNOTATION_PATTERNS.readOnly, // Analysis, safe to cache
  schema: SprintCapacityInputSchema,
  outputSchema: SprintCapacityOutputSchema,
};

/**
 * prioritize_backlog - AI-10: Multi-factor backlog prioritization
 *
 * AI-powered backlog prioritization using business value, dependencies,
 * risk, and effort factors. Returns prioritized items with reasoning.
 */
export const prioritizeBacklogTool: ToolDefinition<BacklogPrioritizationInput, PrioritizationOutput> = {
  name: "prioritize_backlog",
  title: "Prioritize Backlog",
  description:
    "AI-powered backlog prioritization using business value, dependencies, risk, and effort. " +
    "Returns prioritized items with reasoning and confidence scoring. " +
    "Uses multi-factor weighted scoring (BV: 0.4, Dep: 0.25, Risk: 0.2, Effort: 0.15).",
  annotations: ANNOTATION_PATTERNS.aiOperation, // AI non-deterministic
  schema: BacklogPrioritizationInputSchema as unknown as ToolSchema<BacklogPrioritizationInput>,
  outputSchema: PrioritizationOutputSchema,
};

/**
 * assess_sprint_risk - AI-11: Sprint risk assessment
 *
 * Analyzes sprint plan for potential risks. Identifies scope, dependency,
 * capacity, technical, and external risks with mitigation suggestions.
 */
export const assessSprintRiskTool: ToolDefinition<SprintRiskInput, SprintRiskOutput> = {
  name: "assess_sprint_risk",
  title: "Assess Sprint Risk",
  description:
    "Analyze sprint plan for potential risks. Identifies scope, dependency, capacity, " +
    "technical, and external risks with mitigation suggestions. " +
    "Returns overall risk level, risk score (0-100), and actionable mitigations.",
  annotations: ANNOTATION_PATTERNS.aiOperation, // AI non-deterministic
  schema: SprintRiskInputSchema,
  outputSchema: SprintRiskOutputSchema,
};

/**
 * suggest_sprint_composition - AI-12: Velocity-based scope recommendations
 *
 * AI-powered sprint composition suggestion. Selects backlog items that fit
 * capacity while respecting dependencies and business priorities.
 */
export const suggestSprintCompositionTool: ToolDefinition<SprintSuggestionInput, SprintSuggestionOutput> = {
  name: "suggest_sprint_composition",
  title: "Suggest Sprint Composition",
  description:
    "AI-powered sprint composition suggestion. Selects backlog items that fit capacity " +
    "while respecting dependencies and business priorities. " +
    "Returns suggested items with reasoning, capacity utilization, and associated risks.",
  annotations: ANNOTATION_PATTERNS.aiOperation, // AI non-deterministic
  schema: SprintSuggestionInputSchema as unknown as ToolSchema<SprintSuggestionInput>,
  outputSchema: SprintSuggestionOutputSchema,
};

// ============================================================================
// Tool Executors
// ============================================================================

/**
 * Execute calculate_sprint_capacity tool (AI-09).
 *
 * @param args - Sprint capacity input parameters
 * @returns Sprint capacity with confidence scoring
 */
export async function executeCalculateSprintCapacity(
  args: SprintCapacityInput
): Promise<SprintCapacityOutput> {
  const analyzer = new SprintCapacityAnalyzer();

  const result = await analyzer.calculateCapacity({
    velocity: args.velocity,
    sprintDurationDays: args.sprintDurationDays,
    teamMembers: args.teamMembers.map(m => ({
      id: m.id,
      name: m.name,
      availability: m.availability,
      skills: m.skills,
    })),
    historicalSprints: args.historicalSprints?.map(s => ({
      sprintId: s.sprintId,
      sprintName: s.sprintName,
      plannedPoints: s.plannedPoints,
      completedPoints: s.completedPoints,
      durationDays: s.durationDays,
      startDate: s.startDate,
      endDate: s.endDate,
    })),
  });

  return result;
}

/**
 * Execute prioritize_backlog tool (AI-10).
 *
 * @param args - Backlog prioritization input parameters
 * @returns Prioritized items with reasoning
 */
export async function executePrioritizeBacklog(
  args: BacklogPrioritizationInput
): Promise<PrioritizationOutput> {
  const prioritizer = new BacklogPrioritizer();

  const result = await prioritizer.prioritize({
    backlogItems: args.backlogItems.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      points: item.points,
      priority: item.priority,
      labels: item.labels,
      dependencies: item.dependencies,
    })),
    sprintCapacity: args.sprintCapacity,
    businessGoals: args.businessGoals,
    riskTolerance: args.riskTolerance,
  });

  return result;
}

/**
 * Execute assess_sprint_risk tool (AI-11).
 *
 * @param args - Sprint risk input parameters
 * @returns Risk assessment with mitigations
 */
export async function executeAssessSprintRisk(
  args: SprintRiskInput
): Promise<SprintRiskOutput> {
  const assessor = new SprintRiskAssessor();

  const result = await assessor.assessRisks({
    sprintItems: args.sprintItems.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      points: item.points,
      priority: item.priority,
      labels: item.labels,
      dependencies: item.dependencies,
    })),
    sprintCapacity: args.capacity,
    dependencies: args.dependencies?.map(d => ({
      fromTaskId: d.fromItemId,
      toTaskId: d.toItemId,
      type: d.type,
      confidence: d.confidence,
      reasoning: d.description || "",
      isImplicit: false,
    })),
  });

  return result;
}

/**
 * Execute suggest_sprint_composition tool (AI-12).
 *
 * @param args - Sprint suggestion input parameters
 * @returns Sprint composition suggestion with risks
 */
export async function executeSuggestSprintComposition(
  args: SprintSuggestionInput
): Promise<SprintSuggestionOutput> {
  const service = new SprintSuggestionService();

  const result = await service.suggestSprintComposition({
    backlogItems: args.backlogItems.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      points: item.points,
      priority: item.priority,
      labels: item.labels,
      dependencies: item.dependencies,
    })),
    velocity: args.velocity,
    sprintDurationDays: args.sprintDurationDays,
    teamMembers: args.teamMembers?.map(m => ({
      id: m.id,
      name: m.name,
      availability: m.availability,
      skills: m.skills,
    })),
    businessGoals: args.businessGoals,
    riskTolerance: args.riskTolerance,
  });

  return result;
}

// ============================================================================
// Export all tools for registration
// ============================================================================

/**
 * All sprint AI tool definitions for registration in ToolRegistry.
 */
export const sprintAITools: ToolDefinition<unknown>[] = [
  calculateSprintCapacityTool as ToolDefinition<unknown>,
  prioritizeBacklogTool as ToolDefinition<unknown>,
  assessSprintRiskTool as ToolDefinition<unknown>,
  suggestSprintCompositionTool as ToolDefinition<unknown>,
];

/**
 * Map of tool names to executor functions.
 */
export const sprintAIExecutors: Record<string, (args: unknown) => Promise<unknown>> = {
  calculate_sprint_capacity: executeCalculateSprintCapacity as (args: unknown) => Promise<unknown>,
  prioritize_backlog: executePrioritizeBacklog as (args: unknown) => Promise<unknown>,
  assess_sprint_risk: executeAssessSprintRisk as (args: unknown) => Promise<unknown>,
  suggest_sprint_composition: executeSuggestSprintComposition as (args: unknown) => Promise<unknown>,
};
