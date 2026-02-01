/**
 * Zod Schemas for Sprint and Roadmap AI MCP Tools
 *
 * This module defines input and output schemas for Phase 10 AI Sprint and
 * Roadmap Planning MCP tools:
 *
 * Sprint Planning Tools (AI-09 to AI-12):
 * - calculate_sprint_capacity (AI-09)
 * - prioritize_backlog (AI-10)
 * - assess_sprint_risk (AI-11)
 * - suggest_sprint_composition (AI-12)
 *
 * Roadmap Planning Tools (AI-13 to AI-16):
 * - generate_roadmap (AI-13)
 * - update_roadmap_phase (AI-14)
 * - manage_milestone_dependencies (AI-15)
 * - get_roadmap_visualization (AI-16)
 */

import { z } from "zod";
import { SectionConfidenceSchema } from "../../../domain/ai-types";

// ============================================================================
// Common Schemas (Reused across multiple tools)
// ============================================================================

/**
 * Schema for priority levels used across sprint and backlog tools.
 */
export const PriorityTierSchema = z.enum(["critical", "high", "medium", "low"]);

/**
 * Schema for risk probability/impact levels.
 */
export const RiskLevelSchema = z.enum(["high", "medium", "low"]);

/**
 * Schema for mitigation strategies.
 */
export const MitigationStrategySchema = z.enum([
  "avoid",
  "mitigate",
  "transfer",
  "accept",
]);

/**
 * Schema for effort levels.
 */
export const EffortLevelSchema = z.enum(["low", "medium", "high"]);

/**
 * Schema for sprint risk categories.
 */
export const SprintRiskCategorySchema = z.enum([
  "scope",
  "dependency",
  "capacity",
  "technical",
  "external",
]);

// ============================================================================
// Team Member Schemas
// ============================================================================

/**
 * Input schema for a team member.
 */
export const TeamMemberInputSchema = z.object({
  /** Unique identifier for the team member */
  id: z.string().min(1, "Team member ID is required"),
  /** Display name of the team member */
  name: z.string().min(1, "Team member name is required"),
  /** Availability as a fraction (0-1) */
  availability: z
    .number()
    .min(0)
    .max(1)
    .describe("Availability as a fraction (0=none, 1=full)"),
  /** Optional skills for skill-based assignment */
  skills: z.array(z.string()).optional(),
});

export type TeamMemberInput = z.infer<typeof TeamMemberInputSchema>;

/**
 * Output schema for team availability.
 */
export const TeamAvailabilityOutputSchema = z.object({
  /** Total available capacity as a fraction */
  totalAvailability: z.number().min(0).max(1),
  /** Number of team members */
  memberCount: z.number().int().min(0),
  /** Individual member availability breakdown */
  members: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      availability: z.number().min(0).max(1),
    })
  ),
  /** Confidence in availability calculation */
  confidence: z.number().min(0).max(1),
});

export type TeamAvailabilityOutput = z.infer<typeof TeamAvailabilityOutputSchema>;

// ============================================================================
// Sprint Metrics Schema
// ============================================================================

/**
 * Schema for historical sprint metrics.
 */
export const SprintMetricsSchema = z.object({
  /** Sprint identifier */
  sprintId: z.string(),
  /** Sprint name or title */
  sprintName: z.string(),
  /** Planned story points */
  plannedPoints: z.number().min(0),
  /** Completed story points */
  completedPoints: z.number().min(0),
  /** Sprint duration in days */
  durationDays: z.number().int().positive(),
  /** Start date (ISO string) */
  startDate: z.string(),
  /** End date (ISO string) */
  endDate: z.string(),
});

export type SprintMetrics = z.infer<typeof SprintMetricsSchema>;

// ============================================================================
// Sprint Capacity Input/Output Schemas (AI-09)
// ============================================================================

/**
 * Input schema for calculate_sprint_capacity tool (AI-09).
 */
