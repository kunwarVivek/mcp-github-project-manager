/**
 * Compound Zod schemas for the 16 consolidated MCP tools + 1 discover_tools meta-tool.
 *
 * Each schema uses a flat z.object with an `action` discriminator. Parameters from
 * all granular tools in the group are merged and marked `.optional()` since they
 * are action-dependent. The compound executor validates action-specific requirements
 * at dispatch time.
 */

import { z } from 'zod';
import {
  AgentRoleSchema,
  AgentRuntimeSchema,
  AgentOperationalStatusSchema,
  CheckoutStrategySchema,
  BudgetResetPeriodSchema,
} from '../../../domain/agent-orchestration-types';

// ============================================================================
// 1. manage_project — 22+ granular project tools
// ============================================================================

export const manageProjectSchema = z.object({
  action: z.enum([
    'create', 'list', 'get', 'update', 'delete',
    'get_readme', 'update_readme',
    'create_field', 'list_fields', 'update_field',
    'create_view', 'list_views', 'update_view', 'delete_view',
    'add_item', 'remove_item', 'list_items', 'archive_item', 'unarchive_item',
    'set_field_value', 'get_field_value', 'clear_field_value',
    'close', 'reopen',
    'mark_as_template', 'unmark_as_template', 'copy_from_template', 'list_templates',
    'link_to_repo', 'unlink_from_repo', 'link_to_team', 'unlink_from_team',
    'list_linked_repos', 'list_linked_teams',
    'update_item_position', 'filter_items',
    'setup_agent_fields',
  ]).describe('The project operation to perform'),
  // Common
  projectId: z.string().optional(),
  // Create / Update
  title: z.string().optional(),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  owner: z.string().optional(),
  visibility: z.enum(['private', 'public']).optional(),
  // List
  status: z.string().optional(),
  limit: z.number().optional(),
  // Readme
  readme: z.string().optional(),
  // Fields
  fieldId: z.string().optional(),
  name: z.string().optional(),
  type: z.string().optional(),
  options: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
    color: z.string().optional(),
  })).optional(),
  required: z.boolean().optional(),
  // Views
  viewId: z.string().optional(),
  layout: z.enum(['board', 'table', 'timeline', 'roadmap']).optional(),
  // Items
  itemId: z.string().optional(),
  contentId: z.string().optional(),
  contentType: z.enum(['issue', 'pull_request']).optional(),
  // Field values
  value: z.unknown().optional(),
  // Templates
  targetOwner: z.string().optional(),
  includeDraftIssues: z.boolean().optional(),
  // List templates
  org: z.string().optional(),
  first: z.number().optional(),
  after: z.string().optional(),
  // Linking
  repo: z.string().optional(),
  teamSlug: z.string().optional(),
  // Position
  afterId: z.string().optional(),
  // Filter items
  filter: z.object({
    status: z.string().optional(),
    labels: z.array(z.string()).optional(),
    assignee: z.string().optional(),
    type: z.enum(['Issue', 'PullRequest', 'DraftIssue']).optional(),
  }).optional(),
}).describe('Manage GitHub Projects v2 — all project operations');

export type ManageProjectArgs = z.infer<typeof manageProjectSchema>;

// ============================================================================
// 2. manage_issues — 14+ granular issue tools
// ============================================================================

