import { Octokit } from "@octokit/rest";
import {
  OctokitIssue,
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
} from "../rest-types";

// Internal GitHub API event type
interface GitHubEvent {
  id: number;
  node_id: string;
  url: string;
  actor: { login: string; id: number } | null;
  event: string;
  commit_id: string | null;
  created_at: string;
  label?: { name: string };
  milestone?: { title: string };
  assignee?: { login: string };
}

export class GitHubIssueRepository implements IssueRepository {
  private octokit: Octokit;

  constructor(private config: GitHubConfig) {
    this.octokit = new Octokit({ auth: config.token });
  }

  private mapOctokitToRestIssue(response: OctokitIssue): RestIssue {
    const user = response.user || { login: "unknown", id: 0, type: "User" };

    return {
      id: response.id,
      node_id: response.node_id,
      number: response.number,
      title: response.title || "",
      body: response.body ?? null,
      state: response.state === "closed" ? "closed" : "open",
      labels: Array.isArray(response.labels)
        ? response.labels.map((label) =>
            typeof label === "string"
              ? label
              : {
                  id: label.id,
                  name: label.name || "",
                  color: label.color ?? null,
                  description: label.description ?? null,
                  default: !!label.default,
                  url: label.url,
                }
          )
        : [],
      assignees: (response.assignees || []).map((assignee) => ({
        login: assignee.login,
        id: assignee.id,
        avatar_url: assignee.avatar_url,
        gravatar_id: assignee.gravatar_id ?? null,
        url: assignee.url,
      })),
      milestone: response.milestone,
      created_at: response.created_at,
      updated_at: response.updated_at,
      closed_at: response.closed_at ?? null,
      url: response.url,
      repository_url: response.repository_url,
      labels_url: response.labels_url,
      comments_url: response.comments_url,
      events_url: response.events_url,
      html_url: response.html_url,
      user: {
        login: user.login,
        id: user.id,
        avatar_url: (user as any).avatar_url,
        gravatar_id: (user as any).gravatar_id ?? null,
        url: (user as any).url,
      },
    };
  }

  private mapRestToIssue(data: RestIssue): Issue {
    const labelNames = data.labels.map((label) =>
      typeof label === "string" ? label : label.name
    );

    const priorityLabel = labelNames.find((name) =>
      name.startsWith("priority:")
    );
    const typeLabel = labelNames.find((name) => name.startsWith("type:"));

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
    const restIssue = this.mapOctokitToRestIssue(response.data as OctokitIssue);
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
    const restIssue = this.mapOctokitToRestIssue(response.data as OctokitIssue);
    return this.mapRestToIssue(restIssue);
  }

  async delete(id: IssueId): Promise<void> {
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

      const restIssue = this.mapOctokitToRestIssue(
        response.data as OctokitIssue
      );
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
    return response.data.map((item) =>
      this.mapRestToIssue(this.mapOctokitToRestIssue(item as OctokitIssue))
    );
  }

  async updateCustomField(
    issueId: IssueId,
    fieldId: FieldId,
    value: any
  ): Promise<void> {
    const query = `
      mutation($input: UpdateProjectV2ItemFieldValueInput!) {
        updateProjectV2ItemFieldValue(input: $input) {
          projectV2Item {
            id
          }
        }
      }
    `;

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

    const itemResponse = await this.octokit.graphql<
      GraphQLResponse<GraphQLItemResponse>
    >(itemQuery, {
      owner: this.config.owner,
      repo: this.config.repo,
      number: issueId,
    });

    const itemId =
      itemResponse.data.repository?.issue?.projectV2Items?.nodes?.[0]?.id;
    if (!itemId) {
      throw new Error(`Issue #${issueId} is not part of any project`);
    }

    const fieldValue = this.convertToFieldValue(value);

    await this.octokit.graphql(query, {
      input: { projectId: itemId, fieldId: fieldId, value: fieldValue },
    });
  }

  private convertToFieldValue(value: any): CustomFieldValue {
    if (typeof value === "string") {
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
          iteration: { startDate: value.startDate, duration: value.duration },
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

  async getHistory(
    issueId: IssueId
  ): Promise<
    Array<{
      field: string;
      oldValue: any;
      newValue: any;
      timestamp: Date;
      actor: string;
    }>
  > {
    const response = await this.octokit.issues.listEvents({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issueId,
      per_page: 100,
    });

    return response.data
      .map((eventData: GitHubEvent) => ({
        field: this.mapEventToField(eventData.event),
        oldValue: this.getOldValue(eventData),
        newValue: this.getNewValue(eventData),
        timestamp: new Date(eventData.created_at),
        actor: eventData.actor?.login || "unknown",
      }))
      .filter((item) => item.field !== "unknown");
  }

  private mapEventToField(event: string): string {
    const fieldMap: Record<string, string> = {
      closed: "status",
      reopened: "status",
      labeled: "labels",
      unlabeled: "labels",
      assigned: "assignees",
      unassigned: "assignees",
      milestoned: "milestone",
      demilestoned: "milestone",
    };
    return fieldMap[event] || "unknown";
  }

  private getOldValue(event: GitHubEvent): any {
    switch (event.event) {
      case "closed":
        return "open";
      case "reopened":
        return "closed";
      case "unlabeled":
        return event.label?.name;
      case "unassigned":
        return event.assignee?.login;
      case "demilestoned":
        return event.milestone?.title;
      default:
        return undefined;
    }
  }

  private getNewValue(event: GitHubEvent): any {
    switch (event.event) {
      case "closed":
        return "closed";
      case "reopened":
        return "open";
      case "labeled":
        return event.label?.name;
      case "assigned":
        return event.assignee?.login;
      case "milestoned":
        return event.milestone?.title;
      default:
        return undefined;
    }
  }

  async addDependency(issueId: IssueId, dependsOnId: IssueId): Promise<void> {
    const dependencyLabel = `depends-on-${dependsOnId}`;
    await this.addLabel(issueId, dependencyLabel);
    const comment = `This issue depends on #${dependsOnId}`;
    await this.addComment(issueId, comment);
  }

  async getDependencies(issueId: IssueId): Promise<Issue[]> {
    const response = await this.octokit.issues.listLabelsOnIssue({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issueId,
    });

    const dependencyIds = response.data
      .map((label) => {
        const match = label.name.match(/^depends-on-(\d+)$/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((id): id is number => id !== null);

    const dependencies = await Promise.all(
      dependencyIds.map(async (dependencyId) => {
        const issue = await this.findById(dependencyId);
        if (!issue) {
          throw new Error(`Dependency issue #${dependencyId} not found`);
        }
        return issue;
      })
    );

    return dependencies;
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
