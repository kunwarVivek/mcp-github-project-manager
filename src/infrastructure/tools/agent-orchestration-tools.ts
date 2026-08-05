/**
 * MCP tool definitions and executors for agent orchestration.
 *
 * Provides 12 tools that enable Claude Code / Codex subagents to:
 * - Register/deregister themselves in the agent registry
 * - Check out, release, and complete tasks from GitHub Projects
 * - Send heartbeats and report progress
 * - Submit work products with test results
 * - View agent activity and manage token budgets
 */

import { z } from 'zod';
import type { ToolDefinition, ToolSchema } from './ToolValidator';
import { ANNOTATION_PATTERNS } from './annotations/tool-annotations';
import { createGitHubFactory } from './tool-factory';
import { mapErrorToMCPError } from '../../services/utils/ErrorMapper';

import { AgentStore } from '../agent/AgentStore';
import { WorkProductStore } from '../agent/WorkProductStore';
import { TaskCheckoutService } from '../../services/agent/TaskCheckoutService';
import { AgentContextService } from '../../services/agent/AgentContextService';
import { WorkProductService } from '../../services/agent/WorkProductService';
import { AgentBudgetService } from '../../services/agent/AgentBudgetService';

import type { Agent, AgentActivityEntry, BudgetStatus, WorkProduct } from '../../domain/agent-orchestration-types';
import { AgentSchema, TaskCheckoutResultSchema, AgentTaskContextSchema, WorkProductSchema, BudgetStatusSchema, AgentActivityEntrySchema } from '../../domain/agent-orchestration-types';

import {
  registerAgentSchema,
  listAgentsSchema,
  deregisterAgentSchema,
  checkoutTaskSchema,
  releaseTaskSchema,
  completeTaskSchema,
  getTaskContextSchema,
  agentHeartbeatSchema,
  submitWorkProductSchema,
  getAgentActivitySchema,
  getBudgetStatusSchema,
  setAgentBudgetSchema,
} from './schemas/agent-orchestration-schemas';

import type {
  RegisterAgentArgs,
  ListAgentsArgs,
  DeregisterAgentArgs,
  CheckoutTaskArgs,
  ReleaseTaskArgs,
  CompleteTaskArgs,
  GetTaskContextArgs,
  AgentHeartbeatArgs,
  SubmitWorkProductArgs,
  GetAgentActivityArgs,
  GetBudgetStatusArgs,
  SetAgentBudgetArgs,
} from './schemas/agent-orchestration-schemas';

import { SuccessOutputSchema } from './schemas/project-schemas';

// ============================================================================
// Output Schemas
// ============================================================================

const AgentOutputSchema = AgentSchema;

const AgentListOutputSchema = z.object({
  agents: z.array(AgentSchema),
  total: z.number(),
});

const DeregisterOutputSchema = z.object({
  success: z.boolean(),
  agentId: z.string(),
  message: z.string(),
});

const AgentActivityOutputSchema = z.object({
  agents: z.array(AgentActivityEntrySchema),
  total: z.number(),
  timestamp: z.string(),
});

// ============================================================================
// Tool Definitions — Agent Registration
// ============================================================================

export const registerAgentTool: ToolDefinition<
  RegisterAgentArgs,
  z.infer<typeof AgentOutputSchema>
> = {
  name: 'register_agent',
  title: 'Register Agent',
  description:
    'Register a new AI agent in the orchestration registry. ' +
    'Use this when an agent starts up and wants to participate in task assignment. ' +
    'Returns the registered agent record with a unique ID.',
  schema: registerAgentSchema as unknown as ToolSchema<RegisterAgentArgs>,
  outputSchema: AgentOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
  examples: [
    {
      name: 'Register a Claude Code engineer',
      description: 'Register a new agent with engineering capabilities',
      args: {
        name: 'claude-eng-1',
        role: 'engineer',
        runtime: 'claude-code',
        capabilities: ['typescript', 'react', 'testing'],
      },
    },
  ],
};

export const listAgentsTool: ToolDefinition<
  ListAgentsArgs,
  z.infer<typeof AgentListOutputSchema>
