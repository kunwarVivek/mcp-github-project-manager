import { writeFileSync } from "node:fs";
import { join } from "node:path";
import nock from "nock";
import { afterAll, describe, expect, it } from "vitest";
import { registerCompoundExecutors } from "../../../infrastructure/tools/compound/register-executors";
import { ToolRegistry } from "../../../infrastructure/tools/ToolRegistry";
import { getActionCatalog, getToolCatalog, PUBLISHED_SURFACE } from "../utils/action-catalog";

/**
 * Action sweep: every action of every public tool, called for real.
 *
 * The tool e2e suites need live GitHub credentials and skip without them, so
 * in CI most of the MCP surface was never executed - a suite that does
 * nothing still reported "passed". This sweep closes that gap without any
 * credentials: it drives the same registry and the same compound executors
 * the server uses, with the GitHub API stubbed at the HTTP boundary.
 *
 * What it asserts, per action:
 *
 *  1. The action is ROUTED. A schema that advertises an action with no
 *     handler is a real defect: the client would call it and get
 *     "Unknown <tool> action".
 *  2. The action does not CRASH before it talks to GitHub. An unguarded
 *     access on a missing argument (TypeError / ReferenceError) is the bug
 *     class this sweep exists to surface; a failure AFTER a request was made
 *     is reported separately, because there the shape of the stubbed
 *     response - not the product - decides the outcome.
 */

type Status =
  | "ok"
  | "graceful-error"
  | "unrouted"
  | "crash-before-request"
  | "crash-after-request"
  | "timeout";

interface ActionOutcome {
  tool: string;
  action: string;
  status: Status;
  error?: string;
  errorType?: string;
  requestedGitHub: boolean;
}

const REPORT_PATH =
  process.env.E2E_ACTION_REPORT ??
  join(process.cwd(), "src/__tests__/e2e/action-sweep-report.json");

/** A response that satisfies the common shapes the repository mappers read. */
function genericGraphQLResponse() {
  return {
    data: {
      organization: {
        projects: { nodes: [], totalCount: 0 },
        repositories: { nodes: [], totalCount: 0 },
        teams: { nodes: [], totalCount: 0 },
      },
      repository: {
        issues: { nodes: [], totalCount: 0 },
        milestones: { nodes: [], totalCount: 0 },
        labels: { nodes: [], totalCount: 0 },
        pullRequests: { nodes: [], totalCount: 0 },
        releases: { nodes: [], totalCount: 0 },
        workflows: { nodes: [], totalCount: 0 },
        branches: { nodes: [], totalCount: 0 },
        projectV2: null,
      },
      viewer: { login: "test-owner" },
      rateLimit: {
        remaining: 5000,
        limit: 5000,
        cost: 1,
        used: 0,
        resetAt: new Date("2026-01-01T00:00:00Z").toISOString(),
      },
      node: null,
    },
  };
}

const CRASH_TYPES = new Set(["TypeError", "ReferenceError", "RangeError"]);

/** Per-action budget. A call that exceeds it is reported, not waited on. */
const ACTION_TIMEOUT_MS = 8000;

class TimeoutError extends Error {
  public override name = "TimeoutError";
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

describe("MCP action sweep", () => {
  const outcomes: ActionOutcome[] = [];
  let githubRequests = 0;

  // NOTE: the interceptors are registered in beforeEach, not beforeAll. The
  // global setup file (src/__tests__/e2e/setup.ts) calls `nock.cleanAll()` in
  // its own beforeEach, so anything registered in a beforeAll is wiped before
  // the test body runs - which is why the first sweep run hit "disallowed net
  // connect" on every call.
  beforeEach(() => {
    nock.cleanAll();
    nock.disableNetConnect();

    nock("https://api.github.com")
      .persist()
      .get(/\/rate_limit/)
      .reply(200, () => {
        githubRequests++;
        return {
          resources: {
            core: { limit: 5000, used: 0, remaining: 5000, reset: 4102444800 },
          },
          rate: { limit: 5000, used: 0, remaining: 5000, reset: 4102444800 },
        };
      });

    nock("https://api.github.com")
      .persist()
      .post(/graphql/i)
      .reply(200, () => {
        githubRequests++;
        return genericGraphQLResponse();
      })
      .get(/.*/)
      .reply(200, () => {
        githubRequests++;
        return [];
      })
      .post(/.*/)
      .reply(200, () => {
        githubRequests++;
        return {};
      })
      .patch(/.*/)
      .reply(200, () => {
        githubRequests++;
        return {};
      });

    const registry = ToolRegistry.getInstance();
    registerCompoundExecutors(registry);
  }, 30000);

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    nock.cleanAll();
    nock.enableNetConnect();

    const summary = getToolCatalog().map((entry) => {
      const rows = outcomes.filter((o) => o.tool === entry.tool);
      return {
        tool: entry.tool,
        actions: entry.actions.length,
        ok: rows.filter((o) => o.status === "ok").length,
        gracefulError: rows.filter((o) => o.status === "graceful-error").length,
        unrouted: rows.filter((o) => o.status === "unrouted").length,
        crashBeforeRequest: rows.filter((o) => o.status === "crash-before-request").length,
        crashAfterRequest: rows.filter((o) => o.status === "crash-after-request").length,
        timeout: rows.filter((o) => o.status === "timeout").length,
      };
    });

    writeFileSync(
      REPORT_PATH,
      `${JSON.stringify({ generatedAt: new Date().toISOString(), summary, outcomes }, null, 2)}\n`
    );
  });

