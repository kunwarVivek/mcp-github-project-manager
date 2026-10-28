/**
 * Reference agent loop — a runnable worker + reviewer cycle driven over MCP.
 *
 * It spawns this repository's stdio server (`node build/index.js`, with the
 * caller's environment), then drives the agent orchestration layer exactly as a
 * harness (Claude Code, Codex, Cursor, a custom loop) would:
 *
 *   worker:   register → checkout_task → get_task_context → heartbeat
 *             → submit_work_product → submit_for_review → record_usage
 *   reviewer: register → checkout_task{reviewQueue} → approve_task | reject_task
 *
 * Every id is taken from the previous response (agent id from `register`, the
 * issue number from `checkout_task`, ...). A tool error, a `success: false`
 * result or a missing id aborts the run with a non-zero exit code. "No task
 * available" is a clean, reported exit. The agents the run registered are
 * deregistered in a `finally` block.
 *
 *   pnpm run build
 *   GITHUB_TOKEN=… GITHUB_OWNER=… GITHUB_REPO=… \
 *     pnpm exec tsx examples/basic/agent-loop.ts --project <projectId> [--create-demo-task] [--reject]
 *
 *   pnpm exec tsx examples/basic/agent-loop.ts --plan     # print the call sequence only
 */

import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

export type Strategy =
  | "highest_priority"
  | "oldest_first"
  | "skills_match"
  | "milestone_deadline"
  | "ai";

export interface AgentLoopConfig {
  /** Project V2 node id the agents claim from. */
  projectId: string;
  /** Prefix for the registered agent names (a unique suffix is appended). */
  agentName: string;
  runtime: "claude-code" | "codex" | "cursor" | "cli" | "http" | "custom";
  capabilities: string[];
  strategy: Strategy;
  /** Skip tasks whose blockers are still open. */
  skipBlocked: boolean;
  /** Reviewer rejects (with feedback) instead of approving. */
  reject: boolean;
  /** Token budget for the worker. */
  budgetTokens?: number;
  /** Tokens reported through `record_usage` at the end of the worker cycle. */
  tokensUsed: number;
}

export type LoopOutcome =
  | { status: "completed"; issueNumber: number; reviewed: "approved" | "rejected" }
  | { status: "no_task"; stage: "worker" | "reviewer"; message: string };

/** Raised for every hard failure of the loop (tool error, success:false, missing id). */
export class AgentLoopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentLoopError";
  }
}

type Json = Record<string, unknown>;

interface PlanStep {
  description: string;
  tool: string;
  arguments: Json;
}

/**
 * The call sequence of one worker + reviewer cycle. Values that are produced by
 * an earlier call are written as symbolic references (`$register.id`), never as
 * fake literal ids.
 */
