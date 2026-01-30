import { z } from "zod";

// ===== Base Types =====

export const ProjectFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  dataType: z.string(),
  options: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })).optional(),
});

export const ProjectViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  layout: z.string(),
  filter: z.string().optional(),
  sortBy: z.array(z.object({
    field: z.string(),
    direction: z.enum(["asc", "desc"]),
  })).optional(),
});

export const ProjectItemSchema = z.object({
  id: z.string(),
  type: z.enum(["issue", "pull_request", "draft_issue"]),
  title: z.string(),
  state: z.string().optional(),
  fieldValues: z.record(z.string(), z.unknown()).optional(),
});

// ===== Project Tool Output Schemas =====

export const ProjectOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  shortDescription: z.string().optional(),
  visibility: z.enum(["private", "public"]),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  fields: z.array(ProjectFieldSchema).optional(),
  views: z.array(ProjectViewSchema).optional(),
});

export const ProjectListOutputSchema = z.object({
  projects: z.array(ProjectOutputSchema),
  totalCount: z.number(),
  hasMore: z.boolean().optional(),
});

export const ProjectReadmeOutputSchema = z.object({
  content: z.string(),
  updatedAt: z.string().optional(),
});

// ===== Field Value Schemas =====

export const FieldValueOutputSchema = z.object({
  fieldId: z.string(),
  fieldName: z.string(),
  value: z.unknown(),
  formattedValue: z.string().optional(),
});

// ===== Project Item Schemas =====

export const ProjectItemListOutputSchema = z.object({
  items: z.array(ProjectItemSchema),
  totalCount: z.number(),
  hasMore: z.boolean().optional(),
});

export const ProjectItemAddOutputSchema = z.object({
  itemId: z.string(),
  projectId: z.string(),
  contentId: z.string(),
  contentType: z.enum(["issue", "pull_request"]),
});

// ===== Project Field Schemas =====

export const ProjectFieldListOutputSchema = z.object({
  fields: z.array(ProjectFieldSchema),
  totalCount: z.number(),
});

export const ProjectFieldOutputSchema = ProjectFieldSchema.extend({
  description: z.string().optional(),
  required: z.boolean().optional(),
});

// ===== Project View Schemas =====

export const ProjectViewListOutputSchema = z.object({
  views: z.array(ProjectViewSchema),
  totalCount: z.number(),
});

export const ProjectViewOutputSchema = ProjectViewSchema;

// ===== Milestone Schemas =====

export const MilestoneOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  state: z.enum(["open", "closed"]),
  progress: z.object({
    openIssues: z.number(),
    closedIssues: z.number(),
    completionPercentage: z.number(),
  }).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const MilestoneListOutputSchema = z.object({
  milestones: z.array(MilestoneOutputSchema),
  totalCount: z.number(),
});

export const MilestoneMetricsOutputSchema = z.object({
  milestoneId: z.string(),
  title: z.string(),
  openIssues: z.number(),
  closedIssues: z.number(),
  completionPercentage: z.number(),
  dueDate: z.string().optional(),
  isOverdue: z.boolean(),
  daysRemaining: z.number().optional(),
  issues: z.array(z.object({
    id: z.string(),
    title: z.string(),
    state: z.string(),
  })).optional(),
});

// ===== Sprint Schemas =====

export const SprintOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  goals: z.array(z.string()).optional(),
  status: z.enum(["planned", "active", "completed"]).optional(),
  createdAt: z.string(),
});

export const SprintListOutputSchema = z.object({
  sprints: z.array(SprintOutputSchema),
  totalCount: z.number(),
});

export const SprintMetricsOutputSchema = z.object({
  sprintId: z.string(),
  title: z.string(),
  totalIssues: z.number(),
  completedIssues: z.number(),
  completionPercentage: z.number(),
  remainingDays: z.number(),
  velocity: z.number().optional(),
  issues: z.array(z.object({
    id: z.string(),
    title: z.string(),
    state: z.string(),
  })).optional(),
});

// ===== Roadmap Schemas =====

export const RoadmapOutputSchema = z.object({
  projectId: z.string(),
  projectTitle: z.string(),
  milestones: z.array(z.object({
    milestoneId: z.string(),
    title: z.string(),
    issuesCreated: z.number(),
  })),
  totalIssuesCreated: z.number(),
});

// ===== Label Schemas =====

export const LabelOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  description: z.string().optional(),
});

export const LabelListOutputSchema = z.object({
  labels: z.array(LabelOutputSchema),
  totalCount: z.number(),
});

// ===== Iteration Schemas =====

export const IterationOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  startDate: z.string(),
  duration: z.number(),
});

export const IterationConfigOutputSchema = z.object({
  fieldId: z.string(),
  fieldName: z.string(),
  iterations: z.array(IterationOutputSchema),
  completedIterations: z.array(IterationOutputSchema).optional(),
});