export const manageIssuesSchema = z.object({
  action: z.enum([
    'create', 'list', 'get', 'update',
    'create_comment', 'update_comment', 'delete_comment', 'list_comments',
    'create_draft', 'update_draft', 'delete_draft', 'convert_draft',
    'search_advanced',
    'add_sub_issue', 'list_sub_issues', 'get_parent_issue',
    'reprioritize_sub_issue', 'remove_sub_issue',
  ]).describe('The issue operation to perform'),
  // Common
  issueId: z.string().optional(),
  // Create / Update
  title: z.string().optional(),
  description: z.string().optional(),
  milestoneId: z.string().optional().nullable(),
  assignees: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  type: z.enum(['bug', 'feature', 'enhancement', 'documentation']).optional(),
  // List
  status: z.enum(['open', 'closed', 'all']).optional(),
  milestone: z.string().optional(),
  assignee: z.string().optional(),
  sort: z.enum(['created', 'updated', 'comments']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
  limit: z.number().optional(),
  // Comments
  issueNumber: z.number().optional(),
  commentId: z.number().optional(),
  body: z.string().optional(),
  perPage: z.number().optional(),
  // Draft issues
  projectId: z.string().optional(),
  draftIssueId: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
  // Convert draft
  itemId: z.string().optional(),
  owner: z.string().optional(),
  repo: z.string().optional(),
  // Search advanced
  query: z.string().optional(),
  first: z.number().optional(),
  after: z.string().optional(),
  // Sub-issues
  parentIssueNumber: z.number().optional(),
  subIssueNumber: z.number().optional(),
  replaceParent: z.boolean().optional(),
  afterIssueNumber: z.number().optional(),
}).describe('Manage GitHub Issues — CRUD, comments, drafts, sub-issues, and search');

export type ManageIssuesArgs = z.infer<typeof manageIssuesSchema>;

// ============================================================================
// 3. manage_prs — 7 granular PR tools
// ============================================================================

export const managePrsSchema = z.object({
  action: z.enum([
    'create', 'get', 'list', 'update', 'merge',
    'list_reviews', 'create_review',
  ]).describe('The pull request operation to perform'),
  // Common
  pullNumber: z.number().optional(),
  // Create
  title: z.string().optional(),
  body: z.string().optional(),
  head: z.string().optional(),
  base: z.string().optional(),
  draft: z.boolean().optional(),
  // List
  state: z.enum(['open', 'closed', 'all']).optional(),
  perPage: z.number().optional(),
  // Update
  // title, body already above
  // Merge
  commitTitle: z.string().optional(),
  commitMessage: z.string().optional(),
  mergeMethod: z.enum(['merge', 'squash', 'rebase']).optional(),
  // Create review
  event: z.enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']).optional(),
  comments: z.array(z.object({
    path: z.string(),
    position: z.number().optional(),
    body: z.string(),
  })).optional(),
}).describe('Manage GitHub Pull Requests — create, update, merge, and reviews');

export type ManagePrsArgs = z.infer<typeof managePrsSchema>;

// ============================================================================
// 4. manage_milestones — 6 granular milestone tools
// ============================================================================

export const manageMilestonesSchema = z.object({
  action: z.enum([
    'create', 'list', 'update', 'delete',
    'get_metrics', 'get_overdue', 'get_upcoming',
  ]).describe('The milestone operation to perform'),
  // Common
  milestoneId: z.string().optional(),
  // Create / Update
  title: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  state: z.enum(['open', 'closed']).optional(),
  // List
  status: z.enum(['open', 'closed', 'all']).optional(),
  sort: z.enum(['due_date', 'title', 'created_at']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
  // Metrics
  includeIssues: z.boolean().optional(),
  // Overdue / Upcoming
  limit: z.number().optional(),
  daysAhead: z.number().optional(),
}).describe('Manage GitHub Milestones — CRUD, metrics, overdue and upcoming tracking');

export type ManageMilestonesArgs = z.infer<typeof manageMilestonesSchema>;

// ============================================================================
// 5. manage_sprints — 8 granular sprint tools
// ============================================================================

export const manageSprintsSchema = z.object({
  action: z.enum([
    'create', 'list', 'get_current', 'update',
    'add_issues', 'remove_issues', 'get_metrics', 'plan',
  ]).describe('The sprint operation to perform'),
  // Common
  sprintId: z.string().optional(),
  // Create
  title: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  issueIds: z.array(z.string()).optional(),
  // List
  status: z.enum(['planned', 'active', 'completed', 'all']).optional(),
  // Get current
  includeIssues: z.boolean().optional(),
  // Plan
  sprint: z.object({
    title: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    goals: z.array(z.string()),
  }).optional(),
}).describe('Manage Sprints — create, update, plan, add/remove issues, and metrics');

export type ManageSprintsArgs = z.infer<typeof manageSprintsSchema>;

// ============================================================================
// 6. manage_labels — 2 granular label tools
// ============================================================================

export const manageLabelsSchema = z.object({
  action: z.enum([
    'create', 'list',
  ]).describe('The label operation to perform'),
  // Create
  name: z.string().optional(),
  color: z.string().optional(),
  description: z.string().optional(),
  // List
  limit: z.number().optional(),
}).describe('Manage GitHub Labels — create and list repository labels');

export type ManageLabelsArgs = z.infer<typeof manageLabelsSchema>;

// ============================================================================
// 7. manage_automation — 7 granular automation rule tools
// ============================================================================

export const manageAutomationSchema = z.object({
  action: z.enum([
    'create_rule', 'update_rule', 'delete_rule', 'get_rule',
    'list_rules', 'enable_rule', 'disable_rule',
  ]).describe('The automation rule operation to perform'),
  // Common
  ruleId: z.string().optional(),
  projectId: z.string().optional(),
  // Create / Update
  name: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  triggers: z.array(z.object({
    type: z.enum([
      'resource_created', 'resource_updated', 'resource_deleted',
      'issue_opened', 'issue_closed', 'issue_labeled', 'issue_assigned',
      'pr_opened', 'pr_closed', 'pr_merged', 'pr_approved',
      'sprint_started', 'sprint_ended', 'milestone_reached', 'schedule',
    ]),
    resourceType: z.string().optional(),
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.string(),
      value: z.unknown(),
    })).optional(),
  })).optional(),
  actions: z.array(z.object({
    type: z.enum([
      'update_resource', 'create_resource', 'delete_resource',
      'add_label', 'remove_label', 'assign_user', 'unassign_user',
      'create_relationship', 'delete_relationship', 'notify', 'webhook', 'custom_script',
    ]),
    parameters: z.record(z.string(), z.unknown()).optional(),
  })).optional(),
}).describe('Manage Automation Rules — create, update, delete, enable/disable project automation');