export function buildPlan(config: AgentLoopConfig): PlanStep[] {
  const { projectId, agentName, runtime, capabilities, strategy, skipBlocked } = config;
  return [
    {
      description: "Worker: join the registry",
      tool: "agent_work",
      arguments: {
        action: "register",
        name: `${agentName}-worker`,
        role: "engineer",
        runtime,
        capabilities,
        ...(config.budgetTokens ? { budgetTokens: config.budgetTokens } : {}),
      },
    },
    {
      description: "Worker: claim the next task (strategy-driven, dependency-aware)",
      tool: "agent_work",
      arguments: {
        action: "checkout_task",
        agentId: "$workerRegister.id",
        projectId,
        strategy,
        skipBlocked,
      },
    },
    {
      description: "Worker: pull the enriched context of the claimed issue",
      tool: "agent_work",
      arguments: { action: "get_task_context", issueNumber: "$workerCheckout.issueNumber" },
    },
    {
      description: "Worker: report liveness and progress",
      tool: "agent_work",
      arguments: {
        action: "heartbeat",
        agentId: "$workerRegister.id",
        status: "working",
        taskId: "$workerCheckout.issueNumber (as string)",
        progress: 50,
        progressSummary: "Implementation in progress",
        currentBranch: "$workerCheckout.branchSuggestion",
      },
    },
    {
      description: "Worker: record the work product (branch, files, test results)",
      tool: "agent_manage",
      arguments: {
        action: "submit_work_product",
        agentId: "$workerRegister.id",
        taskId: "$workerCheckout.issueNumber (as string)",
        issueNumber: "$workerCheckout.issueNumber",
        branch: "$workerCheckout.branchSuggestion",
        summary: "…",
      },
    },
    {
      description: "Worker: hand the task over to the review queue",
      tool: "agent_work",
      arguments: {
        action: "submit_for_review",
        agentId: "$workerRegister.id",
        taskId: "$workerCheckout.issueNumber (as string)",
        summary: "…",
      },
    },
    {
      description: "Worker: report the tokens it spent so budgets stay accurate",
      tool: "agent_manage",
      arguments: {
        action: "record_usage",
        agentId: "$workerRegister.id",
        tokensUsed: config.tokensUsed,
      },
    },
    {
      description: "Reviewer: join the registry",
      tool: "agent_work",
      arguments: {
        action: "register",
        name: `${agentName}-reviewer`,
        role: "reviewer",
        runtime,
        capabilities: [],
      },
    },
    {
      description: "Reviewer: claim the next item from the REVIEW queue",
      tool: "agent_work",
      arguments: {
        action: "checkout_task",
        agentId: "$reviewerRegister.id",
        projectId,
        reviewQueue: true,
      },
    },
    config.reject
      ? {
          description: "Reviewer: reject the work with feedback (task returns to the worker pool)",
          tool: "agent_work",
          arguments: {
            action: "reject_task",
            reviewerId: "$reviewerRegister.id",
            taskId: "$reviewerCheckout.issueNumber (as string)",
            feedback: "…",
          },
        }
      : {
          description: "Reviewer: approve the work (closes the issue)",
          tool: "agent_work",
          arguments: {
            action: "approve_task",
            reviewerId: "$reviewerRegister.id",
            taskId: "$reviewerCheckout.issueNumber (as string)",
            summary: "…",
          },
        },
    {
      description: "Cleanup: deregister both agents",
      tool: "agent_manage",
      arguments: { action: "deregister", agentId: "$workerRegister.id | $reviewerRegister.id" },
    },
  ];
}

/**
 * Pull the structured payload out of an MCP tool response. Mirrors the `data()`
 * helper of `src/__tests__/e2e/tools/agent-orchestration.e2e.ts`: the server
 * wraps results at two levels (`structuredContent` and, for executors,
 * `structuredContent.structuredContent`), with a JSON text blob as fallback.
 */
function data(response: unknown): unknown {
  if (!response || typeof response !== "object") return response;
  const r = response as {
    structuredContent?: unknown;
    content?: Array<{ text?: string }>;
  };

  if (r.structuredContent) {
    const inner = r.structuredContent;
    if (inner && typeof inner === "object" && (inner as Json).structuredContent !== undefined) {
      return data(inner);
    }
    return inner;
  }

  const text = Array.isArray(r.content) ? r.content[0]?.text : undefined;
  if (text) {
    try {
      return data(JSON.parse(text));
    } catch {
      return text;
    }
  }
  return response;
}

function log(message: string): void {
  process.stderr.write(`${message}\n`);
}

/** Call a tool; a protocol error, `isError` result or non-object payload is a hard failure. */
async function call(client: Client, tool: string, args: Json): Promise<Json> {
  const label = `${tool}/${String(args.action)}`;
  const result = await client.callTool({ name: tool, arguments: args }).catch((error: unknown) => {
    throw new AgentLoopError(`${label} failed: ${(error as Error).message}`);
  });

  const payload = data(result);
  if (result.isError) {
    const detail = typeof payload === "string" ? payload : JSON.stringify(payload);
    throw new AgentLoopError(`${label} returned an error: ${detail}`);
  }
  if (!payload || typeof payload !== "object") {
    throw new AgentLoopError(`${label} returned no structured result: ${JSON.stringify(payload)}`);
  }
  return payload as Json;
}