> = {
  name: 'list_agents',
  title: 'List Agents',
  description:
    'List all registered agents, optionally filtered by role or status. ' +
    'Use this to see which agents are available, working, or blocked.',
  schema: listAgentsSchema as unknown as ToolSchema<ListAgentsArgs>,
  outputSchema: AgentListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: 'List all idle engineers',
      description: 'Find agents ready for new tasks',
      args: { role: 'engineer', status: 'idle' },
    },
  ],
};

export const deregisterAgentTool: ToolDefinition<
  DeregisterAgentArgs,
  z.infer<typeof DeregisterOutputSchema>
> = {
  name: 'deregister_agent',
  title: 'Deregister Agent',
  description:
    'Remove an agent from the orchestration registry. ' +
    'Use this when an agent is shutting down or no longer participating. ' +
    'The agent must not have an active task.',
  schema: deregisterAgentSchema as unknown as ToolSchema<DeregisterAgentArgs>,
  outputSchema: DeregisterOutputSchema,
  annotations: ANNOTATION_PATTERNS.delete,
  examples: [
    {
      name: 'Deregister an agent',
      description: 'Remove an agent from the registry',
      args: { agentId: 'agent-abc123' },
    },
  ],
};

// ============================================================================
// Tool Definitions — Task Lifecycle
// ============================================================================

export const checkoutTaskTool: ToolDefinition<
  CheckoutTaskArgs,
  z.infer<typeof TaskCheckoutResultSchema>
> = {
  name: 'checkout_task',
  title: 'Checkout Task',
  description:
    'Claim the next available task for an agent. ' +
    'Uses the specified strategy (priority, age, skills, or milestone deadline) to select. ' +
    'The task is assigned to the agent and marked in-progress. ' +
    'Returns issue details, suggested branch name, and context.',
  schema: checkoutTaskSchema as unknown as ToolSchema<CheckoutTaskArgs>,
  outputSchema: TaskCheckoutResultSchema,
  annotations: ANNOTATION_PATTERNS.updateNonIdempotent,
  examples: [
    {
      name: 'Checkout highest priority task',
      description: 'Claim the most urgent available task',
      args: { agentId: 'agent-abc123', strategy: 'highest_priority' },
    },
  ],
};

export const releaseTaskTool: ToolDefinition<
  ReleaseTaskArgs,
  z.infer<typeof SuccessOutputSchema>
> = {
  name: 'release_task',
  title: 'Release Task',
  description:
    'Release a previously checked-out task back to the pool. ' +
    'Use this when the agent cannot complete the task (blocked, wrong skills, etc). ' +
    'The task becomes available for other agents to claim.',
  schema: releaseTaskSchema as unknown as ToolSchema<ReleaseTaskArgs>,
  outputSchema: SuccessOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: 'Release a blocked task',
      description: 'Return a task to the unclaimed pool',
      args: { agentId: 'agent-abc123', taskId: 'issue-42', reason: 'Missing API credentials' },
    },
  ],
};

export const completeTaskTool: ToolDefinition<
  CompleteTaskArgs,
  z.infer<typeof SuccessOutputSchema>
> = {
  name: 'complete_task',
  title: 'Complete Task',
  description:
    'Mark a checked-out task as completed. ' +
    'Use this after submitting a work product and getting approval. ' +
    'Provide a summary of what was done.',
  schema: completeTaskSchema as unknown as ToolSchema<CompleteTaskArgs>,
  outputSchema: SuccessOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: 'Complete a task',
      description: 'Mark a task as done with a summary',
      args: {
        agentId: 'agent-abc123',
        taskId: 'issue-42',
        summary: 'Implemented login form with validation and tests',
      },
    },
  ],
};

// ============================================================================
// Tool Definitions — Task Context
// ============================================================================

export const getTaskContextTool: ToolDefinition<
  GetTaskContextArgs,
  z.infer<typeof AgentTaskContextSchema>
