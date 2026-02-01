/**
 * Roadmap Planning Domain Types
 *
 * TypeScript interfaces for AI-powered roadmap generation with phases,
 * milestones, dependencies, and timeline calculations.
 *
 * These types support Phase 10 AI Sprint and Roadmap Planning features:
 * - AI-13: Roadmap generation from requirements
 * - AI-14: Roadmap phase planning
 * - AI-15: Milestone dependency management
 * - AI-16: Roadmap visualization data
 */

import { SectionConfidence } from "./ai-types";

// ============================================================================
// Roadmap Phase Types
// ============================================================================

/**
 * A phase within a project roadmap.
 *
 * Phases represent major stages of the project, each containing
 * one or more milestones and spanning a duration in weeks.
 */
export interface RoadmapPhase {
  /** Unique identifier for the phase */
  id: string;
  /** Name of the phase (e.g., "Foundation", "MVP", "Enhancement") */
  name: string;
  /** Description of what the phase accomplishes */
  description: string;
  /** Key objectives to achieve in this phase */
  objectives: string[];
  /** Duration of the phase in weeks */
  durationWeeks: number;
  /** Start week number (relative to roadmap start) */
  startWeek: number;
  /** End week number (relative to roadmap start) */
  endWeek: number;
  /** IDs of milestones within this phase */
  milestones: string[];
}

// ============================================================================
// Milestone Types
// ============================================================================

/**
 * A milestone within a roadmap phase.
 *
 * Milestones represent specific deliverables or checkpoints
 * with target dates and dependencies.
 */
export interface RoadmapMilestone {
  /** Unique identifier for the milestone */
  id: string;
  /** Title of the milestone */
  title: string;
  /** Detailed description of the milestone */
  description: string;
  /** ID of the phase this milestone belongs to */
  phaseId: string;
  /** Target date for the milestone (ISO date string) */
  targetDate: string;
  /** List of deliverables for this milestone */
  deliverables: string[];
  /** IDs of other milestones this depends on */
  dependencies: string[];
  /** Confidence in the target date (0-1) */
  confidence: number;
}

/**
 * Dependency relationship between milestones.
 */
export interface MilestoneDependency {
  /** ID of the milestone that depends on another */
  fromMilestoneId: string;
  /** ID of the milestone being depended on */
  toMilestoneId: string;
  /** Type of dependency relationship */
  type: "blocks" | "relates_to";
  /** Optional description of the dependency */
  description?: string;
}

// ============================================================================
// Timeline Types
// ============================================================================

/**
 * Overall roadmap timeline information.
 */
export interface RoadmapTimeline {
  /** Start date of the roadmap (ISO date string) */
  startDate: string;
  /** End date of the roadmap (ISO date string) */
  endDate: string;
  /** Total duration in weeks */
  totalWeeks: number;
}

// ============================================================================
// Generated Roadmap Types
// ============================================================================

/**
 * Complete AI-generated roadmap.
 *
 * Contains all phases, milestones, dependencies, and timeline
 * information with confidence scoring.
 */
export interface GeneratedRoadmap {
  /** Phases in the roadmap */
  phases: RoadmapPhase[];
  /** All milestones across phases */
  milestones: RoadmapMilestone[];
  /** Dependencies between milestones */
  dependencies: MilestoneDependency[];
  /** Overall timeline information */
  timeline: RoadmapTimeline;
  /** Confidence scoring for the roadmap */
  confidence: SectionConfidence;
  /** Optional reasoning for the roadmap structure */
  reasoning?: string;
}

// ============================================================================
// Input Types
// ============================================================================

/**
 * A requirement item for roadmap generation input.
 */
export interface RequirementItem {
  /** Optional unique identifier */
  id?: string;
  /** Title of the requirement */
  title: string;
  /** Optional description */
  description?: string;
  /** Priority level */
  priority?: "critical" | "high" | "medium" | "low";
  /** Estimated story points */
  estimatedPoints?: number;
  /** Category or theme of the requirement */
  category?: string;
}

/**
 * Constraints for roadmap generation.
 */
export interface RoadmapConstraints {
  /** Timeline constraint (e.g., "6 months", "Q3 2026") */
  timeline?: string;
  /** Team size for capacity estimation */
  teamSize?: number;
  /** Team velocity in points per sprint */
  velocity?: number;
  /** Sprint duration in weeks */
  sprintDurationWeeks?: number;
}