export type ManageAutomationArgs = z.infer<typeof manageAutomationSchema>;

// ============================================================================
// 8. manage_iterations — 5 granular iteration tools
// ============================================================================

export const manageIterationsSchema = z.object({
  action: z.enum([
    'get_config', 'get_current', 'get_items', 'get_by_date', 'assign_items',
  ]).describe('The iteration operation to perform'),
  // Common
  projectId: z.string().optional(),
  fieldName: z.string().optional(),
  // Get items / Assign items
  iterationId: z.string().optional(),
  limit: z.number().optional(),
  // Get by date
  date: z.string().optional(),
  // Assign items
  itemIds: z.array(z.string()).optional(),
}).describe('Manage Project Iterations — configuration, current iteration, items, and assignment');

export type ManageIterationsArgs = z.infer<typeof manageIterationsSchema>;

// ============================================================================
// 9. manage_events — 3 granular event tools
// ============================================================================

export const manageEventsSchema = z.object({
  action: z.enum([
    'subscribe', 'get_recent', 'replay',
  ]).describe('The event operation to perform'),
  // Subscribe
  clientId: z.string().optional(),
  filters: z.array(z.object({
    resourceType: z.enum(['PROJECT', 'MILESTONE', 'ISSUE', 'SPRINT']).optional(),
    eventType: z.enum(['created', 'updated', 'deleted', 'closed', 'reopened']).optional(),
    resourceId: z.string().optional(),
    source: z.enum(['github', 'api']).optional(),
    tags: z.array(z.string()).optional(),
  })).optional(),
  transport: z.enum(['sse', 'webhook', 'internal']).optional(),
  endpoint: z.string().optional(),
  expiresAt: z.string().optional(),
  // Get recent / Replay
  resourceType: z.enum(['PROJECT', 'MILESTONE', 'ISSUE', 'SPRINT']).optional(),
  resourceId: z.string().optional(),
  eventType: z.enum(['created', 'updated', 'deleted', 'closed', 'reopened']).optional(),
  limit: z.number().optional(),
  // Replay
  fromTimestamp: z.string().optional(),
  toTimestamp: z.string().optional(),
}).describe('Manage Events — subscribe, get recent events, and replay event history');