/** Like `call`, but a `success: false` payload is a hard failure too. */
async function callOk(client: Client, tool: string, args: Json): Promise<Json> {
  const payload = await call(client, tool, args);
  if (payload.success === false) {
    throw new AgentLoopError(
      `${tool}/${String(args.action)} reported failure: ${String(payload.message ?? "no message")}`
    );
  }
  return payload;
}

function requireString(payload: Json, field: string, label: string): string {
  const value = payload[field];
  if (typeof value !== "string" || value === "") {
    throw new AgentLoopError(`${label} response has no "${field}": ${JSON.stringify(payload)}`);
  }
  return value;
}

function requireNumber(payload: Json, field: string, label: string): number {
  const value = payload[field];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new AgentLoopError(`${label} response has no "${field}": ${JSON.stringify(payload)}`);
  }
  return value;
}

/** Is a failed checkout merely an empty queue (clean exit) rather than an error? */
function isEmptyQueue(checkout: Json): boolean {
  return (
    checkout.success === false &&
    typeof checkout.message === "string" &&
    checkout.message.startsWith("No unclaimed tasks available")
  );
}

/**
 * Run one worker + reviewer cycle. Returns an outcome for the expected end
 * states; throws {@link AgentLoopError} for anything else. The agents it
 * registered are always deregistered.
 */
