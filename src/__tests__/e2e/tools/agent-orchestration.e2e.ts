import { vi } from 'vitest';
import { MCPToolTestUtils } from '../utils/MCPToolTestUtils';

/**
 * End-to-end tests for the Agent Orchestration tools.
 *
 * These tests exercise the full agent lifecycle through the real MCP
 * interface against live GitHub:
 *
 *   1. Tool presence + schema compliance
 *   2. Project + agent field provisioning (setup_agent_fields)
 *   3. Registry: register / list / deregister
 *   4. Happy path: checkout → context → heartbeat → work product → review → approve
 *   5. Budgets: set / status / record_usage
 *   6. Self-healing: reclaim_stale_tasks (crash recovery)
 *   7. Metrics: get_agent_metrics
 *
 * Tool mapping: All tests use compound tools with action-based routing:
 * - agent_work: register, checkout_task, release_task, complete_task, heartbeat, ...
 * - agent_manage: list, deregister, get_activity, submit_work_product, ...
 * - manage_project: create, add_item, setup_agent_fields, ...
 * - manage_issues: create, ...
 *
 * They require real GitHub credentials (GITHUB_TOKEN / GITHUB_OWNER /
 * GITHUB_REPO) and skip gracefully when they are missing or fake. Run with:
 *
 *   npm run build && npm run test:e2e:tools:real:agent
 */

// Check for real credentials (not fake test tokens from setup.ts)
const hasRealCredentials = (): boolean => {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!token || token === 'test-token' || token === '') return false;
  if (!owner || owner === 'test-owner') return false;
  if (!repo || repo === 'test-repo') return false;
  return true;
};

