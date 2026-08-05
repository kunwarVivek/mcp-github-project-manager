import { z } from "zod";
import type { TaskPriority, TaskComplexity, AITask, TaskDependency } from './ai-task-types';
import { TaskPrioritySchema, TaskComplexitySchema } from './ai-task-types';
import type { FeatureRequirement } from './prd-types';

// ============================================================================
// Feature Addition and Lifecycle Types
// ============================================================================

/**
 * Feature Addition Request
 */
export interface FeatureAdditionRequest {
  id: string;
  featureIdea: string;
  description: string;
  targetPRD?: string; // PRD ID to add feature to
  targetProject?: string; // GitHub project ID
  requestedBy: string;
  businessJustification?: string;
  targetUsers?: string[];
  priority?: TaskPriority;
  estimatedComplexity?: TaskComplexity;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'implemented';
}

/**
 * Feature Expansion Result
 */
export interface FeatureExpansionResult {
  feature: FeatureRequirement;
  tasks: AITask[];
  dependencies: TaskDependency[];
  estimatedEffort: number;
  suggestedMilestone?: string;
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    mitigations: string[];
  };
}

/**
 * Task Lifecycle State
 */
export interface TaskLifecycleState {
  taskId: string;
  currentPhase: 'planning' | 'development' | 'testing' | 'review' | 'deployment' | 'completed';
  phases: {
    planning: TaskPhaseInfo;
    development: TaskPhaseInfo;
    testing: TaskPhaseInfo;
    review: TaskPhaseInfo;
    deployment: TaskPhaseInfo;
  };
  blockers: TaskBlocker[];
  progressPercentage: number;
  estimatedCompletion: string;
  actualCompletion?: string;
}

/**
 * Valid status values for a task phase
 */
export type TaskPhaseStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';

/**
 * All valid task phase status values
 */
export const TASK_PHASE_STATUSES: readonly TaskPhaseStatus[] = ['not_started', 'in_progress', 'completed', 'blocked'] as const;

/**
 * Type guard to check if a string is a valid TaskPhaseStatus
 */
export function isTaskPhaseStatus(value: string): value is TaskPhaseStatus {
  return TASK_PHASE_STATUSES.includes(value as TaskPhaseStatus);
}

/**
 * Task Phase Information
 */
export interface TaskPhaseInfo {
  status: TaskPhaseStatus;
  startedAt?: string;
  completedAt?: string;
  assignee?: string;
  notes?: string;
  artifacts?: string[]; // URLs to deliverables, PRs, etc.
}

/**
 * Task Blocker
 */
export interface TaskBlocker {
  id: string;
  type: 'dependency' | 'resource' | 'technical' | 'external';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reportedAt: string;
  resolvedAt?: string;
  resolution?: string;
}

/**
 * Project Feature Roadmap
 */
export interface ProjectFeatureRoadmap {
  projectId: string;
  features: {
    current: FeatureRequirement[];
    planned: FeatureRequirement[];
    backlog: FeatureRequirement[];
  };
  timeline: {
    quarters: {
      [key: string]: {
        features: string[]; // feature IDs
        themes: string[];
        goals: string[];
      };
    };
  };
  dependencies: {
    [featureId: string]: string[]; // dependent feature IDs
  };
}

// ============================================================================
// Enhanced Zod Schemas
// ============================================================================

export const FeatureAdditionRequestSchema = z.object({
  id: z.string(),
  featureIdea: z.string().min(10),
  description: z.string().min(20),
  targetPRD: z.string().optional(),
  targetProject: z.string().optional(),
  requestedBy: z.string(),
  businessJustification: z.string().optional(),
  targetUsers: z.array(z.string()).optional(),
  priority: TaskPrioritySchema.optional(),
  estimatedComplexity: TaskComplexitySchema.optional(),
  createdAt: z.string(),
  status: z.enum(['pending', 'approved', 'rejected', 'implemented'])
});

export const TaskLifecycleStateSchema = z.object({
  taskId: z.string(),
  currentPhase: z.enum(['planning', 'development', 'testing', 'review', 'deployment', 'completed']),
  phases: z.object({
    planning: z.object({
      status: z.enum(['not_started', 'in_progress', 'completed', 'blocked']),
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      assignee: z.string().optional(),
      notes: z.string().optional(),
      artifacts: z.array(z.string()).optional()
    }),
    development: z.object({
      status: z.enum(['not_started', 'in_progress', 'completed', 'blocked']),
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      assignee: z.string().optional(),
      notes: z.string().optional(),
      artifacts: z.array(z.string()).optional()
    }),
    testing: z.object({
      status: z.enum(['not_started', 'in_progress', 'completed', 'blocked']),
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      assignee: z.string().optional(),
      notes: z.string().optional(),
      artifacts: z.array(z.string()).optional()
    }),
    review: z.object({
      status: z.enum(['not_started', 'in_progress', 'completed', 'blocked']),
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      assignee: z.string().optional(),
      notes: z.string().optional(),
      artifacts: z.array(z.string()).optional()
    }),
    deployment: z.object({
      status: z.enum(['not_started', 'in_progress', 'completed', 'blocked']),
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      assignee: z.string().optional(),
      notes: z.string().optional(),
      artifacts: z.array(z.string()).optional()
    })
  }),
  blockers: z.array(z.object({
    id: z.string(),
    type: z.enum(['dependency', 'resource', 'technical', 'external']),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    reportedAt: z.string(),
    resolvedAt: z.string().optional(),
    resolution: z.string().optional()
  })),
  progressPercentage: z.number().min(0).max(100),
  estimatedCompletion: z.string(),
  actualCompletion: z.string().optional()
});
