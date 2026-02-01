/**
 * Sprint Planning Domain Types
 *
 * TypeScript interfaces for AI-powered sprint capacity planning,
 * backlog prioritization, risk assessment, and sprint composition suggestions.
 *
 * These types support Phase 10 AI Sprint and Roadmap Planning features:
 * - AI-09: Sprint capacity planning with velocity
 * - AI-10: Backlog prioritization (multi-factor)
 * - AI-11: Sprint risk assessment
 * - AI-12: Sprint scope recommendations
 */

import { SectionConfidence } from "./ai-types";

// ============================================================================
// Team and Capacity Types
// ============================================================================

/**
 * Team member with availability and skills for capacity planning.
 */
export interface TeamMember {
  /** Unique identifier for the team member */
  id: string;
  /** Display name of the team member */
  name: string;
  /** Availability as a fraction (0-1, where 1 = 100% available) */
  availability: number;
  /** Optional list of skills for skill-based assignment */
  skills?: string[];
}

/**
 * Aggregated team availability for a sprint.
 */
export interface TeamAvailability {
  /** Total available capacity as a fraction (0-1) */
  totalAvailability: number;
  /** Number of team members */
  memberCount: number;
  /** Individual member availability breakdown */
  members: Array<{
    id: string;
    name: string;
    availability: number;
  }>;
  /** Confidence in availability calculation (0-1) */
  confidence: number;
}

/**
 * Sprint capacity calculation result.
 *
 * Represents the calculated capacity for a sprint based on velocity,
 * team availability, and configured buffer.
 */
export interface SprintCapacity {
  /** Total story points calculated from velocity */
  totalPoints: number;
  /** Recommended load (typically 80% of total for sustainability) */
  recommendedLoad: number;
  /** Team availability breakdown */
  teamAvailability: TeamAvailability;
  /** Buffer configuration for unexpected work */
  buffer: {
    /** Buffer percentage (e.g., 20 for 20%) */
    percentage: number;
    /** Reasoning for the buffer percentage */
    reasoning: string;
  };
  /** Confidence scoring for the capacity calculation */
  confidence: SectionConfidence;
}

// ============================================================================
// Risk Assessment Types
// ============================================================================

/**
 * Risk category for sprint risks.
 */
export type SprintRiskCategory =
  | "scope"
  | "dependency"
  | "capacity"
  | "technical"
  | "external";

/**
 * Risk probability level.
 */
export type RiskProbability = "high" | "medium" | "low";

/**
 * Risk impact level.
 */
export type RiskImpact = "high" | "medium" | "low";

/**
 * Individual sprint risk identified during assessment.
 */
export interface SprintRisk {
  /** Unique risk identifier */
  id: string;
  /** Category of the risk */
  category: SprintRiskCategory;
  /** Short title for the risk */
  title: string;
  /** Detailed description of the risk */
  description: string;
  /** Probability of the risk occurring */
  probability: RiskProbability;
  /** Impact if the risk occurs */
  impact: RiskImpact;
  /** IDs of backlog items affected by this risk */
  relatedItems: string[];
}

/**
 * Mitigation strategy types.
 */
export type MitigationStrategy = "avoid" | "mitigate" | "transfer" | "accept";

/**
 * Effort level for implementing a mitigation.
 */
export type MitigationEffort = "low" | "medium" | "high";

/**
 * Suggestion for mitigating an identified risk.
 */
export interface MitigationSuggestion {
  /** ID of the risk this mitigation addresses */
  riskId: string;
  /** Type of mitigation strategy */
  strategy: MitigationStrategy;
  /** Specific action to take */
  action: string;
  /** Effort required to implement the mitigation */
  effort: MitigationEffort;
  /** Expected effectiveness (0-1, where 1 = fully mitigates risk) */
  effectiveness: number;
}

/**
 * Complete sprint risk assessment result.
 */
export interface SprintRiskAssessment {
  /** Overall risk level for the sprint */
  overallRisk: RiskProbability;
  /** Numeric risk score (0-100, higher = riskier) */
  riskScore: number;
  /** List of identified risks */
  risks: SprintRisk[];
  /** Suggested mitigations for the risks */
  mitigations: MitigationSuggestion[];
  /** Confidence scoring for the assessment */
  confidence: SectionConfidence;
}

// ============================================================================
// Prioritization Types
// ============================================================================

/**
 * Priority tier for backlog items.
 */
export type PriorityTier = "critical" | "high" | "medium" | "low";

/**
 * Factors contributing to an item's priority score.
 */
export interface PriorityFactors {
  /** Business value score (0-1) */
  businessValue: number;
  /** Dependency score (0-1, higher = fewer blockers) */
  dependencyScore: number;
  /** Risk score (0-1, higher = lower risk) */
  riskScore: number;
  /** Effort fit score (0-1, how well it fits capacity) */
  effortFit: number;
}

/**
 * A backlog item with its calculated priority.
 */
export interface PrioritizedItem {
  /** ID of the backlog item */
  itemId: string;
  /** Assigned priority tier */
  priority: PriorityTier;
  /** Numeric priority score (0-100) */
  score: number;
  /** Breakdown of factors contributing to the score */
  factors: PriorityFactors;
  /** AI reasoning for the priority assignment */
  reasoning: string;
}