/**
 * Input parameters for roadmap generation.
 */
export interface RoadmapGenerationInput {
  /** Requirements as either a string (to be parsed) or structured items */
  requirements: string | RequirementItem[];
  /** Optional constraints for the roadmap */
  constraints?: RoadmapConstraints;
  /** Optional business context for the AI */
  businessContext?: string;
}

// ============================================================================
// Visualization Types
// ============================================================================

/**
 * Phase data formatted for visualization.
 */
export interface VisualizationPhase {
  /** Phase ID */
  id: string;
  /** Phase name */
  name: string;
  /** Start week (relative) */
  startWeek: number;
  /** End week (relative) */
  endWeek: number;
  /** Optional color for visualization */
  color?: string;
}

/**
 * Milestone data formatted for visualization.
 */
export interface VisualizationMilestone {
  /** Milestone ID */
  id: string;
  /** Milestone title */
  title: string;
  /** Week number when milestone is due */
  week: number;
  /** ID of the phase this milestone belongs to */
  phaseId: string;
}

/**
 * Dependency edge for visualization.
 */
export interface VisualizationDependency {
  /** From milestone ID */
  from: string;
  /** To milestone ID */
  to: string;
}

/**
 * Roadmap data formatted for visualization (AI-16).
 *
 * Provides simplified, rendering-ready data for roadmap
 * visualization components.
 */
export interface RoadmapVisualizationData {
  /** Phases formatted for visualization */
  phases: VisualizationPhase[];
  /** Milestones formatted for visualization */
  milestones: VisualizationMilestone[];
  /** Dependency edges */
  dependencies: VisualizationDependency[];
  /** Total roadmap duration in weeks */
  totalWeeks: number;
}

// ============================================================================
// Roadmap Update Types
// ============================================================================

/**
 * Request to update a roadmap phase.
 */
export interface PhaseUpdateRequest {
  /** ID of the phase to update */
  phaseId: string;
  /** New name (optional) */
  name?: string;
  /** New description (optional) */
  description?: string;
  /** New objectives (optional) */
  objectives?: string[];
  /** New duration in weeks (optional) */
  durationWeeks?: number;
}

/**
 * Request to update a milestone.
 */
export interface MilestoneUpdateRequest {
  /** ID of the milestone to update */
  milestoneId: string;
  /** New title (optional) */
  title?: string;
  /** New description (optional) */
  description?: string;
  /** New target date (optional) */
  targetDate?: string;
  /** New deliverables (optional) */
  deliverables?: string[];
}

/**
 * Result of a roadmap recalculation.
 *
 * When velocity or constraints change, the roadmap may need
 * to be recalculated. This captures what changed.
 */
export interface RoadmapRecalculationResult {
  /** Updated roadmap */
  roadmap: GeneratedRoadmap;
  /** Changes made during recalculation */
  changes: Array<{
    /** Type of change */
    type: "milestone_moved" | "phase_extended" | "phase_shortened" | "milestone_added" | "milestone_removed";
    /** ID of the affected element */
    elementId: string;
    /** Description of the change */
    description: string;
    /** Previous value (if applicable) */
    previousValue?: string | number;
    /** New value (if applicable) */
    newValue?: string | number;
  }>;
  /** Reason for recalculation */
  reason: string;
}

// ============================================================================
// Roadmap Analysis Types
// ============================================================================

/**
 * Analysis of roadmap critical path.
 */
export interface CriticalPathAnalysis {
  /** Ordered list of milestone IDs on the critical path */
  criticalPath: string[];
  /** Total duration of critical path in weeks */
  totalDuration: number;
  /** Milestones that if delayed would affect the end date */
  criticalMilestones: string[];
  /** Milestones with slack time */
  milestonesWithSlack: Array<{
    milestoneId: string;
    slackWeeks: number;
  }>;
}

/**
 * Roadmap risk analysis.
 */
export interface RoadmapRiskAnalysis {
  /** Overall risk level */
  overallRisk: "high" | "medium" | "low";
  /** Specific risks identified */
  risks: Array<{
    type: "dependency_chain" | "resource_constraint" | "timeline_aggressive" | "scope_creep";
    description: string;
    affectedPhases: string[];
    affectedMilestones: string[];
    mitigation: string;
  }>;
  /** Confidence in the risk analysis */
  confidence: SectionConfidence;
}