export const IterationItemsOutputSchema = z.object({
  iterationId: z.string(),
  items: z.array(ProjectItemSchema),
  totalCount: z.number(),
});

// ===== Automation Schemas =====

export const AutomationRuleOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  projectId: z.string(),
  enabled: z.boolean(),
  triggers: z.array(z.object({
    type: z.string(),
    resourceType: z.string().optional(),
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.string(),
      value: z.unknown(),
    })).optional(),
  })),
  actions: z.array(z.object({
    type: z.string(),
    parameters: z.record(z.unknown()),
  })),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const AutomationRuleListOutputSchema = z.object({
  rules: z.array(AutomationRuleOutputSchema),
  totalCount: z.number(),
});

// ===== Event Schemas =====

export const EventOutputSchema = z.object({
  id: z.string(),
  type: z.string(),
  resourceType: z.string(),
  resourceId: z.string(),
  timestamp: z.string(),
  data: z.record(z.unknown()).optional(),
});

export const EventListOutputSchema = z.object({
  events: z.array(EventOutputSchema),
  totalCount: z.number(),
});

export const SubscriptionOutputSchema = z.object({
  subscriptionId: z.string(),
  clientId: z.string(),
  transport: z.string(),
  filters: z.array(z.object({
    resourceType: z.string().optional(),
    eventType: z.string().optional(),
    resourceId: z.string().optional(),
  })),
  createdAt: z.string(),
  expiresAt: z.string().optional(),
});

// ===== Issue Schemas =====

export const IssueOutputSchema = z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  body: z.string().optional(),
  state: z.enum(["open", "closed"]),
  labels: z.array(LabelOutputSchema).optional(),
  assignees: z.array(z.object({
    id: z.string(),
    login: z.string(),
  })).optional(),
  milestone: MilestoneOutputSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const IssueListOutputSchema = z.object({
  issues: z.array(IssueOutputSchema),
  totalCount: z.number(),
});

// ===== Issue Comment Schemas =====

export const IssueCommentOutputSchema = z.object({
  id: z.number(),
  body: z.string(),
  author: z.object({
    id: z.string(),
    login: z.string(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const IssueCommentListOutputSchema = z.object({
  comments: z.array(IssueCommentOutputSchema),
  totalCount: z.number(),
});

// ===== Draft Issue Schemas =====

export const DraftIssueOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string().optional(),
  assignees: z.array(z.object({
    id: z.string(),
    login: z.string(),
  })).optional(),
  createdAt: z.string(),
});

// ===== Pull Request Schemas =====

export const PullRequestOutputSchema = z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  body: z.string().optional(),
  state: z.enum(["open", "closed", "merged"]),
  head: z.string(),
  base: z.string(),
  draft: z.boolean().optional(),
  mergeable: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  mergedAt: z.string().optional(),
});

export const PullRequestListOutputSchema = z.object({
  pullRequests: z.array(PullRequestOutputSchema),
  totalCount: z.number(),
});

export const PullRequestReviewOutputSchema = z.object({
  id: z.string(),
  state: z.enum(["APPROVED", "CHANGES_REQUESTED", "COMMENTED", "PENDING", "DISMISSED"]),
  body: z.string().optional(),
  author: z.object({
    id: z.string(),
    login: z.string(),
  }),
  createdAt: z.string(),
});

export const PullRequestReviewListOutputSchema = z.object({
  reviews: z.array(PullRequestReviewOutputSchema),
  totalCount: z.number(),
});

export const MergeResultOutputSchema = z.object({
  merged: z.boolean(),
  sha: z.string().optional(),
  message: z.string(),
});

// ===== Generic Success Schemas =====

export const SuccessOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export const DeleteOutputSchema = z.object({
  deleted: z.boolean(),
  id: z.string(),
  type: z.string(),
});

// ===== AI Tool Schemas =====

export const AIEnrichmentOutputSchema = z.object({
  issueId: z.string(),
  suggestions: z.object({
    labels: z.array(z.string()).optional(),
    priority: z.string().optional(),
    type: z.string().optional(),
    complexity: z.string().optional(),
    effort: z.string().optional(),
  }),
  applied: z.boolean(),
});

export const AITriageOutputSchema = z.object({
  issueId: z.string(),
  classification: z.object({
    category: z.string(),
    priority: z.string(),
    severity: z.string().optional(),
  }),
  recommendations: z.array(z.string()),
  applied: z.boolean(),
});

export const AIRoadmapOutputSchema = z.object({
  projectId: z.string(),
  milestones: z.array(z.object({
    title: z.string(),
    description: z.string(),
    dueDate: z.string().optional(),
    issues: z.array(z.object({
      title: z.string(),
      description: z.string(),
    })),
  })),
  created: z.boolean(),
});

// ===== Bulk Operation Schemas =====

export const BulkOperationResultSchema = z.object({
  succeeded: z.number(),
  failed: z.number(),
  results: z.array(z.object({
    id: z.string(),
    success: z.boolean(),
    error: z.string().optional(),
  })),
});