> = {
  name: 'get_task_context',
  title: 'Get Task Context',
  description:
    'Get enriched context for a task/issue. ' +
    'Returns issue details, parent issue, milestone, related issues, ' +
    'acceptance criteria, coding standards, and suggested branch name. ' +
    'Use this to understand the full scope before starting work.',
  schema: getTaskContextSchema as unknown as ToolSchema<GetTaskContextArgs>,
  outputSchema: AgentTaskContextSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: 'Get context for issue #42',
      description: 'Retrieve full context for a task',
      args: { issueNumber: 42 },
    },
  ],
};

// ============================================================================
// Tool Definitions — Heartbeat
// ============================================================================

export const agentHeartbeatTool: ToolDefinition<
  AgentHeartbeatArgs,
  z.infer<typeof SuccessOutputSchema>
> = {
  name: 'agent_heartbeat',
  title: 'Agent Heartbeat',
  description:
    'Send a heartbeat to report agent liveness and progress. ' +
    'Agents should send heartbeats periodically while working. ' +
    'Include progress percentage, current branch, and blocker info if applicable. ' +
    'Stale agents (no heartbeat for 30 min) may have tasks reclaimed.',
  schema: agentHeartbeatSchema as unknown as ToolSchema<AgentHeartbeatArgs>,
  outputSchema: SuccessOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: 'Report progress',
      description: 'Send a heartbeat with 60% progress',
      args: {
        agentId: 'agent-abc123',
        status: 'working',
        taskId: 'issue-42',
        progress: 60,
        progressSummary: 'Tests passing, working on edge cases',
        currentBranch: 'feat/login-form',
      },
    },
  ],
};

// ============================================================================
// Tool Definitions — Work Product
// ============================================================================

export const submitWorkProductTool: ToolDefinition<
  SubmitWorkProductArgs,
  z.infer<typeof WorkProductSchema>
> = {
  name: 'submit_work_product',
  title: 'Submit Work Product',
  description:
    'Submit a work product (code changes) for a task. ' +
    'Include branch name, PR number, changed files, and test results. ' +
    'The work product is recorded on the issue for review.',
  schema: submitWorkProductSchema as unknown as ToolSchema<SubmitWorkProductArgs>,
  outputSchema: WorkProductSchema,
  annotations: ANNOTATION_PATTERNS.updateNonIdempotent,
  examples: [
    {
      name: 'Submit a PR',
      description: 'Submit work product with PR and test results',
      args: {
        agentId: 'agent-abc123',
        taskId: 'issue-42',
        issueNumber: 42,
        branch: 'feat/login-form',
        prNumber: 99,
        commitShas: ['abc1234'],
        filesChanged: ['src/Login.tsx', 'src/Login.test.tsx'],
        testsPassed: 12,
        testsFailed: 0,
        testsTotal: 12,
        summary: 'Added login form with email/password validation',
      },
    },
  ],
};

// ============================================================================
// Tool Definitions — Activity & Budget
// ============================================================================

export const getAgentActivityTool: ToolDefinition<
  GetAgentActivityArgs,
  z.infer<typeof AgentActivityOutputSchema>
> = {
  name: 'get_agent_activity',
  title: 'Get Agent Activity',
  description:
    'Get an activity dashboard showing all agents and their current state. ' +
    'Shows each agent\'s current task, progress, heartbeat status, and budget. ' +
    'Use includeOffline to also show agents that have gone offline.',
  schema: getAgentActivitySchema as unknown as ToolSchema<GetAgentActivityArgs>,
  outputSchema: AgentActivityOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: 'Get activity dashboard',
      description: 'Show all active agents and their tasks',
      args: { includeOffline: false },
    },
  ],
};

export const getBudgetStatusTool: ToolDefinition<
  GetBudgetStatusArgs,
  z.infer<typeof BudgetStatusSchema>
> = {
  name: 'get_budget_status',
  title: 'Get Budget Status',
  description:
    'Get the token budget status for an agent. ' +
    'Returns total, used, and remaining tokens plus warning/exhaustion flags. ' +
    'Agents should check this periodically to avoid budget overruns.',
  schema: getBudgetStatusSchema as unknown as ToolSchema<GetBudgetStatusArgs>,
  outputSchema: BudgetStatusSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: 'Check budget',
      description: 'Get token budget status for an agent',
      args: { agentId: 'agent-abc123' },
    },
  ],
};

