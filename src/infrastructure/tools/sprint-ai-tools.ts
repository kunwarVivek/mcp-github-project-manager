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

import { BacklogPrioritizer } from "../../services/ai/BacklogPrioritizer";
import { SprintCapacityAnalyzer } from "../../services/ai/SprintCapacityAnalyzer";
import { SprintRiskAssessor } from "../../services/ai/SprintRiskAssessor";
import { SprintSuggestionService } from "../../services/ai/SprintSuggestionService";
import { ANNOTATION_PATTERNS } from "./annotations/tool-annotations";
import { requireArray } from "./input-validation";
import {
  type BacklogPrioritizationInput,
  BacklogPrioritizationInputSchema,
  type PrioritizationOutput,
  PrioritizationOutputSchema,
  type SprintCapacityInput,
  SprintCapacityInputSchema,
  type SprintCapacityOutput,
  SprintCapacityOutputSchema,
  type SprintRiskInput,
  SprintRiskInputSchema,
  type SprintRiskOutput,
  SprintRiskOutputSchema,
  type SprintSuggestionInput,
  SprintSuggestionInputSchema,
  type SprintSuggestionOutput,
  SprintSuggestionOutputSchema,
} from "./schemas/sprint-roadmap-schemas";
import type { ToolDefinition, ToolSchema } from "./ToolValidator";

/**
 * Days between two ISO dates, used when the caller sent the compound
 * schema's sprint metrics (which carry start/end dates but no duration).
 */
function durationInDays(startDate: string, endDate: string): number {
  const start = Date.parse(startDate);
  const end = Date.parse(endDate);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 0;
  }
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * calculate_sprint_capacity - AI-09: Calculate sprint capacity with velocity
 *
 * Calculates sprint capacity based on team velocity, availability, and buffer.
 * Returns recommended story points for the sprint with confidence scoring.
 */
export const calculateSprintCapacityTool: ToolDefinition<
  SprintCapacityInput,
  SprintCapacityOutput
> = {
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
export const prioritizeBacklogTool: ToolDefinition<
  BacklogPrioritizationInput,
  PrioritizationOutput
> = {
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
export const suggestSprintCompositionTool: ToolDefinition<
  SprintSuggestionInput,
  SprintSuggestionOutput
> = {
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
  const action = "calculate_capacity";

  // The compound schema is flat (one object holds the parameters of every
  // action), so an action's own parameters arrive undefined unless the
  // caller sends them - and `args.teamMembers.map` used to throw
  // "Cannot read properties of undefined". Guard the argument and name it.
  const teamMembers = requireArray(args.teamMembers, "teamMembers", action);

  const analyzer = new SprintCapacityAnalyzer();

  const result = await analyzer.calculateCapacity({
    velocity: args.velocity,
    sprintDurationDays: args.sprintDurationDays,
    teamMembers: teamMembers.map((m) => {
      // The compound schema speaks in `availabilityPercent`, the analyzer in
      // an `availability` fraction (0-1). Accept both.
      const member = m as SprintCapacityInput["teamMembers"][number] & {
        availabilityPercent?: number;
      };
      return {
        id: member.id ?? member.name,
        name: member.name,
        availability:
          member.availability ??
          (member.availabilityPercent !== undefined ? member.availabilityPercent / 100 : 1),
        skills: member.skills,
      };
    }),
    historicalSprints: args.historicalSprints?.map((s) => {
      // Same story for sprint metrics: the compound schema offers `name`,
      // the analyzer wants `sprintName` and a `durationDays`.
      const sprint = s as NonNullable<SprintCapacityInput["historicalSprints"]>[number] & {
        name?: string;
      };
      return {
        sprintId: sprint.sprintId,
        sprintName: sprint.sprintName ?? sprint.name ?? sprint.sprintId,
        plannedPoints: sprint.plannedPoints,
        completedPoints: sprint.completedPoints,
        durationDays: sprint.durationDays ?? durationInDays(sprint.startDate, sprint.endDate),
        startDate: sprint.startDate,
        endDate: sprint.endDate,
      };
    }),
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
    backlogItems: requireArray(args.backlogItems, "backlogItems", "prioritize_backlog").map(
      (item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        points: item.points,
        priority: item.priority,
        labels: item.labels,
        dependencies: item.dependencies,
      })
    ),
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
export async function executeAssessSprintRisk(args: SprintRiskInput): Promise<SprintRiskOutput> {
  const assessor = new SprintRiskAssessor();

  const result = await assessor.assessRisks({
    sprintItems: requireArray(args.sprintItems, "sprintItems", "assess_risk").map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      points: item.points,
      priority: item.priority,
      labels: item.labels,
      dependencies: item.dependencies,
    })),
    sprintCapacity: args.capacity,
    dependencies: args.dependencies?.map((d) => ({
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
    backlogItems: requireArray(args.backlogItems, "backlogItems", "suggest_composition").map(
      (item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        points: item.points,
        priority: item.priority,
        labels: item.labels,
        dependencies: item.dependencies,
      })
    ),
    velocity: args.velocity,
    sprintDurationDays: args.sprintDurationDays,
    teamMembers: args.teamMembers?.map((m) => ({
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
  suggest_sprint_composition: executeSuggestSprintComposition as (
    args: unknown
  ) => Promise<unknown>,
};
