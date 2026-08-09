import { z } from 'zod';

// ============================================================================
// Agent Registry Types
// ============================================================================

/** Agent role determines what types of tasks the agent can claim. */
export type AgentRole = 'engineer' | 'reviewer' | 'pm' | 'designer' | 'qa' | 'devops' | 'general';

export const AgentRoleSchema = z.enum(['engineer', 'reviewer', 'pm', 'designer', 'qa', 'devops', 'general']);

/** Agent runtime — what system is driving this agent. */
export type AgentRuntime = 'claude-code' | 'codex' | 'cursor' | 'cli' | 'http' | 'custom';

export const AgentRuntimeSchema = z.enum(['claude-code', 'codex', 'cursor', 'cli', 'http', 'custom']);

/** Current operational status of an agent. */
export type AgentOperationalStatus = 'idle' | 'working' | 'blocked' | 'needs_review' | 'offline' | 'budget_exhausted';

export const AgentOperationalStatusSchema = z.enum([
  'idle', 'working', 'blocked', 'needs_review', 'offline', 'budget_exhausted',
]);

/** A registered agent. */
export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  runtime: AgentRuntime;
  capabilities: string[];
  status: AgentOperationalStatus;
  currentTaskId?: string;
  currentTaskTitle?: string;
  lastHeartbeat?: string;
  registeredAt: string;
  metadata?: Record<string, unknown>;
  parentAgentId?: string;
  budget?: AgentBudget;
}

export const AgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: AgentRoleSchema,
  runtime: AgentRuntimeSchema,
  capabilities: z.array(z.string()),
  status: AgentOperationalStatusSchema,
  currentTaskId: z.string().optional(),
  currentTaskTitle: z.string().optional(),
  lastHeartbeat: z.string().optional(),
  registeredAt: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  parentAgentId: z.string().optional(),
  budget: z.lazy(() => AgentBudgetSchema).optional(),
});

// ============================================================================
// Task Checkout Types
// ============================================================================

/** Status of a task in the agent orchestration workflow. */
export type AgentTaskStatus = 'unclaimed' | 'in_progress' | 'review' | 'blocked' | 'completed';

export const AgentTaskStatusSchema = z.enum(['unclaimed', 'in_progress', 'review', 'blocked', 'completed']);

/** Strategy for selecting which task to check out. */
export type CheckoutStrategy = 'highest_priority' | 'oldest_first' | 'skills_match' | 'milestone_deadline' | 'ai';

export const CheckoutStrategySchema = z.enum([
  'highest_priority', 'oldest_first', 'skills_match', 'milestone_deadline', 'ai',
]);

/** Budget reset period. */
export type BudgetResetPeriod = 'daily' | 'weekly' | 'monthly' | 'never';

export const BudgetResetPeriodSchema = z.enum(['daily', 'weekly', 'monthly', 'never']);

/** Result of a task checkout operation. */
export interface TaskCheckoutResult {
  success: boolean;
  issueId?: string;
  issueNumber?: number;
  issueTitle?: string;
  issueBody?: string;
  labels?: string[];
  milestone?: string;
  branchSuggestion?: string;
  claimedAt?: string;
  /** For AI-assisted selection: why this task was chosen. */
  selectionRationale?: string;
  message: string;
}

export const TaskCheckoutResultSchema = z.object({
  success: z.boolean(),
  issueId: z.string().optional(),
  issueNumber: z.number().optional(),
  issueTitle: z.string().optional(),
  issueBody: z.string().optional(),
  labels: z.array(z.string()).optional(),
  milestone: z.string().optional(),
  branchSuggestion: z.string().optional(),
  claimedAt: z.string().optional(),
  selectionRationale: z.string().optional(),
  message: z.string(),
});

// ============================================================================
// Heartbeat Types
// ============================================================================