export const setAgentBudgetTool: ToolDefinition<
  SetAgentBudgetArgs,
  z.infer<typeof BudgetStatusSchema>
> = {
  name: 'set_agent_budget',
  title: 'Set Agent Budget',
  description:
    'Set or update the token budget for an agent. ' +
    'Configure total tokens, warning threshold, hard stop behavior, and reset period. ' +
    'Use this to control agent spending and prevent runaway costs.',
  schema: setAgentBudgetSchema as unknown as ToolSchema<SetAgentBudgetArgs>,
  outputSchema: BudgetStatusSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: 'Set 500K token budget',
      description: 'Configure a daily budget with 80% warning',
      args: {
        agentId: 'agent-abc123',
        totalTokens: 500000,
        warningThreshold: 0.8,
        hardStop: true,
        resetPeriod: 'daily',
      },
    },
  ],
};

// ============================================================================
// Executor Functions
// ============================================================================

/**
 * Execute the register_agent tool.
 * Creates a new agent record in the registry.
 */
export async function executeRegisterAgent(
  args: RegisterAgentArgs,
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: Agent;
}> {
  try {
    const factory = createGitHubFactory();
    const store = new AgentStore(factory);

    const agent: Agent = {
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: args.name,
      role: args.role,
      runtime: args.runtime,
      capabilities: args.capabilities,
      status: 'idle',
      registeredAt: new Date().toISOString(),
      metadata: args.metadata,
      budget: args.budgetTokens
        ? {
            totalTokens: args.budgetTokens,
            usedTokens: 0,
            warningThreshold: 0.8,
            hardStop: true,
          }
        : undefined,
    };

    await store.upsertAgent(agent);

    return {
      content: [{ type: 'text', text: `Registered agent "${agent.name}" (${agent.id})` }],
      structuredContent: agent,
    };
  } catch (error) {
    throw mapErrorToMCPError(error);
  }
}

/**
 * Execute the list_agents tool.
 * Lists registered agents with optional filtering.
 */
export async function executeListAgents(
  args: ListAgentsArgs,
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: { agents: Agent[]; total: number };
}> {
  try {
    const factory = createGitHubFactory();
    const store = new AgentStore(factory);

    let agents = await store.listAgents();

    if (args.role) {
      agents = agents.filter((a) => a.role === args.role);
    }
    if (args.status) {
      agents = agents.filter((a) => a.status === args.status);
    }

    const result = { agents, total: agents.length };

    return {
      content: [{ type: 'text', text: `Found ${agents.length} agent(s)` }],
      structuredContent: result,
    };
  } catch (error) {
    throw mapErrorToMCPError(error);
  }
}

/**
 * Execute the deregister_agent tool.
 * Removes an agent from the registry.
 */
export async function executeDeregisterAgent(
  args: DeregisterAgentArgs,
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: { success: boolean; agentId: string; message: string };
}> {
  try {
    const factory = createGitHubFactory();
    const store = new AgentStore(factory);

    const removed = await store.removeAgent(args.agentId);

    const result = {
      success: removed,
      agentId: args.agentId,
      message: removed
        ? `Agent ${args.agentId} deregistered`
        : `Agent ${args.agentId} not found`,
    };

    return {
      content: [{ type: 'text', text: result.message }],
      structuredContent: result,
    };
  } catch (error) {
    throw mapErrorToMCPError(error);
  }
}

/**
 * Execute the checkout_task tool.
 * Claims the next available task for an agent.
 */
export async function executeCheckoutTask(
  args: CheckoutTaskArgs,
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: z.infer<typeof TaskCheckoutResultSchema>;
}> {
  try {
    const factory = createGitHubFactory();
    const store = new AgentStore(factory);
    const contextService = new AgentContextService(factory);
    const service = new TaskCheckoutService(factory, store, contextService);

    const result = await service.checkoutTask(args.agentId, {
      projectId: args.projectId,
      strategy: args.strategy,
      labels: args.labels,
    });

    const text = result.success
      ? `Checked out issue #${result.issueNumber}: ${result.issueTitle}`
      : result.message;

    return {
      content: [{ type: 'text', text }],
      structuredContent: result,
    };
  } catch (error) {
    throw mapErrorToMCPError(error);
  }
}