export type ManageEventsArgs = z.infer<typeof manageEventsSchema>;

// ============================================================================
// 10. manage_status_updates — 3 granular status update tools
// ============================================================================

export const manageStatusUpdatesSchema = z.object({
  action: z.enum([
    'create', 'list', 'get',
  ]).describe('The status update operation to perform'),
  // Common
  projectId: z.string().optional(),
  // Create
  body: z.string().optional(),
  status: z.enum(['ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'COMPLETE', 'INACTIVE']).optional(),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
  // List
  first: z.number().optional(),
  after: z.string().optional(),
  // Get
  statusUpdateId: z.string().optional(),
}).describe('Manage Project Status Updates — create, list, and get status updates');

export type ManageStatusUpdatesArgs = z.infer<typeof manageStatusUpdatesSchema>;

// ============================================================================
// 11. ai_generate — 8 granular AI generation tools
// ============================================================================

export const aiGenerateSchema = z.object({
  /**
   * Agent this call is made on behalf of. When present, the server debits
   * the tokens it spends to that agent's budget. Optional: these tools are
   * also called directly by humans, where there is nothing to debit.
   */
  agentId: z.string().optional(),
  action: z.enum([
    'generate_prd', 'enhance_prd', 'parse_prd', 'add_feature',
    'get_next_task', 'analyze_complexity', 'expand_task',
    'create_traceability_matrix', 'materialize_tasks',
  ]).describe('The AI generation operation to perform'),
  // generate_prd
  projectIdea: z.string().optional(),
  projectName: z.string().optional(),
  targetUsers: z.array(z.string()).optional(),
  timeline: z.string().optional(),
  complexity: z.enum(['low', 'medium', 'high']).optional(),
  author: z.string().optional(),
  stakeholders: z.array(z.string()).optional(),
  includeResearch: z.boolean().optional(),
  industryContext: z.string().optional(),
  // enhance_prd
  prdContent: z.string().optional(),
  enhancementType: z.enum(['comprehensive', 'technical', 'user_focused', 'business_focused']).optional(),
  focusAreas: z.array(z.string()).optional(),
  targetAudience: z.enum(['technical', 'business', 'mixed']).optional(),
  addMissingElements: z.boolean().optional(),
  improveExisting: z.boolean().optional(),
  validateQuality: z.boolean().optional(),
  // parse_prd
  maxTasks: z.number().optional(),
  includeSubtasks: z.boolean().optional(),
  autoEstimate: z.boolean().optional(),
  autoPrioritize: z.boolean().optional(),
  autoDetectDependencies: z.boolean().optional(),
  targetComplexity: z.number().optional(),
  teamSkills: z.array(z.string()).optional(),
  projectType: z.string().optional(),
  createLifecycle: z.boolean().optional(),
  createTraceabilityMatrix: z.boolean().optional(),
  includeUseCases: z.boolean().optional(),
  projectId: z.string().optional(),
  enhancedGeneration: z.boolean().optional(),
  contextLevel: z.enum(['minimal', 'standard', 'full']).optional(),
  includeBusinessContext: z.boolean().optional(),
  includeTechnicalContext: z.boolean().optional(),
  includeImplementationGuidance: z.boolean().optional(),
  // add_feature
  featureIdea: z.string().optional(),
  description: z.string().optional(),
  targetPRD: z.string().optional(),
  targetProject: z.string().optional(),
  businessJustification: z.string().optional(),
  requestedBy: z.string().optional(),
  autoApprove: z.boolean().optional(),
  expandToTasks: z.boolean().optional(),
  // get_next_task
  featureId: z.string().optional(),
  assignee: z.string().optional(),
  sprintCapacity: z.number().optional(),
  currentPhase: z.enum(['planning', 'development', 'testing', 'review', 'deployment']).optional(),
  excludeBlocked: z.boolean().optional(),
  maxComplexity: z.number().optional(),
  includeAnalysis: z.boolean().optional(),
  limit: z.number().optional(),
  // analyze_complexity
  taskTitle: z.string().optional(),
  taskDescription: z.string().optional(),
  currentEstimate: z.number().optional(),
  teamExperience: z.enum(['junior', 'mid', 'senior', 'mixed']).optional(),
  projectContext: z.string().optional(),
  includeBreakdown: z.boolean().optional(),
  includeRisks: z.boolean().optional(),
  includeRecommendations: z.boolean().optional(),
  // expand_task
  currentComplexity: z.number().optional(),
  maxSubtasks: z.number().optional(),
  maxDepth: z.number().optional(),
  includeEstimates: z.boolean().optional(),
  includeDependencies: z.boolean().optional(),
  includeAcceptanceCriteria: z.boolean().optional(),
  // create_traceability_matrix
  features: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    userStories: z.array(z.string()),
    acceptanceCriteria: z.array(z.string()),
    estimatedComplexity: z.number(),
  })).optional(),
  tasks: z.array(z.object({
    id: z.string().optional(),
    title: z.string(),
    description: z.string(),
    complexity: z.number().optional(),
    estimatedHours: z.number().optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    dependencies: z.array(z.object({
      id: z.string(),
      type: z.enum(['blocks', 'depends_on', 'related_to']).optional(),
      description: z.string().optional(),
    })).optional(),
    acceptanceCriteria: z.array(z.object({
      description: z.string(),
    })).optional(),
    tags: z.array(z.string()).optional(),
  })).optional(),
  includeTraceabilityLinks: z.boolean().optional(),
  includeCoverageAnalysis: z.boolean().optional(),
  validateCompleteness: z.boolean().optional(),
  // materialize_tasks — creates GitHub issues from generated tasks
  labelPrefix: z.string().optional().describe('Label prefix for materialized issues (e.g. "ai-generated")'),
  addToProject: z.boolean().optional().describe('Whether to add created issues to the specified projectId'),
}).describe('AI Generation — PRD generation/enhancement/parsing, feature management, task analysis, task materialization');

