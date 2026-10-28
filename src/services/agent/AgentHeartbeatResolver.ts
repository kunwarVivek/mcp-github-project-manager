import type { Agent } from "../../domain/agent-orchestration-types";
import { MAX_AGENT_HIERARCHY_DEPTH } from "../../domain/agent-orchestration-types";
import type { ItemClaim, ItemHeartbeatStore } from "../../infrastructure/agent/ItemHeartbeatStore";

/** The latest heartbeat of one agent, and where it was read. */
export interface ResolvedHeartbeat {
  /** ISO timestamp, absent when the agent never beat. */
  lastHeartbeat?: string;
  source?: "project_item" | "registry";
  /** From the claimed item; only for a working agent. */
  progress?: number;
  workBranch?: string;
}

/**
 * The agent and its ancestors, nearest first. A subagent inherits the task its
 * root claimed, so the project item names the root as the claimant.
 */
export function claimantChain(agent: Agent, byId: Map<string, Agent>): string[] {
  const chain = [agent.id];
  let current = agent;
  for (let hops = 0; hops < MAX_AGENT_HIERARCHY_DEPTH; hops++) {
    const parentId = current.parentAgentId;
    if (!parentId || chain.includes(parentId)) break;
    const parent = byId.get(parentId);
    if (!parent) {
      chain.push(parentId);
      break;
    }
    chain.push(parent.id);
    current = parent;
  }
  return chain;
}

function timeOf(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

/**
 * Resolves an agent's latest heartbeat across the hot/cold split.
 *
 * A working agent beats onto the project item it claimed; the registry only
 * gets a heartbeat when a cold field changes (and at checkout). An idle agent
 * has no item, so its registry `lastHeartbeat` is the only source.
 *
 * For a working agent the answer is the NEWER of the item value and the
 * registry value. The item is written by every heartbeat, so it is normally
 * the newer one; the registry value is the fallback right after a checkout
 * (both are set there) and for an item that has no value yet. Taking the
 * newer never reads staler than either source: a false-stale reading
 * un-claims live work.
 */
export class AgentHeartbeatResolver {
  private readonly items: ItemHeartbeatStore;

  constructor(items: ItemHeartbeatStore) {
    this.items = items;
  }

  /**
   * Resolve the heartbeat of each of `subjects`.
   *
   * @param registry - the whole registry (used to find each subject's claimants).
   * @param subjects - the agents to resolve; defaults to every agent.
   *
   * Cost: one GraphQL request per 25 distinct claimed issues among `subjects`
   * (none when no subject holds a task).
   */
  async resolve(
    registry: Agent[],
    subjects: Agent[] = registry
  ): Promise<Map<string, ResolvedHeartbeat>> {
    const byId = new Map(registry.map((a) => [a.id, a]));
    const claims: ItemClaim[] = [];
    const issueOf = new Map<string, number>();

    for (const agent of subjects) {
      const issueNumber = agent.currentTaskId ? Number.parseInt(agent.currentTaskId, 10) : NaN;
      if (!Number.isInteger(issueNumber) || issueNumber <= 0) continue;
      issueOf.set(agent.id, issueNumber);
      claims.push({ issueNumber, claimantIds: claimantChain(agent, byId) });
    }

    const items = claims.length > 0 ? await this.items.readHeartbeats(claims) : new Map();

    const resolved = new Map<string, ResolvedHeartbeat>();
    for (const agent of subjects) {
      const issueNumber = issueOf.get(agent.id);
      const item = issueNumber !== undefined ? items.get(issueNumber) : undefined;
      const itemMs = timeOf(item?.timestamp);
      const registryMs = timeOf(agent.lastHeartbeat);

      if (itemMs !== undefined && (registryMs === undefined || itemMs >= registryMs)) {
        resolved.set(agent.id, {
          lastHeartbeat: item?.timestamp,
          source: "project_item",
          progress: item?.progress,
          workBranch: item?.workBranch,
        });
      } else if (registryMs !== undefined) {
        resolved.set(agent.id, {
          lastHeartbeat: agent.lastHeartbeat,
          source: "registry",
          progress: item?.progress,
          workBranch: item?.workBranch,
        });
      } else {
        resolved.set(agent.id, { progress: item?.progress, workBranch: item?.workBranch });
      }
    }
    return resolved;
  }
}
