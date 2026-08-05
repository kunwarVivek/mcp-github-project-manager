import type { GitHubRepositoryFactory } from '../../infrastructure/github/GitHubRepositoryFactory';
import type { AgentStore } from '../../infrastructure/agent/AgentStore';
import type { AgentContextService } from './AgentContextService';
import type {
  AgentHeartbeat,
  AgentTaskContext,
  TaskCheckoutResult,
  CheckoutStrategy,
} from '../../domain/agent-orchestration-types';
import {
  AGENT_FIELDS,
  DEFAULT_HEARTBEAT_TIMEOUT_MINUTES,
} from '../../domain/agent-orchestration-types';
import { mapErrorToMCPError } from '../utils/ErrorMapper';

// ---------------------------------------------------------------------------
// GraphQL types
// ---------------------------------------------------------------------------

interface ProjectItemFieldValue {
  field?: { name: string };
  text?: string;
  name?: string; // single-select value
}

interface ProjectItemNode {
  id: string;
  project: { id: string };
  fieldValues: {
    nodes: ProjectItemFieldValue[];
  };
}

interface IssueWithProject {
  id: string;
  number: number;
  title: string;
  body: string;
  state: string;
  labels: { nodes: Array<{ name: string }> };
  milestone: { title: string } | null;
  projectItems: {
    nodes: ProjectItemNode[];
  };
}

interface ListIssuesResponse {
  repository: {
    issues: {
      nodes: IssueWithProject[];
    };
  };
}

interface FieldNode {
  id: string;
  name: string;
  dataType: string;
  options?: Array<{ id: string; name: string }>;
}

interface ListFieldsResponse {
  node: {
    fields: {
      nodes: FieldNode[];
    };
  };
}

// ---------------------------------------------------------------------------
// Queries & mutations
// ---------------------------------------------------------------------------

const LIST_OPEN_ISSUES_QUERY = `
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      issues(first: 100, states: OPEN, orderBy: { field: CREATED_AT, direction: ASC }) {
        nodes {
          id
          number
          title
          body
          state
          labels(first: 30) { nodes { name } }
          milestone { title }
          projectItems(first: 5) {
            nodes {
              id
              project { id }
              fieldValues(first: 30) {
                nodes {
                  ... on ProjectV2ItemFieldTextValue  { field { ... on ProjectV2Field { name } } text }
                  ... on ProjectV2ItemFieldSingleSelectValue { field { ... on ProjectV2SingleSelectField { name } } name }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const LIST_FIELDS_QUERY = `
  query($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        fields(first: 50) {
          nodes {
            ... on ProjectV2Field { id name dataType }
            ... on ProjectV2SingleSelectField { id name dataType options { id name } }
          }
        }
      }
    }
  }
`;

const UPDATE_TEXT_FIELD = `
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId, itemId: $itemId, fieldId: $fieldId,
      value: { text: $value }
    }) { projectV2Item { id } }
  }
`;

const UPDATE_SELECT_FIELD = `
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId, itemId: $itemId, fieldId: $fieldId,
      value: { singleSelectOptionId: $value }
    }) { projectV2Item { id } }
  }
`;

const CLEAR_FIELD = `
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
    clearProjectV2ItemFieldValue(input: {
      projectId: $projectId, itemId: $itemId, fieldId: $fieldId
    }) { projectV2Item { id } }
  }