export type AiGenerateArgs = z.infer<typeof aiGenerateSchema>;

// ============================================================================
// 12. ai_analyze — 6+ granular AI analysis tools
// ============================================================================

export const aiAnalyzeSchema = z.object({
  /**
   * Agent this call is made on behalf of. When present, the server debits
   * the tokens it spends to that agent's budget. Optional: these tools are
   * also called directly by humans, where there is nothing to debit.
   */
  agentId: z.string().optional(),
  action: z.enum([
    'enrich_issue', 'enrich_bulk', 'triage_issue', 'triage_all',
    'schedule_triaging', 'suggest_labels', 'detect_duplicates', 'find_related',
  ]).describe('The AI analysis operation to perform'),
  // Common AI enrichment/triage (from ai-automation-tool-schemas)
  projectId: z.string().optional(),
  issueId: z.string().optional(),
  issueNumber: z.number().optional(),
  issueTitle: z.string().optional(),
  issueDescription: z.string().optional(),
  projectContext: z.string().optional(),
  autoApply: z.boolean().optional(),
  // Enrich bulk
  issueIds: z.array(z.string()).optional(),
  // Triage all
  onlyUntriaged: z.boolean().optional(),
  // Schedule triaging
  schedule: z.enum(['hourly', 'daily', 'weekly']).optional(),
  // Suggest labels (from issue-intelligence-schemas)
  existingLabels: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    color: z.string().optional(),
  })).optional(),
  issueHistory: z.array(z.object({
    labels: z.array(z.string()),
    title: z.string(),
  })).optional(),
  config: z.object({
    preferExisting: z.boolean().optional(),
    maxSuggestions: z.number().optional(),
    includeNewProposals: z.boolean().optional(),
  }).optional(),
  repositoryLabels: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    color: z.string().optional(),
  })).optional(),
  // Detect duplicates
  existingIssues: z.array(z.object({
    id: z.string(),
    number: z.number(),
    title: z.string(),
    body: z.string(),
    state: z.enum(['open', 'closed']),
  })).optional(),
  thresholds: z.object({
    high: z.number().optional(),
    medium: z.number().optional(),
  }).optional(),
  maxResults: z.number().optional(),
  // Find related
  issueLabels: z.array(z.string()).optional(),
  repositoryIssues: z.array(z.object({
    id: z.string(),
    number: z.number(),
    title: z.string(),
    body: z.string(),
    labels: z.array(z.string()),
    state: z.enum(['open', 'closed']),
  })).optional(),
  relationConfig: z.object({
    includeSemanticSimilarity: z.boolean().optional(),
    includeDependencies: z.boolean().optional(),
    includeComponentGrouping: z.boolean().optional(),
  }).optional(),
}).describe('AI Analysis — issue enrichment, triage, label suggestion, duplicate detection, related issues');