/**
 * Methodology and weightings used for prioritization.
 */
export interface PrioritizationReasoning {
  /** Description of the prioritization approach used */
  methodology: string;
  /** Weights applied to each factor */
  weightings: {
    businessValue: number;
    dependencies: number;
    risk: number;
    effort: number;
  };
  /** Key tradeoff decisions made during prioritization */
  tradeoffs: string[];
}

/**
 * Complete prioritization result for a backlog.
 */
export interface PrioritizationResult {
  /** Prioritized backlog items */
  prioritizedItems: PrioritizedItem[];
  /** Reasoning and methodology used */
  reasoning: PrioritizationReasoning;
  /** Confidence scoring for the prioritization */
  confidence: SectionConfidence;
}

// ============================================================================
// Sprint Suggestion Types
// ============================================================================

/**
 * An item suggested for inclusion in the sprint.
 */
export interface SuggestedItem {
  /** ID of the backlog item */
  itemId: string;
  /** Title of the item */
  title: string;
  /** Story points for the item */
  points: number;
  /** Priority tier of the item */
  priority: PriorityTier;
  /** Reason for including this item */
  includeReason: string;
  /** IDs of items this depends on */
  dependencies: string[];
}

/**
 * AI-generated sprint composition suggestion.
 *
 * Provides a recommended set of items for the sprint based on
 * capacity, priorities, dependencies, and business goals.
 */
export interface SprintSuggestion {
  /** Items suggested for the sprint */
  suggestedItems: SuggestedItem[];
  /** Total story points of suggested items */
  totalPoints: number;
  /** Capacity utilization (0-1) */
  capacityUtilization: number;
  /** Overall reasoning for the suggestion */
  reasoning: string;
  /** Risks associated with this sprint composition */
  risks: SprintRisk[];
  /** Confidence scoring for the suggestion */
  confidence: SectionConfidence;
}

// ============================================================================
// Input Types
// ============================================================================

/**
 * Backlog item for sprint planning input.
 *
 * Represents an item from the backlog that can be considered
 * for inclusion in a sprint.
 */
export interface BacklogItem {
  /** Unique identifier for the item */
  id: string;
  /** Title of the backlog item */
  title: string;
  /** Optional description */
  description?: string;
  /** Story points estimate */
  points?: number;
  /** Current priority */
  priority?: PriorityTier;
  /** Labels attached to the item */
  labels?: string[];
  /** IDs of items this depends on */
  dependencies?: string[];
}

/**
 * Historical sprint metrics for velocity calculation.
 */
export interface SprintMetrics {
  /** Sprint identifier */
  sprintId: string;
  /** Sprint name or title */
  sprintName: string;
  /** Planned story points */
  plannedPoints: number;
  /** Completed story points */
  completedPoints: number;
  /** Sprint duration in days */
  durationDays: number;
  /** Start date (ISO string) */
  startDate: string;
  /** End date (ISO string) */
  endDate: string;
}

/**
 * Detected dependency between backlog items.
 */
export interface DetectedDependency {
  /** ID of the dependent item (the one that depends on another) */
  fromItemId: string;
  /** ID of the item being depended on */
  toItemId: string;
  /** Type of dependency */
  type: "blocks" | "depends_on" | "related_to";
  /** Description of the dependency relationship */
  description?: string;
  /** Confidence in the detected dependency (0-1) */
  confidence: number;
}

// ============================================================================
// Capacity Input Types
// ============================================================================

/**
 * Input parameters for sprint capacity calculation.
 */
export interface CapacityInput {
  /** Velocity in points per sprint, or 'auto' to calculate from history */
  velocity: number | "auto";
  /** Sprint duration in days */
  sprintDurationDays: number;
  /** Team members with their availability */
  teamMembers: TeamMember[];
  /** Optional historical sprints for velocity calculation */
  historicalSprints?: SprintMetrics[];
}

/**
 * Input parameters for backlog prioritization.
 */
export interface PrioritizationInput {
  /** Backlog items to prioritize */
  backlogItems: BacklogItem[];
  /** Available sprint capacity in points */
  sprintCapacity: number;
  /** Optional business goals to prioritize towards */
  businessGoals?: string[];
  /** Risk tolerance level */
  riskTolerance?: RiskProbability;
}

/**
 * Input parameters for sprint risk assessment.
 */
export interface RiskAssessmentInput {
  /** Items planned for the sprint */
  sprintItems: BacklogItem[];
  /** Sprint capacity information */
  capacity: SprintCapacity;
  /** Known dependencies between items */
  dependencies?: DetectedDependency[];
  /** Optional historical data for context */
  historicalData?: SprintMetrics[];
}

/**
 * Input parameters for sprint suggestion generation.
 */
export interface SprintSuggestionInput {
  /** Available backlog items */
  backlogItems: BacklogItem[];
  /** Team velocity in points per sprint */
  velocity: number;
  /** Sprint duration in days */
  sprintDurationDays: number;
  /** Optional team members for capacity consideration */
  teamMembers?: TeamMember[];
  /** Optional business goals to optimize for */
  businessGoals?: string[];
  /** Risk tolerance level */
  riskTolerance?: RiskProbability;
}