export async function runAgentLoop(client: Client, config: AgentLoopConfig): Promise<LoopOutcome> {
  const registered: string[] = [];
  const suffix = `${Date.now().toString(36)}`;
  const agentName = `${config.agentName}-${suffix}`;

  const register = async (name: string, role: string, capabilities: string[], budget?: number) => {
    const agent = await callOk(client, "agent_work", {
      action: "register",
      name,
      role,
      runtime: config.runtime,
      capabilities,
      ...(budget ? { budgetTokens: budget } : {}),
    });
    const id = requireString(agent, "id", "register");
    registered.push(id);
    log(`  registered ${role} ${id}`);
    return id;
  };

  try {
    // An unknown project id makes checkout_task report an empty queue, which
    // would pass for "nothing to do" — resolve the project first so a typo fails loudly.
    const project = await call(client, "manage_project", {
      action: "get",
      projectId: config.projectId,
    });
    log(`[project] ${String(project.title ?? config.projectId)}`);

    // ── Worker ─────────────────────────────────────────────────────────
    log("\n[worker]");
    const workerId = await register(
      `${agentName}-worker`,
      "engineer",
      config.capabilities,
      config.budgetTokens
    );

    const checkout = await call(client, "agent_work", {
      action: "checkout_task",
      agentId: workerId,
      projectId: config.projectId,
      strategy: config.strategy,
      skipBlocked: config.skipBlocked,
    });
    if (isEmptyQueue(checkout)) {
      log(`  no task available: ${String(checkout.message)}`);
      return { status: "no_task", stage: "worker", message: String(checkout.message) };
    }
    if (checkout.success !== true) {
      throw new AgentLoopError(
        `agent_work/checkout_task reported failure: ${String(checkout.message)}`
      );
    }
    const issueNumber = requireNumber(checkout, "issueNumber", "checkout_task");
    const taskId = String(issueNumber);
    const branch =
      typeof checkout.branchSuggestion === "string" && checkout.branchSuggestion
        ? checkout.branchSuggestion
        : `agent/${issueNumber}-work`;
    log(`  claimed #${issueNumber}: ${String(checkout.issueTitle ?? "")}`);

    const context = await call(client, "agent_work", {
      action: "get_task_context",
      issueNumber,
    });
    const issue = context.issue as Json | undefined;
    if (!issue || issue.number !== issueNumber) {
      throw new AgentLoopError(
        `get_task_context returned context for ${JSON.stringify(issue?.number)}, expected #${issueNumber}`
      );
    }
    log(`  context loaded for #${issueNumber}`);

    await callOk(client, "agent_work", {
      action: "heartbeat",
      agentId: workerId,
      status: "working",
      taskId,
      progress: 50,
      progressSummary: `Working on #${issueNumber}`,
      currentBranch: branch,
    });
    log("  heartbeat accepted");

    // A real harness would do the work here (edit code, run tests) and report
    // the true commit SHAs, files and test counts.
    const workProduct = await call(client, "agent_manage", {
      action: "submit_work_product",
      agentId: workerId,
      taskId,
      issueNumber,
      branch,
      commitShas: [],
      filesChanged: [],
      testsPassed: 0,
      testsFailed: 0,
      testsTotal: 0,
      summary: `Reference loop work product for #${issueNumber}`,
    });
    log(`  work product ${requireString(workProduct, "id", "submit_work_product")} recorded`);

    await callOk(client, "agent_work", {
      action: "submit_for_review",
      agentId: workerId,
      taskId,
      summary: `Reference loop: ready for review (#${issueNumber})`,
    });
    log("  submitted for review");

    await callOk(client, "agent_manage", {
      action: "record_usage",
      agentId: workerId,
      tokensUsed: config.tokensUsed,
    });
    log(`  recorded ${config.tokensUsed} tokens`);

    // ── Reviewer ───────────────────────────────────────────────────────
    log("\n[reviewer]");
    const reviewerId = await register(`${agentName}-reviewer`, "reviewer", []);

    const reviewCheckout = await call(client, "agent_work", {
      action: "checkout_task",
      agentId: reviewerId,
      projectId: config.projectId,
      reviewQueue: true,
    });
    if (isEmptyQueue(reviewCheckout)) {
      throw new AgentLoopError(
        `#${issueNumber} was submitted for review but the review queue is empty: ${String(reviewCheckout.message)}`
      );
    }
    if (reviewCheckout.success !== true) {
      throw new AgentLoopError(
        `agent_work/checkout_task(reviewQueue) reported failure: ${String(reviewCheckout.message)}`
      );
    }
    const reviewedNumber = requireNumber(
      reviewCheckout,
      "issueNumber",
      "checkout_task(reviewQueue)"
    );
    if (reviewedNumber !== issueNumber) {
      throw new AgentLoopError(
        `the review queue returned #${reviewedNumber}, expected #${issueNumber}; another run shares this project`
      );
    }
    log(`  claimed #${reviewedNumber} from the review queue`);

    if (config.reject) {
      await callOk(client, "agent_work", {
        action: "reject_task",
        reviewerId,
        taskId: String(reviewedNumber),
        feedback: "Reference loop rejection: please add a regression test.",
      });
      log(`  rejected #${reviewedNumber} (returned to the worker pool)`);
      return { status: "completed", issueNumber, reviewed: "rejected" };
    }

    await callOk(client, "agent_work", {
      action: "approve_task",
      reviewerId,
      taskId: String(reviewedNumber),
      summary: "Reference loop: approved",
    });
    log(`  approved #${reviewedNumber} (issue closed)`);
    return { status: "completed", issueNumber, reviewed: "approved" };
  } finally {
    for (const agentId of registered) {
      try {
        await client.callTool({
          name: "agent_manage",
          arguments: { action: "deregister", agentId },
        });
        log(`  deregistered ${agentId}`);
      } catch (error) {
        log(`  WARNING: could not deregister ${agentId}: ${(error as Error).message}`);
      }
    }
  }
}

/** Create a throwaway issue in the project so a smoke run has something to claim. */
async function createDemoTask(client: Client, projectId: string): Promise<number> {
  const fields = await callOk(client, "agent_manage", { action: "setup_fields", projectId });
  log(
    `  agent fields ready (created: ${JSON.stringify(fields.created ?? [])}, existing: ${JSON.stringify(fields.existing ?? [])})`
  );

  const issue = await call(client, "manage_issues", {
    action: "create",
    title: `Agent loop demo task ${new Date().toISOString()}`,
    description:
      "Created by examples/basic/agent-loop.ts.\n\n## Acceptance Criteria\n- The reference loop claims, submits and approves this task",
    labels: [],
    assignees: [],
  });
  const contentId = requireString(issue, "id", "manage_issues/create");
  const number = requireNumber(issue, "number", "manage_issues/create");

  await call(client, "manage_project", {
    action: "add_item",
    projectId,
    contentId,
    contentType: "issue",
  });
  log(`  created demo task #${number} in the project`);
  return number;
}

