import { z } from "zod";

// ===== PRD Schemas =====

export const PRDSectionSchema = z.object({
  title: z.string(),
  content: z.string(),
  subsections: z.array(z.object({
    title: z.string(),
    content: z.string(),
  })).optional(),
});

export const PRDOutputSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  summary: z.string(),
  sections: z.array(PRDSectionSchema),
  metadata: z.object({
    version: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  }).optional(),
});

export const PRDParseOutputSchema = z.object({
  features: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    priority: z.enum(["high", "medium", "low"]).optional(),
    complexity: z.enum(["simple", "medium", "complex"]).optional(),
  })),
  requirements: z.array(z.object({
    id: z.string(),
    description: z.string(),
    type: z.enum(["functional", "non-functional", "constraint"]).optional(),
  })).optional(),
});

export const PRDEnhanceOutputSchema = z.object({
  enhancedPRD: PRDOutputSchema,
  improvements: z.array(z.object({
    section: z.string(),
    change: z.string(),
    reason: z.string(),
  })),
});

// ===== Task Schemas =====

export const TaskOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  complexity: z.enum(["simple", "medium", "complex"]).optional(),
  estimatedHours: z.number().optional(),
  dependencies: z.array(z.string()).optional(),
  subtasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
  })).optional(),
  assignee: z.string().optional(),
  labels: z.array(z.string()).optional(),
});

export const TaskListOutputSchema = z.object({
  tasks: z.array(TaskOutputSchema),
  totalCount: z.number(),
});

export const TaskComplexityOutputSchema = z.object({
  taskId: z.string(),
  complexity: z.enum(["simple", "medium", "complex"]),
  score: z.number(),
  factors: z.array(z.object({
    factor: z.string(),
    impact: z.enum(["low", "medium", "high"]),
    description: z.string(),
  })),
  recommendation: z.string().optional(),
});

export const TaskExpandOutputSchema = z.object({
  originalTaskId: z.string(),
  subtasks: z.array(TaskOutputSchema),
  totalSubtasks: z.number(),
});

export const NextTaskOutputSchema = z.object({
  task: TaskOutputSchema.optional(),
  reason: z.string(),
  alternatives: z.array(z.object({
    taskId: z.string(),
    reason: z.string(),
  })).optional(),
});

// ===== Feature Schemas =====

export const FeatureOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  userStories: z.array(z.object({
    id: z.string(),
    story: z.string(),
    acceptanceCriteria: z.array(z.string()),
  })).optional(),
  tasks: z.array(TaskOutputSchema).optional(),
});

export const AddFeatureOutputSchema = z.object({
  feature: FeatureOutputSchema,
  issuesCreated: z.array(z.object({
    id: z.string(),
    number: z.number(),
    title: z.string(),
    url: z.string(),
  })).optional(),
});

// ===== Traceability Matrix Schema =====

export const TraceabilityMatrixOutputSchema = z.object({
  requirements: z.array(z.object({
    id: z.string(),
    description: z.string(),
    linkedFeatures: z.array(z.string()),
    linkedTasks: z.array(z.string()),
    coverage: z.enum(["full", "partial", "none"]),
  })),
  coverage: z.object({
    totalRequirements: z.number(),
    coveredRequirements: z.number(),
    coveragePercentage: z.number(),
  }),
});