export const SprintCapacityInputSchema = z.object({
  /** Velocity in points per sprint, or 'auto' to calculate from history */
  velocity: z.union([
    z.number().positive(),
    z.literal("auto"),
  ]).describe("Points per sprint or 'auto' to calculate from history"),
  /** Sprint duration in days */
  sprintDurationDays: z.number().int().positive().describe("Sprint duration in days"),
  /** Team members with availability */
  teamMembers: z.array(TeamMemberInputSchema).min(1, "At least one team member required"),
  /** Optional historical sprints for velocity calculation */
  historicalSprints: z.array(SprintMetricsSchema).optional(),
});

export type SprintCapacityInput = z.infer<typeof SprintCapacityInputSchema>;

/**
 * Output schema for sprint capacity calculation.
 */
export const SprintCapacityOutputSchema = z.object({
  /** Total story points calculated from velocity */
  totalPoints: z.number().min(0),
  /** Recommended load for sustainability */
  recommendedLoad: z.number().min(0),
  /** Team availability breakdown */
  teamAvailability: TeamAvailabilityOutputSchema,
  /** Buffer configuration */
  buffer: z.object({
    percentage: z.number().min(0).max(100),
    reasoning: z.string(),
  }),
  /** Confidence scoring */
  confidence: SectionConfidenceSchema,
});

export type SprintCapacityOutput = z.infer<typeof SprintCapacityOutputSchema>;

// ============================================================================
// Backlog Item Schemas
// ============================================================================

/**
 * Input schema for a backlog item.
 */
export const BacklogItemInputSchema = z.object({
  /** Unique identifier for the item */
  id: z.string().min(1, "Item ID is required"),
  /** Title of the backlog item */
  title: z.string().min(1, "Item title is required"),
  /** Optional description */
  description: z.string().optional(),
  /** Story points estimate */
  points: z.number().min(0).optional(),
  /** Current priority */
  priority: PriorityTierSchema.optional(),
  /** Labels attached to the item */
  labels: z.array(z.string()).optional(),
  /** IDs of items this depends on */
  dependencies: z.array(z.string()).optional(),
});

export type BacklogItemInput = z.infer<typeof BacklogItemInputSchema>;

/**
 * Schema for detected dependencies.
 */
export const DependencySchema = z.object({
  /** ID of the dependent item */
  fromItemId: z.string(),
  /** ID of the item being depended on */
  toItemId: z.string(),
  /** Type of dependency */
  type: z.enum(["blocks", "depends_on", "related_to"]),
  /** Description of the dependency */
  description: z.string().optional(),
  /** Confidence in the detected dependency */
  confidence: z.number().min(0).max(1),
});

export type Dependency = z.infer<typeof DependencySchema>;

// ============================================================================
// Backlog Prioritization Input/Output Schemas (AI-10)
// ============================================================================

/**
 * Input schema for prioritize_backlog tool (AI-10).
 */
export const BacklogPrioritizationInputSchema = z.object({
  /** Backlog items to prioritize */
  backlogItems: z.array(BacklogItemInputSchema).min(1, "At least one backlog item required"),
  /** Available sprint capacity in points */
  sprintCapacity: z.number().positive().describe("Available capacity in story points"),
  /** Optional business goals to prioritize towards */
  businessGoals: z.array(z.string()).optional(),
  /** Risk tolerance level */
  riskTolerance: RiskLevelSchema.optional().default("medium"),
});

export type BacklogPrioritizationInput = z.infer<typeof BacklogPrioritizationInputSchema>;

/**
 * Schema for priority factors.
 */
export const PriorityFactorsSchema = z.object({
  /** Business value score (0-1) */
  businessValue: z.number().min(0).max(1),
  /** Dependency score (0-1, higher = fewer blockers) */
  dependencyScore: z.number().min(0).max(1),
  /** Risk score (0-1, higher = lower risk) */
  riskScore: z.number().min(0).max(1),
  /** Effort fit score (0-1) */
  effortFit: z.number().min(0).max(1),
});

