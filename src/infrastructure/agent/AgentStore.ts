import type { GitHubRepositoryFactory } from '../github/GitHubRepositoryFactory.js';
import type { Agent } from '../../domain/agent-orchestration-types.js';
import { AGENT_REGISTRY_LABEL } from '../../domain/agent-orchestration-types.js';

/**
 * GitHub issue-backed agent registry.
 *
 * Uses a pinned issue (label: `agent-registry`) to store the agent list
 * as JSON in the issue body. One registry issue per repository.
 *
 * ## Concurrency
 *
 * The registry is a single JSON blob; concurrent writers (e.g. parallel
 * heartbeats from multiple agents) could otherwise clobber each other's
 * updates. All mutations go through {@link mutateAgents}, which performs
 * read-modify-write with an optimistic verify-and-merge retry: after each
 * write we re-read the issue and, if another writer landed in between,
 * re-apply our mutation on top of the fresh state (up to a bounded number
 * of attempts). This converges on the last-writer-wins body while never
 * silently dropping a registered agent.
 */
export class AgentStore {
  private readonly factory: GitHubRepositoryFactory;

  /** Max read-modify-write retries when concurrent writers are detected. */
  private static readonly MAX_MERGE_ATTEMPTS = 3;

  constructor(factory: GitHubRepositoryFactory) {
    this.factory = factory;
  }

  /**
   * Read-only probe: does an agent registry issue exist in this repo?
   *
   * Unlike {@link listAgents} / {@link getRegistryIssue} — which bootstrap the
   * registry by creating the issue + label on first use — this never writes.
   * Background sweeps (e.g. the auto-reclaim scheduler) call this first so a
   * repo that never uses the agent layer is not mutated behind the user's back.
   */
  async registryExists(): Promise<boolean> {
    const octokit = this.factory.getOctokit();
    const config = this.factory.getConfig();

    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner: config.owner,
      repo: config.repo,
      labels: AGENT_REGISTRY_LABEL,
      state: 'open',
      per_page: 1,
    });

    return issues.length > 0;
  }

  /** Find or create the registry issue. */
  private async getRegistryIssue(): Promise<{ number: number; body: string }> {
    const octokit = this.factory.getOctokit();
    const config = this.factory.getConfig();

    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner: config.owner,
      repo: config.repo,
      labels: AGENT_REGISTRY_LABEL,
      state: 'open',
      per_page: 1,
    });

    if (issues.length > 0) {
      return { number: issues[0].number, body: issues[0].body || '[]' };
    }

    // Ensure the label exists before creating the issue
    try {
      await octokit.rest.issues.createLabel({
        owner: config.owner,
        repo: config.repo,
        name: AGENT_REGISTRY_LABEL,
        color: '6f42c1',
        description: 'Agent orchestration registry',
      });
    } catch {
      /* label may already exist */
    }

    const { data: issue } = await octokit.rest.issues.create({
      owner: config.owner,
      repo: config.repo,
      title: 'Agent Registry',
      body: '[]',
      labels: [AGENT_REGISTRY_LABEL],
    });

    return { number: issue.number, body: '[]' };
  }

  /** Read all agents from the registry. */
  async listAgents(): Promise<Agent[]> {
    const { body } = await this.getRegistryIssue();
    try {
      return JSON.parse(body) as Agent[];
    } catch {
      return [];
    }
  }

  /** Get a single agent by ID. */
  async getAgent(agentId: string): Promise<Agent | undefined> {
    const agents = await this.listAgents();
    return agents.find(a => a.id === agentId);
  }

  /** Save the full agent list back to the registry issue. */
  async saveAgents(agents: Agent[]): Promise<void> {
    const { number } = await this.getRegistryIssue();
    const octokit = this.factory.getOctokit();
    const config = this.factory.getConfig();

    await octokit.rest.issues.update({
      owner: config.owner,
      repo: config.repo,
      issue_number: number,
      body: JSON.stringify(agents, null, 2),
    });
  }

  /** Add or update an agent (matched by `id`). */
  async upsertAgent(agent: Agent): Promise<void> {
    await this.mutateAgents(agents => {
      const idx = agents.findIndex(a => a.id === agent.id);
      if (idx >= 0) {
        agents[idx] = agent;
      } else {
        agents.push(agent);
      }
      return agents;
    });
  }

  /** Remove an agent by ID. Returns `true` if found and removed. */
  async removeAgent(agentId: string): Promise<boolean> {
    let removed = false;
    await this.mutateAgents(agents => {
      const filtered = agents.filter(a => a.id !== agentId);
      removed = filtered.length !== agents.length;
      return filtered;
    });
    return removed;
  }

  /** Remove an agent and all its descendants. Returns count of removed agents. */
  async removeAgentCascade(agentId: string): Promise<number> {
    let removedCount = 0;
    await this.mutateAgents(agents => {
      const toRemove = new Set([agentId]);
      let found = true;
      while (found) {
        found = false;
        for (const a of agents) {
          if (a.parentAgentId && toRemove.has(a.parentAgentId) && !toRemove.has(a.id)) {
            toRemove.add(a.id);
            found = true;
          }
        }
      }
      removedCount = toRemove.size;
      return agents.filter(a => !toRemove.has(a.id));
    });
    return removedCount;
  }

  /** Get direct children of an agent. */
  async getChildren(parentId: string): Promise<Agent[]> {
    const agents = await this.listAgents();
    return agents.filter(a => a.parentAgentId === parentId);
  }

  /**
   * Apply a mutation to the agent registry with optimistic concurrency.
   *
   * Reads the current list, applies `mutator`, writes it back, then re-reads.
   * If the written body no longer matches what we wrote (a concurrent writer
   * landed after us), re-applies the mutation on the fresh list and retries,
   * up to MAX_MERGE_ATTEMPTS.
   */
  private async mutateAgents(
    mutator: (agents: Agent[]) => Agent[],
  ): Promise<void> {
    for (let attempt = 0; attempt < AgentStore.MAX_MERGE_ATTEMPTS; attempt++) {
      const agents = await this.listAgents();
      const next = mutator(agents);
      const body = JSON.stringify(next, null, 2);
      await this.saveAgentsBody(body);

      // Verify no concurrent writer overwrote our update; if so, merge again.
      const recheck = await this.listAgents();
      const recheckBody = JSON.stringify(recheck, null, 2);
      if (recheckBody === body) return;
    }

    // Give up after bounded attempts. This is a last-writer-wins race; the
    // registry remains consistent but our update may be lost. Warn loudly.
    process.stderr.write(
      '[AgentStore] Concurrent registry writes detected — merge attempts exhausted; ' +
      'some updates may have been lost. Retry the operation.\n',
    );
  }

  /** Write a raw JSON body to the registry issue (used by mutateAgents). */
  private async saveAgentsBody(body: string): Promise<void> {
    const { number } = await this.getRegistryIssue();
    const octokit = this.factory.getOctokit();
    const config = this.factory.getConfig();

    await octokit.rest.issues.update({
      owner: config.owner,
      repo: config.repo,
      issue_number: number,
      body,
    });
  }
}