export type AiAnalyzeArgs = z.infer<typeof aiAnalyzeSchema>;

// ============================================================================
// 13. ai_plan — 6 granular AI planning tools
// ============================================================================

export const aiPlanSchema = z.object({
  /**
   * Agent this call is made on behalf of. When present, the server debits
   * the tokens it spends to that agent's budget. Optional: these tools are
   * also called directly by humans, where there is nothing to debit.
   */
  agentId: z.string().optional(),
  action: z.enum([
    'calculate_capacity', 'prioritize_backlog', 'assess_risk',
    'suggest_composition', 'generate_roadmap', 'generate_visualization',
  ]).describe('The AI planning operation to perform'),
  // calculate_capacity (SprintCapacityInputSchema)
  velocity: z.union([z.number(), z.literal('auto')]).optional(),
  sprintDurationDays: z.number().optional(),
  teamMembers: z.array(z.object({
    name: z.string(),
    role: z.string().optional(),
    availabilityPercent: z.number().optional(),
    skills: z.array(z.string()).optional(),
    timezone: z.string().optional(),
    hoursPerDay: z.number().optional(),
    daysOff: z.number().optional(),
  })).optional(),
  historicalSprints: z.array(z.object({
    sprintId: z.string(),
    name: z.string().optional(),
    startDate: z.string(),
    endDate: z.string(),
    plannedPoints: z.number(),
    completedPoints: z.number(),
    totalIssues: z.number(),
    completedIssues: z.number(),
    carryoverIssues: z.number().optional(),
    averageCycleTimeDays: z.number().optional(),
    teamSize: z.number().optional(),
  })).optional(),
  // prioritize_backlog (BacklogPrioritizationInputSchema)
  backlogItems: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    points: z.number().optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    labels: z.array(z.string()).optional(),
    dependencies: z.array(z.string()).optional(),
  })).optional(),
  sprintCapacity: z.number().optional(),
  businessGoals: z.array(z.string()).optional(),
  riskTolerance: z.enum(['high', 'medium', 'low']).optional(),
  // assess_risk (SprintRiskInputSchema)
  sprintItems: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    points: z.number().optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    labels: z.array(z.string()).optional(),
    dependencies: z.array(z.string()).optional(),
  })).optional(),
  capacity: z.object({
    totalPoints: z.number(),
    recommendedLoad: z.number(),
    teamAvailability: z.unknown(),
    buffer: z.object({
      percentage: z.number(),
      reasoning: z.string(),
    }),
    confidence: z.unknown(),
  }).optional(),
  // suggest_composition uses backlogItems, velocity, sprintDurationDays, teamMembers, businessGoals, riskTolerance (all above)
  // generate_roadmap (RoadmapGenerationInputSchema)
  requirements: z.union([
    z.string(),
    z.array(z.object({
      id: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
      estimatedPoints: z.number().optional(),
      category: z.string().optional(),
    })),
  ]).optional(),
  constraints: z.object({
    timeline: z.string().optional(),
    teamSize: z.number().optional(),
    velocity: z.number().optional(),
    sprintDurationWeeks: z.number().optional(),
  }).optional(),
  businessContext: z.string().optional(),
  // generate_visualization — takes a roadmap object as input
  roadmap: z.object({
    title: z.string(),
    summary: z.string().optional(),
    phases: z.array(z.unknown()),
    milestones: z.array(z.unknown()).optional(),
    timeline: z.unknown().optional(),
    confidence: z.unknown().optional(),
  }).optional(),
  // assess_risk also uses dependencies
  dependencies: z.array(z.object({
    fromItemId: z.string(),
    toItemId: z.string(),
    type: z.enum(['blocks', 'depends_on', 'related_to']),
    description: z.string().optional(),
    confidence: z.number(),
  })).optional(),
}).describe('AI Planning — sprint capacity, backlog prioritization, risk assessment, sprint composition, roadmap generation');