export type PriorityFactors = z.infer<typeof PriorityFactorsSchema>;

/**
 * Schema for a prioritized item.
 */
export const PrioritizedItemSchema = z.object({
  /** ID of the backlog item */
  itemId: z.string(),
  /** Assigned priority tier */
  priority: PriorityTierSchema,
  /** Numeric priority score (0-100) */
  score: z.number().min(0).max(100),
  /** Breakdown of factors */
  factors: PriorityFactorsSchema,
  /** AI reasoning for the priority */
  reasoning: z.string(),
});

export type PrioritizedItem = z.infer<typeof PrioritizedItemSchema>;

/**
 * Schema for prioritization reasoning.
 */
export const PrioritizationReasoningSchema = z.object({
  /** Description of the approach used */
  methodology: z.string(),
  /** Weights applied to each factor */
  weightings: z.object({
    businessValue: z.number().min(0).max(1),
    dependencies: z.number().min(0).max(1),
    risk: z.number().min(0).max(1),
    effort: z.number().min(0).max(1),
  }),
  /** Key tradeoff decisions */
  tradeoffs: z.array(z.string()),
});

export type PrioritizationReasoning = z.infer<typeof PrioritizationReasoningSchema>;

/**
 * Output schema for backlog prioritization.
 */
export const PrioritizationOutputSchema = z.object({
  /** Prioritized backlog items */
  prioritizedItems: z.array(PrioritizedItemSchema),
  /** Reasoning and methodology */
  reasoning: PrioritizationReasoningSchema,
  /** Confidence scoring */
  confidence: SectionConfidenceSchema,
});

export type PrioritizationOutput = z.infer<typeof PrioritizationOutputSchema>;

// ============================================================================
// Sprint Risk Assessment Input/Output Schemas (AI-11)
// ============================================================================

/**
 * Input schema for assess_sprint_risk tool (AI-11).
 */
export const SprintRiskInputSchema = z.object({
  /** Items planned for the sprint */
  sprintItems: z.array(BacklogItemInputSchema).min(1, "At least one sprint item required"),
  /** Sprint capacity information */
  capacity: SprintCapacityOutputSchema,
  /** Known dependencies between items */
  dependencies: z.array(DependencySchema).optional(),
});

export type SprintRiskInput = z.infer<typeof SprintRiskInputSchema>;

/**
 * Schema for an individual sprint risk.
 */
export const SprintRiskSchema = z.object({
  /** Unique risk identifier */
  id: z.string(),
  /** Category of the risk */
  category: SprintRiskCategorySchema,
  /** Short title for the risk */
  title: z.string(),
  /** Detailed description */
  description: z.string(),
  /** Probability of occurring */
  probability: RiskLevelSchema,
  /** Impact if it occurs */
  impact: RiskLevelSchema,
  /** IDs of affected items */
  relatedItems: z.array(z.string()),
});

export type SprintRisk = z.infer<typeof SprintRiskSchema>;

/**
 * Schema for a mitigation suggestion.
 */
export const MitigationSchema = z.object({
  /** ID of the risk this addresses */
  riskId: z.string(),
  /** Type of mitigation strategy */
  strategy: MitigationStrategySchema,
  /** Specific action to take */
  action: z.string(),
  /** Effort required */
  effort: EffortLevelSchema,
  /** Expected effectiveness (0-1) */
  effectiveness: z.number().min(0).max(1),
});

export type Mitigation = z.infer<typeof MitigationSchema>;

/**
 * Output schema for sprint risk assessment.
 */
export const SprintRiskOutputSchema = z.object({
  /** Overall risk level */
  overallRisk: RiskLevelSchema,
  /** Numeric risk score (0-100) */
  riskScore: z.number().min(0).max(100),
  /** List of identified risks */
  risks: z.array(SprintRiskSchema),
  /** Suggested mitigations */
  mitigations: z.array(MitigationSchema),
  /** Confidence scoring */
  confidence: SectionConfidenceSchema,
});