  it("publishes a surface of 20 tools and 169 actions", () => {
    const tools = getToolCatalog();
    const actions = getActionCatalog();

    expect(tools.length, "the public tool count changed - update README and docs/TOOLS.md").toBe(
      PUBLISHED_SURFACE.tools
    );
    expect(
      actions.length,
      "the public action count changed - update README and docs/TOOLS.md"
    ).toBe(PUBLISHED_SURFACE.actions);
  });

  it("routes every advertised action and never crashes on missing arguments", async () => {
    const registry = ToolRegistry.getInstance();
    const catalog = getActionCatalog();

    const unrouted: ActionOutcome[] = [];
    const crashedBeforeRequest: ActionOutcome[] = [];

    for (const entry of catalog) {
      const before = githubRequests;
      let outcome: ActionOutcome;

      try {
        // One slow action must not stall the whole sweep: the AI and GitHub
        // paths have retry policies, and a call that waits for them would
        // otherwise look like a hang.
        const result = await withTimeout(
          registry.execute(entry.tool, { action: entry.action }),
          ACTION_TIMEOUT_MS,
          `${entry.tool}/${entry.action} timed out after ${ACTION_TIMEOUT_MS}ms`
        );
        outcome = {
          tool: entry.tool,
          action: entry.action,
          status: "ok",
          requestedGitHub: githubRequests > before,
        };
        expect(result, `${entry.tool}/${entry.action} returned nothing`).toBeDefined();
      } catch (error) {
        const errorType = error instanceof Error ? error.name : typeof error;
        const message = error instanceof Error ? error.message : String(error);
        const requestedGitHub = githubRequests > before;

        if (errorType === "TimeoutError") {
          outcome = {
            tool: entry.tool,
            action: entry.action,
            status: "timeout",
            error: message,
            errorType,
            requestedGitHub: githubRequests > before,
          };
        } else if (/Unknown .* action/i.test(message)) {
          outcome = {
            tool: entry.tool,
            action: entry.action,
            status: "unrouted",
            error: message,
            errorType,
            requestedGitHub,
          };
          unrouted.push(outcome);
        } else if (CRASH_TYPES.has(errorType)) {
          outcome = {
            tool: entry.tool,
            action: entry.action,
            status: requestedGitHub ? "crash-after-request" : "crash-before-request",
            error: message,
            errorType,
            requestedGitHub,
          };
          if (!requestedGitHub) crashedBeforeRequest.push(outcome);
        } else {
          outcome = {
            tool: entry.tool,
            action: entry.action,
            status: "graceful-error",
            error: message,
            errorType,
            requestedGitHub,
          };
        }
      }

      outcomes.push(outcome);
    }

    // A schema that advertises an action with no handler: the client would
    // call it and get "Unknown <tool> action".
    expect(
      unrouted.map((o) => `${o.tool}/${o.action}`),
      "advertised actions with no handler"
    ).toEqual([]);

    // An unguarded access on a missing argument, before any request went out.
    expect(
      crashedBeforeRequest.map((o) => `${o.tool}/${o.action} (${o.error})`),
      "actions that crash on a missing argument instead of failing gracefully"
    ).toEqual([]);

    // The sweep must have attempted every action in the catalog.
    expect(outcomes.length).toBe(catalog.length);
  }, 900000);
});
