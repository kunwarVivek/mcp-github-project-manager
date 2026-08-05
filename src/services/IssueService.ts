import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { GitHubIssueRepository } from "../infrastructure/github/repositories/GitHubIssueRepository";
import { ResourceStatus } from "../domain/resource-types";
import { Issue, CreateIssue } from "../domain/types";
import { mapErrorToMCPError } from './utils/ErrorMapper';

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
    try {
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

      return await this.issueRepo.create(issueData);
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  async listIssues(options: {
    status?: string;
    milestone?: string;
    labels?: string[];
    assignee?: string;
    sort?: string;
    direction?: string;
    limit?: number;
  } = {}): Promise<Issue[]> {
    try {
      const {
        status = 'open',
        milestone,
        labels = [],
        assignee,
        sort = 'created',
        direction = 'desc',
        limit = 30
      } = options;

      let issues: Issue[];
      if (milestone) {
        issues = await this.issueRepo.findByMilestone(milestone);
      } else {
        issues = await this.issueRepo.findAll();
      }

      if (status !== 'all') {
        const resourceStatus = status === 'open' ? ResourceStatus.ACTIVE : ResourceStatus.CLOSED;
        issues = issues.filter(issue => issue.status === resourceStatus);
      }

      if (labels.length > 0) {
        issues = issues.filter(issue => labels.every(label => issue.labels.includes(label)));
      }

      if (assignee) {
        issues = issues.filter(issue => issue.assignees.includes(assignee));
      }

      issues.sort((a, b) => {
        let valueA, valueB;
        switch(sort) {
          case 'updated':
            valueA = a.updatedAt;
            valueB = b.updatedAt;
            break;
          case 'created':
          default:
            valueA = a.createdAt;
            valueB = b.createdAt;
        }
        const comparison = valueA.localeCompare(valueB);
        return direction === 'desc' ? -comparison : comparison;
      });

      return issues.slice(0, limit);
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  async getIssue(issueId: string): Promise<Issue | null> {
    try {
      return await this.issueRepo.findById(issueId);
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
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
    }
  ): Promise<Issue> {
    try {
      const data: Partial<Issue> = {};
      if (updates.title) data.title = updates.title;
      if (updates.description) data.description = updates.description;
      if (updates.status) {
        data.status = updates.status === 'open' ? ResourceStatus.ACTIVE : ResourceStatus.CLOSED;
      }
      if (updates.assignees) data.assignees = updates.assignees;
      if (updates.labels) data.labels = updates.labels;
      if (updates.milestoneId === null) {
        data.milestoneId = undefined;
      } else if (updates.milestoneId !== undefined) {
        data.milestoneId = updates.milestoneId;
      }

      return await this.issueRepo.update(issueId, data);
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  async createIssueComment(data: {
    issueNumber: number;
    body: string;
  }): Promise<IssueComment> {
    try {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.issues.createComment({
        owner: config.owner,
        repo: config.repo,
        issue_number: data.issueNumber,
        body: data.body
      });

      return {
        id: response.data.id,
        body: response.data.body || '',
        user: response.data.user?.login || 'unknown',
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at
      };
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  async updateIssueComment(data: {
    commentId: number;
    body: string;
  }): Promise<IssueComment> {
    try {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.issues.updateComment({
        owner: config.owner,
        repo: config.repo,
        comment_id: data.commentId,
        body: data.body
      });

      return {
        id: response.data.id,
        body: response.data.body || '',
        user: response.data.user?.login || 'unknown',
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at
      };
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  async deleteIssueComment(data: { commentId: number }): Promise<{ success: boolean; message: string }> {
    try {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      await octokit.rest.issues.deleteComment({
        owner: config.owner,
        repo: config.repo,
        comment_id: data.commentId
      });

      return { success: true, message: `Comment ${data.commentId} deleted successfully` };
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  async listIssueComments(data: {
    issueNumber: number;
    limit?: number;
  }): Promise<IssueComment[]> {
    try {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.issues.listComments({
        owner: config.owner,
        repo: config.repo,
        issue_number: data.issueNumber,
        per_page: data.limit || 30
      });

      return response.data.map(comment => ({
        id: comment.id,
        body: comment.body || '',
        user: comment.user?.login || 'unknown',
        createdAt: comment.created_at,
        updatedAt: comment.updated_at
      }));
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  async createDraftIssue(data: {
    projectId: string;
    title: string;
    body?: string;
    assigneeIds?: string[];
  }): Promise<DraftIssue> {
    try {
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
          body: data.body || '',
          assigneeIds: data.assigneeIds || []
        }
      });

      const content = response.addProjectV2DraftIssue.projectV2Item.content;
      return { id: content.id, title: content.title, body: content.body };
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  async updateDraftIssue(data: {
    draftIssueId: string;
    title?: string;
    body?: string;
    assigneeIds?: string[];
  }): Promise<DraftIssue> {
    try {
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
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  async deleteDraftIssue(data: { draftIssueId: string }): Promise<{ success: boolean; message: string }> {
    try {
      const mutation = `
        mutation($input: DeleteProjectV2DraftIssueInput!) {
          deleteProjectV2DraftIssue(input: $input) {
            draftIssue { id }
          }
        }
      `;

      await this.factory.graphql(mutation, { input: { draftIssueId: data.draftIssueId } });
      return { success: true, message: `Draft issue ${data.draftIssueId} deleted successfully` };
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }
}