export type SprintRiskOutput = z.infer<typeof SprintRiskOutputSchema>;

// ============================================================================
// Sprint Suggestion Input/Output Schemas (AI-12)
// ============================================================================

/**
 * Input schema for suggest_sprint_composition tool (AI-12).
 */
export const SprintSuggestionInputSchema = z.object({
  /** Available backlog items */
  backlogItems: z.array(BacklogItemInputSchema).min(1, "At least one backlog item required"),
  /** Team velocity in points per sprint */
  velocity: z.number().positive().describe("Team velocity in story points per sprint"),
  /** Sprint duration in days */
  sprintDurationDays: z.number().int().positive(),
  /** Optional team members for capacity consideration */
  teamMembers: z.array(TeamMemberInputSchema).optional(),
  /** Optional business goals to optimize for */
  businessGoals: z.array(z.string()).optional(),
  /** Risk tolerance level */
  riskTolerance: RiskLevelSchema.optional().default("medium"),
});

export type SprintSuggestionInput = z.infer<typeof SprintSuggestionInputSchema>;

/**
 * Schema for a suggested sprint item.
 */
export const SuggestedItemSchema = z.object({
  /** ID of the backlog item */
  itemId: z.string(),
  /** Title of the item */
  title: z.string(),
  /** Story points */
  points: z.number().min(0),
  /** Priority tier */
  priority: PriorityTierSchema,
  /** Reason for including this item */
  includeReason: z.string(),
  /** Dependencies on other items */
  dependencies: z.array(z.string()),
});

export type SuggestedItem = z.infer<typeof SuggestedItemSchema>;

/**
 * Output schema for sprint suggestion.
 */
export const SprintSuggestionOutputSchema = z.object({
  /** Items suggested for the sprint */
  suggestedItems: z.array(SuggestedItemSchema),
  /** Total story points */
  totalPoints: z.number().min(0),
  /** Capacity utilization (0-1) */
  capacityUtilization: z.number().min(0).max(1),
  /** Overall reasoning */
  reasoning: z.string(),
  /** Associated risks */
  risks: z.array(SprintRiskSchema),
  /** Confidence scoring */
  confidence: SectionConfidenceSchema,
});

export type SprintSuggestionOutput = z.infer<typeof SprintSuggestionOutputSchema>;

// ============================================================================
// Roadmap Requirement Input Schemas
// ============================================================================

/**
 * Input schema for a requirement item.
 */
export const RequirementInputSchema = z.object({
  /** Optional unique identifier */
  id: z.string().optional(),
  /** Title of the requirement */
  title: z.string().min(1, "Requirement title is required"),
  /** Optional description */
  description: z.string().optional(),
  /** Priority level */
  priority: PriorityTierSchema.optional(),
  /** Estimated story points */
  estimatedPoints: z.number().min(0).optional(),
  /** Category or theme */
  category: z.string().optional(),
});

export type RequirementInput = z.infer<typeof RequirementInputSchema>;

/**
 * Schema for roadmap constraints.
 */
export const RoadmapConstraintsSchema = z.object({
  /** Timeline constraint (e.g., "6 months", "Q3 2026") */
  timeline: z.string().optional(),
  /** Team size for capacity estimation */
  teamSize: z.number().int().positive().optional(),
  /** Team velocity in points per sprint */
  velocity: z.number().positive().optional(),
  /** Sprint duration in weeks */
  sprintDurationWeeks: z.number().positive().optional(),
});

export type RoadmapConstraints = z.infer<typeof RoadmapConstraintsSchema>;

// ============================================================================
// Roadmap Generation Input/Output Schemas (AI-13)
// ============================================================================

/**
 * Input schema for generate_roadmap tool (AI-13).
 */
