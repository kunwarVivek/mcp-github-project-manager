import { Octokit } from "@octokit/rest";
import {
  Issue,
  IssueId,
  IssueRepository,
  MilestoneId,
  FieldId,
} from "../../../domain/types";
import { GitHubConfig } from "../GitHubConfig";
import {
  CreateIssueParams,
  ListIssuesParams,
  RestIssue,
  RestLabel,
  UpdateIssueParams,
  CustomFieldValue,
  GraphQLItemResponse,
  GraphQLResponse,
  mapOctokitResponseToRestIssue,
} from "../rest-types";

export class GitHubIssueRepository implements IssueRepository {
  private octokit: Octokit;

  constructor(private config: GitHubConfig) {
    this.octokit = new Octokit({ auth: config.token });
  }

  async create(
    data: Omit<Issue, "id" | "createdAt" | "updatedAt">
  ): Promise<Issue> {
    const params: CreateIssueParams = {
      owner: this.config.owner,
      repo: this.config.repo,
      title: data.title,
      body: data.description,
      milestone: data.milestoneId,
      assignees: data.assignees,
      labels: [
        `priority:${data.priority}`,
        ...(data.type ? [`type:${data.type}`] : []),
        ...data.labels,
      ],
    };

    const response = await this.octokit.issues.create(params);
    const restIssue = mapOctokitResponseToRestIssue(response.data);
    return this.mapRestToIssue(restIssue);
  }

  async update(id: IssueId, data: Partial<Issue>): Promise<Issue> {
    const params: UpdateIssueParams = {
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: id,
      ...(data.title && { title: data.title }),
      ...(data.description && { body: data.description }),
      ...(data.status && { state: data.status as "open" | "closed" }),
      ...(data.milestoneId !== undefined && { milestone: data.milestoneId }),
      ...(data.assignees && { assignees: data.assignees }),
    };

    // Handle labels separately to maintain priority and type labels
    if (data.labels || data.priority || data.type) {
      const currentIssue = await this.findById(id);
      if (!currentIssue) {
        throw new Error(`Issue #${id} not found`);
      }

      params.labels = [
        `priority:${data.priority || currentIssue.priority}`,
        ...(data.type || currentIssue.type
          ? [`type:${data.type || currentIssue.type}`]
          : []),
        ...(data.labels || currentIssue.labels),
      ];
    }

    const response = await this.octokit.issues.update(params);
    const restIssue = mapOctokitResponseToRestIssue(response.data);
    return this.mapRestToIssue(restIssue);
  }

  async delete(id: IssueId): Promise<void> {
    // GitHub doesn't allow true deletion of issues
    // Instead, we close it and mark it as not planned
    await this.octokit.issues.update({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: id,
      state: "closed" as const,
      state_reason: "not_planned" as const,
    });
  }

  async findById(id: IssueId): Promise<Issue | null> {
    try {
      const response = await this.octokit.issues.get({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: id,
      });

      const restIssue = mapOctokitResponseToRestIssue(response.data);
      return this.mapRestToIssue(restIssue);
    } catch (error) {
      if ((error as any).status === 404) return null;
      throw error;
    }
  }

  async findAll(filters?: {
    status?: "open" | "closed";
    milestoneId?: MilestoneId;
    assignee?: string;
  }): Promise<Issue[]> {
    const params: ListIssuesParams = {
      owner: this.config.owner,
      repo: this.config.repo,
      state: filters?.status || "all",
      milestone: filters?.milestoneId?.toString(),
      assignee: filters?.assignee,
      per_page: 100,
    };

    const response = await this.octokit.issues.listForRepo(params);
    return response.data.map(item => this.mapRestToIssue(mapOctokitResponseToRestIssue(item)));
  }

  async updateCustomField(issueId: IssueId, fieldId: FieldId, value: any): Promise<void> {
    const query = `
      mutation($input: UpdateProjectV2ItemFieldValueInput!) {
        updateProjectV2ItemFieldValue(input: $input) {
          projectV2Item {
            id
          }
        }
      }
    `;

    // First, get the project item ID for this issue
    const itemQuery = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            projectV2Items(first: 1) {
              nodes {
                id
              }
            }
          }
        }
      }
    `;

    const itemResponse = await this.octokit.graphql<GraphQLResponse<GraphQLItemResponse>>(itemQuery, {
      owner: this.config.owner,
      repo: this.config.repo,
      number: issueId,
    });

    const itemId = itemResponse.data.repository?.issue?.projectV2Items?.nodes?.[0]?.id;
    if (!itemId) {
      throw new Error(`Issue #${issueId} is not part of any project`);
    }

    // Convert the value to the appropriate GraphQL input type
    const fieldValue = this.convertToFieldValue(value);

    // Update the field value
    await this.octokit.graphql(query, {
      input: {
        projectId: itemId,
        fieldId: fieldId,
        value: fieldValue,
      },
    });
  }

  private convertToFieldValue(value: any): CustomFieldValue {
    if (typeof value === "string") {
      // Check if it's a date string
      if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return { date: value };
      }
      return { text: value };
    }
    if (typeof value === "number") {
      return { number: value };
    }
    if (value && typeof value === "object") {
      if ("startDate" in value && "duration" in value) {
        return {
          iteration: {
            startDate: value.startDate,
            duration: value.duration,
          },
        };
      }
    }
    return { text: String(value) };
  }

  private mapRestToIssue(data: RestIssue): Issue {
    // Extract label names
    const labelNames = data.labels.map((label) =>
      typeof label === "string" ? label : label.name
    );

    const priorityLabel = labelNames.find((name) =>
      name.startsWith("priority:")
    );
    const typeLabel = labelNames.find((name) => name.startsWith("type:"));

    // Filter out our special labels
    const customLabels = labelNames.filter(
      (name) => !name.startsWith("priority:") && !name.startsWith("type:")
    );

    return {
      id: data.number,
      title: data.title,
      description: data.body || "",
      status: data.state as "open" | "closed",
      priority: (priorityLabel?.split(":")[1] || "medium") as
        | "high"
        | "medium"
        | "low",
      type: typeLabel?.split(":")[1] as Issue["type"],
      assignees: data.assignees.map((a) => a.login),
      labels: customLabels,
      milestoneId: data.milestone?.number,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async addComment(issueId: IssueId, body: string): Promise<void> {
    await this.octokit.issues.createComment({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issueId,
      body,
    });
  }

  async addLabel(issueId: IssueId, label: string): Promise<void> {
    await this.octokit.issues.addLabels({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issueId,
      labels: [label],
    });
  }

  async removeLabel(issueId: IssueId, label: string): Promise<void> {
    await this.octokit.issues.removeLabel({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issueId,
      name: label,
    });
  }

  async assignUser(issueId: IssueId, username: string): Promise<void> {
    await this.octokit.issues.addAssignees({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issueId,
      assignees: [username],
    });
  }

  async unassignUser(issueId: IssueId, username: string): Promise<void> {
    await this.octokit.issues.removeAssignees({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issueId,
      assignees: [username],
    });
  }
}
