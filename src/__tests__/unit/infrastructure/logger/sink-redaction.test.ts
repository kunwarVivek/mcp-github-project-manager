import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { IssueCreatedEvent } from "../../../../domain/events/DomainEvent";
import { DomainEventBus } from "../../../../domain/events/DomainEventBus";
import { CachePersistence } from "../../../../infrastructure/cache/CachePersistence";
import { GracefulShutdown } from "../../../../infrastructure/lifecycle/GracefulShutdown";
import { startTrace } from "../../../../infrastructure/observability/CorrelationContext";
import { createMutationAuditLog } from "../../../../infrastructure/observability/MutationAuditLog";
import { AIResiliencePolicy } from "../../../../infrastructure/resilience/AIResiliencePolicy";
import { SprintRiskAssessor } from "../../../../services/ai/SprintRiskAssessor";

const GITHUB_TOKEN = `ghp_${"a1B2c3D4e5".repeat(4).slice(0, 36)}`;
const { ANTHROPIC_KEY } = vi.hoisted(() => ({
  ANTHROPIC_KEY: `sk-ant-${"Zy9Xw8Vu7T".repeat(3)}`,
}));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  generateObject: vi.fn().mockRejectedValue(new Error(`provider 401 for key ${ANTHROPIC_KEY} end`)),
}));

function stderrText(spy: MockInstance<typeof process.stderr.write>): string {
  return spy.mock.calls.map((call) => String(call[0])).join("");
}

describe("direct stderr sinks redact credential-shaped values", () => {
  let stderrSpy: MockInstance<typeof process.stderr.write>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("trace error events scrub the error message and stack", async () => {
    await expect(
      startTrace("op", async () => {
        throw new Error(`clone failed for https://x:${GITHUB_TOKEN}@github.com/o/r`);
      })
    ).rejects.toThrow();

    const text = stderrText(stderrSpy);
    expect(text).toContain("clone failed for");
    expect(text).toContain("github.com/o/r");
    expect(text).not.toContain(GITHUB_TOKEN);
  });

  it("AI resilience fallback message scrubs a degraded-result message", async () => {
    const policy = new AIResiliencePolicy({ maxRetries: 1, consecutiveFailures: 10 });

    await policy.execute(
      async () => {
        throw new Error("boom");
      },
      () => ({ degraded: true, message: `fell back after ${ANTHROPIC_KEY} was rejected` })
    );

    const text = stderrText(stderrSpy);
    expect(text).toContain("Fallback triggered: fell back after");
    expect(text).toContain("was rejected");
    expect(text).not.toContain(ANTHROPIC_KEY);
  });

  it("domain event bus default reporter prints the error name but never its message", () => {
    const bus = DomainEventBus.getInstance();
    bus.subscribeByName("IssueCreated", () => {
      throw new TypeError(`webhook delivery failed with ${GITHUB_TOKEN}`);
    });

    bus.publish(
      IssueCreatedEvent.create({ issueId: "1", title: "t", description: "d", causedBy: "test" })
    );
    DomainEventBus.resetInstance();

    const text = stderrText(stderrSpy);
    expect(text).toContain("Error in event handler for IssueCreated: (TypeError)");
    expect(text).not.toContain(GITHUB_TOKEN);
    expect(text).not.toContain("webhook delivery failed");
  });

  it("domain event bus hands handler errors to a wired reporter", async () => {
    const bus = DomainEventBus.getInstance();
    const received: Array<[string, unknown]> = [];
    bus.setErrorReporter((message, error) => received.push([message, error]));
    const failure = new Error("handler broke");
    bus.subscribeByNameAsync("IssueCreated", async () => {
      throw failure;
    });

    await expect(
      bus.publishAsync(
        IssueCreatedEvent.create({ issueId: "1", title: "t", description: "d", causedBy: "test" })
      )
    ).rejects.toBe(failure);
    DomainEventBus.resetInstance();

    expect(received).toEqual([["Error in event handler for IssueCreated:", failure]]);
    expect(stderrText(stderrSpy)).not.toContain("Error in event handler");
  });

  it("AI service fallback logging (SprintRiskAssessor) scrubs the provider error", async () => {
    const assessor = new SprintRiskAssessor({
      getModel: () => ({}),
      getBestAvailableModel: () => ({}),
    } as never);

    await assessor.assessRisks({
      sprintCapacity: { recommendedLoad: 20 },
      sprintItems: [],
    } as never);

    const text = stderrText(stderrSpy);
    expect(text).toContain("AI risk assessment failed");
    expect(text).toContain("provider 401 for key");
    expect(text).not.toContain(ANTHROPIC_KEY);
  });

  it("GracefulShutdown's default logger scrubs cleanup errors", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const shutdown = new GracefulShutdown();

    await shutdown.shutdown(async () => {
      throw new Error(`cleanup could not revoke ${GITHUB_TOKEN}`);
    });

    const text = stderrText(stderrSpy);
    expect(text).toContain("[Shutdown] Cleanup error: cleanup could not revoke");
    expect(text).not.toContain(GITHUB_TOKEN);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("cache persistence failures scrub a token embedded in the failing path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sink-"));
    try {
      // A regular file used as the cache directory makes mkdir fail with ENOTDIR,
      // and the OS error text includes the path (which carries the token here).
      const blocker = join(dir, GITHUB_TOKEN);
      await writeFile(blocker, "x");
      const persistence = new CachePersistence(join(blocker, "cache"));

      await expect(persistence.save(new Map())).rejects.toThrow();

      const text = stderrText(stderrSpy);
      expect(text).toContain("[CachePersistence] Failed to save cache:");
      expect(text).not.toContain(GITHUB_TOKEN);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("mutation audit file redacts identifying string fields", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "audit-redact-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("scrubs tool, action, target and idempotencyKey but keeps the record shape", async () => {
    const path = join(dir, "mutations.jsonl");
    const log = createMutationAuditLog({ enabled: true, path });

    log.recordMutation({
      tool: `tool:${GITHUB_TOKEN}`,
      action: `act:${ANTHROPIC_KEY}`,
      target: `repo:o/r?access=${GITHUB_TOKEN}`,
      idempotencyKey: `idem:${GITHUB_TOKEN}`,
      outcome: "success",
      durationMs: 1,
    });
    await log.close();

    const raw = await readFile(path, "utf8");
    expect(raw).not.toContain(GITHUB_TOKEN);
    expect(raw).not.toContain(ANTHROPIC_KEY);
    const record = JSON.parse(raw.trim());
    expect(record.tool).toMatch(/^tool:/);
    expect(record.action).toMatch(/^act:/);
    expect(record.target).toContain("repo:o/r?access=");
    expect(record.idempotencyKey).toMatch(/^idem:/);
    expect(record.outcome).toBe("success");
  });
});