export const RoadmapGenerationInputSchema = z.object({
  /** Requirements as string or structured items */
  requirements: z.union([
    z.string().min(10, "Requirements description too short"),
    z.array(RequirementInputSchema).min(1, "At least one requirement needed"),
  ]).describe("Requirements to plan (string or structured items)"),
  /** Optional constraints */
  constraints: RoadmapConstraintsSchema.optional(),
  /** Optional business context */
  businessContext: z.string().optional(),
});

export type RoadmapGenerationInput = z.infer<typeof RoadmapGenerationInputSchema>;

/**
 * Schema for a roadmap phase.
 */
export const RoadmapPhaseSchema = z.object({
  /** Phase ID */
  id: z.string(),
  /** Phase name */
  name: z.string(),
  /** Phase description */
  description: z.string(),
  /** Phase objectives */
  objectives: z.array(z.string()),
  /** Duration in weeks */
  durationWeeks: z.number().positive(),
  /** Start week (relative) */
  startWeek: z.number().min(0),
  /** End week (relative) */
  endWeek: z.number().positive(),
  /** Milestone IDs in this phase */
  milestones: z.array(z.string()),
});

export type RoadmapPhase = z.infer<typeof RoadmapPhaseSchema>;

/**
 * Schema for a roadmap milestone.
 */
export const RoadmapMilestoneSchema = z.object({
  /** Milestone ID */
  id: z.string(),
  /** Milestone title */
  title: z.string(),
  /** Milestone description */
  description: z.string(),
  /** Parent phase ID */
  phaseId: z.string(),
  /** Target date (ISO string) */
  targetDate: z.string(),
  /** Deliverables */
  deliverables: z.array(z.string()),
  /** Dependent milestone IDs */
  dependencies: z.array(z.string()),
  /** Confidence in target date (0-1) */
  confidence: z.number().min(0).max(1),
});

export type RoadmapMilestone = z.infer<typeof RoadmapMilestoneSchema>;

/**
 * Schema for milestone dependency.
 */
export const MilestoneDependencySchema = z.object({
  /** From milestone ID */
  fromMilestoneId: z.string(),
  /** To milestone ID */
  toMilestoneId: z.string(),
  /** Dependency type */
  type: z.enum(["blocks", "relates_to"]),
  /** Optional description */
  description: z.string().optional(),
});

export type MilestoneDependencyOutput = z.infer<typeof MilestoneDependencySchema>;

/**
 * Schema for roadmap timeline.
 */
export const RoadmapTimelineSchema = z.object({
  /** Start date (ISO string) */
  startDate: z.string(),
  /** End date (ISO string) */
  endDate: z.string(),
  /** Total weeks */
  totalWeeks: z.number().positive(),
});

export type RoadmapTimelineOutput = z.infer<typeof RoadmapTimelineSchema>;

/**
 * Output schema for roadmap generation.
 */
export const RoadmapOutputSchema = z.object({
  /** Phases in the roadmap */
  phases: z.array(RoadmapPhaseSchema),
  /** All milestones */
  milestones: z.array(RoadmapMilestoneSchema),
  /** Dependencies between milestones */
  dependencies: z.array(MilestoneDependencySchema),
  /** Timeline information */
  timeline: RoadmapTimelineSchema,
  /** Confidence scoring */
  confidence: SectionConfidenceSchema,
  /** Optional reasoning */
  reasoning: z.string().optional(),
});

export type RoadmapOutput = z.infer<typeof RoadmapOutputSchema>;

// ============================================================================
// Roadmap Visualization Schemas (AI-16)
// ============================================================================

/**
 * Schema for visualization phase data.
 */
export const VisualizationPhaseSchema = z.object({
  /** Phase ID */
  id: z.string(),
  /** Phase name */
  name: z.string(),
  /** Start week */
  startWeek: z.number().min(0),
  /** End week */
  endWeek: z.number().positive(),
  /** Optional color */
  color: z.string().optional(),
});

