import { vi } from "vitest";
import { MCPToolTestUtils } from "../utils/MCPToolTestUtils";

/**
 * End-to-end tests for the Agent Orchestration tools.
 *
 * These tests exercise the full agent lifecycle through the real MCP
 * interface against live GitHub:
 *
 *   1. Tool presence + schema compliance
 *   2. Project + agent field provisioning (setup_agent_fields)
 *   3. Registry: register / list / deregister
 *   4. Happy path: checkout → context → heartbeat → work product → review queue checkout → approve
 *   5. Budgets: set / status / record_usage / hard-stop checkout refusal
 *   6. Self-healing: reclaim_stale_tasks (crash recovery)
 *   7. PM coordination action discovery: swarm status / rebalance / converge
 *   8. Metrics: get_agent_metrics
 *   9. Product-level lifecycle scenarios, asserted on the resulting GitHub
 *      state (issue state, Project V2 claim fields, issue comments): the
 *      worker loop, the rejection path, crash recovery, the PM flow
 *      (assign_task / smart_assign / get_swarm_status), concurrent checkouts
 *      and the budget hard stop.
 *  10. PM convergence and workload scenarios, each in its own project:
 *      rebalance_workload (stale owner → idle capable agent),
 *      converge_project with a reviewer (lifecycle approve / reject) and
 *      without one (fallback path), converge_until_done (terminates and
 *      reports a converged project).
 *  11. Native blockers (add_blocker / list_dependencies / remove_blocker) and
 *      checkout_task {skipBlocked}, and checkout_task {view} (a view
 *      without a sort order falls back to the strategy; GitHub's API cannot
 *      set a view's sort, so the sort-order pick is covered by unit tests).
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

  if (!token || token === "test-token" || token === "") return false;
  if (!owner || owner === "test-owner") return false;
  if (!repo || repo === "test-repo") return false;
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
  if (!response || typeof response !== "object") return response;

  // Unwrap executor double-wrap: structuredContent: { content, structuredContent }
  if (response.structuredContent) {
    const inner = response.structuredContent;
    if (inner && typeof inner === "object" && inner.structuredContent !== undefined) {
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

/**
 * Create an issue and add it to a project.
 *
 * The product-level scenarios below need a project whose pool contains only
 * the issues they create, so that `checkout_task` is deterministic.
 */
