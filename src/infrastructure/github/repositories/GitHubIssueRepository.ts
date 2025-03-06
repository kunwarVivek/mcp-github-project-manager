import { Octokit } from "@octokit/rest";
import { GitHubConfig } from "../GitHubConfig";
import {
  OctokitIssue,
  OctokitIssueEvent,
  RestIssue,
  Issue,
  IssueId,
  MilestoneId,
  IssueEvent,
} from "../../../domain/types";
import { ResourceStatus, ResourceType } from "../../../domain/resource-types";
import { ValidationError } from "../../../domain/errors";
import { BaseGitHubRepository } from "./BaseGitHubRepository";

export class GitHubIssueRepository extends BaseGitHubRepository<Issue> {
  constructor(octokit: Octokit, config: GitHubConfig) {
    super(octokit, config);
  }

  async create(data: {
    title: string;
    body?: string;
    milestoneId?: MilestoneId;
    assignees?: string[];
    labels?: string[];
  }): Promise<Issue> {
    this.validateRequiredFields(data, ["title"]);

    const params = {
      title: data.title,
      body: data.body,
      milestone: data.milestoneId ? parseInt(data.milestoneId) : undefined,
      assignees: data.assignees,
      labels: data.labels,
    };

    return this.createResource(
      "/repos/{owner}/{repo}/issues",
      params,
      (response: OctokitIssue) => this.mapRestToIssue(this.mapOctokitToRestIssue(response))
    );
  }

  async findById(id: IssueId): Promise<Issue | null> {
    return this.getResource(
      "/repos/{owner}/{repo}/issues/{number}",
      parseInt(id),
      (response: OctokitIssue) => this.mapRestToIssue(this.mapOctokitToRestIssue(response))
    );
  }

  async update(id: IssueId, data: {
    title?: string;
    body?: string;
    state?: "open" | "closed";
    milestoneId?: MilestoneId | null;
    assignees?: string[];
    labels?: string[];
    status?: ResourceStatus;
  }): Promise<Issue> {
    const params = {
      title: data.title,
      body: data.body,
      state: data.status ? this.mapResourceStatusToGitHubState(data.status) : undefined,
      milestone: data.milestoneId === null ? null : data.milestoneId ? parseInt(data.milestoneId) : undefined,
      assignees: data.assignees,
      labels: data.labels,
    };

    return this.updateResource(
      "/repos/{owner}/{repo}/issues/{number}",
      parseInt(id),
      params,
      (response: OctokitIssue) => this.mapRestToIssue(this.mapOctokitToRestIssue(response))
    );
  }

  async getHistory(id: IssueId): Promise<IssueEvent[]> {
    return this.listResources<{ issue_number: number }, IssueEvent>(
      "/repos/{owner}/{repo}/issues/{issue_number}/events",
      { issue_number: parseInt(id) },
      (response: OctokitIssueEvent[]) => response.map(event => ({
        field: event.event,
        oldValue: event.event === "renamed" ? (event as any).rename?.from : null,
        newValue: event.event === "renamed" ? (event as any).rename?.to : null,
        timestamp: new Date(event.created_at),
        actor: event.actor?.login || "unknown",
      }))
    );
  }

  async addCustomField(id: IssueId, fieldId: string, value: unknown): Promise<void> {
    this.validateRequiredFields({ value }, ["value"]);

    await this.update(id, {
      body: JSON.stringify({ [fieldId]: value }),
    });
  }

  private mapGitHubStateToResourceStatus(state: "open" | "closed"): ResourceStatus {
    switch (state) {
      case "open":
        return ResourceStatus.ACTIVE;
      case "closed":
        return ResourceStatus.ARCHIVED;
      default:
        return ResourceStatus.ACTIVE;
    }
  }

  private mapResourceStatusToGitHubState(status: ResourceStatus): "open" | "closed" {
    switch (status) {
      case ResourceStatus.ACTIVE:
        return "open";
      case ResourceStatus.ARCHIVED:
      case ResourceStatus.DELETED:
        return "closed";
      default:
        return "open";
    }
  }

  private mapLabelToRestFormat(label: unknown): string | { name: string } {
    if (typeof label === "string") {
      return label;
    }
    if (label && typeof label === "object" && 'name' in label && typeof label.name === "string") {
      return { name: label.name };
    }
    throw new ValidationError("Invalid label format", { label });
  }

  private mapOctokitToRestIssue(response: OctokitIssue): RestIssue {
    const user = response.user || {
      login: "unknown",
    };

    const labels = Array.isArray(response.labels)
      ? response.labels.map(label => this.mapLabelToRestFormat(label))
      : [];

    return {
      id: response.id,
      node_id: response.node_id,
      number: response.number,
      title: response.title || "",
      body: response.body ?? null,
      state: response.state === "closed" ? "closed" : "open",
      labels,
      assignees: (response.assignees || []).map((assignee) => ({
        login: assignee.login,
      })),
      milestone: response.milestone
        ? {
            number: response.milestone.number,
            title: response.milestone.title || "",
            description: response.milestone.description ?? null,
            due_on: response.milestone.due_on ?? null,
            state: response.milestone.state === "closed" ? "closed" : "open",
            open_issues: response.milestone.open_issues || 0,
            closed_issues: response.milestone.closed_issues || 0,
            created_at: response.milestone.created_at,
            updated_at: response.milestone.updated_at,
            closed_at: response.milestone.closed_at ?? null,
            url: response.milestone.url,
          }
        : null,
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
      },
    };
  }

  private mapRestToIssue(data: RestIssue): Issue {
    return {
      id: data.number.toString(),
      type: ResourceType.ISSUE,
      status: this.mapGitHubStateToResourceStatus(data.state),
      version: 1, // GitHub doesn't have explicit versions, using 1 as default
      number: data.number,
      title: data.title,
      description: data.body,
      milestoneId: data.milestone?.number.toString(),
      assignees: data.assignees.map(a => a.login),
      labels: data.labels.map(l => typeof l === "string" ? l : l.name),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      closedAt: data.closed_at,
      deletedAt: null,
      url: data.html_url,
      metadata: {
        nodeId: data.node_id,
        repositoryUrl: data.repository_url,
        labelsUrl: data.labels_url,
        commentsUrl: data.comments_url,
        eventsUrl: data.events_url,
      },
    };
  }
}