export type VisualizationPhase = z.infer<typeof VisualizationPhaseSchema>;

/**
 * Schema for visualization milestone data.
 */
export const VisualizationMilestoneSchema = z.object({
  /** Milestone ID */
  id: z.string(),
  /** Milestone title */
  title: z.string(),
  /** Week number */
  week: z.number().min(0),
  /** Parent phase ID */
  phaseId: z.string(),
});

export type VisualizationMilestoneOutput = z.infer<typeof VisualizationMilestoneSchema>;

/**
 * Schema for dependency edge in visualization.
 */
export const DependencyEdgeSchema = z.object({
  /** From milestone ID */
  from: z.string(),
  /** To milestone ID */
  to: z.string(),
});

export type DependencyEdge = z.infer<typeof DependencyEdgeSchema>;

/**
 * Output schema for roadmap visualization data.
 */
export const RoadmapVisualizationOutputSchema = z.object({
  /** Phases for visualization */
  phases: z.array(VisualizationPhaseSchema),
  /** Milestones for visualization */
  milestones: z.array(VisualizationMilestoneSchema),
  /** Dependency edges */
  dependencies: z.array(DependencyEdgeSchema),
  /** Total duration in weeks */
  totalWeeks: z.number().positive(),
});

export type RoadmapVisualizationOutput = z.infer<typeof RoadmapVisualizationOutputSchema>;

// ============================================================================
// Phase Update Schemas (AI-14)
// ============================================================================

/**
 * Input schema for update_roadmap_phase tool (AI-14).
 */
export const UpdatePhaseInputSchema = z.object({
  /** ID of the phase to update */
  phaseId: z.string().min(1, "Phase ID is required"),
  /** New name (optional) */
  name: z.string().optional(),
  /** New description (optional) */
  description: z.string().optional(),
  /** New objectives (optional) */
  objectives: z.array(z.string()).optional(),
  /** New duration in weeks (optional) */
  durationWeeks: z.number().positive().optional(),
});

export type UpdatePhaseInput = z.infer<typeof UpdatePhaseInputSchema>;

/**
 * Output schema for phase update.
 */
export const PhaseUpdateOutputSchema = z.object({
  /** Updated phase */
  phase: RoadmapPhaseSchema,
  /** Whether timeline was affected */
  timelineAffected: z.boolean(),
  /** Milestones that were affected */
  affectedMilestones: z.array(z.string()),
});

export type PhaseUpdateOutput = z.infer<typeof PhaseUpdateOutputSchema>;

// ============================================================================
// Milestone Dependency Schemas (AI-15)
// ============================================================================

/**
 * Input schema for manage_milestone_dependencies tool (AI-15).
 */
export const ManageDependenciesInputSchema = z.object({
  /** Operation to perform */
  operation: z.enum(["add", "remove", "list"]),
  /** From milestone ID (required for add/remove) */
  fromMilestoneId: z.string().optional(),
  /** To milestone ID (required for add/remove) */
  toMilestoneId: z.string().optional(),
  /** Dependency type (required for add) */
  type: z.enum(["blocks", "relates_to"]).optional(),
  /** Optional description (for add) */
  description: z.string().optional(),
  /** Roadmap ID (required for list) */
  roadmapId: z.string().optional(),
});

export type ManageDependenciesInput = z.infer<typeof ManageDependenciesInputSchema>;

/**
 * Output schema for dependency management.
 */
export const DependencyManagementOutputSchema = z.object({
  /** Whether operation succeeded */
  success: z.boolean(),
  /** Message describing the result */
  message: z.string(),
  /** Current dependencies (for list operation) */
  dependencies: z.array(MilestoneDependencySchema).optional(),
  /** Whether a cycle was detected */
  cycleDetected: z.boolean().optional(),
  /** Affected milestones */
  affectedMilestones: z.array(z.string()).optional(),
});

export type DependencyManagementOutput = z.infer<typeof DependencyManagementOutputSchema>;
