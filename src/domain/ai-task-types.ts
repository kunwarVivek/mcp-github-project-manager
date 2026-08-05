import { z } from "zod";

// ============================================================================
// AI Task Management Types
// ============================================================================

/**
 * Task Priority Levels
 */
export enum TaskPriority {
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low"
}

/**
 * Task Status
 */
export enum TaskStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  BLOCKED = "blocked",
  DONE = "done",
  CANCELLED = "cancelled"
}

/**
 * Task Complexity (1-10 scale)
 */
export type TaskComplexity = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * AI Generation Metadata
 */
export interface AIGenerationMetadata {
  generatedBy: string; // AI model used
  generatedAt: string; // ISO timestamp
  prompt: string; // Prompt used for generation
  confidence: number; // 0-1 confidence score
  version: string; // AI system version
}

/**
 * Task Dependency
 */
export interface TaskDependency {
  id: string;
  type: "blocks" | "depends_on" | "related_to";
  description?: string;
}

/**
 * Acceptance Criteria
 */
export interface AcceptanceCriteria {
  id: string;
  description: string;
  completed: boolean;
}

/**
 * AI Enhanced Task
 */
export interface AITask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  complexity: TaskComplexity;
  estimatedHours: number;
  actualHours?: number;

  // AI-specific metadata
  aiGenerated: boolean;
  aiMetadata?: AIGenerationMetadata;

  // Task relationships
  parentTaskId?: string;
  subtasks: string[]; // IDs of subtasks
  dependencies: TaskDependency[];

  // Acceptance criteria
  acceptanceCriteria: AcceptanceCriteria[];

  // GitHub integration
  githubProjectItemId?: string;
  githubIssueId?: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  dueDate?: string;

  // Additional metadata
  tags: string[];
  assignee?: string;
  sourcePRD?: string; // Reference to source PRD
}

/**
 * Subtask (simplified version of AITask)
 */
export interface SubTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  complexity: TaskComplexity;
  estimatedHours: number;
  parentTaskId: string;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Zod Schemas for AI Task Types
// ============================================================================

export const TaskPrioritySchema = z.nativeEnum(TaskPriority);
export const TaskStatusSchema = z.nativeEnum(TaskStatus);
export const TaskComplexitySchema = z.number().min(1).max(10) as z.ZodType<TaskComplexity>;

export const AIGenerationMetadataSchema = z.object({
  generatedBy: z.string(),
  generatedAt: z.string(),
  prompt: z.string(),
  confidence: z.number().min(0).max(1),
  version: z.string()
});

export const TaskDependencySchema = z.object({
  id: z.string(),
  type: z.enum(["blocks", "depends_on", "related_to"]),
  description: z.string().optional()
});

export const AcceptanceCriteriaSchema = z.object({
  id: z.string(),
  description: z.string(),
  completed: z.boolean()
});

export const AITaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  complexity: TaskComplexitySchema,
  estimatedHours: z.number().min(0),
  actualHours: z.number().min(0).optional(),
  aiGenerated: z.boolean(),
  aiMetadata: AIGenerationMetadataSchema.optional(),
  parentTaskId: z.string().optional(),
  subtasks: z.array(z.string()),
  dependencies: z.array(TaskDependencySchema),
  acceptanceCriteria: z.array(AcceptanceCriteriaSchema),
  githubProjectItemId: z.string().optional(),
  githubIssueId: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  dueDate: z.string().optional(),
  tags: z.array(z.string()),
  assignee: z.string().optional(),
  sourcePRD: z.string().optional()
});