export type AiPlanArgs = z.infer<typeof aiPlanSchema>;

// ============================================================================
// 14. agent_work — 7 granular agent work tools
// ============================================================================

export const agentWorkSchema = z.object({
  action: z.enum([
    'register', 'checkout_task', 'release_task', 'complete_task',
    'heartbeat', 'check_work_status', 'get_task_context',
    'submit_for_review', 'approve_task', 'reject_task', 'validate_work_product',
    'get_handoff_context',
  ]).describe('The agent work operation to perform'),
  // Common
  agentId: z.string().optional(),
  taskId: z.string().optional(),
  // Register
  name: z.string().optional(),
  role: AgentRoleSchema.optional(),
  runtime: AgentRuntimeSchema.optional(),
  capabilities: z.array(z.string()).optional(),
  budgetTokens: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  parentAgentId: z.string().optional(),
  // Checkout task
  projectId: z.string().optional(),
  strategy: CheckoutStrategySchema.optional(),
  labels: z.array(z.string()).optional(),
  milestone: z.string().optional(),
  skipBlocked: z.boolean().optional(),
  reviewQueue: z.boolean().optional(),
  // Release task
  reason: z.string().optional(),
  // Complete task
  summary: z.string().optional(),
  closeIssue: z.boolean().optional(),
  prNumber: z.number().optional(),
  autoCheckoutNext: z.boolean().optional(),
  // Heartbeat
  status: z.enum(['working', 'blocked', 'needs_review']).optional(),
  progress: z.number().optional(),
  progressSummary: z.string().optional(),
  currentBranch: z.string().optional(),
  estimatedCompletionMinutes: z.number().optional(),
  blockerDescription: z.string().optional(),
  // Get task context
  issueNumber: z.number().optional(),
  // Review
  reviewerId: z.string().optional(),
  feedback: z.string().optional(),
}).describe('Agent Work — register, checkout/release/complete tasks, heartbeat, review, work status');

export type AgentWorkArgs = z.infer<typeof agentWorkSchema>;

// ============================================================================
// 15. agent_manage — 5 granular agent management tools
// ============================================================================