`;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export interface CheckoutOptions {
  strategy?: CheckoutStrategy;
  labels?: string[];
  projectId?: string;
}

/**
 * Core service for atomic task checkout, release, completion, and heartbeat
 * management. Works with GitHub Project V2 custom fields to track which agent
 * has claimed each issue.
 */
export class TaskCheckoutService {
  private readonly factory: GitHubRepositoryFactory;
  private readonly agentStore: AgentStore;
  private readonly contextService: AgentContextService;

  constructor(
    factory: GitHubRepositoryFactory,
    agentStore: AgentStore,
    contextService: AgentContextService,
  ) {
    this.factory = factory;
    this.agentStore = agentStore;
    this.contextService = contextService;
  }

  /**
   * Find the highest-priority unclaimed issue, atomically claim it, and
   * return enriched context for the agent.
   */
  async checkoutTask(
    agentId: string,
    options?: CheckoutOptions,
  ): Promise<TaskCheckoutResult> {
    try {
      const agent = await this.agentStore.getAgent(agentId);
      if (!agent) {
        return { success: false, message: `Agent not found: ${agentId}` };
      }

      if (agent.currentTaskId) {
        return {
          success: false,
          message: `Agent already has a task checked out: ${agent.currentTaskTitle ?? agent.currentTaskId}`,
        };
      }

      const config = this.factory.getConfig();

      // 1. Fetch open issues with their project item fields
      const resp = await this.factory.graphql<ListIssuesResponse>(LIST_OPEN_ISSUES_QUERY, {
        owner: config.owner,
        repo: config.repo,
      });

      const issues = resp.repository.issues.nodes;

      // 2. Find an unclaimed issue (no agent_claimed_by, agent_status = unclaimed or absent)
      const candidate = this.pickCandidate(issues, options);
      if (!candidate) {
        return { success: false, message: 'No unclaimed tasks available' };
      }

      // 3. Atomically claim via project field updates
      const projectItem = candidate.issue.projectItems.nodes[0];
      if (projectItem) {
        await this.claimProjectItem(projectItem.project.id, projectItem.id, agentId);
      }

      // 4. Update agent record
      agent.currentTaskId = String(candidate.issue.number);
      agent.currentTaskTitle = candidate.issue.title;
      agent.status = 'working';
      agent.lastHeartbeat = new Date().toISOString();
      await this.agentStore.upsertAgent(agent);

      // 5. Build enriched context
      let context: AgentTaskContext | undefined;
      try {
        context = await this.contextService.getTaskContext(
          candidate.issue.id,
          candidate.issue.number,
        );
      } catch {
        // Context fetch failure is non-fatal; the checkout itself succeeded
      }

      const labels = candidate.issue.labels.nodes.map(l => l.name);

      return {
        success: true,
        issueId: candidate.issue.id,
        issueNumber: candidate.issue.number,
        issueTitle: candidate.issue.title,
        issueBody: candidate.issue.body ?? '',
        labels,
        milestone: candidate.issue.milestone?.title,
        branchSuggestion: context?.branchSuggestion ?? buildBranchName(candidate.issue.number, candidate.issue.title),
        claimedAt: new Date().toISOString(),
        message: `Task #${candidate.issue.number} checked out successfully`,
      };
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  /** Release a task claim. The issue returns to unclaimed status. */
  async releaseTask(agentId: string, taskId: string): Promise<{ success: boolean; message: string }> {
    try {
      const agent = await this.agentStore.getAgent(agentId);
      if (!agent) {
        return { success: false, message: `Agent not found: ${agentId}` };
      }

      if (agent.currentTaskId !== taskId) {
        return { success: false, message: `Agent ${agentId} does not own task ${taskId}` };
      }

      // Clear project fields
      const issueNumber = parseInt(taskId, 10);
      if (!Number.isNaN(issueNumber)) {
        await this.clearClaimFields(issueNumber, 'unclaimed').catch(() => {
          // Non-fatal — agent record update is the source of truth
        });
      }

      // Update agent record
      agent.currentTaskId = undefined;
      agent.currentTaskTitle = undefined;
      agent.status = 'idle';
      await this.agentStore.upsertAgent(agent);

      return { success: true, message: `Task ${taskId} released by agent ${agentId}` };
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  /** Mark a task as completed. */
  async completeTask(
    agentId: string,
    taskId: string,
    summary: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const agent = await this.agentStore.getAgent(agentId);
      if (!agent) {
        return { success: false, message: `Agent not found: ${agentId}` };
      }

      if (agent.currentTaskId !== taskId) {
        return { success: false, message: `Agent ${agentId} does not own task ${taskId}` };
      }

      // Update project fields to completed status and clear claim
      const issueNumber = parseInt(taskId, 10);
      if (!Number.isNaN(issueNumber)) {
        await this.clearClaimFields(issueNumber, 'completed').catch(() => {});

        // Post a completion comment on the issue
        const config = this.factory.getConfig();
        const octokit = this.factory.getOctokit();
        await octokit.rest.issues.createComment({
          owner: config.owner,
          repo: config.repo,
          issue_number: issueNumber,
          body: [
            `## Agent Work Completed`,
            '',
            `**Agent:** ${agent.name} (\`${agentId}\`)`,
            `**Summary:** ${summary}`,
            `**Completed at:** ${new Date().toISOString()}`,
          ].join('\n'),
        }).catch(() => {});
      }

      // Update agent record
      agent.currentTaskId = undefined;
      agent.currentTaskTitle = undefined;
      agent.status = 'idle';
      await this.agentStore.upsertAgent(agent);

      return { success: true, message: `Task ${taskId} completed by agent ${agentId}` };
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  /** Process a heartbeat from an agent. Updates timestamp, status, and progress. */
  async processHeartbeat(heartbeat: AgentHeartbeat): Promise<{ success: boolean; message: string }> {
    try {
      const agent = await this.agentStore.getAgent(heartbeat.agentId);
      if (!agent) {
        return { success: false, message: `Agent not found: ${heartbeat.agentId}` };
      }

      agent.lastHeartbeat = heartbeat.timestamp;
      agent.status = heartbeat.status;

      if (heartbeat.taskId) {
        agent.currentTaskId = heartbeat.taskId;
      }

      // Store progress info in metadata
      if (heartbeat.progress != null || heartbeat.progressSummary || heartbeat.currentBranch) {
        agent.metadata = {
          ...agent.metadata,
          ...(heartbeat.progress != null && { progress: heartbeat.progress }),
          ...(heartbeat.progressSummary && { progressSummary: heartbeat.progressSummary }),
          ...(heartbeat.currentBranch && { currentBranch: heartbeat.currentBranch }),
          ...(heartbeat.estimatedCompletionMinutes != null && {
            estimatedCompletionMinutes: heartbeat.estimatedCompletionMinutes,
          }),
          ...(heartbeat.blockerDescription && { blockerDescription: heartbeat.blockerDescription }),
        };
      }

      await this.agentStore.upsertAgent(agent);
      return { success: true, message: `Heartbeat processed for agent ${heartbeat.agentId}` };
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  /**
   * Reclaim tasks from agents whose heartbeat has gone stale.
   * Returns the number of tasks reclaimed.
   */
  async reclaimStaleTasks(
    timeoutMinutes: number = DEFAULT_HEARTBEAT_TIMEOUT_MINUTES,
  ): Promise<{ reclaimed: number; details: Array<{ agentId: string; taskId: string }> }> {
    try {
      const agents = await this.agentStore.listAgents();
      const now = Date.now();
      const timeoutMs = timeoutMinutes * 60_000;
      const reclaimed: Array<{ agentId: string; taskId: string }> = [];

      for (const agent of agents) {
        if (!agent.currentTaskId) continue;
        if (!agent.lastHeartbeat) continue;

        const elapsed = now - new Date(agent.lastHeartbeat).getTime();
        if (elapsed < timeoutMs) continue;

        // Release the task
        const taskId = agent.currentTaskId;
        const issueNumber = parseInt(taskId, 10);
        if (!Number.isNaN(issueNumber)) {
          await this.clearClaimFields(issueNumber, 'unclaimed').catch(() => {});
        }

        agent.currentTaskId = undefined;
        agent.currentTaskTitle = undefined;
        agent.status = 'offline';
        await this.agentStore.upsertAgent(agent);

        reclaimed.push({ agentId: agent.id, taskId });
      }

      return { reclaimed: reclaimed.length, details: reclaimed };
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Pick the best unclaimed candidate from the issue list. */
  private pickCandidate(
    issues: IssueWithProject[],
    options?: CheckoutOptions,
  ): { issue: IssueWithProject } | null {
    for (const issue of issues) {
      // Skip issues without project items (can't track agent fields)
      if (issue.projectItems.nodes.length === 0) continue;

      // Filter by labels if requested
      if (options?.labels?.length) {
        const issueLabels = new Set(issue.labels.nodes.map(l => l.name));
        if (!options.labels.some(l => issueLabels.has(l))) continue;
      }

      // Filter by projectId if requested
      if (options?.projectId) {
        const inProject = issue.projectItems.nodes.some(
          pi => pi.project.id === options.projectId,
        );
        if (!inProject) continue;
      }

      // Check agent fields — must be unclaimed
      const item = issue.projectItems.nodes[0]!;
      const fieldValues = item.fieldValues.nodes;

      const claimedBy = fieldValues.find(
        fv => fv.field?.name === AGENT_FIELDS.CLAIMED_BY,
      );
      if (claimedBy?.text) continue; // already claimed

      const status = fieldValues.find(
        fv => fv.field?.name === AGENT_FIELDS.STATUS,
      );
      // Accept if status is absent, 'unclaimed', or empty
      if (status?.name && status.name !== 'unclaimed') continue;

      return { issue };
    }

    return null;
  }

  /** Set agent claim fields on a project item. */
  private async claimProjectItem(
    projectId: string,
    itemId: string,
    agentId: string,
  ): Promise<void> {
    const fields = await this.loadFieldMap(projectId);

    // Set agent_claimed_by (TEXT)
    const claimedByField = fields.get(AGENT_FIELDS.CLAIMED_BY);
    if (claimedByField) {
      await this.factory.graphql(UPDATE_TEXT_FIELD, {
        projectId, itemId, fieldId: claimedByField.id, value: agentId,
      });
    }

    // Set agent_claimed_at (TEXT — ISO timestamp)
    const claimedAtField = fields.get(AGENT_FIELDS.CLAIMED_AT);
    if (claimedAtField) {
      await this.factory.graphql(UPDATE_TEXT_FIELD, {
        projectId, itemId, fieldId: claimedAtField.id, value: new Date().toISOString(),
      });
    }

    // Set agent_status (SINGLE_SELECT → 'in_progress')
    const statusField = fields.get(AGENT_FIELDS.STATUS);
    if (statusField?.options) {
      const option = statusField.options.find(o => o.name === 'in_progress');
      if (option) {
        await this.factory.graphql(UPDATE_SELECT_FIELD, {
          projectId, itemId, fieldId: statusField.id, value: option.id,
        });
      }
    }
  }

  /** Clear claim fields and set status on a project item for a given issue. */
  private async clearClaimFields(issueNumber: number, newStatus: 'unclaimed' | 'completed'): Promise<void> {
    const config = this.factory.getConfig();

    // Find the project item
    const query = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            projectItems(first: 5) {
              nodes { id project { id } }
            }
          }
        }
      }
    `;

    interface Resp {
      repository: {
        issue: {
          projectItems: {
            nodes: Array<{ id: string; project: { id: string } }>;
          };
        } | null;
      };
    }

    const resp = await this.factory.graphql<Resp>(query, {
      owner: config.owner,
      repo: config.repo,
      number: issueNumber,
    });

    const items = resp.repository.issue?.projectItems.nodes;
    if (!items || items.length === 0) return;

    const item = items[0]!;
    const projectId = item.project.id;
    const itemId = item.id;

    const fields = await this.loadFieldMap(projectId);

    // Clear agent_claimed_by
    const claimedByField = fields.get(AGENT_FIELDS.CLAIMED_BY);
    if (claimedByField) {
      await this.factory.graphql(CLEAR_FIELD, {
        projectId, itemId, fieldId: claimedByField.id,
      });
    }

    // Clear agent_claimed_at
    const claimedAtField = fields.get(AGENT_FIELDS.CLAIMED_AT);
    if (claimedAtField) {
      await this.factory.graphql(CLEAR_FIELD, {
        projectId, itemId, fieldId: claimedAtField.id,
      });
    }

    // Set agent_status
    const statusField = fields.get(AGENT_FIELDS.STATUS);
    if (statusField?.options) {
      const option = statusField.options.find(o => o.name === newStatus);
      if (option) {
        await this.factory.graphql(UPDATE_SELECT_FIELD, {
          projectId, itemId, fieldId: statusField.id, value: option.id,
        });
      }
    }
  }

  /** Load project fields into a Map keyed by field name. */
  private async loadFieldMap(projectId: string): Promise<Map<string, FieldNode>> {
    const resp = await this.factory.graphql<ListFieldsResponse>(LIST_FIELDS_QUERY, {
      projectId,
    });
    return new Map(resp.node.fields.nodes.map(f => [f.name, f]));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBranchName(issueNumber: number, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `agent/${issueNumber}-${slug}`;
}
