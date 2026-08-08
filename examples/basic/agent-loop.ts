/**
 * Reference agent loop — a complete autonomous worker cycle.
 *
 * This example shows how an agentic harness (Claude Code, Codex, Cursor,
 * or a custom loop) drives the agent orchestration layer through the
 * `agent_work` / `agent_manage` compound tools:
 *
 *   register → checkout_task → get_task_context → heartbeat*
 *     → submit_for_review → (reviewer) review_next → approve/reject
 *
 * The script is a self-contained illustration: it prints the exact MCP
 * tool calls an agent should issue for each step. Run it to see the loop
 * end-to-end (requires a running server with GitHub credentials):
 *
 *   node --loader ts-node/esm examples/basic/agent-loop.ts
 *
 * To execute against a live server, pair this with scripts/mcp-test-client.js.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

interface AgentLoopConfig {
  agentName: string;
  role: 'engineer' | 'reviewer' | 'pm' | 'designer' | 'qa' | 'devops' | 'general';
  runtime: 'claude-code' | 'codex' | 'cursor' | 'cli' | 'http' | 'custom';
  capabilities: string[];
  /** Checkout strategy for task selection. */
  strategy: 'highest_priority' | 'oldest_first' | 'skills_match' | 'milestone_deadline' | 'ai';
  /** Skip tasks whose blockers are still open. */
  skipBlocked: boolean;
  /** Budget tokens for this agent. */
  budgetTokens?: number;
}

/**
 * Describes the tool calls for one full agent cycle.
 * This is a reference — plug the payloads into your harness's MCP client.
 */
export function agentLoopPlan(config: AgentLoopConfig): Array<{
  tool: string;
  description: string;
  arguments: Record<string, unknown>;
}> {
  const { agentName, role, runtime, capabilities, strategy, skipBlocked, budgetTokens } = config;

  return [
    {
      tool: 'agent_work',
      description: '1. Register the agent in the registry',
      arguments: {
        action: 'register',
        name: agentName,
        role,
        runtime,
        capabilities,
        ...(budgetTokens ? { budgetTokens } : {}),
      },
    },
    {
      tool: 'agent_work',
      description: '2. Claim the next task (strategy-driven, dependency-aware)',
      arguments: {
        action: 'checkout_task',
        agentId: `agent-<id-from-register>`,
        strategy,
        skipBlocked,
      },
    },
    {
      tool: 'agent_work',
      description: '3. Pull enriched context (issue, milestone, standards, AI suggestions)',
      arguments: {
        action: 'get_task_context',
        issueNumber: 42, // ← the issueNumber returned by checkout_task
      },
    },
    {
      tool: 'agent_work',
      description: '4. Report progress periodically (heartbeat history is retained)',
      arguments: {
        action: 'heartbeat',
        agentId: 'agent-<id>',
        status: 'working',
        taskId: 'issue-42',
        progress: 50,
        progressSummary: 'Implementation in progress',
        currentBranch: 'agent/42-<slug>',
      },
    },
    {
      tool: 'agent_work',
      description: '5. Submit the work for review (moves issue to the review queue)',
      arguments: {
        action: 'submit_for_review',
        agentId: 'agent-<id>',
        taskId: 'issue-42',
        summary: 'Implemented the feature with tests',
      },
    },
    {
      tool: 'agent_manage',
      description: '6. (Reviewer agent) claim the next item from the review queue',
      arguments: {
        action: 'checkout_task',
        agentId: 'agent-reviewer-<id>',
        reviewQueue: true,
      },
    },
    {
      tool: 'agent_work',
      description: '7. (Reviewer) approve or reject the work',
      arguments: {
        action: 'approve_task', // or reject_task with feedback
        reviewerId: 'agent-reviewer-<id>',
        taskId: 'issue-42',
        summary: 'LGTM — tests pass',
      },
    },
    {
      tool: 'agent_manage',
      description: '8. Report token usage so budgets stay accurate',
      arguments: {
        action: 'record_usage',
        agentId: 'agent-<id>',
        tokensUsed: 12500,
      },
    },
    {
      tool: 'agent_manage',
      description: '9. (Optional) observe swarm health',
      arguments: {
        action: 'get_metrics',
        staleAfterMinutes: 30,
      },
    },
  ];
}

/**
 * Run the reference loop plan against an MCP server via the SDK.
 * Demonstrates calling tools through the standard MCP transport.
 */
export async function runAgentLoop(
  server: Server,
  config: AgentLoopConfig,
): Promise<void> {
  const plan = agentLoopPlan(config);
  for (const step of plan) {
    process.stderr.write(`\n→ ${step.description}\n`);
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await server.request(
        {
          method: 'tools/call',
          params: { name: step.tool, arguments: step.arguments },
        },
        (await import('@modelcontextprotocol/sdk/types.js')).CallToolResultSchema,
      );
      process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
    } catch (error) {
      process.stderr.write(`Step failed: ${(error as Error).message}\n`);
    }
  }
}

// Print the plan when executed directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  const plan = agentLoopPlan({
    agentName: 'example-engineer',
    role: 'engineer',
    runtime: 'claude-code',
    capabilities: ['typescript', 'testing'],
    strategy: 'ai',
    skipBlocked: true,
    budgetTokens: 500_000,
  });
  process.stderr.write(JSON.stringify(plan, null, 2) + '\n');
}
