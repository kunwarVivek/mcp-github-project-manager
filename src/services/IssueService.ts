import type {
  CreateIssue,
  Issue,
  IssueDependency,
  IssueProjectMembership,
  IssueTypeDefinition,
} from "../domain/types";
import { filterByStatus, parseResourceStatus } from "../domain/utils/StatusParser";
import type { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import type { GitHubIssueRepository } from "../infrastructure/github/repositories/GitHubIssueRepository";
import { safeCall } from "./utils/safeCall";

/** A GitHub issue comment as returned by the REST API. */
export interface IssueComment {
  id: number;
  body: string;
  user: string;
  createdAt: string;
  updatedAt: string;
}

/** A GitHub Projects v2 draft issue. */
export interface DraftIssue {
  id: string;
  title: string;
  body: string;
}

/**
 * IssueService handles issue CRUD, issue comments, and Projects v2 draft issues.
 *
 * Extracted from ProjectManagementService (which now delegates to it) to provide
 * a focused, testable interface for issue-related operations. Can be instantiated
 * directly with a GitHubRepositoryFactory or via dependency injection.
 */
export class IssueService {
  private readonly factory: GitHubRepositoryFactory;

  constructor(factory: GitHubRepositoryFactory) {
    this.factory = factory;
  }

  private get issueRepo(): GitHubIssueRepository {
    return this.factory.createIssueRepository();
  }

  async createIssue(data: {
    title: string;
    description: string;
    milestoneId?: string;
    assignees?: string[];
    labels?: string[];
    priority?: string;
    type?: string;
  }): Promise<Issue> {
    return safeCall(async () => {
      const labels = data.labels || [];
      if (data.priority) labels.push(`priority:${data.priority}`);
      if (data.type) labels.push(`type:${data.type}`);

      const issueData: CreateIssue = {
        title: data.title,
        description: data.description,
        assignees: data.assignees || [],
        labels,
        milestoneId: data.milestoneId,
      };

      const issue = await this.issueRepo.create(issueData);
      // Return plain object for MCP compatibility
      return issue;
    });
  }

  async listIssues(
    options: {
      status?: string;
      milestone?: string;
      labels?: string[];
      assignee?: string;
      sort?: string;
      direction?: string;
      limit?: number;
    } = {}
  ): Promise<Issue[]> {
    return safeCall(async () => {
      const {
        status = "open",
        milestone,
        labels = [],
        assignee,
        sort = "created",
        direction = "desc",
        limit = 30,
      } = options;

      let issues: Issue[];
      if (milestone) {
        issues = await this.issueRepo.findByMilestone(milestone);
      } else {
        issues = await this.issueRepo.findAll();
      }

      if (status !== "all") {
        issues = filterByStatus(issues, status, "issue");
      }

      if (labels.length > 0) {
        issues = issues.filter((issue) => labels.every((label) => issue.labels.includes(label)));
      }

      if (assignee) {
        issues = issues.filter((issue) => issue.assignees.includes(assignee));
      }

      issues.sort((a, b) => {
        let valueA: string | number | undefined;
        let valueB: string | number | undefined;
        switch (sort) {
          case "updated":
            valueA = a.updatedAt;
            valueB = b.updatedAt;
            break;
          case "created":
          default:
            valueA = a.createdAt;
            valueB = b.createdAt;
        }
        const comparison = valueA.localeCompare(valueB);
        return direction === "desc" ? -comparison : comparison;
      });

      // Return plain objects for MCP compatibility
      return issues.slice(0, limit);
    });
  }

  async getIssue(issueId: string): Promise<Issue | null> {
    return safeCall(async () => {
      const issue = await this.issueRepo.findById(issueId);
      // Return plain object for MCP compatibility
      return issue;
    });
  }

  async updateIssue(
    issueId: string,
    updates: {
      title?: string;
      description?: string;
      status?: string;
      milestoneId?: string | null;
      assignees?: string[];
      labels?: string[];
      type?: string;
    }
  ): Promise<Issue> {
    return safeCall(async () => {
      const data: Partial<Issue> = {};
      if (updates.title) data.title = updates.title;
      if (updates.description) data.description = updates.description;
      if (updates.status) {
        data.status = parseResourceStatus(updates.status, "issue");
      }
      if (updates.assignees) data.assignees = updates.assignees;
      if (updates.labels) data.labels = updates.labels;
      if (updates.milestoneId === null) {
        data.milestoneId = undefined;
      } else if (updates.milestoneId !== undefined) {
        data.milestoneId = updates.milestoneId;
      }

      const issue = await this.issueRepo.update(issueId, data);
      // The issue type is a separate write: the native organization issue
      // type is not part of the issue update input.
      if (updates.type) {
        await this.issueRepo.setIssueType(issueId, updates.type);
      }
      // Return plain object for MCP compatibility
      return issue;
    });
  }

  /**
   * The native "blocked by" edges of an issue.
   *
   * `direction` selects which side of the edge is read: `blocked_by` are the
   * issues that block this one, `blocking` are the issues this one blocks.
   * The edges that predate the native API (`blocked-by:#123` labels) are
   * merged into the answer, so a board wired up before the native edge
   * exists keeps working.
   */
  async listIssueBlockers(
    issueId: string,
    direction: "blocked_by" | "blocking" = "blocked_by"
  ): Promise<IssueDependency[]> {
    return safeCall(async () => {
      return direction === "blocking"
        ? await this.issueRepo.listBlocking(issueId)
        : await this.issueRepo.listBlockers(issueId);
    });
  }

  /** Makes an issue blocked by another one (native edge). */
  async addIssueBlocker(issueId: string, blockingIssueId: string): Promise<IssueDependency> {
    return safeCall(async () => this.issueRepo.addBlocker(issueId, blockingIssueId));
  }

  /** Removes a native "blocked by" edge. */
  async removeIssueBlocker(issueId: string, blockingIssueId: string): Promise<void> {
    return safeCall(async () => this.issueRepo.removeBlocker(issueId, blockingIssueId));
  }

  /** The issue types the organization defines. */
  async listIssueTypes(): Promise<IssueTypeDefinition[]> {
    return safeCall(async () => this.issueRepo.listIssueTypes());
  }

  /**
   * Sets the issue type.
   *
   * The native organization issue type is written when the deployment knows
   * it; otherwise the `type:<name>` label emulation is used.
   */
  async setIssueType(issueId: string, issueType: string): Promise<IssueTypeDefinition | null> {
    return safeCall(async () => this.issueRepo.setIssueType(issueId, issueType));
  }

  /** The projects an issue is tracked on (native reverse membership). */
  async getIssueProjectMembership(issueId: string): Promise<IssueProjectMembership> {
    return safeCall(async () => this.issueRepo.getProjectMembership(issueId));
  }

  async createIssueComment(data: { issueNumber: number; body: string }): Promise<IssueComment> {
    return safeCall(async () => {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.issues.createComment({
        owner: config.owner,
        repo: config.repo,
        issue_number: data.issueNumber,
        body: data.body,
      });

      return {
        id: response.data.id,
        body: response.data.body || "",
        user: response.data.user?.login || "unknown",
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at,
      };
    });
  }

  async updateIssueComment(data: { commentId: number; body: string }): Promise<IssueComment> {
    return safeCall(async () => {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.issues.updateComment({
        owner: config.owner,
        repo: config.repo,
        comment_id: data.commentId,
        body: data.body,
      });

      return {
        id: response.data.id,
        body: response.data.body || "",
        user: response.data.user?.login || "unknown",
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at,
      };
    });
  }

  async deleteIssueComment(data: {
    commentId: number;
  }): Promise<{ success: boolean; message: string }> {
    return safeCall(async () => {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      await octokit.rest.issues.deleteComment({
        owner: config.owner,
        repo: config.repo,
        comment_id: data.commentId,
      });

      return { success: true, message: `Comment ${data.commentId} deleted successfully` };
    });
  }

  async listIssueComments(data: { issueNumber: number; limit?: number }): Promise<IssueComment[]> {
    return safeCall(async () => {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.issues.listComments({
        owner: config.owner,
        repo: config.repo,
        issue_number: data.issueNumber,
        per_page: data.limit || 30,
      });

      return response.data.map((comment) => ({
        id: comment.id,
        body: comment.body || "",
        user: comment.user?.login || "unknown",
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
      }));
    });
  }

  async createDraftIssue(data: {
    projectId: string;
    title: string;
    body?: string;
    assigneeIds?: string[];
  }): Promise<DraftIssue> {
    return safeCall(async () => {
      const mutation = `
        mutation($input: AddProjectV2DraftIssueInput!) {
          addProjectV2DraftIssue(input: $input) {
            projectV2Item {
              id
              content {
                ... on DraftIssue {
                  id
                  title
                  body
                }
              }
            }
          }
        }
      `;

      interface AddDraftIssueResponse {
        addProjectV2DraftIssue: {
          projectV2Item: {
            id: string;
            content: { id: string; title: string; body: string };
          };
        };
      }

      const response = await this.factory.graphql<AddDraftIssueResponse>(mutation, {
        input: {
          projectId: data.projectId,
          title: data.title,
          body: data.body || "",
          assigneeIds: data.assigneeIds || [],
        },
      });

      const content = response.addProjectV2DraftIssue.projectV2Item.content;
      return { id: content.id, title: content.title, body: content.body };
    });
  }

  async updateDraftIssue(data: {
    draftIssueId: string;
    title?: string;
    body?: string;
    assigneeIds?: string[];
  }): Promise<DraftIssue> {
    return safeCall(async () => {
      const mutation = `
        mutation($input: UpdateProjectV2DraftIssueInput!) {
          updateProjectV2DraftIssue(input: $input) {
            draftIssue {
              id
              title
              body
            }
          }
        }
      `;

      interface UpdateDraftIssueResponse {
        updateProjectV2DraftIssue: {
          draftIssue: { id: string; title: string; body: string };
        };
      }

      const input: Record<string, unknown> = { draftIssueId: data.draftIssueId };
      if (data.title !== undefined) input.title = data.title;
      if (data.body !== undefined) input.body = data.body;
      if (data.assigneeIds !== undefined) input.assigneeIds = data.assigneeIds;

      const response = await this.factory.graphql<UpdateDraftIssueResponse>(mutation, { input });
      const draftIssue = response.updateProjectV2DraftIssue.draftIssue;
      return { id: draftIssue.id, title: draftIssue.title, body: draftIssue.body };
    });
  }

  async deleteDraftIssue(data: {
    draftIssueId: string;
  }): Promise<{ success: boolean; message: string }> {
    return safeCall(async () => {
      const mutation = `
        mutation($input: DeleteProjectV2DraftIssueInput!) {
          deleteProjectV2DraftIssue(input: $input) {
            draftIssue { id }
          }
        }
      `;

      await this.factory.graphql(mutation, { input: { draftIssueId: data.draftIssueId } });
      return { success: true, message: `Draft issue ${data.draftIssueId} deleted successfully` };
    });
  }
}