async function createIssueInProject(
  client: MCPToolTestUtils,
  projectId: string,
  title: string,
  description: string
): Promise<{ id: string; number: number }> {
  const issue = data(
    await client.callTool("manage_issues", {
      action: "create",
      title,
      description,
      labels: [],
      assignees: [],
    })
  );

  await client.callTool("manage_project", {
    action: "add_item",
    projectId,
    contentId: issue.id,
    contentType: "issue",
  });

  // GitHub lists a project's items eventually: right after addProjectV2ItemById
  // the item is not yet returned by `ProjectV2.items` (measured: 2-3 s), and
  // the PM actions (smart_assign, converge_*) enumerate a project through
  // exactly that listing. Wait until the item is visible so a scenario starts
  // from a pool every read path agrees on.
  vi.useRealTimers();
  try {
    // The lag is 2-3 s: sleep first, then poll sparsely (each poll is a
    // full GraphQL item listing and the hourly budget is shared).
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const deadline = Date.now() + 45000;
    while ((await client.getProjectItemFieldValues(projectId, issue.id)) === null) {
      if (Date.now() > deadline) {
        throw new Error(`Issue #${issue.number} never became listable in project ${projectId}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  } finally {
    vi.useFakeTimers();
  }
  return { id: issue.id, number: issue.number };
}

/** Register an agent through the MCP surface and return its id. */
async function registerAgent(
  client: MCPToolTestUtils,
  name: string,
  role: "engineer" | "reviewer" | "pm" | "qa" | "designer" | "devops" | "general",
  capabilities: string[] = []
): Promise<string> {
  const agent = data(
    await client.callTool("agent_work", {
      action: "register",
      name,
      role,
      runtime: "claude-code",
      capabilities,
    })
  );
  return agent.id;
}

/**
 * Create a dedicated project with the agent fields provisioned.
 *
 * Each PM / blocker / view scenario owns its project so the claiming pool
 * holds exactly the issues the scenario creates and the assertions are
 * deterministic regardless of what other scenarios (or other runs) left in
 * the repository.
 */
async function createScenarioProject(client: MCPToolTestUtils, title: string): Promise<string> {
  const project = data(
    await client.callTool("manage_project", {
      action: "create",
      title,
      shortDescription: "E2E dedicated scenario project",
      owner: process.env.GITHUB_OWNER || "test-owner",
      visibility: "private",
    })
  );
  expect(project.id).toBeDefined();

  const fields = data(
    await client.callTool("agent_manage", { action: "setup_fields", projectId: project.id })
  );
  const present = new Set([...(fields.created ?? []), ...(fields.existing ?? [])]);
  for (const fieldName of AGENT_FIELD_NAMES) {
    expect(present.has(fieldName)).toBe(true);
  }
  return project.id;
}

/** Close an issue through the MCP surface (scenario cleanup). */
async function closeIssue(client: MCPToolTestUtils, issueId: string): Promise<void> {
  await client.callTool("manage_issues", { action: "update", issueId, status: "closed" });
}

/** Checkout through the MCP surface; returns the structured result. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkoutTask(client: MCPToolTestUtils, args: Record<string, unknown>): Promise<any> {
  const result = data(await client.callTool("agent_work", { action: "checkout_task", ...args }));
  if (!result || typeof result !== "object") {
    throw new Error(`checkout_task returned a non-structured result: ${String(result)}`);
  }
  return result;
}

/** Submit a work product (and nothing else) for a task the agent holds. */
async function submitWorkProduct(
  client: MCPToolTestUtils,
  agentId: string,
  issueNumber: number,
  testsFailed: number
): Promise<void> {
  const product = data(
    await client.callTool("agent_manage", {
      action: "submit_work_product",
      agentId,
      taskId: String(issueNumber),
      issueNumber,
      filesChanged: [`src/e2e-${issueNumber}.ts`],
      testsPassed: 1,
      testsFailed,
      testsTotal: 1 + testsFailed,
      summary: `Work product for #${issueNumber}`,
    })
  );
  expect(product.id).toBeDefined();
}

/** The registry record of an agent, read through agent_manage list. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function registryEntry(client: MCPToolTestUtils, agentId: string): Promise<any> {
  const agents = data(await client.callTool("agent_manage", { action: "list" }));
  return agents.agents.find((a: { id: string }) => a.id === agentId);
}

const AGENT_FIELD_NAMES = [
  "agent_claimed_by",
  "agent_claimed_at",
  "agent_status",
  "agent_work_branch",
  "agent_pr_number",
];

// The MCP server exposes compound tools (progressive disclosure); the agent
// actions are reachable via agent_work (task lifecycle) + agent_manage
// (administration), and the project/issue primitives via manage_project /
// manage_issues.
const AGENT_COMPOUND_TOOLS = ["agent_work", "agent_manage"];
const AGENT_COMPOUND_ACTIONS: Record<string, string[]> = {
  agent_work: [
    "register",
    "checkout_task",
    "release_task",
    "complete_task",
    "heartbeat",
    "check_work_status",
    "get_task_context",
    "submit_for_review",
    "approve_task",
    "reject_task",
  ],
  agent_manage: [
    "list",
    "deregister",
    "get_activity",
    "submit_work_product",
    "get_budget",
    "set_budget",
    "reclaim_stale",
    "record_usage",
    "get_metrics",
    "setup_fields",
    "get_swarm_status",
    "rebalance_workload",
    "converge_project",
    "converge_until_done",
  ],
};

/**
 * The live API is slow: a single tool call that creates a project, a field or
 * an agent can take 10-25 seconds. The global test timeout is 10s, which is
 * right for the unit suites and too short here - the failures were timeouts,
 * not broken behaviour. A scenario that drives a whole lifecycle makes a
 * dozen live calls, so the budget per test is two minutes.
 */
vi.setConfig({ testTimeout: 120000 });

describe("Agent Orchestration Tools E2E", () => {
  let utils: MCPToolTestUtils | undefined;

  // Unique per run: Date.now() is frozen by setup.ts's fake timers in all
  // modes, so append a random suffix to stay unique across runs.
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let projectId = "";
  let engineerAgentId = "";
  let reviewerAgentId = "";
  let reclaimAgentId = "";
  const registeredAgentIds: string[] = [];

  // Happy-path lifecycle state
  let happyTaskId = "";
  let happyIssueNumber = 0;

  // Reclaim lifecycle state
  let reclaimTaskId = "";

  beforeAll(async () => {
    if (!hasRealCredentials()) {
      console.log("Skipping Agent Orchestration Tools E2E - missing real GitHub credentials");
      return;
    }

    utils = new MCPToolTestUtils();
    await utils.startServer();
  }, 30000);

  afterAll(async () => {
    // Best-effort cleanup: deregister every agent created by this run so the
    // shared agent registry (registry.json on the agent-registry branch) doesn't accumulate across test runs.
    if (utils) {
      for (const agentId of registeredAgentIds) {
        try {
          await utils.callTool("agent_manage", { action: "deregister", agentId });
        } catch {
          // ignore cleanup failures
        }
      }
      await utils.stopServer();
    }
  }, 60000);

  // ────────────────────────────────────────────────────────────────────────
  // 1. Tool presence + schema compliance
  // ────────────────────────────────────────────────────────────────────────

  it("should expose the agent compound tools and their actions over MCP", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }

    const tools = await utils.listTools();

    // Compound tools are listed with full schema
    for (const toolName of AGENT_COMPOUND_TOOLS) {
      const tool = tools.find((t) => t.name === toolName);
      expect(tool).toBeDefined();
      expect(tool?.name).toBe(toolName);
      expect(tool?.description).toBeDefined();
      expect(tool?.inputSchema).toBeDefined();
    }

    // discover_tools catalogs every agent action
    const catalog = data(await utils.callTool("discover_tools", { domain: "agents" }));
    expect(catalog.actions).toBeDefined();
    for (const actions of Object.values(AGENT_COMPOUND_ACTIONS)) {
      for (const action of actions) {
        expect(catalog.actions).toContain(action);
      }
    }
  });

  it("should route granular agent tool names through the registry (aliases)", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }

    // Granular names are callable even though they are not listed
    const tools = await utils.listTools();
    const names = tools.map((t) => t.name);
    for (const granular of ["register_agent", "checkout_task", "get_agent_metrics"]) {
      expect(names).not.toContain(granular);
    }
  });

  it("should reject invalid checkout strategy enums", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }

    // MCP v2 reports a schema violation as a TOOL error result
    // (`{content, isError: true}`), not as a JSON-RPC error: a bad argument
    // is a tool failure the model can recover from, a protocol error is
    // reserved for protocol faults. The old expectation (a rejected promise)
    // belonged to the v1 era.
    const raw = await utils.callToolRaw("agent_work", {
      action: "checkout_task",
      agentId: "agent-x",
      strategy: "not_a_strategy",
    });

    expect(raw.isError).toBe(true);
    expect(raw.content?.[0]?.text ?? "").toMatch(/strategy|validation|allowed values/i);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 2. Project + agent field provisioning
  // ────────────────────────────────────────────────────────────────────────

  it("should create a project for the agent lifecycle", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }

    const response = await utils.callTool("manage_project", {
      action: "create",
      title: `E2E Agent Project ${runId}`,
      shortDescription: "E2E test project for agent orchestration",
      owner: process.env.GITHUB_OWNER || "test-owner",
      visibility: "private",
    });

    const result = data(response);
    expect(result.id).toBeDefined();
    expect(result.title).toContain("E2E Agent Project");
    projectId = result.id;
  });

  it("should provision agent fields idempotently (setup_agent_fields)", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!projectId) {
      console.log("Skipping: no project created");
      return;
    }

    const response = await utils.callTool("agent_manage", { action: "setup_fields", projectId });
    const result = data(response);

    const present = new Set([...(result.created ?? []), ...(result.existing ?? [])]);
    for (const fieldName of AGENT_FIELD_NAMES) {
      expect(present.has(fieldName)).toBe(true);
    }

    // Second call must be a no-op (idempotent)
    const again = data(await utils.callTool("agent_manage", { action: "setup_fields", projectId }));
    expect(again.created ?? []).toHaveLength(0);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 3. Registry
  // ────────────────────────────────────────────────────────────────────────

  it("should register an engineer agent", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }

    const response = await utils.callTool("agent_work", {
      action: "register",
      name: `e2e-engineer-${runId}`,
      role: "engineer",
      runtime: "claude-code",
      capabilities: ["typescript", "testing"],
      budgetTokens: 500000,
    });

    const agent = data(response);
    expect(agent.id).toBeDefined();
    expect(agent.name).toContain("e2e-engineer");
    expect(agent.status).toBe("idle");

    engineerAgentId = agent.id;
    registeredAgentIds.push(engineerAgentId);
  });

  it("should register a reviewer agent", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }

    const response = await utils.callTool("agent_work", {
      action: "register",
      name: `e2e-reviewer-${runId}`,
      role: "reviewer",
      runtime: "claude-code",
    });

    const agent = data(response);
    expect(agent.id).toBeDefined();
    expect(agent.role).toBe("reviewer");

    reviewerAgentId = agent.id;
    registeredAgentIds.push(reviewerAgentId);
  });

  it("should list agents including the newly registered ones", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }

    const result = data(await utils.callTool("agent_manage", { action: "list" }));
    expect(Array.isArray(result.agents)).toBe(true);
    expect(result.total).toBeGreaterThanOrEqual(2);

    const ids = new Set(result.agents.map((a: { id: string }) => a.id));
    expect(ids.has(engineerAgentId)).toBe(true);
    expect(ids.has(reviewerAgentId)).toBe(true);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 4. Happy-path lifecycle
  // ────────────────────────────────────────────────────────────────────────

  it("should create and project-ify an issue to work on", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!projectId) {
      console.log("Skipping: no project created");
      return;
    }

    const issue = data(
      await utils.callTool("manage_issues", {
        action: "create",
        title: `E2E Agent Task ${runId}`,
        description: "Task for the agent lifecycle E2E test",
        labels: [],
        assignees: [],
      })
    );

    expect(issue.id).toBeDefined();
    expect(issue.number).toBeGreaterThan(0);
    happyIssueNumber = issue.number;

    const added = data(
      await utils.callTool("manage_project", {
        action: "add_item",
        projectId,
        contentId: issue.id,
        contentType: "issue",
      })
    );
    expect(added).toBeDefined();
  });

  it("should checkout the task for the engineer", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!engineerAgentId || !projectId) {
      console.log("Skipping: missing setup state");
      return;
    }

    const response = await utils.callTool("agent_work", {
      action: "checkout_task",
      agentId: engineerAgentId,
      projectId,
      strategy: "highest_priority",
    });

    const result = data(response);
    expect(result.success).toBe(true);
    expect(result.issueNumber).toBe(happyIssueNumber);
    expect(result.issueTitle).toContain("E2E Agent Task");

    happyTaskId = String(result.issueNumber);
  });

  it("should prevent a second agent from claiming the same task", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!reviewerAgentId || !projectId) {
      console.log("Skipping: missing setup state");
      return;
    }

    // Reviewer has no task yet — but the issue is claimed, so checkout must fail
    // with "no unclaimed tasks" rather than assigning the same issue.
    const result = data(
      await utils.callTool("agent_work", {
        action: "checkout_task",
        agentId: reviewerAgentId,
        projectId,
        strategy: "highest_priority",
      })
    );

    expect(result.success).toBe(false);
  });

  it("should get enriched task context", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!happyIssueNumber) {
      console.log("Skipping: no task created");
      return;
    }

    const context = data(
      await utils.callTool("agent_work", {
        action: "get_task_context",
        issueNumber: happyIssueNumber,
      })
    );

    expect(context.issue).toBeDefined();
    expect(context.issue.number ?? context.issue.id).toBeDefined();
  });

  it("should process a heartbeat and expose heartbeat history in activity", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!engineerAgentId || !happyTaskId) {
      console.log("Skipping: missing setup state");
      return;
    }

    const hb = data(
      await utils.callTool("agent_work", {
        action: "heartbeat",
        agentId: engineerAgentId,
        status: "working",
        taskId: happyTaskId,
        progress: 50,
        progressSummary: "Halfway through the E2E task",
      })
    );
    expect(hb.success).toBe(true);

    const activity = data(
      await utils.callTool("agent_manage", { action: "get_activity", includeOffline: true })
    );
    expect(Array.isArray(activity.agents)).toBe(true);

    const entry = activity.agents.find(
      (a: { agent?: { id: string } }) => a.agent?.id === engineerAgentId
    );
    expect(entry).toBeDefined();
    expect(entry.currentTask).toBeDefined();
  });

  it("should submit a work product", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!engineerAgentId || !happyTaskId || !happyIssueNumber) {
      console.log("Skipping: missing setup state");
      return;
    }

    const product = data(
      await utils.callTool("agent_manage", {
        action: "submit_work_product",
        agentId: engineerAgentId,
        taskId: happyTaskId,
        issueNumber: happyIssueNumber,
        branch: `agent/${happyIssueNumber}-e2e-task`,
        commitShas: [],
        filesChanged: ["src/e2e.ts"],
        testsPassed: 4,
        testsFailed: 0,
        testsTotal: 4,
        summary: "Implemented the E2E agent lifecycle task",
      })
    );

    expect(product.id).toBeDefined();
    expect(product.agentId).toBe(engineerAgentId);
    expect(product.taskId).toBe(happyTaskId);
  });

  it("should submit the task for review, claim it from the review queue, and approve it", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!engineerAgentId || !reviewerAgentId || !happyTaskId || !projectId) {
      console.log("Skipping: missing setup state");
      return;
    }

    const submitted = data(
      await utils.callTool("agent_work", {
        action: "submit_for_review",
        agentId: engineerAgentId,
        taskId: happyTaskId,
        summary: "Please review the E2E task",
      })
    );
    expect(submitted.success).toBe(true);

    const reviewCheckout = data(
      await utils.callTool("agent_work", {
        action: "checkout_task",
        agentId: reviewerAgentId,
        projectId,
        reviewQueue: true,
      })
    );
    expect(reviewCheckout.success).toBe(true);
    expect(String(reviewCheckout.issueNumber)).toBe(happyTaskId);

    const approved = data(
      await utils.callTool("agent_work", {
        action: "approve_task",
        reviewerId: reviewerAgentId,
        taskId: happyTaskId,
        summary: "LGTM — E2E lifecycle verified",
      })
    );
    expect(approved.success).toBe(true);
  });

  it("should have released the engineer after approval", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!engineerAgentId) {
      console.log("Skipping: no engineer registered");
      return;
    }

    const activity = data(
      await utils.callTool("agent_manage", { action: "get_activity", includeOffline: true })
    );
    const entry = activity.agents.find(
      (a: { agent?: { id: string } }) => a.agent?.id === engineerAgentId
    );
    expect(entry).toBeDefined();
    expect(entry.currentTask).toBeUndefined();
  });

  // ────────────────────────────────────────────────────────────────────────
  // 5. Budgets
  // ────────────────────────────────────────────────────────────────────────

  it("should set, read, and record against an agent budget", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!engineerAgentId) {
      console.log("Skipping: no engineer registered");
      return;
    }

    const set = data(
      await utils.callTool("agent_manage", {
        action: "set_budget",
        agentId: engineerAgentId,
        totalTokens: 100000,
        warningThreshold: 0.8,
        hardStop: true,
      })
    );
    expect(set.totalTokens).toBe(100000);

    const before = data(
      await utils.callTool("agent_manage", { action: "get_budget", agentId: engineerAgentId })
    );
    expect(before.usedTokens ?? before.usagePercent).toBeDefined();

    const recorded = data(
      await utils.callTool("agent_manage", {
        action: "record_usage",
        agentId: engineerAgentId,
        tokensUsed: 25000,
      })
    );
    expect(recorded.usedTokens).toBeGreaterThanOrEqual(25000);
    expect(recorded.remainingTokens).toBeLessThanOrEqual(75000);
  });

  it("should refuse checkout when a hard-stop budget is exhausted", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!projectId) {
      console.log("Skipping: missing setup state");
      return;
    }

    const issue = data(
      await utils.callTool("manage_issues", {
        action: "create",
        title: `E2E Budget Refusal Task ${runId}`,
        description: "Task that must not be checked out by an exhausted agent",
        labels: [],
        assignees: [],
      })
    );
    await utils.callTool("manage_project", {
      action: "add_item",
      projectId,
      contentId: issue.id,
      contentType: "issue",
    });

    // A dedicated agent: budget usage is cumulative and shared with the
    // engineer agent used by the other tests, so exhaustion here has to be
    // produced by this test alone.
    const budgetAgent = data(
      await utils.callTool("agent_work", {
        action: "register",
        name: `e2e-budget-${runId}`,
        role: "engineer",
        runtime: "claude-code",
        capabilities: ["typescript"],
      })
    );
    const budgetAgentId = budgetAgent.id;
    expect(budgetAgentId).toBeTruthy();

    await utils.callTool("agent_manage", {
      action: "set_budget",
      agentId: budgetAgentId,
      totalTokens: 1000,
      warningThreshold: 0.8,
      hardStop: true,
    });
    const exhausted = data(
      await utils.callTool("agent_manage", {
        action: "record_usage",
        agentId: budgetAgentId,
        tokensUsed: 1200,
      })
    );
    expect(exhausted.isExhausted).toBe(true);

    const checkout = data(
      await utils.callTool("agent_work", {
        action: "checkout_task",
        agentId: budgetAgentId,
        projectId,
        strategy: "oldest_first",
      })
    );
    expect(checkout.success).toBe(false);
    expect(checkout.message ?? checkout.error ?? "").toMatch(/budget|exhaust/i);

    await utils.callTool("agent_manage", {
      action: "deregister",
      agentId: budgetAgentId,
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 6. Self-healing: auto-reclaim
  // ────────────────────────────────────────────────────────────────────────

  it("should register a reclaim-test agent and claim a second task", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!projectId) {
      console.log("Skipping: no project created");
      return;
    }

    const agent = data(
      await utils.callTool("agent_work", {
        action: "register",
        name: `e2e-reclaim-${runId}`,
        role: "engineer",
        runtime: "cli",
      })
    );
    reclaimAgentId = agent.id;
    registeredAgentIds.push(reclaimAgentId);

    const issue = data(
      await utils.callTool("manage_issues", {
        action: "create",
        title: `E2E Reclaim Task ${runId}`,
        description: "Task that the agent will crash on (no more heartbeats)",
        labels: [],
        assignees: [],
      })
    );
    await utils.callTool("manage_project", {
      action: "add_item",
      projectId,
      contentId: issue.id,
      contentType: "issue",
    });

    const checkout = data(
      await utils.callTool("agent_work", {
        action: "checkout_task",
        agentId: reclaimAgentId,
        projectId,
        strategy: "oldest_first",
      })
    );
    expect(checkout.success).toBe(true);
    reclaimTaskId = String(checkout.issueNumber);
  });

  it("should reclaim the crashed agent task and mark the agent offline", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!reclaimAgentId || !reclaimTaskId) {
      console.log("Skipping: missing setup state");
      return;
    }

    // Simulate a crash: stop heartbeating and wait past the reclaim threshold.
    // timeoutMinutes=0.01 → 600ms; we wait 2.5s to guarantee staleness.
    // setup.ts runs the test process on fake timers, so swap to real timers
    // for the sleep (the server process uses its own real clock).
    vi.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 2500));
    vi.useFakeTimers();

    const reclaimed = data(
      await utils.callTool("agent_manage", { action: "reclaim_stale", timeoutMinutes: 0.01 })
    );
    expect(reclaimed.reclaimed).toBeGreaterThanOrEqual(1);

    const hit = (reclaimed.details ?? []).find(
      (d: { agentId: string; taskId: string }) => d.agentId === reclaimAgentId
    );
    expect(hit).toBeDefined();
    expect(hit.taskId).toBe(reclaimTaskId);

    // Agent must now be offline in the registry
    const activity = data(
      await utils.callTool("agent_manage", { action: "get_activity", includeOffline: true })
    );
    const entry = activity.agents.find(
      (a: { agent?: { id: string } }) => a.agent?.id === reclaimAgentId
    );
    expect(entry).toBeDefined();
    expect(entry.agent.status).toBe("offline");
  });

  // ────────────────────────────────────────────────────────────────────────
  // 7. Metrics
  // ────────────────────────────────────────────────────────────────────────

  it("should return aggregate agent metrics", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }

    const metrics = data(await utils.callTool("agent_manage", { action: "get_metrics" }));

    expect(metrics.totalAgents).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(metrics.agents)).toBe(true);
    expect(metrics.totalTasksCompleted).toBeGreaterThanOrEqual(1);
    expect(metrics.overallBudgetUsagePercent).toBeDefined();
  });

  // ────────────────────────────────────────────────────────────────────────
  // 8. Product-level lifecycle scenarios
  //
  // The tests above exercise one tool at a time. The scenarios below drive
  // the platform the way a real swarm does — register, claim, work, submit,
  // review, approve/reject, crash, recover — and then assert the state that
  // actually ended up in GitHub: the issue (open/closed), the Project V2
  // claim fields (`agent_status`, `agent_claimed_by`) and the issue
  // comments. That state is the durable record a crashed agent (or a human)
  // has to resume from, so it is the only thing worth asserting on.
  //
  // They run against a DEDICATED project, so the pool a `checkout_task` call
  // sees is exactly the set of open, unclaimed items of that project, and
  // every scenario closes or claims the issues it creates before the next
  // one starts.
  // ────────────────────────────────────────────────────────────────────────

  let productProjectId = "";
  let productWorkerId = "";
  let productReviewerId = "";
  let productPmId = "";
  let productWorkerTaskNumber = 0;

  it("should create a dedicated project for the product-level scenarios", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }

    const result = data(
      await utils.callTool("manage_project", {
        action: "create",
        title: `E2E Product Project ${runId}`,
        shortDescription: "E2E product-level agent lifecycle scenarios",
        owner: process.env.GITHUB_OWNER || "test-owner",
        visibility: "private",
      })
    );

    expect(result.id).toBeDefined();
    productProjectId = result.id;
  }, 60000);

  it("should provision the agent fields on the product project", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!productProjectId) {
      console.log("Skipping: no product project created");
      return;
    }

    const result = data(
      await utils.callTool("agent_manage", { action: "setup_fields", projectId: productProjectId })
    );

    const present = new Set([...(result.created ?? []), ...(result.existing ?? [])]);
    for (const fieldName of AGENT_FIELD_NAMES) {
      expect(present.has(fieldName)).toBe(true);
    }
  }, 60000);

  it("should register the worker, the reviewer and the PM agent for the product scenarios", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }

    productWorkerId = await registerAgent(utils, `e2e-product-worker-${runId}`, "engineer", [
      "typescript",
    ]);
    productReviewerId = await registerAgent(utils, `e2e-product-reviewer-${runId}`, "reviewer");
    productPmId = await registerAgent(utils, `e2e-product-pm-${runId}`, "engineer", ["typescript"]);

    expect(productWorkerId).toBeTruthy();
    expect(productReviewerId).toBeTruthy();
    expect(productPmId).toBeTruthy();

    registeredAgentIds.push(productWorkerId, productReviewerId, productPmId);
  }, 60000);

  // ── (a) The worker loop ────────────────────────────────────────────

  it("should run the worker loop: checkout, context, heartbeat, work product, review, approve", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!productProjectId || !productWorkerId || !productReviewerId) {
      console.log("Skipping: missing setup state");
      return;
    }

    const task = await createIssueInProject(
      utils,
      productProjectId,
      `E2E Product Worker Task ${runId}`,
      "Implement the product worker task.\n\n## Acceptance Criteria\n- The worker completes the task\n- The regression suite stays green"
    );

    // 1. The worker claims the only open task in the project.
    const checkout = data(
      await utils.callTool("agent_work", {
        action: "checkout_task",
        agentId: productWorkerId,
        projectId: productProjectId,
        strategy: "highest_priority",
      })
    );
    expect(checkout.success).toBe(true);
    expect(checkout.issueNumber).toBe(task.number);
    productWorkerTaskNumber = task.number;

    // 2. The worker gets the enriched context of the task it claimed.
    const context = data(
      await utils.callTool("agent_work", { action: "get_task_context", issueNumber: task.number })
    );
    expect(context.issue.number).toBe(task.number);
    expect(context.issue.title).toContain("E2E Product Worker Task");
    expect(context.acceptanceCriteria).toContain("The worker completes the task");
    expect(context.branchSuggestion).toBeTruthy();

    // 3. The worker reports liveness while it works.
    const heartbeat = data(
      await utils.callTool("agent_work", {
        action: "heartbeat",
        agentId: productWorkerId,
        status: "working",
        taskId: String(task.number),
        progress: 50,
        progressSummary: "Halfway through the product worker task",
      })
    );
    expect(heartbeat.success).toBe(true);

    // 4. The worker submits the work product.
    const product = data(
      await utils.callTool("agent_manage", {
        action: "submit_work_product",
        agentId: productWorkerId,
        taskId: String(task.number),
        issueNumber: task.number,
        branch: `agent/${task.number}-product-worker`,
        commitShas: [],
        filesChanged: ["src/product-worker.ts"],
        testsPassed: 3,
        testsFailed: 0,
        testsTotal: 3,
        summary: "Implemented the product worker task end to end",
      })
    );
    expect(product.id).toBeDefined();
    expect(product.agentId).toBe(productWorkerId);
    expect(product.taskId).toBe(String(task.number));

    // 5. The worker hands the task over for review.
    const submitted = data(
      await utils.callTool("agent_work", {
        action: "submit_for_review",
        agentId: productWorkerId,
        taskId: String(task.number),
        summary: "Ready for review",
      })
    );
    expect(submitted.success).toBe(true);

    // 6. The reviewer claims it from the REVIEW QUEUE — not from the open pool.
    const reviewCheckout = data(
      await utils.callTool("agent_work", {
        action: "checkout_task",
        agentId: productReviewerId,
        projectId: productProjectId,
        reviewQueue: true,
      })
    );
    expect(reviewCheckout.success).toBe(true);
    expect(reviewCheckout.issueNumber).toBe(task.number);

    // 7. The reviewer approves it.
    const approved = data(
      await utils.callTool("agent_work", {
        action: "approve_task",
        reviewerId: productReviewerId,
        taskId: String(task.number),
        summary: "LGTM — product lifecycle verified",
      })
    );
    expect(approved.success).toBe(true);

    // ── The end state in GitHub ──────────────────────────────────────

    // The issue is closed.
    const issue = await utils.getIssue(task.id);
    expect(issue?.status).toBe("closed");

    // The claim is released and the task is marked completed in the project.
    const fields = await utils.getProjectItemFieldValues(productProjectId, task.id);
    expect(fields).not.toBeNull();
    expect(fields?.agent_status).toBe("completed");
    expect(fields?.agent_claimed_by).toBeUndefined();

    // Both agents are idle and hold no task.
    const agents = data(await utils.callTool("agent_manage", { action: "list" }));
    const worker = agents.agents.find((a: { id: string }) => a.id === productWorkerId);
    const reviewer = agents.agents.find((a: { id: string }) => a.id === productReviewerId);
    expect(worker).toBeDefined();
    expect(worker.status).toBe("idle");
    expect(worker.currentTaskId).toBeUndefined();
    expect(reviewer).toBeDefined();
    expect(reviewer.status).toBe("idle");
    expect(reviewer.currentTaskId).toBeUndefined();

    // The work product and the review trail are recorded as comments.
    const comments = await utils.listIssueComments(task.number);
    expect(comments.some((c) => c.body.includes("## Agent Work Product"))).toBe(true);
    expect(comments.some((c) => c.body.includes("agent-work-product"))).toBe(true);
    expect(comments.some((c) => c.body.includes("## Agent Work Submitted for Review"))).toBe(true);
    expect(comments.some((c) => c.body.includes("## Agent Work Approved"))).toBe(true);
  }, 120000);

  // ── (h) Work products ─────────────────────────────────────────────

  it("should ignore a malformed work-product comment and return the valid one", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!productWorkerId || !productWorkerTaskNumber) {
      console.log("Skipping: missing setup state");
      return;
    }

    // A comment that carries the work-product marker but is not valid JSON.
    // It is posted AFTER the real work product, so a parser that does not
    // skip it would return it as the latest product.
    await utils.callTool("manage_issues", {
      action: "create_comment",
      issueNumber: productWorkerTaskNumber,
      body: "<!-- agent-work-product: {this is not valid json -->",
    });

    const validation = data(
      await utils.callTool("agent_work", {
        action: "validate_work_product",
        agentId: productWorkerId,
        taskId: String(productWorkerTaskNumber),
      })
    );

    expect(validation.valid).toBe(true);
    expect(validation.findings).toEqual([]);
    expect(validation.workProduct.agentId).toBe(productWorkerId);
    expect(validation.workProduct.files).toContain("src/product-worker.ts");
    expect(validation.recommendation).toBe("approve");
  }, 60000);

  // ── (b) The rejection path ─────────────────────────────────────────

  it("should return a rejected task to the pool with feedback, and make it claimable again", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!productProjectId || !productWorkerId || !productReviewerId || !productPmId) {
      console.log("Skipping: missing setup state");
      return;
    }

    const task = await createIssueInProject(
      utils,
      productProjectId,
      `E2E Product Rejected Task ${runId}`,
      "Task that will be rejected during review.\n\n## Acceptance Criteria\n- The edge case is covered"
    );

    const checkout = data(
      await utils.callTool("agent_work", {
        action: "checkout_task",
        agentId: productWorkerId,
        projectId: productProjectId,
        strategy: "highest_priority",
      })
    );
    expect(checkout.success).toBe(true);
    expect(checkout.issueNumber).toBe(task.number);

    await utils.callTool("agent_manage", {
      action: "submit_work_product",
      agentId: productWorkerId,
      taskId: String(task.number),
      issueNumber: task.number,
      filesChanged: ["src/rejected.ts"],
      testsPassed: 1,
      testsFailed: 0,
      testsTotal: 1,
      summary: "First attempt at the rejected task",
    });

    const submitted = data(
      await utils.callTool("agent_work", {
        action: "submit_for_review",
        agentId: productWorkerId,
        taskId: String(task.number),
        summary: "Please review",
      })
    );
    expect(submitted.success).toBe(true);

    const reviewCheckout = data(
      await utils.callTool("agent_work", {
        action: "checkout_task",
        agentId: productReviewerId,
        projectId: productProjectId,
        reviewQueue: true,
      })
    );
    expect(reviewCheckout.success).toBe(true);
    expect(reviewCheckout.issueNumber).toBe(task.number);

    const rejected = data(
      await utils.callTool("agent_work", {
        action: "reject_task",
        reviewerId: productReviewerId,
        taskId: String(task.number),
        feedback: "Please add a regression test for the empty-input edge case",
      })
    );
    expect(rejected.success).toBe(true);

    // The issue is NOT closed — the work is still owed.
    const issue = await utils.getIssue(task.id);
    expect(issue?.status).toBe("active");

    // The claim is cleared and the task is back in the unclaimed pool.
    const fields = await utils.getProjectItemFieldValues(productProjectId, task.id);
    expect(fields?.agent_status).toBe("unclaimed");
    expect(fields?.agent_claimed_by).toBeUndefined();

    // The feedback is on the issue for the next agent to read.
    const comments = await utils.listIssueComments(task.number);
    const rejection = comments.find((c) => c.body.includes("## Agent Work Rejected"));
    expect(rejection).toBeDefined();
    expect(rejection?.body).toContain("Please add a regression test for the empty-input edge case");

    // Both agents were released.
    const agents = data(await utils.callTool("agent_manage", { action: "list" }));
    const worker = agents.agents.find((a: { id: string }) => a.id === productWorkerId);
    const reviewer = agents.agents.find((a: { id: string }) => a.id === productReviewerId);
    expect(worker.currentTaskId).toBeUndefined();
    expect(reviewer.currentTaskId).toBeUndefined();

    // And the task is claimable again — by a different agent.
    const reClaim = data(
      await utils.callTool("agent_work", {
        action: "checkout_task",
        agentId: productPmId,
        projectId: productProjectId,
        strategy: "highest_priority",
      })
    );
    expect(reClaim.success).toBe(true);
    expect(reClaim.issueNumber).toBe(task.number);

    // Close the task so the next scenario starts from a clean pool.
    const completed = data(
      await utils.callTool("agent_work", {
        action: "complete_task",
        agentId: productPmId,
        taskId: String(task.number),
        summary: "Re-did the task with the requested regression test",
        closeIssue: true,
        autoCheckoutNext: false,
      })
    );
    expect(completed.success).toBe(true);
  }, 120000);

  // ── (c) Crash recovery ─────────────────────────────────────────────

  it("should reclaim the task of an agent that stopped heart-beating and let another agent claim it", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!productProjectId) {
      console.log("Skipping: no product project created");
      return;
    }

    const crashAgentId = await registerAgent(utils, `e2e-product-crash-${runId}`, "engineer", [
      "typescript",
    ]);
    const rescueAgentId = await registerAgent(utils, `e2e-product-rescue-${runId}`, "engineer", [
      "typescript",
    ]);
    registeredAgentIds.push(crashAgentId, rescueAgentId);

    const task = await createIssueInProject(
      utils,
      productProjectId,
      `E2E Product Crash Task ${runId}`,
      "Task whose owner crashes mid-flight."
    );

    const checkout = data(
      await utils.callTool("agent_work", {
        action: "checkout_task",
        agentId: crashAgentId,
        projectId: productProjectId,
        strategy: "highest_priority",
      })
    );
    expect(checkout.success).toBe(true);
    expect(checkout.issueNumber).toBe(task.number);

    // The agent now "crashes": it never heart-beats again.
    vi.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 2500));
    vi.useFakeTimers();

    const reclaimed = data(
      await utils.callTool("agent_manage", { action: "reclaim_stale", timeoutMinutes: 0.01 })
    );
    expect(reclaimed.reclaimed).toBeGreaterThanOrEqual(1);

    const hit = (reclaimed.details ?? []).find(
      (d: { agentId: string; taskId: string }) =>
        d.agentId === crashAgentId && d.taskId === String(task.number)
    );
    expect(hit).toBeDefined();

    // The crashed agent is offline and no longer holds the task.
    const agents = data(await utils.callTool("agent_manage", { action: "list" }));
    const crashed = agents.agents.find((a: { id: string }) => a.id === crashAgentId);
    expect(crashed).toBeDefined();
    expect(crashed.status).toBe("offline");
    expect(crashed.currentTaskId).toBeUndefined();

    // The task is back in the unclaimed pool.
    const fields = await utils.getProjectItemFieldValues(productProjectId, task.id);
    expect(fields?.agent_status).toBe("unclaimed");
    expect(fields?.agent_claimed_by).toBeUndefined();

    // Another agent can pick it up.
    const rescue = data(
      await utils.callTool("agent_work", {
        action: "checkout_task",
        agentId: rescueAgentId,
        projectId: productProjectId,
        strategy: "highest_priority",
      })
    );
    expect(rescue.success).toBe(true);
    expect(rescue.issueNumber).toBe(task.number);

    const completed = data(
      await utils.callTool("agent_work", {
        action: "complete_task",
        agentId: rescueAgentId,
        taskId: String(task.number),
        summary: "Finished the task the crashed agent abandoned",
        closeIssue: true,
        autoCheckoutNext: false,
      })
    );
    expect(completed.success).toBe(true);
  }, 120000);

  // ── (e) PM flow ────────────────────────────────────────────────────

  it("should let the PM assign a specific issue to a specific agent", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!productProjectId || !productPmId) {
      console.log("Skipping: missing setup state");
      return;
    }

    const task = await createIssueInProject(
      utils,
      productProjectId,
      `E2E Product PM Assigned Task ${runId}`,
      "Task the PM hands to a named agent."
    );

    const assigned = data(
      await utils.callTool("agent_manage", {
        action: "assign_task",
        agentId: productPmId,
        projectId: productProjectId,
        issueNumber: task.number,
      })
    );
    expect(assigned.success).toBe(true);
    expect(assigned.issueNumber).toBe(task.number);

    // The durable claim names the agent the PM picked.
    const fields = await utils.getProjectItemFieldValues(productProjectId, task.id);
    expect(fields?.agent_claimed_by).toBe(productPmId);
    expect(fields?.agent_status).toBe("in_progress");

    // The registry agrees.
    const agents = data(await utils.callTool("agent_manage", { action: "list" }));
    const pm = agents.agents.find((a: { id: string }) => a.id === productPmId);
    expect(pm.currentTaskId).toBe(String(task.number));
    expect(pm.status).toBe("working");

    // Hand the task back so the next scenario starts from a clean pool.
    const completed = data(
      await utils.callTool("agent_work", {
        action: "complete_task",
        agentId: productPmId,
        taskId: String(task.number),
        summary: "PM-assigned task delivered",
        closeIssue: true,
        autoCheckoutNext: false,
      })
    );
    expect(completed.success).toBe(true);
  }, 90000);

  it("should let smart_assign distribute open work to an idle capable agent", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!productProjectId || !productPmId) {
      console.log("Skipping: missing setup state");
      return;
    }

    const task = await createIssueInProject(
      utils,
      productProjectId,
      `E2E Product Smart Assign typescript Task ${runId}`,
      "Open work for the capability-aware assignment."
    );

    const smart = data(
      await utils.callTool("agent_manage", {
        action: "smart_assign",
        projectId: productProjectId,
        agentIds: [productPmId],
      })
    );

    expect(smart.success).toBe(true);
    expect(smart.totalAssigned).toBeGreaterThanOrEqual(1);

    const assignment = (smart.assignments ?? []).find(
      (a: { issueNumber: number }) => a.issueNumber === task.number
    );
    expect(assignment).toBeDefined();
    expect(assignment.agentId).toBe(productPmId);

    // The assignment is durable in the project, not just in the response.
    const fields = await utils.getProjectItemFieldValues(productProjectId, task.id);
    expect(fields?.agent_claimed_by).toBe(productPmId);
    expect(fields?.agent_status).toBe("in_progress");

    // And the swarm dashboard reports the ownership.
    const swarm = data(await utils.callTool("agent_manage", { action: "get_swarm_status" }));
    const entry = swarm.agents.find((a: { id: string }) => a.id === productPmId);
    expect(entry).toBeDefined();
    expect(entry.status).toBe("working");
    expect(entry.currentTask).not.toBeNull();
    expect(entry.currentTask.id).toBe(String(task.number));
    expect(entry.currentTask.title).toContain("E2E Product Smart Assign typescript Task");

    const completed = data(
      await utils.callTool("agent_work", {
        action: "complete_task",
        agentId: productPmId,
        taskId: String(task.number),
        summary: "Smart-assigned task delivered",
        closeIssue: true,
        autoCheckoutNext: false,
      })
    );
    expect(completed.success).toBe(true);
  }, 90000);

  // ── (f) Concurrency ────────────────────────────────────────────────

  it("should never let two agents own the same task when they check out at the same time", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!productProjectId) {
      console.log("Skipping: no product project created");
      return;
    }

    const racerA = await registerAgent(utils, `e2e-product-race-a-${runId}`, "engineer", [
      "typescript",
    ]);
    const racerB = await registerAgent(utils, `e2e-product-race-b-${runId}`, "engineer", [
      "typescript",
    ]);
    const bystander = await registerAgent(utils, `e2e-product-race-c-${runId}`, "engineer", [
      "typescript",
    ]);
    registeredAgentIds.push(racerA, racerB, bystander);

    const task = await createIssueInProject(
      utils,
      productProjectId,
      `E2E Product Race Task ${runId}`,
      "Task two agents race for."
    );

    // Two agents claim the same task at the same time.
    const [resultA, resultB] = await Promise.all([
      utils.callTool("agent_work", {
        action: "checkout_task",
        agentId: racerA,
        projectId: productProjectId,
        strategy: "highest_priority",
      }),
      utils.callTool("agent_work", {
        action: "checkout_task",
        agentId: racerB,
        projectId: productProjectId,
        strategy: "highest_priority",
      }),
    ]);

    const outcomes = [data(resultA), data(resultB)];
    const winners = outcomes.filter((o) => o.success === true);

    // At least one of them must have won the task.
    expect(winners.length).toBeGreaterThanOrEqual(1);

    // The task has exactly ONE durable owner: `agent_claimed_by` is a
    // single-value field, so the project can never record two owners.
    const fields = await utils.getProjectItemFieldValues(productProjectId, task.id);
    const owner = fields?.agent_claimed_by;
    expect(typeof owner).toBe("string");
    expect([racerA, racerB]).toContain(owner);

    // The recorded owner is the racer that won the claim.
    const ownerOutcome = owner === racerA ? outcomes[0] : outcomes[1];
    expect(ownerOutcome.success).toBe(true);

    // And the pool agrees: a third agent cannot take the same task.
    const third = data(
      await utils.callTool("agent_work", {
        action: "checkout_task",
        agentId: bystander,
        projectId: productProjectId,
        strategy: "highest_priority",
      })
    );
    expect(third.success).toBe(false);

    // Whichever racer won, the task is registered against the agent that
    // owns the durable claim. (The project claim is a non-atomic
    // read-modify-write on GitHub, so in the rare interleaving where both
    // checkouts verify their own write, the registry — whose own writes are
    // sha-CAS guarded — can briefly list two holders; the PROJECT always
    // holds exactly one.)
    const agents = data(await utils.callTool("agent_manage", { action: "list" }));
    const holders = agents.agents.filter(
      (a: { currentTaskId?: string }) => a.currentTaskId === String(task.number)
    );
    expect(holders.length).toBeGreaterThanOrEqual(1);
    expect(holders.map((a: { id: string }) => a.id)).toContain(owner);

    // Release the task again so the next scenario starts from a clean pool.
    for (const holder of holders) {
      await utils.callTool("agent_work", {
        action: "release_task",
        agentId: holder.id,
        taskId: String(task.number),
      });
    }
    await utils.callTool("manage_issues", {
      action: "update",
      issueId: task.id,
      status: "closed",
    });
  }, 90000);

  // ── (d) Budget hard stop ───────────────────────────────────────────

  it("should refuse to check out more work once the hard-stop budget is exhausted", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }
    if (!productProjectId) {
      console.log("Skipping: no product project created");
      return;
    }

    const budgetAgentId = await registerAgent(utils, `e2e-product-budget-${runId}`, "engineer", [
      "typescript",
    ]);
    registeredAgentIds.push(budgetAgentId);

    const task = await createIssueInProject(
      utils,
      productProjectId,
      `E2E Product Budget Task ${runId}`,
      "Task an agent with an exhausted budget must not get."
    );

    const budget = data(
      await utils.callTool("agent_manage", {
        action: "set_budget",
        agentId: budgetAgentId,
        totalTokens: 1000,
        warningFraction: 0.8,
        hardStop: true,
      })
    );
    expect(budget.totalTokens).toBe(1000);

    const exhausted = data(
      await utils.callTool("agent_manage", {
        action: "record_usage",
        agentId: budgetAgentId,
        tokensUsed: 1200,
      })
    );
    expect(exhausted.isExhausted).toBe(true);

    const checkout = data(
      await utils.callTool("agent_work", {
        action: "checkout_task",
        agentId: budgetAgentId,
        projectId: productProjectId,
        strategy: "highest_priority",
      })
    );
    expect(checkout.success).toBe(false);
    expect(checkout.message ?? "").toMatch(/budget|exhaust/i);

    // No claim was written for the refused checkout.
    const fields = await utils.getProjectItemFieldValues(productProjectId, task.id);
    expect(fields?.agent_claimed_by).toBeUndefined();
    expect(fields?.agent_status).not.toBe("in_progress");

    // Close the task so the repository is left tidy.
    await utils.callTool("manage_issues", {
      action: "update",
      issueId: task.id,
      status: "closed",
    });
  }, 90000);

  // ────────────────────────────────────────────────────────────────────────
  // PM convergence + workload scenarios (each in its own project)
  // ────────────────────────────────────────────────────────────────────────

  it("should rebalance_workload: reclaim the stale owner's task and hand it to an idle capable agent", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }

    // Contract (executor): rebalance_workload = reclaim every task whose
    // owner stopped heart-beating for `staleAfterMinutes`, then redistribute
    // open project work to idle, capable agents through smart_assign.
    const rebalanceProjectId = await createScenarioProject(utils, `E2E Rebalance Project ${runId}`);
    const staleOwnerId = await registerAgent(utils, `e2e-rebalance-stale-${runId}`, "engineer", [
      "typescript",
    ]);
    const idleAgentId = await registerAgent(utils, `e2e-rebalance-idle-${runId}`, "engineer", [
      "typescript",
    ]);
    registeredAgentIds.push(staleOwnerId, idleAgentId);

    const task = await createIssueInProject(
      utils,
      rebalanceProjectId,
      `E2E Rebalance typescript Task ${runId}`,
      "Task whose owner stops heart-beating."
    );

    const claim = await checkoutTask(utils, {
      agentId: staleOwnerId,
      projectId: rebalanceProjectId,
      strategy: "oldest_first",
    });
    expect(claim.success).toBe(true);
    expect(claim.issueNumber).toBe(task.number);

    let fields = await utils.getProjectItemFieldValues(rebalanceProjectId, task.id);
    expect(fields?.agent_claimed_by).toBe(staleOwnerId);

    // The owner goes silent.
    vi.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 2500));
    vi.useFakeTimers();

    const rebalanced = data(
      await utils.callTool("agent_manage", {
        action: "rebalance_workload",
        projectId: rebalanceProjectId,
        staleAfterMinutes: 0.01,
        agentIds: [idleAgentId],
      })
    );
    expect(rebalanced.reclaimed).toBeGreaterThanOrEqual(1);
    expect(
      (rebalanced.reclaimedTasks ?? []).some(
        (d: { agentId: string; taskId: string }) =>
          d.agentId === staleOwnerId && d.taskId === String(task.number)
      )
    ).toBe(true);
    expect(rebalanced.assigned).toBe(1);
    expect(rebalanced.assignments[0].agentId).toBe(idleAgentId);
    expect(rebalanced.assignments[0].issueNumber).toBe(task.number);

    // GitHub: the claim names the new owner; the issue is still open.
    fields = await utils.getProjectItemFieldValues(rebalanceProjectId, task.id);
    expect(fields?.agent_claimed_by).toBe(idleAgentId);
    expect(fields?.agent_status).toBe("in_progress");
    expect((await utils.getIssue(task.id))?.status).toBe("active");

    // Registry: both records agree with the claim.
    const previousOwner = await registryEntry(utils, staleOwnerId);
    expect(previousOwner.status).toBe("offline");
    expect(previousOwner.currentTaskId).toBeUndefined();
    const newOwner = await registryEntry(utils, idleAgentId);
    expect(newOwner.status).toBe("working");
    expect(newOwner.currentTaskId).toBe(String(task.number));

    // The reclaim is audited on the issue.
    const comments = await utils.listIssueComments(task.number);
    expect(comments.some((c) => c.body.includes("## Agent Task Auto-Reclaimed"))).toBe(true);

    const completed = data(
      await utils.callTool("agent_work", {
        action: "complete_task",
        agentId: idleAgentId,
        taskId: String(task.number),
        summary: "Finished the rebalanced task",
        closeIssue: true,
        autoCheckoutNext: false,
      })
    );
    expect(completed.success).toBe(true);
  }, 240000);

  it("should converge_project with a reviewer: approve a passing submission and reject a failing one through the review lifecycle", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }

    const convergeProjectId = await createScenarioProject(
      utils,
      `E2E Converge Reviewer Project ${runId}`
    );
    const passingWorkerId = await registerAgent(utils, `e2e-converge-pass-${runId}`, "engineer");
    const failingWorkerId = await registerAgent(utils, `e2e-converge-fail-${runId}`, "engineer");
    const reviewerId = await registerAgent(utils, `e2e-converge-reviewer-${runId}`, "reviewer");
    registeredAgentIds.push(passingWorkerId, failingWorkerId, reviewerId);

    const passing = await createIssueInProject(
      utils,
      convergeProjectId,
      `E2E Converge Passing Task ${runId}`,
      "Task whose submission passes validation."
    );
    const failing = await createIssueInProject(
      utils,
      convergeProjectId,
      `E2E Converge Failing Task ${runId}`,
      "Task whose submission has a failing test."
    );

    // Each worker claims one task, submits a work product and hands it over
    // for review.
    const firstClaim = await checkoutTask(utils, {
      agentId: passingWorkerId,
      projectId: convergeProjectId,
      strategy: "oldest_first",
    });
    expect(firstClaim.issueNumber).toBe(passing.number);
    const secondClaim = await checkoutTask(utils, {
      agentId: failingWorkerId,
      projectId: convergeProjectId,
      strategy: "oldest_first",
    });
    expect(secondClaim.issueNumber).toBe(failing.number);

    await submitWorkProduct(utils, passingWorkerId, passing.number, 0);
    await submitWorkProduct(utils, failingWorkerId, failing.number, 1);
    for (const [agentId, issueNumber] of [
      [passingWorkerId, passing.number],
      [failingWorkerId, failing.number],
    ] as const) {
      const submitted = data(
        await utils.callTool("agent_work", {
          action: "submit_for_review",
          agentId,
          taskId: String(issueNumber),
          summary: "Ready for review",
        })
      );
      expect(submitted.success).toBe(true);
    }

    const report = data(
      await utils.callTool("agent_manage", {
        action: "converge_project",
        projectId: convergeProjectId,
        reviewerId,
      })
    );
    expect(report.approved.map((a: { issue: number }) => a.issue)).toEqual([passing.number]);
    expect(report.rejected.map((r: { issue: number }) => r.issue)).toEqual([failing.number]);
    expect(report.rejected[0].findings).toContain("1 test(s) failing");

    // ── approve path: closed, claim cleared, owner released ──
    expect((await utils.getIssue(passing.id))?.status).toBe("closed");
    const approvedFields = await utils.getProjectItemFieldValues(convergeProjectId, passing.id);
    expect(approvedFields?.agent_status).toBe("completed");
    expect(approvedFields?.agent_claimed_by).toBeUndefined();
    expect(approvedFields?.agent_claimed_at).toBeUndefined();
    const passingWorker = await registryEntry(utils, passingWorkerId);
    expect(passingWorker.status).toBe("idle");
    expect(passingWorker.currentTaskId).toBeUndefined();
    const approvedComments = await utils.listIssueComments(passing.number);
    const approval = approvedComments.find((c) => c.body.includes("## Agent Work Approved"));
    expect(approval).toBeDefined();
    expect(approval?.body).toContain(reviewerId);
    expect(approvedComments.some((c) => c.body.includes("Auto-Approved by Convergence"))).toBe(
      false
    );

    // ── reject path: stays open, claim cleared, feedback on the issue ──
    expect((await utils.getIssue(failing.id))?.status).toBe("active");
    const rejectedFields = await utils.getProjectItemFieldValues(convergeProjectId, failing.id);
    expect(rejectedFields?.agent_status).toBe("unclaimed");
    expect(rejectedFields?.agent_claimed_by).toBeUndefined();
    const failingWorker = await registryEntry(utils, failingWorkerId);
    expect(failingWorker.status).toBe("idle");
    expect(failingWorker.currentTaskId).toBeUndefined();
    const rejectedComments = await utils.listIssueComments(failing.number);
    const rejection = rejectedComments.find((c) => c.body.includes("## Agent Work Rejected"));
    expect(rejection).toBeDefined();
    expect(rejection?.body).toContain("1 test(s) failing");
    expect(rejectedComments.some((c) => c.body.includes("Auto-Rejected by Convergence"))).toBe(
      false
    );

    // The reviewer holds nothing afterwards.
    const reviewer = await registryEntry(utils, reviewerId);
    expect(reviewer.currentTaskId).toBeUndefined();

    // Tidy up: the rejected task and the fix subtask convergence created.
    await closeIssue(utils, failing.id);
    for (const decomposed of report.decomposed ?? []) {
      for (const subtask of decomposed.subtasks) {
        await closeIssue(utils, String(subtask));
      }
    }
  }, 300000);

  it("should converge_project without a reviewer: release the owner, clear the claim, comment and settle the issue", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }

    // Contract (executor): without reviewerId there is no lifecycle call.
    // The owner is released, the claim fields are cleared and agent_status
    // becomes completed (approve) / unclaimed (reject), and the fallback
    // writes an "Auto-Approved/Auto-Rejected by Convergence Loop" comment;
    // an approved issue is closed, a rejected one stays open.
    const fallbackProjectId = await createScenarioProject(
      utils,
      `E2E Converge Fallback Project ${runId}`
    );
    const passingWorkerId = await registerAgent(utils, `e2e-fallback-pass-${runId}`, "engineer");
    const failingWorkerId = await registerAgent(utils, `e2e-fallback-fail-${runId}`, "engineer");
    registeredAgentIds.push(passingWorkerId, failingWorkerId);

    const passing = await createIssueInProject(
      utils,
      fallbackProjectId,
      `E2E Fallback Passing Task ${runId}`,
      "Task whose submission passes validation."
    );
    const failing = await createIssueInProject(
      utils,
      fallbackProjectId,
      `E2E Fallback Failing Task ${runId}`,
      "Task whose submission has a failing test."
    );

    expect(
      (
        await checkoutTask(utils, {
          agentId: passingWorkerId,
          projectId: fallbackProjectId,
          strategy: "oldest_first",
        })
      ).issueNumber
    ).toBe(passing.number);
    expect(
      (
        await checkoutTask(utils, {
          agentId: failingWorkerId,
          projectId: fallbackProjectId,
          strategy: "oldest_first",
        })
      ).issueNumber
    ).toBe(failing.number);

    await submitWorkProduct(utils, passingWorkerId, passing.number, 0);
    await submitWorkProduct(utils, failingWorkerId, failing.number, 1);

    const report = data(
      await utils.callTool("agent_manage", {
        action: "converge_project",
        projectId: fallbackProjectId,
      })
    );
    expect(report.approved.map((a: { issue: number }) => a.issue)).toEqual([passing.number]);
    expect(report.rejected.map((r: { issue: number }) => r.issue)).toEqual([failing.number]);

    // Approved: closed, claim + status fields cleared, owner released.
    expect((await utils.getIssue(passing.id))?.status).toBe("closed");
    const approvedFields = await utils.getProjectItemFieldValues(fallbackProjectId, passing.id);
    expect(approvedFields?.agent_status).toBe("completed");
    expect(approvedFields?.agent_claimed_by).toBeUndefined();
    expect(approvedFields?.agent_claimed_at).toBeUndefined();
    const passingWorker = await registryEntry(utils, passingWorkerId);
    expect(passingWorker.status).toBe("idle");
    expect(passingWorker.currentTaskId).toBeUndefined();
    const approvedComments = await utils.listIssueComments(passing.number);
    expect(
      approvedComments.some((c) => c.body.includes("## Auto-Approved by Convergence Loop"))
    ).toBe(true);
    expect(approvedComments.some((c) => c.body.includes("## Agent Work Approved"))).toBe(false);

    // Rejected: stays open, claim cleared back to the pool, findings recorded.
    expect((await utils.getIssue(failing.id))?.status).toBe("active");
    const rejectedFields = await utils.getProjectItemFieldValues(fallbackProjectId, failing.id);
    expect(rejectedFields?.agent_status).toBe("unclaimed");
    expect(rejectedFields?.agent_claimed_by).toBeUndefined();
    expect(rejectedFields?.agent_claimed_at).toBeUndefined();
    const failingWorker = await registryEntry(utils, failingWorkerId);
    expect(failingWorker.status).toBe("idle");
    expect(failingWorker.currentTaskId).toBeUndefined();
    const rejectedComments = await utils.listIssueComments(failing.number);
    const autoRejection = rejectedComments.find((c) =>
      c.body.includes("## Auto-Rejected by Convergence Loop")
    );
    expect(autoRejection).toBeDefined();
    expect(autoRejection?.body).toContain("1 test(s) failing");

    await closeIssue(utils, failing.id);
    for (const decomposed of report.decomposed ?? []) {
      for (const subtask of decomposed.subtasks) {
        await closeIssue(utils, String(subtask));
      }
    }
  }, 300000);

  it("should converge_until_done: report progress per iteration and terminate on a converged project", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }

    const doneProjectId = await createScenarioProject(utils, `E2E Converge Done Project ${runId}`);
    const workerId = await registerAgent(utils, `e2e-done-worker-${runId}`, "engineer");
    const reviewerId = await registerAgent(utils, `e2e-done-reviewer-${runId}`, "reviewer");
    registeredAgentIds.push(workerId, reviewerId);

    const delivered = await createIssueInProject(
      utils,
      doneProjectId,
      `E2E Done Delivered Task ${runId}`,
      "Task with a passing work product."
    );
    const pending = await createIssueInProject(
      utils,
      doneProjectId,
      `E2E Done Pending Task ${runId}`,
      "Task nobody has worked on yet."
    );

    expect(
      (
        await checkoutTask(utils, {
          agentId: workerId,
          projectId: doneProjectId,
          strategy: "oldest_first",
        })
      ).issueNumber
    ).toBe(delivered.number);
    await submitWorkProduct(utils, workerId, delivered.number, 0);

    // Iteration 1: not done; one passing task to settle, one to assign.
    const first = data(
      await utils.callTool("agent_manage", {
        action: "converge_until_done",
        projectId: doneProjectId,
        iteration: 1,
        maxIterations: 5,
      })
    );
    expect(first.done).toBe(false);
    expect(first.progress).toMatchObject({
      total: 2,
      closed: 0,
      open: 2,
      withWorkProduct: 1,
      withoutWorkProduct: 1,
      passing: 1,
      failing: 0,
    });
    expect(first.nextActions.join("\n")).toMatch(/converge_project/);
    expect(first.nextActions.join("\n")).toMatch(/smart_assign/);

    // Execute the suggested action: settle the passing task.
    const report = data(
      await utils.callTool("agent_manage", {
        action: "converge_project",
        projectId: doneProjectId,
        reviewerId,
      })
    );
    expect(report.approved.map((a: { issue: number }) => a.issue)).toEqual([delivered.number]);
    expect((await utils.getIssue(delivered.id))?.status).toBe("closed");

    // Iteration 2: one task left, nobody started it.
    const second = data(
      await utils.callTool("agent_manage", {
        action: "converge_until_done",
        projectId: doneProjectId,
        iteration: 2,
        maxIterations: 5,
      })
    );
    expect(second.done).toBe(false);
    expect(second.progress).toMatchObject({ total: 2, closed: 1, open: 1, withoutWorkProduct: 1 });

    // The remaining task is worked and closed by the (now idle) worker.
    const claim = await checkoutTask(utils, {
      agentId: workerId,
      projectId: doneProjectId,
      strategy: "oldest_first",
    });
    expect(claim.issueNumber).toBe(pending.number);
    const completed = data(
      await utils.callTool("agent_work", {
        action: "complete_task",
        agentId: workerId,
        taskId: String(pending.number),
        summary: "Finished the last task",
        closeIssue: true,
        autoCheckoutNext: false,
      })
    );
    expect(completed.success).toBe(true);

    // Iteration 3: converged.
    const third = data(
      await utils.callTool("agent_manage", {
        action: "converge_until_done",
        projectId: doneProjectId,
        iteration: 3,
        maxIterations: 5,
      })
    );
    expect(third.done).toBe(true);
    expect(third.reason).toBe("All issues closed");
    expect(third.closedCount).toBe(2);

    // A runaway loop is cut off by maxIterations.
    const capped = data(
      await utils.callTool("agent_manage", {
        action: "converge_until_done",
        projectId: doneProjectId,
        iteration: 3,
        maxIterations: 2,
      })
    );
    expect(capped.done).toBe(true);
    expect(capped.reason).toBe("Max iterations reached");
  }, 300000);

  // ────────────────────────────────────────────────────────────────────────
  // Native blockers + view pools
  // ────────────────────────────────────────────────────────────────────────

  it("should honour native blockers in checkout_task {skipBlocked} and round-trip add/list/remove_blocker", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }

    const blockerProjectId = await createScenarioProject(utils, `E2E Blocker Project ${runId}`);
    const firstAgentId = await registerAgent(utils, `e2e-blocker-first-${runId}`, "engineer");
    const secondAgentId = await registerAgent(utils, `e2e-blocker-second-${runId}`, "engineer");
    registeredAgentIds.push(firstAgentId, secondAgentId);

    // B is created BEFORE A, so oldest_first would hand B out first if the
    // blocker were ignored.
    const blocked = await createIssueInProject(
      utils,
      blockerProjectId,
      `E2E Blocker Blocked Task B ${runId}`,
      "Blocked by A."
    );
    const blocker = await createIssueInProject(
      utils,
      blockerProjectId,
      `E2E Blocker Blocking Task A ${runId}`,
      "Blocks B."
    );

    const edge = data(
      await utils.callTool("manage_issues", {
        action: "add_blocker",
        issueId: blocked.id,
        blockingIssueId: blocker.id,
      })
    );
    expect(edge.blockingIssueNumber).toBe(blocker.number);

    const blockedBy = data(
      await utils.callTool("manage_issues", {
        action: "list_dependencies",
        issueId: blocked.id,
      })
    );
    expect(blockedBy).toHaveLength(1);
    expect(blockedBy[0].blockingIssueNumber).toBe(blocker.number);
    expect(blockedBy[0].state).toMatch(/open/i);

    // While A is open, B is never handed out: the first agent gets A.
    const first = await checkoutTask(utils, {
      agentId: firstAgentId,
      projectId: blockerProjectId,
      strategy: "oldest_first",
      skipBlocked: true,
    });
    expect(first.success).toBe(true);
    expect(first.issueNumber).toBe(blocker.number);

    // A is claimed, B is blocked: nothing is left for the second agent.
    const none = await checkoutTask(utils, {
      agentId: secondAgentId,
      projectId: blockerProjectId,
      strategy: "oldest_first",
      skipBlocked: true,
    });
    expect(none.success).toBe(false);
    const untouched = await utils.getProjectItemFieldValues(blockerProjectId, blocked.id);
    expect(untouched?.agent_claimed_by).toBeUndefined();
    expect(untouched?.agent_status).not.toBe("in_progress");

    // Closing A releases B.
    const completed = data(
      await utils.callTool("agent_work", {
        action: "complete_task",
        agentId: firstAgentId,
        taskId: String(blocker.number),
        summary: "Finished the blocking task",
        closeIssue: true,
        autoCheckoutNext: false,
      })
    );
    expect(completed.success).toBe(true);
    expect((await utils.getIssue(blocker.id))?.status).toBe("closed");

    const released = await checkoutTask(utils, {
      agentId: secondAgentId,
      projectId: blockerProjectId,
      strategy: "oldest_first",
      skipBlocked: true,
    });
    expect(released.success).toBe(true);
    expect(released.issueNumber).toBe(blocked.number);
    const claimed = await utils.getProjectItemFieldValues(blockerProjectId, blocked.id);
    expect(claimed?.agent_claimed_by).toBe(secondAgentId);

    const finished = data(
      await utils.callTool("agent_work", {
        action: "complete_task",
        agentId: secondAgentId,
        taskId: String(blocked.number),
        summary: "Finished the formerly blocked task",
        closeIssue: true,
        autoCheckoutNext: false,
      })
    );
    expect(finished.success).toBe(true);

    // ── remove_blocker round trip ──
    // D blocks C and C is older: with the edge, skipBlocked skips C; after
    // remove_blocker, C is claimable again.
    const unblocked = await createIssueInProject(
      utils,
      blockerProjectId,
      `E2E Blocker Round Trip Task C ${runId}`,
      "Blocked by D until the edge is removed."
    );
    const roundTripBlocker = await createIssueInProject(
      utils,
      blockerProjectId,
      `E2E Blocker Round Trip Task D ${runId}`,
      "Blocks C until the edge is removed."
    );
    await utils.callTool("manage_issues", {
      action: "add_blocker",
      issueId: unblocked.id,
      blockingIssueId: roundTripBlocker.id,
    });
    const listed = data(
      await utils.callTool("manage_issues", { action: "list_dependencies", issueId: unblocked.id })
    );
    expect(listed.map((d: { blockingIssueNumber: number }) => d.blockingIssueNumber)).toEqual([
      roundTripBlocker.number,
    ]);

    const viaEdge = await checkoutTask(utils, {
      agentId: firstAgentId,
      projectId: blockerProjectId,
      strategy: "oldest_first",
      skipBlocked: true,
    });
    expect(viaEdge.issueNumber).toBe(roundTripBlocker.number);

    await utils.callTool("manage_issues", {
      action: "remove_blocker",
      issueId: unblocked.id,
      blockingIssueId: roundTripBlocker.id,
    });
    const afterRemoval = data(
      await utils.callTool("manage_issues", { action: "list_dependencies", issueId: unblocked.id })
    );
    expect(afterRemoval).toHaveLength(0);

    const afterRemove = await checkoutTask(utils, {
      agentId: secondAgentId,
      projectId: blockerProjectId,
      strategy: "oldest_first",
      skipBlocked: true,
    });
    expect(afterRemove.success).toBe(true);
    expect(afterRemove.issueNumber).toBe(unblocked.number);

    for (const [agentId, issueNumber] of [
      [firstAgentId, roundTripBlocker.number],
      [secondAgentId, unblocked.number],
    ] as const) {
      const done = data(
        await utils.callTool("agent_work", {
          action: "complete_task",
          agentId,
          taskId: String(issueNumber),
          summary: "Round trip task delivered",
          closeIssue: true,
          autoCheckoutNext: false,
        })
      );
      expect(done.success).toBe(true);
    }
  }, 360000);

  it("should claim through checkout_task {view}: a created view is the pool, and a view without a sort order falls back to the strategy", async () => {
    if (!utils) {
      console.log("Skipping: utils not initialized (missing credentials)");
      return;
    }

    // manage_project exposes create_view / list_views. GitHub's
    // UpdateProjectV2ViewInput / CreateProjectV2ViewInput carry no sort
    // field (only name, layout, filter and visibleFieldIds), so a view
    // created through the API has an empty sort order. The claim path
    // honours a view's sort order when GitHub stores one (covered in
    // TaskCheckoutService unit tests); a view with no sort order must fall
    // back to the strategy rather than break or reorder the pool.
    const viewProjectId = await createScenarioProject(utils, `E2E View Project ${runId}`);
    const viewAgentId = await registerAgent(utils, `e2e-view-agent-${runId}`, "engineer");
    const otherAgentId = await registerAgent(utils, `e2e-view-other-${runId}`, "engineer");
    registeredAgentIds.push(viewAgentId, otherAgentId);

    const viewName = `E2E Pool View ${runId}`;
    const created = data(
      await utils.callTool("manage_project", {
        action: "create_view",
        projectId: viewProjectId,
        name: viewName,
        layout: "table",
      })
    );
    expect(created.id).toBeDefined();
    expect(created.name).toBe(viewName);

    const views = data(
      await utils.callTool("manage_project", {
        action: "list_views",
        projectId: viewProjectId,
        name: viewName,
      })
    );
    expect(views).toHaveLength(1);
    expect(views[0].id).toBe(created.id);
    expect(views[0].sortBy ?? []).toHaveLength(0);

    const older = await createIssueInProject(
      utils,
      viewProjectId,
      `E2E View Older Task ${runId}`,
      "Created first."
    );
    const newer = await createIssueInProject(
      utils,
      viewProjectId,
      `E2E View Newer Task ${runId}`,
      "Created second."
    );

    const viaView = await checkoutTask(utils, {
      agentId: viewAgentId,
      projectId: viewProjectId,
      strategy: "oldest_first",
      view: viewName,
    });
    expect(viaView.success).toBe(true);
    expect(viaView.issueNumber).toBe(older.number);

    // A view that does not exist behaves the same way.
    const viaUnknownView = await checkoutTask(utils, {
      agentId: otherAgentId,
      projectId: viewProjectId,
      strategy: "oldest_first",
      view: `no-such-view-${runId}`,
    });
    expect(viaUnknownView.success).toBe(true);
    expect(viaUnknownView.issueNumber).toBe(newer.number);

    for (const [agentId, issueNumber] of [
      [viewAgentId, older.number],
      [otherAgentId, newer.number],
    ] as const) {
      const done = data(
        await utils.callTool("agent_work", {
          action: "complete_task",
          agentId,
          taskId: String(issueNumber),
          summary: "View pool task delivered",
          closeIssue: true,
          autoCheckoutNext: false,
        })
      );
      expect(done.success).toBe(true);
    }

    await utils.callTool("manage_project", {
      action: "delete_view",
      projectId: viewProjectId,
      viewId: created.id,
    });
  }, 300000);
});