/** Heartbeat data sent by an agent to report its liveness and progress. */
export interface AgentHeartbeat {
  agentId: string;
  status: AgentOperationalStatus;
  taskId?: string;
  progress?: number;
  progressSummary?: string;
  currentBranch?: string;
  estimatedCompletionMinutes?: number;
  blockerDescription?: string;
  timestamp: string;
}

export const AgentHeartbeatSchema = z.object({
  agentId: z.string().min(1),
  status: AgentOperationalStatusSchema,
  taskId: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  progressSummary: z.string().optional(),
  currentBranch: z.string().optional(),
  estimatedCompletionMinutes: z.number().positive().optional(),
  blockerDescription: z.string().optional(),
  timestamp: z.string(),
});

// ============================================================================
// Work Product Types
// ============================================================================

/** A work product submitted by an agent for a task. */
export interface WorkProduct {
  id: string;
  agentId: string;
  taskId: string;
  branch?: string;
  prNumber?: number;
  prUrl?: string;
  commitShas: string[];
  filesChanged: string[];
  testResults?: TestResults;
  summary: string;
  submittedAt: string;
}

export const WorkProductSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  taskId: z.string().min(1),
  branch: z.string().optional(),
  prNumber: z.number().optional(),
  prUrl: z.string().optional(),
  commitShas: z.array(z.string()),
  filesChanged: z.array(z.string()),
  testResults: z.lazy(() => TestResultsSchema).optional(),
  summary: z.string(),
  submittedAt: z.string(),
});

/** Test execution results attached to a work product. */
export interface TestResults {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  coverage?: number;
  summary?: string;
}

export const TestResultsSchema = z.object({
  passed: z.number().nonnegative(),
  failed: z.number().nonnegative(),
  skipped: z.number().nonnegative(),
  total: z.number().nonnegative(),
  coverage: z.number().min(0).max(100).optional(),
  summary: z.string().optional(),
});

// ============================================================================
// Budget Types
// ============================================================================

/** Per-agent token budget. */
export interface AgentBudget {
  totalTokens: number;
  usedTokens: number;
  warningThreshold: number;
  hardStop: boolean;
  resetPeriod?: 'daily' | 'weekly' | 'monthly' | 'never';
  lastResetAt?: string;
}

export const AgentBudgetSchema = z.object({
  totalTokens: z.number().positive(),
  usedTokens: z.number().nonnegative(),
  warningThreshold: z.number().min(0).max(1).default(0.8),
  hardStop: z.boolean().default(true),
  resetPeriod: z.enum(['daily', 'weekly', 'monthly', 'never']).optional(),
  lastResetAt: z.string().optional(),
});

/** Budget status report. */
export interface BudgetStatus {
  agentId: string;
  agentName: string;
  totalTokens: number;
  usedTokens: number;
  remainingTokens: number;
  usagePercent: number;
  isWarning: boolean;
  isExhausted: boolean;
  resetPeriod?: string;
  lastResetAt?: string;
}

export const BudgetStatusSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  totalTokens: z.number(),
  usedTokens: z.number(),
  remainingTokens: z.number(),
  usagePercent: z.number(),
  isWarning: z.boolean(),
  isExhausted: z.boolean(),
  resetPeriod: z.string().optional(),
  lastResetAt: z.string().optional(),
});

// ============================================================================
// Agent Context Types
// ============================================================================

/** Enriched context provided to an agent when it checks out a task. */
export interface AgentTaskContext {
  /** The issue being worked on. */
  issue: {
    id: string;
    number: number;
    title: string;
    body: string;
    labels: string[];
    assignees: string[];
    state: string;
    createdAt: string;
  };
  /** Parent issue if this is a sub-issue. */
  parentIssue?: {
    id: string;
    number: number;
    title: string;
    body: string;
  };
  /** Milestone context (the "why" behind the sprint). */
  milestone?: {
    title: string;
    description: string;
    dueDate?: string;
    progress?: number;
  };
  /** Related issues for cross-reference. */
  relatedIssues: Array<{
    number: number;
    title: string;
    state: string;
    labels: string[];
  }>;
  /** Project-level goals. */
  projectGoals?: string;
  /** Repository coding standards (from CLAUDE.md / AGENTS.md). */
  codingStandards?: string;
  /** Suggested branch name. */
  branchSuggestion: string;
  /** Acceptance criteria extracted from issue body. */
  acceptanceCriteria: string[];
  /** Estimated complexity (from AI analysis if available). */
  estimatedComplexity?: number;
  /** AI-generated suggestions (acceptance criteria, guidance) when AI is available. */
  aiSuggestions?: {
    acceptanceCriteria?: string[];
    complexityEstimate?: number;
    implementationGuidance?: string;
    confidence?: number;
  };
}