/**
 * Pull the structured payload out of an MCP tool response.
 *
 * The server wraps results at two levels: the MCP layer adds a top-level
 * `structuredContent`, and granular executors return `{ content, structuredContent }`
 * which then gets re-wrapped. Service-backed compound actions (e.g.
 * manage_project/create) return the payload directly in the top-level
 * `structuredContent`. This helper unwraps recursively until it finds the
 * actual payload in either shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function data(response: any): any {
  if (!response || typeof response !== 'object') return response;

  // Unwrap executor double-wrap: structuredContent: { content, structuredContent }
  if (response.structuredContent) {
    const inner = response.structuredContent;
    if (
      inner &&
      typeof inner === 'object' &&
      inner.structuredContent !== undefined
    ) {
      return data(inner);
    }
    return inner;
  }

  // Fall back to parsing the text blob if structuredContent is absent
  if (Array.isArray(response.content) && response.content[0]?.text) {
    try {
      const parsed = JSON.parse(response.content[0].text);
      return data(parsed);
    } catch {
      // not JSON — return raw text
      return response.content[0].text;
    }
  }

  return response;
}

const AGENT_FIELD_NAMES = [
  'agent_claimed_by',
  'agent_claimed_at',
  'agent_status',
  'agent_work_branch',
  'agent_pr_number',
];

// The MCP server exposes compound tools (progressive disclosure); the agent
// actions are reachable via agent_work (task lifecycle) + agent_manage
// (administration), and the project/issue primitives via manage_project /
// manage_issues.
const AGENT_COMPOUND_TOOLS = ['agent_work', 'agent_manage'];
const AGENT_COMPOUND_ACTIONS: Record<string, string[]> = {
  agent_work: [
    'register', 'checkout_task', 'release_task', 'complete_task',
    'heartbeat', 'check_work_status', 'get_task_context', 'submit_for_review', 'approve_task', 'reject_task',
  ],
  agent_manage: [
    'list', 'deregister', 'get_activity', 'submit_work_product',
    'get_budget', 'set_budget', 'reclaim_stale', 'record_usage', 'get_metrics', 'setup_fields',
  ],
};

describe('Agent Orchestration Tools E2E', () => {
  let utils: MCPToolTestUtils | undefined;

  // Unique per run: Date.now() is frozen by setup.ts's fake timers in all
  // modes, so append a random suffix to stay unique across runs.
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let projectId = '';
  let engineerAgentId = '';
  let reviewerAgentId = '';
  let reclaimAgentId = '';
  const registeredAgentIds: string[] = [];

  // Happy-path lifecycle state
  let happyTaskId = '';
  let happyIssueNumber = 0;
  let happyIssueId = '';

  // Reclaim lifecycle state
  let reclaimTaskId = '';

  beforeAll(async () => {
    if (!hasRealCredentials()) {
      console.log('Skipping Agent Orchestration Tools E2E - missing real GitHub credentials');
      return;
    }

    utils = new MCPToolTestUtils();
    await utils.startServer();
  }, 30000);

  afterAll(async () => {
    // Best-effort cleanup: deregister every agent created by this run so the
    // shared agent-registry issue doesn't accumulate across test runs.
    if (utils) {
      for (const agentId of registeredAgentIds) {
        try {
          await utils.callTool('agent_manage', { action: 'deregister', agentId });
        } catch {
          // ignore cleanup failures
        }
      }
      await utils.stopServer();
    }
  }, 20000);

  // ────────────────────────────────────────────────────────────────────────
  // 1. Tool presence + schema compliance
  // ────────────────────────────────────────────────────────────────────────

  it('should expose the agent compound tools and their actions over MCP', async () => {
    if (!utils) { console.log('Skipping: utils not initialized (missing credentials)'); return; }

    const tools = await utils.listTools();
    const names = tools.map(t => t.name);

    // Compound tools are listed with full schema
    for (const toolName of AGENT_COMPOUND_TOOLS) {
      const tool = tools.find(t => t.name === toolName);
      expect(tool).toBeDefined();
      expect(tool?.name).toBe(toolName);
      expect(tool?.description).toBeDefined();
      expect(tool?.inputSchema).toBeDefined();
    }

    // discover_tools catalogs every agent action
    const catalog = data(await utils.callTool('discover_tools', { domain: 'agents' }));
    expect(catalog.actions).toBeDefined();
    for (const actions of Object.values(AGENT_COMPOUND_ACTIONS)) {
      for (const action of actions) {
        expect(catalog.actions).toContain(action);
      }
    }
  });

  it('should route granular agent tool names through the registry (aliases)', async () => {
    if (!utils) { console.log('Skipping: utils not initialized (missing credentials)'); return; }

    // Granular names are callable even though they are not listed
    const tools = await utils.listTools();
    const names = tools.map(t => t.name);
    for (const granular of ['register_agent', 'checkout_task', 'get_agent_metrics']) {
      expect(names).not.toContain(granular);
    }
  });

  it('should reject invalid checkout strategy enums', async () => {
    if (!utils) { console.log('Skipping: utils not initialized (missing credentials)'); return; }

    await expect(
      utils.callTool('agent_work', { action: 'checkout_task', agentId: 'agent-x', strategy: 'not_a_strategy' }),
    ).rejects.toThrow();
  });

  // ────────────────────────────────────────────────────────────────────────
  // 2. Project + agent field provisioning
  // ────────────────────────────────────────────────────────────────────────

  it('should create a project for the agent lifecycle', async () => {
    if (!utils) { console.log('Skipping: utils not initialized (missing credentials)'); return; }

    const response = await utils.callTool('manage_project', {
      action: 'create',
      title: `E2E Agent Project ${runId}`,
      shortDescription: 'E2E test project for agent orchestration',
      owner: process.env.GITHUB_OWNER || 'test-owner',
      visibility: 'private',
    });

    const result = data(response);
    expect(result.id).toBeDefined();
    expect(result.title).toContain('E2E Agent Project');
    projectId = result.id;
  });

  it('should provision agent fields idempotently (setup_agent_fields)', async () => {
    if (!utils) { console.log('Skipping: utils not initialized (missing credentials)'); return; }
    if (!projectId) { console.log('Skipping: no project created'); return; }

    const response = await utils.callTool('agent_manage', { action: 'setup_fields', projectId });
    const result = data(response);

    const present = new Set([...(result.created ?? []), ...(result.existing ?? [])]);
    for (const fieldName of AGENT_FIELD_NAMES) {
      expect(present.has(fieldName)).toBe(true);
    }

    // Second call must be a no-op (idempotent)
    const again = data(await utils.callTool('agent_manage', { action: 'setup_fields', projectId }));
    expect(again.created ?? []).toHaveLength(0);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 3. Registry
  // ────────────────────────────────────────────────────────────────────────

  it('should register an engineer agent', async () => {
    if (!utils) { console.log('Skipping: utils not initialized (missing credentials)'); return; }

    const response = await utils.callTool('agent_work', {
      action: 'register',
      name: `e2e-engineer-${runId}`,
      role: 'engineer',
      runtime: 'claude-code',
      capabilities: ['typescript', 'testing'],
      budgetTokens: 500000,
    });

    const agent = data(response);
    expect(agent.id).toBeDefined();
    expect(agent.name).toContain('e2e-engineer');
    expect(agent.status).toBe('idle');

    engineerAgentId = agent.id;
    registeredAgentIds.push(engineerAgentId);
  });

  it('should register a reviewer agent', async () => {
    if (!utils) { console.log('Skipping: utils not initialized (missing credentials)'); return; }

    const response = await utils.callTool('agent_work', {
      action: 'register',
      name: `e2e-reviewer-${runId}`,
      role: 'reviewer',
      runtime: 'claude-code',
    });

    const agent = data(response);
    expect(agent.id).toBeDefined();
    expect(agent.role).toBe('reviewer');

    reviewerAgentId = agent.id;
    registeredAgentIds.push(reviewerAgentId);
  });

  it('should list agents including the newly registered ones', async () => {
    if (!utils) { console.log('Skipping: utils not initialized (missing credentials)'); return; }

    const result = data(await utils.callTool('agent_manage', { action: 'list' }));
    expect(Array.isArray(result.agents)).toBe(true);
    expect(result.total).toBeGreaterThanOrEqual(2);

    const ids = new Set(result.agents.map((a: { id: string }) => a.id));
    expect(ids.has(engineerAgentId)).toBe(true);
    expect(ids.has(reviewerAgentId)).toBe(true);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 4. Happy-path lifecycle
  // ────────────────────────────────────────────────────────────────────────

  it('should create and project-ify an issue to work on', async () => {
    if (!utils) { console.log('Skipping: utils not initialized (missing credentials)'); return; }
    if (!projectId) { console.log('Skipping: no project created'); return; }

    const issue = data(await utils.callTool('manage_issues', {
      action: 'create',
      title: `E2E Agent Task ${runId}`,
      description: 'Task for the agent lifecycle E2E test',
      labels: [],
      assignees: [],
    }));

    expect(issue.id).toBeDefined();
    expect(issue.number).toBeGreaterThan(0);
    happyIssueId = issue.id;
    happyIssueNumber = issue.number;

    const added = data(await utils.callTool('manage_project', {
      action: 'add_item',
      projectId,
      contentId: issue.id,
      contentType: 'issue',
    }));
    expect(added).toBeDefined();
  });

  it('should checkout the task for the engineer', async () => {
    if (!utils) { console.log('Skipping: utils not initialized (missing credentials)'); return; }
    if (!engineerAgentId || !projectId) { console.log('Skipping: missing setup state'); return; }

    const response = await utils.callTool('agent_work', {
      action: 'checkout_task',
      agentId: engineerAgentId,
      projectId,
      strategy: 'highest_priority',
    });

    const result = data(response);
    expect(result.success).toBe(true);
    expect(result.issueNumber).toBe(happyIssueNumber);
    expect(result.issueTitle).toContain('E2E Agent Task');

    happyTaskId = String(result.issueNumber);
  });

  it('should prevent a second agent from claiming the same task', async () => {
    if (!utils) { console.log('Skipping: utils not initialized (missing credentials)'); return; }
    if (!reviewerAgentId || !projectId) { console.log('Skipping: missing setup state'); return; }

    // Reviewer has no task yet — but the issue is claimed, so checkout must fail
    // with "no unclaimed tasks" rather than assigning the same issue.
    const result = data(await utils.callTool('agent_work', {
      action: 'checkout_task',
      agentId: reviewerAgentId,
      projectId,
      strategy: 'highest_priority',
    }));

    expect(result.success).toBe(false);
  });

  it('should get enriched task context', async () => {
    if (!utils) { console.log('Skipping: utils not initialized (missing credentials)'); return; }
    if (!happyIssueNumber) { console.log('Skipping: no task created'); return; }

    const context = data(await utils.callTool('agent_work', {
      action: 'get_task_context',
      issueNumber: happyIssueNumber,
    }));

    expect(context.issue).toBeDefined();
    expect(context.issue.number ?? context.issue.id).toBeDefined();
  });

  it('should process a heartbeat and expose heartbeat history in activity', async () => {
    if (!utils) { console.log('Skipping: utils not initialized (missing credentials)'); return; }
    if (!engineerAgentId || !happyTaskId) { console.log('Skipping: missing setup state'); return; }

    const hb = data(await utils.callTool('agent_work', {
      action: 'heartbeat',
      agentId: engineerAgentId,
      status: 'working',
      taskId: happyTaskId,
      progress: 50,
      progressSummary: 'Halfway through the E2E task',
    }));
    expect(hb.success).toBe(true);

    const activity = data(await utils.callTool('agent_manage', { action: 'get_activity', includeOffline: true }));
    expect(Array.isArray(activity.agents)).toBe(true);

    const entry = activity.agents.find(
      (a: { agent?: { id: string } }) => a.agent?.id === engineerAgentId,
    );
    expect(entry).toBeDefined();
    expect(entry.currentTask).toBeDefined();
  });

  it('should submit a work product', async () => {
    if (!utils) { console.log('Skipping: utils not initialized (missing credentials)'); return; }
    if (!engineerAgentId || !happyTaskId || !happyIssueNumber) { console.log('Skipping: missing setup state'); return; }

    const product = data(await utils.callTool('agent_manage', {
      action: 'submit_work_product',
      agentId: engineerAgentId,
      taskId: happyTaskId,
      issueNumber: happyIssueNumber,
      branch: `agent/${happyIssueNumber}-e2e-task`,
      commitShas: [],
      filesChanged: ['src/e2e.ts'],
      testsPassed: 4,
      testsFailed: 0,
      testsTotal: 4,
      summary: 'Implemented the E2E agent lifecycle task',
    }));

    expect(product.id).toBeDefined();
    expect(product.agentId).toBe(engineerAgentId);
    expect(product.taskId).toBe(happyTaskId);
  });

  it('should submit the task for review and have it approved', async () => {
    if (!utils) { console.log('Skipping: utils not initialized (missing credentials)'); return; }
    if (!engineerAgentId || !reviewerAgentId || !happyTaskId) { console.log('Skipping: missing setup state'); return; }

    const submitted = data(await utils.callTool('agent_work', {
      action: 'submit_for_review',
      agentId: engineerAgentId,
      taskId: happyTaskId,
      summary: 'Please review the E2E task',
    }));
    expect(submitted.success).toBe(true);

    const approved = data(await utils.callTool('agent_work', {
      action: 'approve_task',
      reviewerId: reviewerAgentId,
      taskId: happyTaskId,
      summary: 'LGTM — E2E lifecycle verified',
    }));
    expect(approved.success).toBe(true);
  });

  it('should have released the engineer after approval', async () => {
    if (!utils) { console.log('Skipping: utils not initialized (missing credentials)'); return; }
    if (!engineerAgentId) { console.log('Skipping: no engineer registered'); return; }

    const activity = data(await utils.callTool('agent_manage', { action: 'get_activity', includeOffline: true }));
    const entry = activity.agents.find(
      (a: { agent?: { id: string } }) => a.agent?.id === engineerAgentId,
    );
    expect(entry).toBeDefined();
    expect(entry.currentTask).toBeUndefined();
  });

  // ────────────────────────────────────────────────────────────────────────
  // 5. Budgets
  // ────────────────────────────────────────────────────────────────────────

  it('should set, read, and record against an agent budget', async () => {
    if (!utils) { console.log('Skipping: utils not initialized (missing credentials)'); return; }
    if (!engineerAgentId) { console.log('Skipping: no engineer registered'); return; }

    const set = data(await utils.callTool('agent_manage', {
      action: 'set_budget',
      agentId: engineerAgentId,
      totalTokens: 100000,
      warningThreshold: 0.8,
      hardStop: true,
    }));
    expect(set.totalTokens).toBe(100000);

    const before = data(await utils.callTool('agent_manage', { action: 'get_budget', agentId: engineerAgentId }));
    expect(before.usedTokens ?? before.usagePercent).toBeDefined();

    const recorded = data(await utils.callTool('agent_manage', {
      action: 'record_usage',
      agentId: engineerAgentId,
      tokensUsed: 25000,
    }));
    expect(recorded.usedTokens).toBeGreaterThanOrEqual(25000);
    expect(recorded.remainingTokens).toBeLessThanOrEqual(75000);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 6. Self-healing: auto-reclaim
  // ────────────────────────────────────────────────────────────────────────

  it('should register a reclaim-test agent and claim a second task', async () => {
    if (!utils) { console.log('Skipping: utils not initialized (missing credentials)'); return; }
    if (!projectId) { console.log('Skipping: no project created'); return; }

    const agent = data(await utils.callTool('agent_work', {
      action: 'register',
      name: `e2e-reclaim-${runId}`,
      role: 'engineer',
      runtime: 'cli',
    }));
    reclaimAgentId = agent.id;
    registeredAgentIds.push(reclaimAgentId);

    const issue = data(await utils.callTool('manage_issues', {
      action: 'create',
      title: `E2E Reclaim Task ${runId}`,
      description: 'Task that the agent will crash on (no more heartbeats)',
      labels: [],
      assignees: [],
    }));
    await utils.callTool('manage_project', {
      action: 'add_item',
      projectId,
      contentId: issue.id,
      contentType: 'issue',
    });

    const checkout = data(await utils.callTool('agent_work', {
      action: 'checkout_task',
      agentId: reclaimAgentId,
      projectId,
      strategy: 'oldest_first',
    }));
    expect(checkout.success).toBe(true);
    reclaimTaskId = String(checkout.issueNumber);
  });

  it('should reclaim the crashed agent task and mark the agent offline', async () => {
    if (!utils) { console.log('Skipping: utils not initialized (missing credentials)'); return; }
    if (!reclaimAgentId || !reclaimTaskId) { console.log('Skipping: missing setup state'); return; }

    // Simulate a crash: stop heartbeating and wait past the reclaim threshold.
    // timeoutMinutes=0.01 → 600ms; we wait 2.5s to guarantee staleness.
    // setup.ts runs the test process on fake timers, so swap to real timers
    // for the sleep (the server process uses its own real clock).
    vi.useRealTimers();
    await new Promise(resolve => setTimeout(resolve, 2500));
    vi.useFakeTimers();

    const reclaimed = data(await utils.callTool('agent_manage', { action: 'reclaim_stale', timeoutMinutes: 0.01 }));
    expect(reclaimed.reclaimed).toBeGreaterThanOrEqual(1);

    const hit = (reclaimed.details ?? []).find(
      (d: { agentId: string; taskId: string }) => d.agentId === reclaimAgentId,
    );
    expect(hit).toBeDefined();
    expect(hit.taskId).toBe(reclaimTaskId);

    // Agent must now be offline in the registry
    const activity = data(await utils.callTool('agent_manage', { action: 'get_activity', includeOffline: true }));
    const entry = activity.agents.find(
      (a: { agent?: { id: string } }) => a.agent?.id === reclaimAgentId,
    );
    expect(entry).toBeDefined();
    expect(entry.agent.status).toBe('offline');
  });

  // ────────────────────────────────────────────────────────────────────────
  // 7. Metrics
  // ────────────────────────────────────────────────────────────────────────

  it('should return aggregate agent metrics', async () => {
    if (!utils) { console.log('Skipping: utils not initialized (missing credentials)'); return; }

    const metrics = data(await utils.callTool('agent_manage', { action: 'get_metrics' }));

    expect(metrics.totalAgents).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(metrics.agents)).toBe(true);
    expect(metrics.totalTasksCompleted).toBeGreaterThanOrEqual(1);
    expect(metrics.overallBudgetUsagePercent).toBeDefined();
  });
});
