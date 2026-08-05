import { GitHubRepositoryFactory } from '../github/GitHubRepositoryFactory.js';
import type { Agent } from '../../domain/agent-orchestration-types.js';
import { AGENT_REGISTRY_LABEL } from '../../domain/agent-orchestration-types.js';

/**
 * GitHub issue-backed agent registry.
 *
 * Uses a pinned issue (label: `agent-registry`) to store the agent list
 * as JSON in the issue body. One registry issue per repository.
 */
export class AgentStore {
  private readonly factory: GitHubRepositoryFactory;

  constructor(factory: GitHubRepositoryFactory) {
    this.factory = factory;
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
    const agents = await this.listAgents();
    const idx = agents.findIndex(a => a.id === agent.id);
    if (idx >= 0) {
      agents[idx] = agent;
    } else {
      agents.push(agent);
    }
    await this.saveAgents(agents);
  }

  /** Remove an agent by ID. Returns `true` if found and removed. */
  async removeAgent(agentId: string): Promise<boolean> {
    const agents = await this.listAgents();
    const filtered = agents.filter(a => a.id !== agentId);
    if (filtered.length === agents.length) return false;
    await this.saveAgents(filtered);
    return true;
  }

  /** Remove an agent and all its descendants. Returns count of removed agents. */
  async removeAgentCascade(agentId: string): Promise<number> {
    const agents = await this.listAgents();
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
    const filtered = agents.filter(a => !toRemove.has(a.id));
    if (filtered.length < agents.length) {
      await this.saveAgents(filtered);
    }
    return toRemove.size;
  }

  /** Get direct children of an agent. */
  async getChildren(parentId: string): Promise<Agent[]> {
    const agents = await this.listAgents();
    return agents.filter(a => a.parentAgentId === parentId);
  }
}