export const AgentTaskContextSchema = z.object({
  issue: z.object({
    id: z.string(),
    number: z.number(),
    title: z.string(),
    body: z.string(),
    labels: z.array(z.string()),
    assignees: z.array(z.string()),
    state: z.string(),
    createdAt: z.string(),
  }),
  parentIssue: z.object({
    id: z.string(),
    number: z.number(),
    title: z.string(),
    body: z.string(),
  }).optional(),
  milestone: z.object({
    title: z.string(),
    description: z.string(),
    dueDate: z.string().optional(),
    progress: z.number().optional(),
  }).optional(),
  relatedIssues: z.array(z.object({
    number: z.number(),
    title: z.string(),
    state: z.string(),
    labels: z.array(z.string()),
  })),
  projectGoals: z.string().optional(),
  codingStandards: z.string().optional(),
  branchSuggestion: z.string(),
  acceptanceCriteria: z.array(z.string()),
  estimatedComplexity: z.number().optional(),
  aiSuggestions: z.object({
    acceptanceCriteria: z.array(z.string()).optional(),
    complexityEstimate: z.number().optional(),
    implementationGuidance: z.string().optional(),
    confidence: z.number().optional(),
  }).optional(),
});

// ============================================================================
// Agent Activity Types
// ============================================================================

/** Activity dashboard entry for one agent. */
export interface AgentActivityEntry {
  agent: {
    id: string;
    name: string;
    role: AgentRole;
    runtime: AgentRuntime;
    status: AgentOperationalStatus;
  };
  currentTask?: {
    issueId: string;
    issueNumber?: number;
    title: string;
    progress?: number;
    branch?: string;
    claimedAt: string;
  };
  lastHeartbeat?: string;
  heartbeatAge?: string;
  isStale: boolean;
  budgetStatus?: {
    usagePercent: number;
    isWarning: boolean;
    isExhausted: boolean;
  };
  completedToday: number;
  /** Recent heartbeat history (most recent first). */
  heartbeatHistory?: Array<{
    timestamp: string;
    status: string;
    progress?: number;
    progressSummary?: string;
  }>;
}

export const AgentActivityEntrySchema = z.object({
  agent: z.object({
    id: z.string(),
    name: z.string(),
    role: AgentRoleSchema,
    runtime: AgentRuntimeSchema,
    status: AgentOperationalStatusSchema,
  }),
  currentTask: z.object({
    issueId: z.string(),
    issueNumber: z.number().optional(),
    title: z.string(),
    progress: z.number().optional(),
    branch: z.string().optional(),
    claimedAt: z.string(),
  }).optional(),
  lastHeartbeat: z.string().optional(),
  heartbeatAge: z.string().optional(),
  isStale: z.boolean(),
  budgetStatus: z.object({
    usagePercent: z.number(),
    isWarning: z.boolean(),
    isExhausted: z.boolean(),
  }).optional(),
  completedToday: z.number(),
  heartbeatHistory: z.array(z.object({
    timestamp: z.string(),
    status: z.string(),
    progress: z.number().optional(),
    progressSummary: z.string().optional(),
  })).optional(),
});

// ============================================================================
// Configuration Constants
// ============================================================================

/** Default heartbeat timeout in minutes. Agent is considered stale after this. */
export const DEFAULT_HEARTBEAT_TIMEOUT_MINUTES = 30;

