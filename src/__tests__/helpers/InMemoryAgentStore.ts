import { vi } from "vitest";
import type { Agent } from "../../domain/agent-orchestration-types";
import { AgentAlreadyExistsError, AgentNotFoundError } from "../../infrastructure/agent/AgentStore";

/**
 * A stateful stand-in for `AgentStore` with the same field-level contract:
 * `updateAgent` runs its mutator on the record as stored at write time and
 * throws `AgentNotFoundError` for an unknown id.
 *
 * `updateAgent` reads through `getAgent`, so a test may still pin what an
 * agent looks like with `store.getAgent.mockResolvedValue(...)`.
 */
export class InMemoryAgentStore {
  readonly agents: Map<string, Agent>;
  /** Every record an `updateAgent`/`createAgent` committed, in order. */
  readonly writes: Agent[] = [];

  constructor(initial: Agent[] = []) {
    this.agents = new Map(initial.map((a) => [a.id, structuredClone(a)]));
  }

  readonly getAgent = vi.fn(async (id: string): Promise<Agent | undefined> => {
    const found = this.agents.get(id);
    return found ? structuredClone(found) : undefined;
  });

  readonly listAgents = vi.fn(
    async (): Promise<Agent[]> => structuredClone([...this.agents.values()])
  );

  readonly getChildren = vi.fn(
    async (parentId: string): Promise<Agent[]> =>
      structuredClone([...this.agents.values()].filter((a) => a.parentAgentId === parentId))
  );

  readonly removeAgent = vi.fn(async (id: string): Promise<boolean> => this.agents.delete(id));

  readonly registryExists = vi.fn(async (): Promise<boolean> => true);

  readonly createAgent = vi.fn(async (agent: Agent): Promise<void> => {
    if (this.agents.has(agent.id)) throw new AgentAlreadyExistsError(agent.id);
    this.agents.set(agent.id, structuredClone(agent));
    this.writes.push(structuredClone(agent));
  });

  readonly updateAgent = vi.fn(
    async (id: string, mutator: (fresh: Agent) => Agent): Promise<Agent> => {
      const current = this.agents.get(id) ?? (await this.getAgent(id));
      if (!current) throw new AgentNotFoundError(id);
      const next = mutator(structuredClone(current));
      // Like the real store: an unchanged record is not a write.
      if (JSON.stringify(next) === JSON.stringify(current)) return next;
      this.agents.set(id, structuredClone(next));
      this.writes.push(structuredClone(next));
      return next;
    }
  );
}
