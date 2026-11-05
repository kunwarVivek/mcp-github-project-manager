import { ResourceNotFoundError } from "../domain/errors";
import { type ResourceStatus, ResourceType } from "../domain/resource-types";
import type { Issue } from "../domain/types";
import type { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import type { GitHubIssueRepository } from "../infrastructure/github/repositories/GitHubIssueRepository";
import type { GitHubMilestoneRepository } from "../infrastructure/github/repositories/GitHubMilestoneRepository";
import type {
  GitHubSubIssueRepository,
  IssueTimelineNode,
} from "../infrastructure/github/repositories/GitHubSubIssueRepository";
import type {
  ParentIssueResult,
  SubIssueListResult,
  SubIssueResult,
} from "../infrastructure/github/repositories/types";
import { safeCall } from "./utils/safeCall";

/**
 * Represents a dependency relationship between issues.
 * The issue with issueId depends on the issue with dependsOnId.
 */
export interface IssueDependency {
  issueId: string;
  dependsOnId: string;
  createdAt: string;
}

/**
 * Represents a history entry for an issue.
 */
export interface IssueHistoryEntry {
  id: string;
  action: string;
  timestamp: string;
  actor: string;
  changes: Record<string, unknown>;
}

/**
 * SubIssueService handles issue dependencies, status updates, and milestone assignments.
 *
 * This service is extracted from ProjectManagementService to provide a focused,
 * testable interface for issue-related operations.
 *
 * Can be instantiated directly with a GitHubRepositoryFactory or via dependency injection.
 */
export class SubIssueService {
  private readonly factory: GitHubRepositoryFactory;

  constructor(factory: GitHubRepositoryFactory) {
    this.factory = factory;
  }

  private get issueRepo(): GitHubIssueRepository {
    return this.factory.createIssueRepository();
  }

  private get milestoneRepo(): GitHubMilestoneRepository {
    return this.factory.createMilestoneRepository();
  }

  private get subIssueRepo(): GitHubSubIssueRepository {
    return this.factory.createSubIssueRepository();
  }

  /**
   * Adds an existing issue as a sub-issue of a parent issue (both by issue number).
   */
  async addSubIssue(
    parentIssueNumber: number,
    subIssueNumber: number,
    replaceParent = false
  ): Promise<SubIssueResult> {
    return safeCall(async () => {
      const repo = this.subIssueRepo;
      const [parentId, subIssueId] = await Promise.all([
        repo.getIssueNodeId(parentIssueNumber),
        repo.getIssueNodeId(subIssueNumber),
      ]);
      return repo.addSubIssue(parentId, subIssueId, replaceParent);
    });
  }

  /**
   * Lists the sub-issues of a parent issue (by issue number) with pagination.
   */
  async listSubIssues(
    issueNumber: number,
    first = 20,
    after?: string
  ): Promise<SubIssueListResult> {
    return safeCall(async () => {
      const repo = this.subIssueRepo;
      const issueId = await repo.getIssueNodeId(issueNumber);
      return repo.listSubIssues(issueId, first, after);
    });
  }

  /**
   * Gets the parent of an issue (by issue number), or null if it has none.
   */
  async getParentIssue(issueNumber: number): Promise<ParentIssueResult | null> {
    return safeCall(async () => {
      const repo = this.subIssueRepo;
      const issueId = await repo.getIssueNodeId(issueNumber);
      return repo.getParentIssue(issueId);
    });
  }

  /**
   * Moves a sub-issue within its parent's list, after `afterIssueNumber`
   * (or to the beginning when omitted).
   */
  async reprioritizeSubIssue(
    parentIssueNumber: number,
    subIssueNumber: number,
    afterIssueNumber?: number
  ): Promise<SubIssueResult> {
    return safeCall(async () => {
      const repo = this.subIssueRepo;
      const [parentId, subIssueId, afterId] = await Promise.all([
        repo.getIssueNodeId(parentIssueNumber),
        repo.getIssueNodeId(subIssueNumber),
        afterIssueNumber === undefined ? undefined : repo.getIssueNodeId(afterIssueNumber),
      ]);
      return repo.reprioritizeSubIssue(parentId, subIssueId, afterId);
    });
  }

  /**
   * Unlinks a sub-issue from its parent (the issue itself remains).
   */
  async removeSubIssue(parentIssueNumber: number, subIssueNumber: number): Promise<void> {
    return safeCall(async () => {
      const repo = this.subIssueRepo;
      const [parentId, subIssueId] = await Promise.all([
        repo.getIssueNodeId(parentIssueNumber),
        repo.getIssueNodeId(subIssueNumber),
      ]);
      await repo.removeSubIssue(parentId, subIssueId);
    });
  }

  /**
   * Updates the status of an issue.
   *
   * @param issueId - The ID of the issue to update
   * @param status - The new status to set
   * @returns The updated issue
   * @throws ResourceNotFoundError if the issue doesn't exist
   */
  async updateIssueStatus(issueId: string, status: ResourceStatus): Promise<Issue> {
    return safeCall(async () => {
      const issue = await this.issueRepo.findById(issueId);
      if (!issue) {
        throw new ResourceNotFoundError(ResourceType.ISSUE, issueId);
      }

      const updatedIssue = await this.issueRepo.update(issueId, { status });
      // Return plain object for MCP compatibility
      return updatedIssue;
    });
  }

  /**
   * Adds a dependency relationship between two issues.
   * The issue specified by issueId will depend on the issue specified by dependsOnId.
   *
   * Dependencies are tracked using labels in the format `depends-on:{dependsOnId}`.
   *
   * @param issueId - The ID of the dependent issue
   * @param dependsOnId - The ID of the issue that is depended upon
   * @throws ResourceNotFoundError if either issue doesn't exist
   */
  async addIssueDependency(issueId: string, dependsOnId: string): Promise<void> {
    return safeCall(async () => {
      // Verify the dependent issue exists
      const issue = await this.issueRepo.findById(issueId);
      if (!issue) {
        throw new ResourceNotFoundError(ResourceType.ISSUE, issueId);
      }

      // Verify the dependency target exists
      const dependentIssue = await this.issueRepo.findById(dependsOnId);
      if (!dependentIssue) {
        throw new ResourceNotFoundError(ResourceType.ISSUE, dependsOnId);
      }

      // Add a label to track the dependency
      const labels = [...issue.labels];
      if (!labels.includes(`depends-on:${dependsOnId}`)) {
        labels.push(`depends-on:${dependsOnId}`);
        await this.issueRepo.update(issueId, { labels });
      }
    });
  }

  /**
   * Gets all dependency IDs for a given issue.
   *
   * @param issueId - The ID of the issue to get dependencies for
   * @returns An array of issue IDs that this issue depends on
   * @throws ResourceNotFoundError if the issue doesn't exist
   */
  async getIssueDependencies(issueId: string): Promise<string[]> {
    return safeCall(async () => {
      const issue = await this.issueRepo.findById(issueId);
      if (!issue) {
        throw new ResourceNotFoundError(ResourceType.ISSUE, issueId);
      }

      // Extract dependency IDs from labels
      const dependencies: string[] = [];
      issue.labels.forEach((label) => {
        if (label.startsWith("depends-on:")) {
          dependencies.push(label.replace("depends-on:", ""));
        }
      });

      return dependencies;
    });
  }

  /**
   * Assigns an issue to a milestone.
   *
   * @param issueId - The ID of the issue to assign
   * @param milestoneId - The ID of the milestone to assign to
   * @returns The updated issue
   * @throws ResourceNotFoundError if either the issue or milestone doesn't exist
   */
  async assignIssueToMilestone(issueId: string, milestoneId: string): Promise<Issue> {
    return safeCall(async () => {
      const issue = await this.issueRepo.findById(issueId);
      if (!issue) {
        throw new ResourceNotFoundError(ResourceType.ISSUE, issueId);
      }

      const milestone = await this.milestoneRepo.findById(milestoneId);
      if (!milestone) {
        throw new ResourceNotFoundError(ResourceType.MILESTONE, milestoneId);
      }

      const updatedIssue = await this.issueRepo.update(issueId, { milestoneId });
      // Return plain object for MCP compatibility
      return updatedIssue;
    });
  }

  /**
   * Gets the history of changes for an issue from GitHub's issue timeline
   * (labels, assignees, state, milestone, title, projects, cross-references,
   * comments and parent/sub-issue links), oldest first.
   *
   * @param issueId - The ID of the issue to get history for
   * @returns An array of history entries
   * @throws ResourceNotFoundError if the issue doesn't exist
   */
  async getIssueHistory(issueId: string): Promise<IssueHistoryEntry[]> {
    return safeCall(async () => {
      const issue = await this.issueRepo.findById(issueId);
      if (!issue) {
        throw new ResourceNotFoundError(ResourceType.ISSUE, issueId);
      }

      const nodes = await this.subIssueRepo.getIssueTimeline(issue.number);
      return mapTimelineToHistory(nodes);
    });
  }
}

const UNKNOWN_ACTOR = "unknown";

/**
 * Maps raw GitHub timeline nodes to history entries. Node kinds this mapping
 * does not know are skipped (GitHub adds timeline event types over time).
 */
export function mapTimelineToHistory(nodes: IssueTimelineNode[]): IssueHistoryEntry[] {
  const entries: IssueHistoryEntry[] = [];
  for (const node of nodes) {
    const entry = mapTimelineNode(node);
    if (entry) entries.push(entry);
  }
  return entries;
}

function mapTimelineNode(node: IssueTimelineNode): IssueHistoryEntry | null {
  const changes = timelineChanges(node);
  if (!changes || !node.id || !node.createdAt) return null;
  return {
    id: node.id,
    action: changes.action,
    timestamp: node.createdAt,
    actor: node.actor?.login ?? node.author?.login ?? UNKNOWN_ACTOR,
    changes: changes.changes,
  };
}

function timelineChanges(
  node: IssueTimelineNode
): { action: string; changes: Record<string, unknown> } | null {
  switch (node.__typename) {
    case "LabeledEvent":
      return { action: "labeled", changes: { label: node.label?.name ?? null } };
    case "UnlabeledEvent":
      return { action: "unlabeled", changes: { label: node.label?.name ?? null } };
    case "AssignedEvent":
      return { action: "assigned", changes: { assignee: node.assignee?.login ?? null } };
    case "UnassignedEvent":
      return { action: "unassigned", changes: { assignee: node.assignee?.login ?? null } };
    case "ClosedEvent":
      return { action: "closed", changes: { stateReason: node.stateReason ?? null } };
    case "ReopenedEvent":
      return { action: "reopened", changes: {} };
    case "MilestonedEvent":
      return { action: "milestoned", changes: { milestone: node.milestoneTitle ?? null } };
    case "DemilestonedEvent":
      return { action: "demilestoned", changes: { milestone: node.milestoneTitle ?? null } };
    case "RenamedTitleEvent":
      return {
        action: "renamed",
        changes: { title: { from: node.previousTitle ?? null, to: node.currentTitle ?? null } },
      };
    case "AddedToProjectV2Event":
      return { action: "added_to_project", changes: { project: node.project?.title ?? null } };
    case "RemovedFromProjectV2Event":
      return { action: "removed_from_project", changes: { project: node.project?.title ?? null } };
    case "ProjectV2ItemStatusChangedEvent":
      return {
        action: "project_status_changed",
        changes: {
          project: node.project?.title ?? null,
          status: { from: node.previousStatus ?? null, to: node.status ?? null },
        },
      };
    case "CrossReferencedEvent":
      return {
        action: "cross_referenced",
        changes: {
          source: node.source
            ? {
                type: node.source.__typename,
                number: node.source.number ?? null,
                title: node.source.title ?? null,
                url: node.source.url ?? null,
              }
            : null,
        },
      };
    case "IssueComment":
      return { action: "commented", changes: { url: node.url ?? null } };
    case "SubIssueAddedEvent":
      return { action: "sub_issue_added", changes: { subIssue: node.subIssue ?? null } };
    case "SubIssueRemovedEvent":
      return { action: "sub_issue_removed", changes: { subIssue: node.subIssue ?? null } };
    case "ParentIssueAddedEvent":
      return { action: "parent_issue_added", changes: { parent: node.parent ?? null } };
    case "ParentIssueRemovedEvent":
      return { action: "parent_issue_removed", changes: { parent: node.parent ?? null } };
    default:
      return null;
  }
}
