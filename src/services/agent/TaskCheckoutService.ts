import type { GitHubRepositoryFactory } from '../../infrastructure/github/GitHubRepositoryFactory';
import type { AgentStore } from '../../infrastructure/agent/AgentStore';
import { AgentBudgetService } from './AgentBudgetService';
import type { AgentContextService } from './AgentContextService';
import type {
  Agent,
  AgentHeartbeat,
  AgentTaskContext,
  TaskCheckoutResult,
  CheckoutStrategy,
} from '../../domain/agent-orchestration-types';
import {
  AGENT_FIELDS,
  DEFAULT_HEARTBEAT_TIMEOUT_MINUTES,
} from '../../domain/agent-orchestration-types';
import { AIServiceFactory } from '../ai/AIServiceFactory';
import { mapErrorToMCPError } from '../utils/ErrorMapper';
import {
  TaskCheckedOutEvent,
  TaskReleasedEvent,
  TaskCompletedEvent,
  TaskSubmittedForReviewEvent,
  TaskApprovedEvent,
  TaskRejectedEvent,
  AgentHeartbeatEvent,
  TaskReclaimedEvent,
} from '../../domain/events';
import { domainEventBus } from '../../domain/events/DomainEventBus';

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
  createdAt: string;
  labels: { nodes: Array<{ name: string }> };
  milestone: { title: string; dueOn?: string | null } | null;
  projectItems: {
    nodes: ProjectItemNode[];
  };
}