/**
 * Execute the release_task tool.
 * Returns a task to the unclaimed pool.
 */
export async function executeReleaseTask(
  args: ReleaseTaskArgs,
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: { success: boolean; message?: string };
}> {
  try {
    const factory = createGitHubFactory();
    const store = new AgentStore(factory);
    const contextService = new AgentContextService(factory);
    const service = new TaskCheckoutService(factory, store, contextService);

    await service.releaseTask(args.agentId, args.taskId);

    return {
      content: [{ type: 'text', text: `Released task ${args.taskId} from agent ${args.agentId}` }],
      structuredContent: { success: true, message: `Task ${args.taskId} released` },
    };
  } catch (error) {
    throw mapErrorToMCPError(error);
  }
}

/**
 * Execute the complete_task tool.
 * Marks a task as completed.
 */
export async function executeCompleteTask(
  args: CompleteTaskArgs,
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: { success: boolean; message?: string };
}> {
  try {
    const factory = createGitHubFactory();
    const store = new AgentStore(factory);
    const contextService = new AgentContextService(factory);
    const service = new TaskCheckoutService(factory, store, contextService);

    await service.completeTask(args.agentId, args.taskId, args.summary);

    return {
      content: [{ type: 'text', text: `Completed task ${args.taskId}` }],
      structuredContent: { success: true, message: `Task ${args.taskId} completed` },
    };
  } catch (error) {
    throw mapErrorToMCPError(error);
  }
}

/**
 * Execute the get_task_context tool.
 * Returns enriched context for a task/issue.
 */
export async function executeGetTaskContext(
  args: GetTaskContextArgs,
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: z.infer<typeof AgentTaskContextSchema>;
}> {
  try {
    const factory = createGitHubFactory();
    const service = new AgentContextService(factory);

    // Service takes (issueId, issueNumber) — pass the number as string;
    // the service resolves the node ID internally if needed.
    const context = await service.getTaskContext(
      String(args.issueNumber),
      args.issueNumber,
    );

    return {
      content: [{ type: 'text', text: `Context for issue #${args.issueNumber}: ${context.issue.title}` }],
      structuredContent: context,
    };
  } catch (error) {
    throw mapErrorToMCPError(error);
  }
}

/**
 * Execute the agent_heartbeat tool.
 * Records agent liveness and progress.
 */
export async function executeAgentHeartbeat(
  args: AgentHeartbeatArgs,
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: { success: boolean; message?: string };
}> {
  try {
    const factory = createGitHubFactory();
    const store = new AgentStore(factory);
    const contextService = new AgentContextService(factory);
    const service = new TaskCheckoutService(factory, store, contextService);

    await service.processHeartbeat({
      ...args,
      timestamp: new Date().toISOString(),
    });

    const progressText = args.progress != null ? ` (${args.progress}%)` : '';
    return {
      content: [{ type: 'text', text: `Heartbeat received for ${args.agentId}${progressText}` }],
      structuredContent: { success: true, message: 'Heartbeat recorded' },
    };
  } catch (error) {
    throw mapErrorToMCPError(error);
  }
}

/**
 * Execute the submit_work_product tool.
 * Records a work product on the issue.
 */
export async function executeSubmitWorkProduct(
  args: SubmitWorkProductArgs,
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: z.infer<typeof WorkProductSchema>;
}> {
  try {
    const factory = createGitHubFactory();
    const wpStore = new WorkProductStore(factory);
    const service = new WorkProductService(factory, wpStore);

    const product: WorkProduct = {
      id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agentId: args.agentId,
      taskId: args.taskId,
      branch: args.branch,
      prNumber: args.prNumber,
      commitShas: args.commitShas,
      filesChanged: args.filesChanged,
      testResults:
        args.testsTotal != null
          ? {
              passed: args.testsPassed ?? 0,
              failed: args.testsFailed ?? 0,
              skipped: 0,
              total: args.testsTotal,
            }
          : undefined,
      summary: args.summary,
      submittedAt: new Date().toISOString(),
    };

    await service.submitWorkProduct(product);

    return {
      content: [{ type: 'text', text: `Work product submitted for task ${args.taskId}` }],
      structuredContent: product,
    };
  } catch (error) {
    throw mapErrorToMCPError(error);
  }
}