function usage(): string {
  return `Usage: tsx examples/basic/agent-loop.ts --project <projectId> [options]

  --project <id>        Project V2 node id to claim from (or env AGENT_LOOP_PROJECT_ID)
  --create-demo-task    Provision the agent fields and create a demo issue in the project
  --reject              Reviewer rejects with feedback instead of approving
  --strategy <name>     highest_priority | oldest_first | skills_match | milestone_deadline | ai
                        (default: highest_priority)
  --allow-blocked       Do not skip tasks whose blockers are still open
  --budget-tokens <n>   Token budget for the worker
  --tokens-used <n>     Tokens reported through record_usage (default: 1000)
  --plan                Print the call sequence with symbolic references and exit
  --help                Show this help

The server is spawned as \`node build/index.js\` with the current environment
(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO). Run \`pnpm run build\` first.`;
}

const STRATEGIES: readonly Strategy[] = [
  "highest_priority",
  "oldest_first",
  "skills_match",
  "milestone_deadline",
  "ai",
];

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      project: { type: "string" },
      "create-demo-task": { type: "boolean", default: false },
      reject: { type: "boolean", default: false },
      strategy: { type: "string", default: "highest_priority" },
      "allow-blocked": { type: "boolean", default: false },
      "budget-tokens": { type: "string" },
      "tokens-used": { type: "string", default: "1000" },
      plan: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help) {
    log(usage());
    return 0;
  }

  const strategy = values.strategy as Strategy;
  if (!STRATEGIES.includes(strategy)) {
    log(`Invalid --strategy "${values.strategy}". Expected one of: ${STRATEGIES.join(", ")}`);
    return 2;
  }
  const tokensUsed = Number(values["tokens-used"]);
  const budgetTokens = values["budget-tokens"] ? Number(values["budget-tokens"]) : undefined;
  if (!Number.isInteger(tokensUsed) || tokensUsed < 0) {
    log(`Invalid --tokens-used "${values["tokens-used"]}"`);
    return 2;
  }
  if (budgetTokens !== undefined && (!Number.isInteger(budgetTokens) || budgetTokens <= 0)) {
    log(`Invalid --budget-tokens "${values["budget-tokens"]}"`);
    return 2;
  }

  const projectId = values.project ?? process.env.AGENT_LOOP_PROJECT_ID;
  if (!projectId && !values.plan) {
    log(`--project <projectId> (or AGENT_LOOP_PROJECT_ID) is required.\n\n${usage()}`);
    return 2;
  }

  const config: AgentLoopConfig = {
    projectId: projectId ?? "$projectId",
    agentName: "agent-loop-example",
    runtime: "custom",
    capabilities: ["typescript", "testing"],
    strategy,
    skipBlocked: !values["allow-blocked"],
    reject: values.reject ?? false,
    budgetTokens,
    tokensUsed,
  };

  if (values.plan) {
    process.stdout.write(`${JSON.stringify(buildPlan(config), null, 2)}\n`);
    return 0;
  }

  const serverEntry = fileURLToPath(new URL("../../build/index.js", import.meta.url));
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  );
  const client = new Client({ name: "agent-loop-example", version: "1.0.0" });
  await client.connect(
    new StdioClientTransport({ command: process.execPath, args: [serverEntry], env })
  );

  try {
    if (values["create-demo-task"]) {
      log("[setup]");
      await createDemoTask(client, config.projectId);
    }
    const outcome = await runAgentLoop(client, config);
    if (outcome.status === "no_task") {
      log(
        `\nNo task available for the ${outcome.stage}; nothing to do. (Pass --create-demo-task to seed one.)`
      );
      return 0;
    }
    log(`\nDone: #${outcome.issueNumber} ${outcome.reviewed} by the reviewer.`);
    return 0;
  } catch (error) {
    log(`\nagent loop FAILED: ${(error as Error).message}`);
    return 1;
  } finally {
    await client.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      log(`agent loop FAILED: ${(error as Error).message}`);
      process.exit(1);
    }
  );
}