interface ListIssuesResponse {
  repository: {
    issues: {
      nodes: IssueWithProject[];
      pageInfo?: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
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
  query($owner: String!, $repo: String!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      issues(first: 100, states: OPEN, orderBy: { field: CREATED_AT, direction: ASC }, after: $cursor) {
        nodes {
          id
          number
          title
          body
          state
          createdAt
          labels(first: 30) { nodes { name } }
          milestone { title dueOn }
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
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

/** Max pages of open issues to scan for checkout (config bound). */
const MAX_CHECKOUT_PAGES = 5;

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
  /** Skip issues whose declared blockers are still open. */
  skipBlocked?: boolean;
  /**
   * If true, only consider issues currently in the `review` state
   * (for reviewer agents). Mutually exclusive with other strategies.
   */
  reviewQueue?: boolean;
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
  private readonly aiFactory: AIServiceFactory;
  private readonly budgetService: AgentBudgetService;

  /**
   * @param factory - GitHub repository factory for API access.
   * @param agentStore - Agent registry for claim/release operations.
   * @param contextService - Service for building enriched task context.
   * @param aiFactory - AI service factory for AI-assisted checkout strategies.
   *     When omitted, defaults to the global singleton via `AIServiceFactory.getInstance()`.
   * @param budgetService - Budget gate for checkout. When omitted, one is built
   *     over the same agent store.
   */
  constructor(
    factory: GitHubRepositoryFactory,
    agentStore: AgentStore,
    contextService: AgentContextService,
    aiFactory?: AIServiceFactory,
    budgetService?: AgentBudgetService,
  ) {
    this.factory = factory;
    this.agentStore = agentStore;
    this.contextService = contextService;
    this.aiFactory = aiFactory ?? AIServiceFactory.getInstance();
    this.budgetService = budgetService ?? new AgentBudgetService(agentStore);
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
      if (agent.parentAgentId) {
        return {
          success: false,
          message: "Subagents inherit parent's task — use get_task_context with parent's task",
        };
      }

      if (agent.currentTaskId) {
        return {
          success: false,
          message: `Agent already has a task checked out: ${agent.currentTaskTitle ?? agent.currentTaskId}`,
        };
      }

      // Budget gate. Without this, an agent flipped to 'budget_exhausted' by
      // recordUsage could simply check out again: step 4 below sets
      // `agent.status = 'working'` unconditionally, silently clearing the
      // exhausted state. `hardStop` defaults to true and enforced nothing.
      const budgetStatus = await this.budgetService.getBudgetStatus(agentId);
      if (budgetStatus.isExhausted) {
        return {
          success: false,
          message:
            `Budget exhausted for ${budgetStatus.agentName}: ` +
            `${budgetStatus.usedTokens}/${budgetStatus.totalTokens} tokens used. ` +
            `Raise or reset the budget with set_agent_budget before checking out more work.`,
        };
      }

      const config = this.factory.getConfig();

      // 1. Fetch open issues with their project item fields (paginated)
      const issues = await this.fetchOpenIssues(config.owner, config.repo);

      // 2. Find an unclaimed issue (no agent_claimed_by, agent_status = unclaimed or absent)
      //    Review-queue claims always take precedence over the AI strategy.
      const candidate = options?.reviewQueue
        ? this.pickCandidate(issues, options, agent.capabilities)
        : options?.strategy === 'ai'
          ? await this.pickCandidateWithAI(issues, options, agent)
          : this.pickCandidate(issues, options, agent.capabilities);
      if (!candidate) {
        return { success: false, message: 'No unclaimed tasks available' };
      }

      // 3. Atomically claim via project field updates — verify the claim
      //    is still free immediately before writing to avoid TOCTOU races
      //    between concurrent agents.
      const projectItem = candidate.issue.projectItems.nodes[0];
      if (projectItem) {
        const claimed = await this.claimProjectItemAtomic(
          projectItem.project.id,
          projectItem.id,
          agentId,
        );
        if (!claimed) {
          return {
            success: false,
            message: `Task #${candidate.issue.number} was claimed by another agent concurrently — try again`,
          };
        }
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

      // Publish domain event
      domainEventBus.publish(TaskCheckedOutEvent.create({
        agentId,
        issueNumber: candidate.issue.number,
        issueTitle: candidate.issue.title,
        strategy: options?.strategy ?? 'highest_priority',
        selectionRationale: candidate.rationale,
        milestone: candidate.issue.milestone?.title,
        labels,
        branchSuggestion: context?.branchSuggestion ?? buildBranchName(candidate.issue.number, candidate.issue.title),
      }));

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
        selectionRationale: candidate.rationale,
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

      // Publish domain event
      domainEventBus.publish(TaskReleasedEvent.create({
        agentId,
        issueNumber: parseInt(taskId, 10),
        reason: 'Agent released task',
      }));

      return { success: true, message: `Task ${taskId} released by agent ${agentId}` };
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  /** Mark a task as completed. Optionally close the issue, mention a PR, deregister children, and auto-checkout next. */
  async completeTask(
    agentId: string,
    taskId: string,
    summary: string,
    options?: { closeIssue?: boolean; prNumber?: number; autoCheckoutNext?: boolean },
  ): Promise<{ success: boolean; message: string; nextTask?: TaskCheckoutResult }> {
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
      const config = this.factory.getConfig();
      const octokit = this.factory.getOctokit();

      if (!Number.isNaN(issueNumber)) {
        await this.clearClaimFields(issueNumber, 'completed').catch(() => {});

        // Build completion comment body
        const commentLines = [
          `## Agent Work Completed`,
          '',
          `**Agent:** ${agent.name} (\`${agentId}\`)`,
          `**Summary:** ${summary}`,
        ];
        if (options?.prNumber) {
          commentLines.push(`**Pull Request:** #${options.prNumber}`);
        }
        commentLines.push(`**Completed at:** ${new Date().toISOString()}`);

        await octokit.rest.issues.createComment({
          owner: config.owner,
          repo: config.repo,
          issue_number: issueNumber,
          body: commentLines.join('\n'),
        }).catch(() => {});

        // Close the issue unless explicitly opted out
        if (options?.closeIssue !== false) {
          await octokit.rest.issues.update({
            owner: config.owner,
            repo: config.repo,
            issue_number: issueNumber,
            state: 'closed',
          }).catch(() => {});
        }
      }

      // Cascade: deregister child agents
      const children = await this.agentStore.getChildren(agentId);
      for (const child of children) {
        await this.agentStore.removeAgent(child.id).catch(() => {});
      }

      // Update agent record
      agent.currentTaskId = undefined;
      agent.currentTaskTitle = undefined;
      agent.status = 'idle';
      await this.agentStore.upsertAgent(agent);

      // Publish domain event
      domainEventBus.publish(TaskCompletedEvent.create({
        agentId,
        issueNumber,
        summary,
        prNumber: options?.prNumber,
        closeIssue: options?.closeIssue ?? true,
      }));

      // Auto-checkout next task unless explicitly opted out
      let nextTask: TaskCheckoutResult | undefined;
      if (options?.autoCheckoutNext !== false) {
        try {
          const result = await this.checkoutTask(agentId);
          if (result.success) {
            nextTask = result;
          }
        } catch {
          // Auto-checkout failure is non-fatal
        }
      }

      return {
        success: true,
        message: `Task ${taskId} completed by agent ${agentId}`,
        nextTask,
      };
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

      // Append to bounded heartbeat history (most recent first)
      const history = Array.isArray(agent.metadata?.heartbeatHistory)
        ? (agent.metadata.heartbeatHistory as Array<Record<string, unknown>>)
        : [];
      history.unshift({
        timestamp: heartbeat.timestamp,
        status: heartbeat.status,
        ...(heartbeat.progress != null && { progress: heartbeat.progress }),
        ...(heartbeat.progressSummary && { progressSummary: heartbeat.progressSummary }),
        ...(heartbeat.currentBranch && { currentBranch: heartbeat.currentBranch }),
      });
      agent.metadata = {
        ...agent.metadata,
        heartbeatHistory: history.slice(0, 50),
      };

      await this.agentStore.upsertAgent(agent);

      // Publish domain event
      domainEventBus.publish(AgentHeartbeatEvent.create({
        agentId: heartbeat.agentId,
        status: heartbeat.status,
        progress: heartbeat.progress,
        progressSummary: heartbeat.progressSummary,
        currentBranch: heartbeat.currentBranch,
        estimatedCompletionMinutes: heartbeat.estimatedCompletionMinutes,
        blockerDescription: heartbeat.blockerDescription,
      }));

      // Propagate heartbeat to parent agent
      if (agent.parentAgentId) {
        const parent = await this.agentStore.getAgent(agent.parentAgentId);
        if (parent) {
          parent.lastHeartbeat = heartbeat.timestamp;
          await this.agentStore.upsertAgent(parent);
        }
      }

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
      // Never bootstrap the registry from a background sweep: if no registry
      // issue exists, there is nothing to reclaim (and we must not create
      // issues in a repo that never opted into the agent layer).
      if (!(await this.agentStore.registryExists())) {
        return { reclaimed: 0, details: [] };
      }

      const agents = await this.agentStore.listAgents();
      const now = Date.now();
      const timeoutMs = timeoutMinutes * 60_000;
      const reclaimed: Array<{ agentId: string; taskId: string }> = [];

      const config = this.factory.getConfig();
      const octokit = this.factory.getOctokit();

      for (const agent of agents) {
        if (!agent.currentTaskId) continue;
        // Skip agents that never heartbeated. This intentionally includes
        // subagents (parentAgentId) that inherit the parent's task claim
        // without ever heartbeating themselves — their parent's heartbeat
        // governs the shared claim, and reclaiming the child would wrongly
        // un-claim the parent's task.
        if (!agent.lastHeartbeat) continue;

        const elapsed = now - new Date(agent.lastHeartbeat).getTime();
        if (elapsed < timeoutMs) continue;

        // Release the task
        const taskId = agent.currentTaskId;
        const issueNumber = parseInt(taskId, 10);
        if (!Number.isNaN(issueNumber)) {
          await this.clearClaimFields(issueNumber, 'unclaimed').catch(() => {});

          // Audit trail: humans and other agents see why the task was released.
          await octokit.rest.issues.createComment({
            owner: config.owner,
            repo: config.repo,
            issue_number: issueNumber,
            body: [
              '## Agent Task Auto-Reclaimed',
              '',
              `**Agent:** ${agent.name} (\`${agent.id}\`)`,
              `**Task:** #${taskId}`,
              `**Reason:** No heartbeat for more than ${timeoutMinutes} min`,
              `**Reclaimed at:** ${new Date().toISOString()}`,
              '',
              'The task has been returned to the unclaimed pool and can be picked up by another agent.',
            ].join('\n'),
          }).catch(() => {});
        }

        agent.currentTaskId = undefined;
        agent.currentTaskTitle = undefined;
        agent.status = 'offline';
        await this.agentStore.upsertAgent(agent);

        // Publish domain event
        domainEventBus.publish(TaskReclaimedEvent.create({
          issueNumber,
          previousAgentId: agent.id,
          reason: `No heartbeat for more than ${timeoutMinutes} min`,
        }));

        reclaimed.push({ agentId: agent.id, taskId });
      }

      return { reclaimed: reclaimed.length, details: reclaimed };
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  // -----------------------------------------------------------------------
  // Review workflow
  // -----------------------------------------------------------------------

  /**
   * Submit a task for review. The issue's agent_status is moved to
   * `review` and the submitting agent enters `needs_review`.
   */
  async submitForReview(
    agentId: string,
    taskId: string,
    summary?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const agent = await this.agentStore.getAgent(agentId);
      if (!agent) {
        return { success: false, message: `Agent not found: ${agentId}` };
      }
      if (agent.currentTaskId !== taskId) {
        return { success: false, message: `Agent ${agentId} does not own task ${taskId}` };
      }

      const issueNumber = parseInt(taskId, 10);
      if (!Number.isNaN(issueNumber)) {
        await this.setStatusField(issueNumber, 'review').catch(() => {});
        // Record a structured comment so reviewers/humans can see the submission
        const config = this.factory.getConfig();
        const octokit = this.factory.getOctokit();
        await octokit.rest.issues.createComment({
          owner: config.owner,
          repo: config.repo,
          issue_number: issueNumber,
          body: `## Agent Work Submitted for Review\n\n**Agent:** ${agent.name} (\`${agentId}\`)\n${summary ? `**Summary:** ${summary}\n` : ''}**Submitted at:** ${new Date().toISOString()}`,
        }).catch(() => {});
      }

      agent.status = 'needs_review';
      await this.agentStore.upsertAgent(agent);

      // Publish domain event
      domainEventBus.publish(TaskSubmittedForReviewEvent.create({
        agentId,
        issueNumber,
        summary,
      }));

      return { success: true, message: `Task ${taskId} submitted for review by ${agentId}` };
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  /**
   * Approve a reviewed task — completes it. Reviewer ownership is required
   * when the task was claimed by a reviewer (reviewQueue flow); otherwise
   * any call with the original agent is accepted.
   */
  async approveTask(
    reviewerId: string,
    taskId: string,
    summary?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const reviewer = await this.agentStore.getAgent(reviewerId);
      if (!reviewer) {
        return { success: false, message: `Agent not found: ${reviewerId}` };
      }

      const issueNumber = parseInt(taskId, 10);
      const config = this.factory.getConfig();
      const octokit = this.factory.getOctokit();

      // Release the original submitting agent (the one still holding the task)
      await this.releaseTaskOwner(taskId, reviewerId, reviewer);

      if (!Number.isNaN(issueNumber)) {
        await this.clearClaimFields(issueNumber, 'completed').catch(() => {});
        await octokit.rest.issues.createComment({
          owner: config.owner,
          repo: config.repo,
          issue_number: issueNumber,
          body: `## Agent Work Approved\n\n**Reviewer:** ${reviewer.name} (\`${reviewerId}\`)\n${summary ? `**Note:** ${summary}\n` : ''}**Approved at:** ${new Date().toISOString()}`,
        }).catch(() => {});
        await octokit.rest.issues.update({
          owner: config.owner,
          repo: config.repo,
          issue_number: issueNumber,
          state: 'closed',
        }).catch(() => {});
      }

      // Publish domain event
      domainEventBus.publish(TaskApprovedEvent.create({
        issueNumber,
        reviewerId,
        summary,
      }));

      return { success: true, message: `Task ${taskId} approved by ${reviewerId}` };
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  /**
   * Reject a reviewed task — returns it to the unclaimed pool and records
   * the reviewer's feedback on the issue.
   */
  async rejectTask(
    reviewerId: string,
    taskId: string,
    feedback?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const reviewer = await this.agentStore.getAgent(reviewerId);
      if (!reviewer) {
        return { success: false, message: `Agent not found: ${reviewerId}` };
      }

      const issueNumber = parseInt(taskId, 10);
      const config = this.factory.getConfig();
      const octokit = this.factory.getOctokit();

      // Release the original submitting agent so it can pick up new work
      await this.releaseTaskOwner(taskId, reviewerId, reviewer);

      if (!Number.isNaN(issueNumber)) {
        await this.clearClaimFields(issueNumber, 'unclaimed').catch(() => {});
        await octokit.rest.issues.createComment({
          owner: config.owner,
          repo: config.repo,
          issue_number: issueNumber,
          body: `## Agent Work Rejected\n\n**Reviewer:** ${reviewer.name} (\`${reviewerId}\`)\n${feedback ? `**Feedback:** ${feedback}\n` : ''}**Rejected at:** ${new Date().toISOString()}`,
        }).catch(() => {});
      }

      // Publish domain event
      domainEventBus.publish(TaskRejectedEvent.create({
        issueNumber,
        reviewerId,
        feedback,
      }));

      return { success: true, message: `Task ${taskId} rejected by ${reviewerId} and returned to pool` };
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Reset the agent that owns a task (used by the review approve/reject
   * flow so the submitting agent is released even though the reviewer
   * performs the transition).
   */
  private async releaseTaskOwner(
    taskId: string,
    _reviewerId: string,
    reviewer: Agent,
  ): Promise<void> {
    // The reviewer may have claimed the task from the review queue (in which
    // case they own it) or may be an external reviewer — find the current owner.
    let owner: Agent | undefined = reviewer;
    if (reviewer.currentTaskId !== taskId) {
      const agents = await this.agentStore.listAgents();
      owner = agents.find(a => a.currentTaskId === taskId) ?? undefined;
    }

    if (owner && owner.currentTaskId === taskId) {
      owner.currentTaskId = undefined;
      owner.currentTaskTitle = undefined;
      owner.status = 'idle';
      await this.agentStore.upsertAgent(owner);
    }
  }

  /**
   * Fetch open issues with project item fields, paginated up to a bound.
   * The query orders by CREATED_AT ASC; we walk `after` cursors until
   * exhaustion or MAX_CHECKOUT_PAGES.
   */
  private async fetchOpenIssues(owner: string, repo: string): Promise<IssueWithProject[]> {
    const all: IssueWithProject[] = [];
    let cursor: string | null | undefined;

    for (let page = 0; page < MAX_CHECKOUT_PAGES; page++) {
      const resp = await this.factory.graphql<ListIssuesResponse>(LIST_OPEN_ISSUES_QUERY, {
        owner,
        repo,
        cursor: cursor ?? undefined,
      });
      const issues = resp.repository.issues;
      all.push(...issues.nodes);

      if (!issues.pageInfo?.hasNextPage || !issues.pageInfo.endCursor) {
        break;
      }
      cursor = issues.pageInfo.endCursor;
    }

    return all;
  }

  /**
   * AI-assisted candidate selection. Ranks the claimable pool with the
   * LLM (Vercel AI SDK `generateObject`) when a model is available, and
   * gracefully falls back to deterministic priority+skills ranking when
   * AI is unavailable or the call fails.
   */
  private async pickCandidateWithAI(
    issues: IssueWithProject[],
    options?: CheckoutOptions,
    agent?: Agent,
  ): Promise<{ issue: IssueWithProject; rationale?: string } | null> {
    const fallback = this.pickCandidate(issues, options, agent?.capabilities);
    if (!fallback) return null;

    try {
      const model = this.aiFactory.getBestAvailableModel();
      if (!model) return fallback;

      // Build the candidate pool (same eligibility rules as pickCandidate)
      const openNumbers = new Set(issues.map(i => i.number));
      const pool: Array<{
        number: number;
        title: string;
        labels: string[];
        milestone: string | null;
        createdAt: string;
        skillScore: number;
        blocked: boolean;
      }> = [];

      for (const issue of issues) {
        if (issue.projectItems.nodes.length === 0) continue;
        if (options?.projectId && !issue.projectItems.nodes.some(pi => pi.project.id === options.projectId)) continue;
        const labels = issue.labels.nodes.map(l => l.name);
        const claimedBy = issue.projectItems.nodes[0].fieldValues.nodes.find(
          fv => fv.field?.name === AGENT_FIELDS.CLAIMED_BY,
        );
        const status = issue.projectItems.nodes[0].fieldValues.nodes.find(
          fv => fv.field?.name === AGENT_FIELDS.STATUS,
        );
        if (claimedBy?.text) continue;
        if (status?.name && status.name !== 'unclaimed') continue;
        if (options?.skipBlocked && hasOpenBlocker(issue, openNumbers)) continue;
        if (options?.labels?.length) {
          const issueLabels = new Set(labels.map(l => l.toLowerCase()));
          if (!options.labels.some(l => issueLabels.has(l.toLowerCase()))) continue;
        }

        let skillScore = 0;
        if (agent?.capabilities?.length) {
          const issueLabels = new Set(labels.map(l => l.toLowerCase()));
          for (const cap of agent.capabilities) {
            if (issueLabels.has(cap.toLowerCase())) skillScore++;
          }
        }

        pool.push({
          number: issue.number,
          title: issue.title,
          labels,
          milestone: issue.milestone?.title ?? null,
          createdAt: issue.createdAt,
          skillScore,
          blocked: hasOpenBlocker(issue, openNumbers),
        });
      }

      if (pool.length === 0) return fallback;

      const { generateObject } = await import('ai');
      const { z } = await import('zod');

      const schema = z.object({
        issueNumber: z.number().int().positive(),
        rationale: z.string().describe('One or two sentences explaining the selection'),
      });

      const { object } = await generateObject({
        model,
        schema,
        system: 'You are a task dispatcher for an autonomous agent swarm. ' +
          'Pick the single most appropriate task for the given agent from the candidate list. ' +
          'Prefer tasks matching the agent\'s skills, highest priority, unblocked, and closest deadlines. ' +
          'Respond with the issue number you chose and a short rationale.',
        prompt: `Agent: ${agent?.name ?? 'unknown'} (role: ${agent?.role ?? 'general'})\n` +
          `Agent capabilities: ${agent?.capabilities?.join(', ') || 'none'}\n\n` +
          `Candidate issues:\n${pool.map(c =>
            `- #${c.number} "${c.title}" [labels: ${c.labels.join(', ') || 'none'}] [milestone: ${c.milestone ?? 'none'}] [skillScore: ${c.skillScore}] [blocked: ${c.blocked}] [created: ${c.createdAt.slice(0, 10)}]`,
          ).join('\n')}`,
      });

      const chosen = pool.find(c => c.number === object.issueNumber) ?? pool[0];
      const issue = issues.find(i => i.number === chosen.number);
      if (!issue) return fallback;

      return { issue, rationale: object.rationale };
    } catch {
      // AI failure is non-fatal — fall back to deterministic ranking
      return fallback;
    }
  }

  /**
   * Pick the best unclaimed candidate using the requested strategy.
   * Each strategy returns an ordered ranking; `highest_priority` is the
   * default and factors in both priority labels and skill match.
   */
  private pickCandidate(
    issues: IssueWithProject[],
    options?: CheckoutOptions,
    agentCapabilities?: string[],
  ): { issue: IssueWithProject; rationale?: string } | null {
    const strategy = options?.reviewQueue
      ? 'review_queue'
      : (options?.strategy ?? 'highest_priority');

    // For reviewer agents: only consider issues in the `review` state.
    if (strategy === 'review_queue') {
      return this.pickFromState(issues, 'review', options, 'Needs review');
    }

    // Build the pool of claimable candidates with scoring context.
    const openNumbers = new Set(issues.map(i => i.number));
    const candidates: Array<{
      issue: IssueWithProject;
      priorityScore: number;
      skillScore: number;
      createdAt: number;
      dueOn: number | null;
    }> = [];

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

      // Dependency awareness: skip issues whose declared blockers are open
      if (options?.skipBlocked && hasOpenBlocker(issue, openNumbers)) {
        continue;
      }

      // Priority score from labels (P0/P1/P2/P3 or priority:critical/high/medium/low)
      const labels = issue.labels.nodes.map(l => l.name);
      const priorityScore = labelPriorityScore(labels);

      // Skill match score
      let skillScore = 0;
      if (agentCapabilities?.length) {
        const issueLabels = new Set(labels.map(l => l.toLowerCase()));
        for (const cap of agentCapabilities) {
          if (issueLabels.has(cap.toLowerCase())) skillScore++;
        }
      }

      candidates.push({
        issue,
        priorityScore,
        skillScore,
        createdAt: new Date(issue.createdAt).getTime(),
        dueOn: issue.milestone?.dueOn ? new Date(issue.milestone.dueOn).getTime() : null,
      });
    }

    if (candidates.length === 0) return null;

    switch (strategy) {
      case 'oldest_first': {
        candidates.sort((a, b) => a.createdAt - b.createdAt);
        return {
          issue: candidates[0].issue,
          rationale: 'Oldest task first',
        };
      }

      case 'milestone_deadline': {
        // Issues with a milestone deadline first (soonest deadline), then no deadline
        candidates.sort((a, b) => {
          if (a.dueOn == null && b.dueOn == null) return b.priorityScore - a.priorityScore;
          if (a.dueOn == null) return 1;
          if (b.dueOn == null) return -1;
          return a.dueOn - b.dueOn;
        });
        const best = candidates[0]!;
        return {
          issue: best.issue,
          rationale: best.dueOn != null
            ? `Earliest milestone deadline (${new Date(best.dueOn).toISOString().slice(0, 10)})`
            : 'No milestone deadline — highest priority fallback',
        };
      }

      case 'skills_match': {
        candidates.sort((a, b) => b.skillScore - a.skillScore || b.priorityScore - a.priorityScore);
        const best = candidates[0]!;
        return {
          issue: best.issue,
          rationale: `Best skill match (${best.skillScore} matching capability/label pairs)`,
        };
      }

      case 'ai': {
        // AI ranking happens in the caller (checkoutTask) because it needs
        // async model access; here we return the highest-scoring fallback.
        candidates.sort((a, b) =>
          b.priorityScore + b.skillScore - (a.priorityScore + a.skillScore));
        return {
          issue: candidates[0].issue,
          rationale: 'AI ranking unavailable — fell back to priority + skills',
        };
      }

      case 'highest_priority':
      default: {
        candidates.sort((a, b) =>
          b.priorityScore - a.priorityScore || b.skillScore - a.skillScore);
        const best = candidates[0]!;
        return {
          issue: best.issue,
          rationale: best.priorityScore > 0
            ? `Highest priority (priority score ${best.priorityScore})`
            : 'Highest priority — no priority labels, best skill match',
        };
      }
    }
  }

  /** Pick from issues in a specific agent_status state (e.g. review queue). */
  private pickFromState(
    issues: IssueWithProject[],
    state: string,
    options?: CheckoutOptions,
    label = 'Issue in queue',
  ): { issue: IssueWithProject; rationale?: string } | null {
    for (const issue of issues) {
      if (issue.projectItems.nodes.length === 0) continue;

      if (options?.projectId) {
        const inProject = issue.projectItems.nodes.some(
          pi => pi.project.id === options.projectId,
        );
        if (!inProject) continue;
      }

      const item = issue.projectItems.nodes[0]!;
      const status = item.fieldValues.nodes.find(
        fv => fv.field?.name === AGENT_FIELDS.STATUS,
      );
      if (status?.name !== state) continue;

      return { issue, rationale: label };
    }
    return null;
  }

  /**
   * Claim a project item with best-effort TOCTOU protection.
   *
   * GitHub's project-item mutations are not conditional, so true atomicity
   * is impossible — but we narrow the race window by (a) reading fresh
   * immediately before writing and (b) verifying after writing that our
   * claim actually stuck; if another agent won, we return false so the
   * caller aborts instead of double-assigning.
   */
  private async claimProjectItemAtomic(
    projectId: string,
    itemId: string,
    agentId: string,
  ): Promise<boolean> {
    // Fresh read to confirm the item is still unclaimed
    const fresh = await this.readItemFields(projectId, itemId);
    const claimedBy = fresh.find(fv => fv.field?.name === AGENT_FIELDS.CLAIMED_BY);
    if (claimedBy?.text) return false;

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

    // Post-write verification: confirm our claim stuck. If another agent
    // wrote in the window, abort so only one agent owns the task.
    const after = await this.readItemFields(projectId, itemId);
    const afterClaim = after.find(fv => fv.field?.name === AGENT_FIELDS.CLAIMED_BY);
    return afterClaim?.text === agentId;
  }

  /** Read the current field values of a project item (used for claim verification). */
  private async readItemFields(
    _projectId: string,
    itemId: string,
  ): Promise<ProjectItemFieldValue[]> {
    // Only $itemId is used by the operation — GitHub rejects anonymous
    // operations that declare a variable and never use it, so do not
    // declare $projectId here.
    const query = `
      query($itemId: ID!) {
        node(id: $itemId) {
          ... on ProjectV2Item {
            project { id }
            fieldValues(first: 30) {
              nodes {
                ... on ProjectV2ItemFieldTextValue { field { ... on ProjectV2Field { name } } text }
                ... on ProjectV2ItemFieldSingleSelectValue { field { ... on ProjectV2SingleSelectField { name } } name }
              }
            }
          }
        }
      }
    `;

    interface ReadItemResponse {
      node: {
        project: { id: string };
        fieldValues: {
          nodes: ProjectItemFieldValue[];
        };
      } | null;
    }

    const resp = await this.factory.graphql<ReadItemResponse>(query, { itemId });
    return resp.node?.fieldValues.nodes ?? [];
  }

  /** Set only the agent_status field to the given value (used by review flow). */
  private async setStatusField(issueNumber: number, newStatus: 'review' | 'blocked'): Promise<void> {
    const config = this.factory.getConfig();

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
    const fields = await this.loadFieldMap(item.project.id);
    const statusField = fields.get(AGENT_FIELDS.STATUS);
    if (statusField?.options) {
      const option = statusField.options.find(o => o.name === newStatus);
      if (option) {
        await this.factory.graphql(UPDATE_SELECT_FIELD, {
          projectId: item.project.id, itemId: item.id, fieldId: statusField.id, value: option.id,
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

// ---------------------------------------------------------------------------
// Pure scoring helpers
// ---------------------------------------------------------------------------

/**
 * Priority score derived from issue labels.
 * Supports both `P0`-`P3` and `priority:critical|high|medium|low` conventions.
 */
function labelPriorityScore(labels: string[]): number {
  let score = 0;
  for (const label of labels) {
    const normalized = label.toLowerCase();
    if (/^p0$/.test(normalized) || normalized.includes('priority:critical') || normalized.includes('priority:urgent')) score = Math.max(score, 4);
    else if (/^p1$/.test(normalized) || normalized.includes('priority:high')) score = Math.max(score, 3);
    else if (/^p2$/.test(normalized) || normalized.includes('priority:medium')) score = Math.max(score, 2);
    else if (/^p3$/.test(normalized) || normalized.includes('priority:low')) score = Math.max(score, 1);
  }
  return score;
}

/**
 * Detect whether an issue declares blockers that are still open.
 * Recognizes `Blocked by #N`, `Depends on #N`, and a `blocked` label.
 */
function hasOpenBlocker(issue: IssueWithProject, openNumbers: Set<number>): boolean {
  const labels = issue.labels.nodes.map(l => l.name.toLowerCase());
  if (labels.includes('blocked')) return true;

  const body = issue.body ?? '';
  const patterns = [
    /blocked\s+by\s+#?(\d+)/gi,
    /blocker\s*:\s*#?(\d+)/gi,
    /depends\s+on\s+#?(\d+)/gi,
    /depends\s*:\s*#?(\d+)/gi,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(body);
    if (match?.[1] && openNumbers.has(Number(match[1]))) {
      return true;
    }
  }
  return false;
}