/**
 * Execute the get_agent_activity tool.
 * Returns activity dashboard for all agents.
 */
export async function executeGetAgentActivity(
  args: GetAgentActivityArgs,
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: { agents: AgentActivityEntry[]; total: number; timestamp: string };
}> {
  try {
    const factory = createGitHubFactory();
    const store = new AgentStore(factory);

    let agents = await store.listAgents();

    if (!args.includeOffline) {
      agents = agents.filter((a) => a.status !== 'offline');
    }

    const now = new Date();
    const entries: AgentActivityEntry[] = agents.map((agent) => {
      const lastHb = agent.lastHeartbeat ? new Date(agent.lastHeartbeat) : undefined;
      const ageMs = lastHb ? now.getTime() - lastHb.getTime() : undefined;
      const isStale = ageMs != null && ageMs > 30 * 60 * 1000;

      return {
        agent: {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          runtime: agent.runtime,
          status: agent.status,
        },
        currentTask: agent.currentTaskId
          ? {
              issueId: agent.currentTaskId,
              title: agent.currentTaskTitle ?? 'Unknown',
              claimedAt: agent.lastHeartbeat ?? agent.registeredAt,
            }
          : undefined,
        lastHeartbeat: agent.lastHeartbeat,
        heartbeatAge: ageMs != null ? `${Math.round(ageMs / 60000)}m` : undefined,
        isStale,
        budgetStatus: agent.budget
          ? {
              usagePercent: agent.budget.totalTokens > 0
                ? (agent.budget.usedTokens / agent.budget.totalTokens) * 100
                : 0,
              isWarning: agent.budget.totalTokens > 0
                ? agent.budget.usedTokens / agent.budget.totalTokens >= agent.budget.warningThreshold
                : false,
              isExhausted: agent.budget.hardStop && agent.budget.usedTokens >= agent.budget.totalTokens,
            }
          : undefined,
        completedToday: 0, // Requires additional query; populated by service layer
      };
    });

    const result = {
      agents: entries,
      total: entries.length,
      timestamp: now.toISOString(),
    };

    return {
      content: [{ type: 'text', text: `${entries.length} agent(s) active` }],
      structuredContent: result,
    };
  } catch (error) {
    throw mapErrorToMCPError(error);
  }
}

/**
 * Execute the get_budget_status tool.
 * Returns token budget status for an agent.
 */
export async function executeGetBudgetStatus(
  args: GetBudgetStatusArgs,
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: BudgetStatus;
}> {
  try {
    const factory = createGitHubFactory();
    const store = new AgentStore(factory);
    const service = new AgentBudgetService(store);

    const status = await service.getBudgetStatus(args.agentId);

    return {
      content: [
        {
          type: 'text',
          text: `Budget for ${status.agentName}: ${status.usagePercent.toFixed(1)}% used (${status.remainingTokens} remaining)`,
        },
      ],
      structuredContent: status,
    };
  } catch (error) {
    throw mapErrorToMCPError(error);
  }
}

/**
 * Execute the set_agent_budget tool.
 * Configures token budget for an agent.
 */
export async function executeSetAgentBudget(
  args: SetAgentBudgetArgs,
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: BudgetStatus;
}> {
  try {
    const factory = createGitHubFactory();
    const store = new AgentStore(factory);
    const service = new AgentBudgetService(store);

    await service.setBudget(
      args.agentId,
      args.totalTokens,
      args.warningThreshold,
      args.resetPeriod,
    );

    const status = await service.getBudgetStatus(args.agentId);

    return {
      content: [
        {
          type: 'text',
          text: `Budget set for agent ${args.agentId}: ${args.totalTokens} tokens`,
        },
      ],
      structuredContent: status,
    };
  } catch (error) {
    throw mapErrorToMCPError(error);
  }
}