export const agentManageSchema = z.object({
  action: z.enum([
    'list', 'deregister', 'get_activity',
    'submit_work_product', 'get_budget', 'set_budget',
    'reclaim_stale', 'record_usage', 'get_metrics', 'setup_fields',
    // PM coordination
    'assign_task', 'get_swarm_status', 'rebalance_workload', 'decompose_task', 'smart_assign', 'converge_project',
  ]).describe('The agent management operation to perform'),
  // Common
  agentId: z.string().optional(),
  projectId: z.string().optional(),
  // List
  role: AgentRoleSchema.optional(),
  status: AgentOperationalStatusSchema.optional(),
  // Deregister — just agentId
  // Get activity
  includeOffline: z.boolean().optional(),
  // Submit work product
  taskId: z.string().optional(),
  issueNumber: z.number().optional(),
  branch: z.string().optional(),
  prNumber: z.number().optional(),
  commitShas: z.array(z.string()).optional(),
  filesChanged: z.array(z.string()).optional(),
  testsPassed: z.number().optional(),
  testsFailed: z.number().optional(),
  testsTotal: z.number().optional(),
  summary: z.string().optional(),
  // Set budget
  totalTokens: z.number().optional(),
  warningThreshold: z.number().optional(),
  hardStop: z.boolean().optional(),
  resetPeriod: BudgetResetPeriodSchema.optional(),
  // Reclaim stale
  timeoutMinutes: z.number().optional(),
  // Record usage
  tokensUsed: z.number().optional(),
  // Metrics
  staleAfterMinutes: z.number().optional(),
  // Smart assign
  maxAssignments: z.number().optional(),
  // Decompose task
  subtasks: z.array(z.object({
    title: z.string(),
    description: z.string(),
    acceptanceCriteria: z.string().optional(),
  })).optional().describe('Subtasks for decompose_task — PM splits a rejected task into smaller pieces'),
}).describe('Agent Management — list, deregister, activity, work products, budget, reclaim, usage, metrics, PM coordination');

export type AgentManageArgs = z.infer<typeof agentManageSchema>;

// ============================================================================
// 16. system — 2 granular system tools
// ============================================================================

export const systemSchema = z.object({
  action: z.enum([
    'health_check', 'setup_project_fields',
  ]).describe('The system operation to perform'),
  // setup_project_fields
  projectId: z.string().optional(),
}).describe('System — health check and project field setup');

export type SystemArgs = z.infer<typeof systemSchema>;

// ============================================================================
// 17. discover_tools — meta-tool for tool discovery
// ============================================================================

export const discoverToolsSchema = z.object({
  domain: z.enum([
    'projects', 'issues', 'pull_requests', 'milestones', 'sprints',
    'labels', 'automation', 'iterations', 'events', 'status_updates',
    'ai_generation', 'ai_analysis', 'ai_planning',
    'agents', 'system',
  ]).optional().describe('Filter tools by domain'),
  query: z.string().optional().describe('Free-text search across tool names and descriptions'),
}).describe('Discover available tool actions by domain or search query');

export type DiscoverToolsArgs = z.infer<typeof discoverToolsSchema>;

// ============================================================================
// Schema map — for programmatic access by compound tool name
// ============================================================================

export const compoundSchemas = {
  manage_project: manageProjectSchema,
  manage_issues: manageIssuesSchema,
  manage_prs: managePrsSchema,
  manage_milestones: manageMilestonesSchema,
  manage_sprints: manageSprintsSchema,
  manage_labels: manageLabelsSchema,
  manage_automation: manageAutomationSchema,
  manage_iterations: manageIterationsSchema,
  manage_events: manageEventsSchema,
  manage_status_updates: manageStatusUpdatesSchema,
  ai_generate: aiGenerateSchema,
  ai_analyze: aiAnalyzeSchema,
  ai_plan: aiPlanSchema,
  agent_work: agentWorkSchema,
  agent_manage: agentManageSchema,
  system: systemSchema,
  discover_tools: discoverToolsSchema,
} as const;

export type CompoundToolName = keyof typeof compoundSchemas;