/** Default agent budget in tokens. */
export const DEFAULT_AGENT_BUDGET_TOKENS = 500_000;

/**
 * Maximum depth of the agent hierarchy (root = depth 0).
 *
 * Bounds two things: how far `resolveBudgetOwner` will walk toward the root, and
 * how deep `register_agent` will let a caller nest. Without a cap, a chain of
 * subagents can be nested indefinitely, and each level costs a registry read.
 */
export const MAX_AGENT_HIERARCHY_DEPTH = 5;

/**
 * Maximum number of direct children a single agent may have.
 *
 * Fan-out limit for `register_agent`. Combined with MAX_AGENT_HIERARCHY_DEPTH
 * this bounds the total swarm size a single root can spawn.
 */
export const MAX_AGENT_CHILDREN = 20;

/** Label used to identify the agent registry issue. */
export const AGENT_REGISTRY_LABEL = 'agent-registry';

/** Comment marker for structured work product data. */
export const WORK_PRODUCT_MARKER = '<!-- agent-work-product:';

/** GitHub Project custom field names for agent orchestration. */
export const AGENT_FIELDS = {
  CLAIMED_BY: 'agent_claimed_by',
  CLAIMED_AT: 'agent_claimed_at',
  STATUS: 'agent_status',
  WORK_BRANCH: 'agent_work_branch',
  PR_NUMBER: 'agent_pr_number',
} as const;

/** Valid values for the agent_status project field. */
export const AGENT_STATUS_OPTIONS = [
  { name: 'unclaimed', color: 'GRAY', description: 'Not assigned to any agent' },
  { name: 'in_progress', color: 'YELLOW', description: 'Agent is actively working' },
  { name: 'review', color: 'BLUE', description: 'Work submitted, awaiting review' },
  { name: 'blocked', color: 'RED', description: 'Agent is blocked' },
  { name: 'completed', color: 'GREEN', description: 'Work completed and verified' },
] as const;

// ============================================================================
// Agent Metrics Types
// ============================================================================

/** Per-agent metric entry for the metrics dashboard. */
export interface AgentMetricEntry {
  agentId: string;
  agentName: string;
  role: AgentRole;
  status: AgentOperationalStatus;
  tasksCompleted: number;
  tasksInProgress: number;
  currentTaskId?: string;
  currentTaskTitle?: string;
  budgetUsagePercent: number;
  isStale: boolean;
  /** Average task duration in minutes (from completed work products), if known. */
  averageCycleTimeMinutes?: number;
}

export const AgentMetricEntrySchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  role: AgentRoleSchema,
  status: AgentOperationalStatusSchema,
  tasksCompleted: z.number(),
  tasksInProgress: z.number(),
  currentTaskId: z.string().optional(),
  currentTaskTitle: z.string().optional(),
  budgetUsagePercent: z.number(),
  isStale: z.boolean(),
  averageCycleTimeMinutes: z.number().optional(),
});

/** Aggregate metrics over all registered agents. */
export interface AgentMetrics {
  generatedAt: string;
  totalAgents: number;
  activeAgents: number;
  staleAgents: number;
  budgetExhaustedAgents: number;
  totalTasksInProgress: number;
  totalTasksCompleted: number;
  totalTokensBudget: number;
  totalTokensUsed: number;
  overallBudgetUsagePercent: number;
  agents: AgentMetricEntry[];
}

export const AgentMetricsSchema = z.object({
  generatedAt: z.string(),
  totalAgents: z.number(),
  activeAgents: z.number(),
  staleAgents: z.number(),
  budgetExhaustedAgents: z.number(),
  totalTasksInProgress: z.number(),
  totalTasksCompleted: z.number(),
  totalTokensBudget: z.number(),
  totalTokensUsed: z.number(),
  overallBudgetUsagePercent: z.number(),
  agents: z.array(AgentMetricEntrySchema),
});
