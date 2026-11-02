import { ProtocolError } from "@modelcontextprotocol/server";
import { describe, expect, it, type Mock, vi } from "vitest";
import { z } from "zod";
import type { BudgetStatus } from "../../../../domain/agent-orchestration-types";
import type { ILogger } from "../../../../infrastructure/logger/index";
import { ToolDispatcher } from "../../../../infrastructure/mcp/ToolDispatcher";
import { getTraceContext } from "../../../../infrastructure/observability/CorrelationContext";
import {
  type AuditSink,
  createMutationAuditLog,
  type MutationAuditRecord,
} from "../../../../infrastructure/observability/MutationAuditLog";
import type { ToolDefinition } from "../../../../infrastructure/tools/ToolValidator";
import {
  BudgetExhaustedError,
  type MeteredDebitOutcome,
} from "../../../../services/agent/AgentBudgetService";
import { partialFake } from "../../../helpers/aiFakes";

const logger = partialFake<ILogger>({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

function memorySink(): AuditSink & { records: MutationAuditRecord[] } {
  const records: MutationAuditRecord[] = [];
  return {
    records,
    append: (record) => {
      records.push(record);
    },
    flush: async () => undefined,
    close: async () => undefined,
  };
}

function exhaustedStatus(): BudgetStatus {
  return {
    agentId: "agent-1",
    agentName: "Agent One",
    totalTokens: 1000,
    meteredTokens: 1000,
    reportedTokens: 0,
    usedTokens: 1000,
    remainingTokens: 0,
    usagePercent: 100,
    isWarning: true,
    isExhausted: true,
  };
}

type ExecuteMock = Mock<(toolName: string, args: unknown) => Promise<unknown>>;

interface Harness {
  dispatcher: ToolDispatcher;
  sink: ReturnType<typeof memorySink>;
  execute: ExecuteMock;
  assertCanSpend: Mock<(agentId: string) => Promise<void>>;
  debitMeteredWithRetry: Mock<(agentId: string, tokens: number) => Promise<MeteredDebitOutcome>>;
}

function healthyStatus(usagePercent: number): BudgetStatus {
  return {
    ...exhaustedStatus(),
    usedTokens: usagePercent * 10,
    remainingTokens: 1000 - usagePercent * 10,
    usagePercent,
    isWarning: false,
    isExhausted: false,
  };
}

function harness(
  tools: Record<string, Partial<ToolDefinition<unknown>>>,
  execute: ExecuteMock = vi.fn(async () => ({ ok: true }))
): Harness {
  const sink = memorySink();
  const assertCanSpend: Harness["assertCanSpend"] = vi.fn(async () => undefined);
  const debitMeteredWithRetry: Harness["debitMeteredWithRetry"] = vi.fn();
  const dispatcher = new ToolDispatcher({
    registry: {
      getTool: <T>(name: string) => tools[name] as ToolDefinition<T> | undefined,
      execute,
    },
    budget: () => ({ assertCanSpend, debitMeteredWithRetry }),
    audit: createMutationAuditLog({ enabled: true, path: "unused" }, sink),
    logger,
  });
  return { dispatcher, sink, execute, assertCanSpend, debitMeteredWithRetry };
}

const manageSchema = z.object({
  action: z.string(),
  projectId: z.string().optional(),
  agentId: z.string().optional(),
});

describe("ToolDispatcher", () => {
  it("throws a protocol error only for an unknown tool", async () => {
    const { dispatcher } = harness({});
    await expect(dispatcher.dispatch("nope", {})).rejects.toBeInstanceOf(ProtocolError);
  });

  it("returns invalid arguments as an isError result naming the field", async () => {
    const { dispatcher, execute } = harness({ manage: { schema: manageSchema } });

    const result = await dispatcher.dispatch("manage", { projectId: 5 });

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Invalid parameters for tool manage");
    expect(text).toContain("action");
    expect(execute).not.toHaveBeenCalled();
  });

  it("maps a GitHub API error to an actionable isError result", async () => {
    const execute: ExecuteMock = vi.fn(async () => {
      throw Object.assign(new Error("Not Found"), { status: 404 });
    });
    const { dispatcher } = harness({ manage: { schema: manageSchema } }, execute);

    const result = await dispatcher.dispatch("manage", { action: "get", projectId: "p1" });

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toMatch(/not found/i);
    expect(text).toMatch(/verify the owner/i);
  });

  it("rejects an exhausted hard-stop agent before the AI call runs", async () => {
    const { dispatcher, execute, assertCanSpend } = harness({
      ai_generate: { schema: manageSchema },
    });
    assertCanSpend.mockRejectedValue(new BudgetExhaustedError("agent-1", exhaustedStatus()));

    const result = await dispatcher.dispatch("ai_generate", {
      action: "generate_prd",
      agentId: "agent-1",
    });

    expect(result.isError).toBe(true);
    expect(execute).not.toHaveBeenCalled();
    expect(result._meta).toMatchObject({
      error: { code: "BudgetExhausted", agentId: "agent-1", limit: 1000, remaining: 0 },
    });
  });

  it("stamps _meta.schemaVersion on success and error results of versioned tools", async () => {
    const execute: ExecuteMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error("boom"));
    const { dispatcher } = harness({ manage_issues: { schema: manageSchema } }, execute);

    const ok = await dispatcher.dispatch("manage_issues", { action: "list" });
    const failed = await dispatcher.dispatch("manage_issues", { action: "list" });
    const invalid = await dispatcher.dispatch("manage_issues", {});

    for (const result of [ok, failed, invalid]) {
      expect(result._meta).toMatchObject({ schemaVersion: "1.0.0" });
    }
    expect(failed.isError).toBe(true);
  });

  it("does not gate non-AI tools or calls without an agent", async () => {
    const { dispatcher, assertCanSpend } = harness({
      manage: { schema: manageSchema },
      ai_plan: { schema: manageSchema },
    });

    await dispatcher.dispatch("manage", { action: "create", agentId: "agent-1" });
    await dispatcher.dispatch("ai_plan", { action: "prioritize_backlog" });

    expect(assertCanSpend).not.toHaveBeenCalled();
  });

  it("records a state-changing call in the audit log with the actor", async () => {
    const { dispatcher, sink } = harness({ manage: { schema: manageSchema } });

    await dispatcher.dispatch("manage", { action: "create", projectId: "p1" });
    await dispatcher.dispatch("manage", { action: "create", agentId: "agent-7" });

    expect(sink.records).toHaveLength(2);
    expect(sink.records[0]).toMatchObject({
      tool: "manage",
      action: "create",
      target: "projectId:p1",
      actor: "token",
      outcome: "success",
    });
    expect(sink.records[1]?.actor).toBe("agent-7");
  });

  it("records a failed mutation with outcome error", async () => {
    const execute: ExecuteMock = vi.fn(async () => {
      throw new Error("boom");
    });
    const { dispatcher, sink } = harness({ manage: { schema: manageSchema } }, execute);

    const result = await dispatcher.dispatch("manage", { action: "delete" });

    expect(result.isError).toBe(true);
    expect(sink.records[0]).toMatchObject({ action: "delete", outcome: "error", error: "boom" });
  });

  it("does not record read-only actions or read-only annotated tools", async () => {
    const { dispatcher, sink } = harness({
      manage: { schema: manageSchema },
      discover: { schema: manageSchema, annotations: { readOnlyHint: true } },
    });

    await dispatcher.dispatch("manage", { action: "list" });
    await dispatcher.dispatch("manage", { action: "get_metrics" });
    await dispatcher.dispatch("discover", { action: "create" });

    expect(sink.records).toHaveLength(0);
  });

  describe("budget debit", () => {
    /** An executor that reports AI token spend the way the AI middleware does. */
    const spending = (tokens: number) => async () => {
      const usage = getTraceContext()?.usage;
      if (usage) usage.tokens += tokens;
      return { ok: true };
    };

    it("debits the tokens a call spent to the agent once per call", async () => {
      const { dispatcher, debitMeteredWithRetry } = harness(
        { ai_generate: { schema: manageSchema } },
        vi.fn(spending(321))
      );
      debitMeteredWithRetry.mockResolvedValue({ ok: true, status: healthyStatus(40) });

      const result = await dispatcher.dispatch("ai_generate", {
        action: "generate_prd",
        agentId: "agent-1",
      });

      expect(debitMeteredWithRetry).toHaveBeenCalledExactlyOnceWith("agent-1", 321);
      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(1);
    });

    it("does not debit a call that spent nothing", async () => {
      const { dispatcher, debitMeteredWithRetry } = harness({
        ai_generate: { schema: manageSchema },
      });

      await dispatcher.dispatch("ai_generate", { action: "generate_prd", agentId: "agent-1" });

      expect(debitMeteredWithRetry).not.toHaveBeenCalled();
    });

    it("appends a wrap-up warning once the agent crosses its warning threshold", async () => {
      const { dispatcher, debitMeteredWithRetry } = harness(
        { ai_generate: { schema: manageSchema } },
        vi.fn(spending(10))
      );
      debitMeteredWithRetry.mockResolvedValue({
        ok: true,
        status: { ...healthyStatus(85.25), isWarning: true },
      });

      const result = await dispatcher.dispatch("ai_generate", {
        action: "generate_prd",
        agentId: "agent-1",
      });

      expect(result.content).toHaveLength(2);
      expect((result.content[1] as { text: string }).text).toContain("85.3%");
    });

    it("still returns the result and flags the unpaid debit when the debit cannot be written", async () => {
      const { dispatcher, debitMeteredWithRetry } = harness(
        { ai_generate: { schema: manageSchema } },
        vi.fn(spending(77))
      );
      debitMeteredWithRetry.mockResolvedValue({
        ok: false,
        failure: { agentId: "agent-1", tokens: 77, error: "registry conflict" },
      });

      const result = await dispatcher.dispatch("ai_generate", {
        action: "generate_prd",
        agentId: "agent-1",
      });

      expect(result.isError).toBeUndefined();
      expect(result._meta).toMatchObject({
        budgetDebitFailed: { agentId: "agent-1", tokens: 77, error: "registry conflict" },
      });
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("held as an unpaid debit"));
    });

    it("lets the call proceed when the budget registry cannot be read", async () => {
      const { dispatcher, execute, assertCanSpend } = harness({
        ai_generate: { schema: manageSchema },
      });
      assertCanSpend.mockRejectedValue(new Error("registry unreachable"));

      const result = await dispatcher.dispatch("ai_generate", {
        action: "generate_prd",
        agentId: "agent-1",
      });

      expect(execute).toHaveBeenCalledOnce();
      expect(result.isError).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("proceeding"));
    });
  });

  describe("result shaping", () => {
    it("adds structuredContent only for tools that declare an outputSchema", async () => {
      const execute: ExecuteMock = vi.fn(async () => ({ count: 2 }));
      const { dispatcher } = harness(
        {
          typed: { schema: manageSchema, outputSchema: z.object({ count: z.number() }) },
          untyped: { schema: manageSchema },
        },
        execute
      );

      const typed = await dispatcher.dispatch("typed", { action: "list" });
      const untyped = await dispatcher.dispatch("untyped", { action: "list" });

      expect(typed.structuredContent).toEqual({ count: 2 });
      expect(untyped.structuredContent).toBeUndefined();
    });

    it("rethrows a method-not-found protocol error from the executor instead of wrapping it", async () => {
      const execute: ExecuteMock = vi.fn(async () => {
        throw new ProtocolError(-32601, "Unknown tool: handlerless");
      });
      const { dispatcher } = harness({ handlerless: { schema: manageSchema } }, execute);

      await expect(dispatcher.dispatch("handlerless", { action: "list" })).rejects.toBeInstanceOf(
        ProtocolError
      );
    });
  });

  describe("audit target", () => {
    it("qualifies the target with owner/repo and falls back to the repo, then the tool name", async () => {
      const { dispatcher, sink } = harness({ manage: { schema: manageSchema.loose() } });

      await dispatcher.dispatch("manage", {
        action: "update",
        owner: "o",
        repo: "r",
        issueNumber: 5,
      });
      await dispatcher.dispatch("manage", { action: "update", owner: "o", repo: "r" });
      await dispatcher.dispatch("manage", { action: "update" });

      expect(sink.records.map((r) => r.target)).toEqual([
        "issueNumber:o/r#5",
        "repo:o/r",
        "manage",
      ]);
    });
  });
});
