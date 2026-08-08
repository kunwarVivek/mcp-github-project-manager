/**
 * Zod input schemas for agent orchestration MCP tools.
 *
 * These schemas validate input for the 12 agent tools that enable
 * Claude Code / Codex subagents to register, claim tasks, report
 * progress, and submit work products via GitHub Projects.
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
// Agent Registration Schemas
// ============================================================================

export const registerAgentSchema = z.object({
  name: z.string().min(1, 'Agent name is required'),
  role: AgentRoleSchema.default('engineer'),
  runtime: AgentRuntimeSchema.default('claude-code'),
  capabilities: z.array(z.string()).default([]),
  budgetTokens: z.number().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  parentAgentId: z.string().optional(),
});
export type RegisterAgentArgs = z.infer<typeof registerAgentSchema>;

export const listAgentsSchema = z.object({
  role: AgentRoleSchema.optional(),
  status: AgentOperationalStatusSchema.optional(),
});
export type ListAgentsArgs = z.infer<typeof listAgentsSchema>;

export const deregisterAgentSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
});
export type DeregisterAgentArgs = z.infer<typeof deregisterAgentSchema>;

// ============================================================================
// Task Lifecycle Schemas
// ============================================================================

export const checkoutTaskSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
  projectId: z.string().optional(),
  strategy: CheckoutStrategySchema.default('highest_priority'),
  labels: z.array(z.string()).optional(),
  milestone: z.string().optional(),
  /** Skip issues whose declared blockers are still open (dependency-aware). */
  skipBlocked: z.boolean().optional(),
  /** Claim the next task from the review queue instead of the unclaimed pool. */
  reviewQueue: z.boolean().optional(),
});
export type CheckoutTaskArgs = z.infer<typeof checkoutTaskSchema>;

export const releaseTaskSchema = z.object({
  agentId: z.string().min(1),
  taskId: z.string().min(1, 'Task/Issue ID is required'),
  reason: z.string().optional(),
});
export type ReleaseTaskArgs = z.infer<typeof releaseTaskSchema>;

export const completeTaskSchema = z.object({
  agentId: z.string().min(1),
  taskId: z.string().min(1),
  summary: z.string().min(1, 'Completion summary is required'),
  closeIssue: z.boolean().default(true),
  prNumber: z.number().int().positive().optional(),
  autoCheckoutNext: z.boolean().default(true),
});
export type CompleteTaskArgs = z.infer<typeof completeTaskSchema>;

// ============================================================================
// Task Context Schema
// ============================================================================

export const getTaskContextSchema = z.object({
  issueNumber: z.number().int().positive('Issue number required'),
});
export type GetTaskContextArgs = z.infer<typeof getTaskContextSchema>;

// ============================================================================
// Heartbeat Schema
// ============================================================================

export const agentHeartbeatSchema = z.object({
  agentId: z.string().min(1),
  status: z.enum(['working', 'blocked', 'needs_review']),
  taskId: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  progressSummary: z.string().optional(),
  currentBranch: z.string().optional(),
  estimatedCompletionMinutes: z.number().positive().optional(),
  blockerDescription: z.string().optional(),
});
export type AgentHeartbeatArgs = z.infer<typeof agentHeartbeatSchema>;

// ============================================================================
// Work Product Schema
// ============================================================================

export const submitWorkProductSchema = z.object({
  agentId: z.string().min(1),
  taskId: z.string().min(1),
  issueNumber: z.number().int().positive(),
  branch: z.string().optional(),
  prNumber: z.number().int().positive().optional(),
  commitShas: z.array(z.string()).default([]),
  filesChanged: z.array(z.string()).default([]),
  testsPassed: z.number().nonnegative().optional(),
  testsFailed: z.number().nonnegative().optional(),
  testsTotal: z.number().nonnegative().optional(),
  summary: z.string().min(1),
});
export type SubmitWorkProductArgs = z.infer<typeof submitWorkProductSchema>;

// ============================================================================
// Activity & Budget Schemas
// ============================================================================

export const getAgentActivitySchema = z.object({
  includeOffline: z.boolean().default(false),
});
export type GetAgentActivityArgs = z.infer<typeof getAgentActivitySchema>;

export const getBudgetStatusSchema = z.object({
  agentId: z.string().min(1),
});
export type GetBudgetStatusArgs = z.infer<typeof getBudgetStatusSchema>;

export const setAgentBudgetSchema = z.object({
  agentId: z.string().min(1),
  totalTokens: z.number().positive(),
  warningThreshold: z.number().min(0).max(1).default(0.8),
  hardStop: z.boolean().default(true),
  resetPeriod: BudgetResetPeriodSchema.optional(),
});
export type SetAgentBudgetArgs = z.infer<typeof setAgentBudgetSchema>;

// ============================================================================
// Check Work Status Schema
// ============================================================================

export const checkWorkStatusSchema = z.object({
  agentId: z.string().min(1),
  taskId: z.string().min(1),
  prNumber: z.number().int().positive().optional(),
});
export type CheckWorkStatusArgs = z.infer<typeof checkWorkStatusSchema>;

// ============================================================================
// Reclaim Stale Tasks Schema
// ============================================================================

export const reclaimStaleTasksSchema = z.object({
  timeoutMinutes: z.number().positive().optional(),
});
export type ReclaimStaleTasksArgs = z.infer<typeof reclaimStaleTasksSchema>;

// ============================================================================
// Record Usage Schema
// ============================================================================

export const recordUsageSchema = z.object({
  agentId: z.string().min(1),
  tokensUsed: z.number().nonnegative('Token usage must be non-negative'),
});
export type RecordUsageArgs = z.infer<typeof recordUsageSchema>;

// ============================================================================
// Review Workflow Schemas
// ============================================================================

export const submitForReviewSchema = z.object({
  agentId: z.string().min(1),
  taskId: z.string().min(1),
  summary: z.string().optional(),
});
export type SubmitForReviewArgs = z.infer<typeof submitForReviewSchema>;

export const approveTaskSchema = z.object({
  reviewerId: z.string().min(1),
  taskId: z.string().min(1),
  summary: z.string().optional(),
});
export type ApproveTaskArgs = z.infer<typeof approveTaskSchema>;

export const rejectTaskSchema = z.object({
  reviewerId: z.string().min(1),
  taskId: z.string().min(1),
  feedback: z.string().optional(),
});
export type RejectTaskArgs = z.infer<typeof rejectTaskSchema>;

// ============================================================================
// Metrics Schema
// ============================================================================

export const getAgentMetricsSchema = z.object({
  staleAfterMinutes: z.number().positive().optional(),
});
export type GetAgentMetricsArgs = z.infer<typeof getAgentMetricsSchema>;

// ============================================================================
// Project Field Setup Schema
// ============================================================================

export const setupAgentFieldsSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
});
export type SetupAgentFieldsArgs = z.infer<typeof setupAgentFieldsSchema>;
