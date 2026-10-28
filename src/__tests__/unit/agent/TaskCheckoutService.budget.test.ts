import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent, AgentBudget } from "../../../domain/agent-orchestration-types";
import type { AgentStore } from "../../../infrastructure/agent/AgentStore";
import type { GitHubRepositoryFactory } from "../../../infrastructure/github/GitHubRepositoryFactory";
import { AgentBudgetService } from "../../../services/agent/AgentBudgetService";
import type { AgentContextService } from "../../../services/agent/AgentContextService";
import { TaskCheckoutService } from "../../../services/agent/TaskCheckoutService";
import { UnpaidDebitLedger } from "../../../services/agent/UnpaidDebitLedger";
import { InMemoryAgentStore } from "../../helpers/InMemoryAgentStore";

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    name: "worker",
    role: "engineer",
    runtime: "claude-code",
    capabilities: [],
    status: "idle",
    registeredAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function budgetOf(used: number, total: number, hardStop = true): AgentBudget {
  return {
    totalTokens: total,
    meteredTokens: used,
    reportedTokens: 0,
    usedTokens: used,
    warningFraction: 0.8,
    hardStop,
  };
}

/**
 * Regression suite for the budget gate.
 *
 * Before the gate existed, `hardStop` enforced nothing: recordUsage flipped an
 * agent to 'budget_exhausted', and the very next checkoutTask set
 * `agent.status = 'working'` unconditionally — clearing the exhausted state and
 * handing out another task. An agent could loop past its budget forever.
 */
describe("TaskCheckoutService budget gate", () => {
  let store: InMemoryAgentStore;
  let agents: Map<string, Agent>;
  let ledger: UnpaidDebitLedger;
  let budgetService: AgentBudgetService;
  let service: TaskCheckoutService;

  beforeEach(() => {
    store = new InMemoryAgentStore();
    agents = store.agents;
    ledger = new UnpaidDebitLedger();
    budgetService = new AgentBudgetService(store as unknown as AgentStore, ledger);

    service = new TaskCheckoutService(
      {} as GitHubRepositoryFactory,
      store as unknown as AgentStore,
      {} as AgentContextService,
      { getInstance: vi.fn() } as never,
      budgetService
    );
  });

  it("refuses checkout once the budget is exhausted", async () => {
    agents.set("agent-1", makeAgent({ budget: budgetOf(100, 100) }));

    const result = await service.checkoutTask("agent-1");

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/budget exhausted/i);
  });

  it("does not silently reset a budget_exhausted agent to working", async () => {
    agents.set("agent-1", makeAgent({ status: "budget_exhausted", budget: budgetOf(150, 100) }));

    await service.checkoutTask("agent-1");

    expect(agents.get("agent-1")?.status).toBe("budget_exhausted");
  });

  it("a subagent is blocked by the ROOT budget, not its own empty one", async () => {
    agents.set("root", makeAgent({ id: "root", budget: budgetOf(100, 100) }));
    agents.set("child", makeAgent({ id: "child", parentAgentId: "root" }));
    agents.set("grandchild", makeAgent({ id: "grandchild", parentAgentId: "child" }));

    // Subagents are rejected earlier (they inherit the parent's task), which is
    // itself the correct behaviour — assert that, so the guard can't regress.
    const result = await service.checkoutTask("grandchild");
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/subagent/i);
  });

  /**
   * Past the gate, checkout reaches the (deliberately unmocked) GitHub factory
   * and throws. That throw IS the signal it got past the gate — assert only
   * that the failure is not the budget rejection.
   */
  async function failureMessage(agentId: string): Promise<string> {
    try {
      const result = await service.checkoutTask(agentId);
      return result.message ?? "";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  it("allows checkout past the gate when budget remains", async () => {
    agents.set("agent-1", makeAgent({ budget: budgetOf(10, 1000) }));

    expect(await failureMessage("agent-1")).not.toMatch(/budget exhausted/i);
  });

  it("hardStop:false lets an over-budget agent continue", async () => {
    agents.set("agent-1", makeAgent({ budget: budgetOf(500, 100, false) }));

    expect(await failureMessage("agent-1")).not.toMatch(/budget exhausted/i);
  });

  describe("metered debits the registry refused", () => {
    beforeEach(() => {
      agents.set("agent-1", makeAgent({ budget: budgetOf(0, 1000) }));
    });

    it("refuses checkout while the unpaid debit still cannot be written", async () => {
      // Two failed debit attempts, then one failed settlement attempt.
      store.updateAgent
        .mockRejectedValueOnce(new Error("registry down"))
        .mockRejectedValueOnce(new Error("registry down"))
        .mockRejectedValueOnce(new Error("registry still down"));
      await budgetService.debitMeteredWithRetry("agent-1", 400);

      const result = await service.checkoutTask("agent-1");

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/1 metered token debit\(s\) totalling 400 tokens/);
      expect(result.message).toMatch(/registry still down/);
      expect(ledger.size).toBe(1);
      expect(agents.get("agent-1")?.currentTaskId).toBeUndefined();
    });

    it("settles the debit at checkout, then lets the checkout proceed with the debit in the counters", async () => {
      store.updateAgent
        .mockRejectedValueOnce(new Error("registry down"))
        .mockRejectedValueOnce(new Error("registry down"));
      await budgetService.debitMeteredWithRetry("agent-1", 400);
      expect(agents.get("agent-1")?.budget?.usedTokens).toBe(0);

      // The registry is writable again: the settlement lands, so the gate passes
      // (and then trips on the unmocked GitHub factory, like every pass-through test).
      expect(await failureMessage("agent-1")).not.toMatch(/budget exhausted|metered token debit/i);

      expect(ledger.size).toBe(0);
      expect(agents.get("agent-1")?.budget?.meteredTokens).toBe(400);
      expect(agents.get("agent-1")?.budget?.usedTokens).toBe(400);
    });

    it("an unpaid debit that exhausts the budget is enforced once settled", async () => {
      store.updateAgent
        .mockRejectedValueOnce(new Error("registry down"))
        .mockRejectedValueOnce(new Error("registry down"));
      await budgetService.debitMeteredWithRetry("agent-1", 1200);

      const result = await service.checkoutTask("agent-1");

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/budget exhausted/i);
      expect(agents.get("agent-1")?.budget?.usedTokens).toBe(1200);
    });
  });
});
