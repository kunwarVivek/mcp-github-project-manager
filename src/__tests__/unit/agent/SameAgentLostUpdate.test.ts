import { beforeEach, describe, expect, it } from "vitest";
import type { Agent } from "../../../domain/agent-orchestration-types";
import { AgentStore } from "../../../infrastructure/agent/AgentStore";
import { AgentBudgetService } from "../../../services/agent/AgentBudgetService";
import type { AgentContextService } from "../../../services/agent/AgentContextService";
import { TaskCheckoutService } from "../../../services/agent/TaskCheckoutService";
import type { AIServiceFactory } from "../../../services/ai/AIServiceFactory";
import { FakeGitHub } from "../../helpers/FakeGitHub";

/**
 * Regression for the same-agent lost update.
 *
 * Callers used to read an agent, edit a copy and write the whole copy back.
 * The store re-applied "replace the record with this copy" on every
 * compare-and-swap retry, so a concurrent write to a DIFFERENT field of the
 * SAME agent (a heartbeat, a metered debit, a budget change) was reverted by
 * whichever writer committed last. A reverted debit means a budget hard stop
 * that never fires.
 *
 * These tests drive the real services over one shared registry with paused
 * writes, so both writers have read the same snapshot before either commits.
 */

const instantly = async (): Promise<void> => {};

function newStore(github: FakeGitHub): AgentStore {
  return new AgentStore(github.asFactory(), { sleep: instantly });
}

function budgetedAgent(id: string): Agent {
  return {
    id,
    name: `agent-${id}`,
    role: "engineer",
    runtime: "claude-code",
    capabilities: ["typescript"],
    status: "idle",
    registeredAt: "2026-01-01T00:00:00Z",
    budget: {
      totalTokens: 10_000,
      meteredTokens: 0,
      reportedTokens: 0,
      usedTokens: 0,
      warningFraction: 0.8,
      hardStop: true,
      resetPeriod: "never",
    },
  };
}

function checkoutServiceOver(github: FakeGitHub): TaskCheckoutService {
  const store = newStore(github);
  return new TaskCheckoutService(
    github.asFactory(),
    store,
    {} as unknown as AgentContextService,
    {} as unknown as AIServiceFactory,
    new AgentBudgetService(store)
  );
}

async function raceTwoWriters(
  github: FakeGitHub,
  first: () => Promise<unknown>,
  second: () => Promise<unknown>
): Promise<void> {
  github.pauseWrites();
  const one = first();
  const two = second();
  await github.waitForPendingWrites(2);
  github.releaseWrites();
  await Promise.all([one, two]);
}

describe("same-agent concurrent writers keep each other's fields", () => {
  let github: FakeGitHub;

  beforeEach(() => {
    github = new FakeGitHub();
    github.seedRegistry([budgetedAgent("agent-x")]);
  });

  it("a metered debit and a heartbeat that changes status both survive", async () => {
    const budget = new AgentBudgetService(newStore(github));
    const checkout = checkoutServiceOver(github);

    await raceTwoWriters(
      github,
      () => budget.recordMeteredUsage("agent-x", 700),
      () =>
        checkout.processHeartbeat({
          agentId: "agent-x",
          status: "blocked",
          timestamp: "2026-10-28T10:00:00.000Z",
        })
    );

    const [agent] = github.registryAgents();
    expect(agent.budget?.meteredTokens).toBe(700);
    expect(agent.budget?.usedTokens).toBe(700);
    expect(agent.status).toBe("blocked");
  });

  it("two concurrent metered debits both count", async () => {
    const first = new AgentBudgetService(newStore(github));
    const second = new AgentBudgetService(newStore(github));

    await raceTwoWriters(
      github,
      () => first.recordMeteredUsage("agent-x", 100),
      () => second.recordMeteredUsage("agent-x", 50)
    );

    const [agent] = github.registryAgents();
    expect(agent.budget?.meteredTokens).toBe(150);
    expect(agent.budget?.usedTokens).toBe(150);
  });

  it("a metered debit and a reported debit both count", async () => {
    const first = new AgentBudgetService(newStore(github));
    const second = new AgentBudgetService(newStore(github));

    await raceTwoWriters(
      github,
      () => first.recordMeteredUsage("agent-x", 300),
      () => second.recordReportedUsage("agent-x", 40)
    );

    const [agent] = github.registryAgents();
    expect(agent.budget?.meteredTokens).toBe(300);
    expect(agent.budget?.reportedTokens).toBe(40);
    expect(agent.budget?.usedTokens).toBe(340);
  });

  it("a budget change and a metered debit both survive", async () => {
    const setter = new AgentBudgetService(newStore(github));
    const debiter = new AgentBudgetService(newStore(github));

    await raceTwoWriters(
      github,
      () => setter.setBudget("agent-x", 20_000),
      () => debiter.recordMeteredUsage("agent-x", 250)
    );

    const [agent] = github.registryAgents();
    expect(agent.budget?.totalTokens).toBe(20_000);
    expect(agent.budget?.meteredTokens).toBe(250);
    expect(agent.budget?.usedTokens).toBe(250);
  });
});
