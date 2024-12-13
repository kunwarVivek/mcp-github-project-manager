import { Octokit } from "@octokit/rest";
import {
  Milestone,
  MilestoneId,
  MilestoneRepository,
} from "../../../domain/types";
import { GitHubConfig } from "../GitHubConfig";
import {
  CreateMilestoneParams,
  ListMilestonesParams,
  RestMilestone,
  UpdateMilestoneParams,
} from "../rest-types";

export class GitHubMilestoneRepository implements MilestoneRepository {
  private octokit: Octokit;

  constructor(private config: GitHubConfig) {
    this.octokit = new Octokit({ auth: config.token });
  }

  async create(data: Omit<Milestone, "id" | "progress">): Promise<Milestone> {
    const params: CreateMilestoneParams = {
      owner: this.config.owner,
      repo: this.config.repo,
      title: data.title,
      description: data.description,
      due_on: data.dueDate?.toISOString(),
      state: data.status,
    };

    const response = await this.octokit.issues.createMilestone(params);
    return this.mapRestToMilestone(response.data);
  }

  async update(id: MilestoneId, data: Partial<Milestone>): Promise<Milestone> {
    const params: UpdateMilestoneParams = {
      owner: this.config.owner,
      repo: this.config.repo,
      milestone_number: id,
      ...(data.title && { title: data.title }),
      ...(data.description && { description: data.description }),
      ...(data.dueDate && { due_on: data.dueDate.toISOString() }),
      ...(data.status && { state: data.status }),
    };

    const response = await this.octokit.issues.updateMilestone(params);
    return this.mapRestToMilestone(response.data);
  }

  async delete(id: MilestoneId): Promise<void> {
    await this.octokit.issues.deleteMilestone({
      owner: this.config.owner,
      repo: this.config.repo,
      milestone_number: id,
    });
  }

  async findById(id: MilestoneId): Promise<Milestone | null> {
    try {
      const response = await this.octokit.issues.getMilestone({
        owner: this.config.owner,
        repo: this.config.repo,
        milestone_number: id,
      });

      return this.mapRestToMilestone(response.data);
    } catch (error) {
      if ((error as any).status === 404) return null;
      throw error;
    }
  }

  async findAll(filters?: {
    status?: "open" | "closed";
  }): Promise<Milestone[]> {
    const params: ListMilestonesParams = {
      owner: this.config.owner,
      repo: this.config.repo,
      state: filters?.status || "all",
      sort: "due_on",
      direction: "asc",
      per_page: 100,
    };

    const response = await this.octokit.issues.listMilestones(params);
    return response.data.map(this.mapRestToMilestone);
  }

  private mapRestToMilestone(data: RestMilestone): Milestone {
    return {
      id: data.number,
      title: data.title,
      description: data.description || "",
      dueDate: data.due_on ? new Date(data.due_on) : undefined,
      status: data.state as "open" | "closed",
      progress: {
        openIssues: data.open_issues,
        closedIssues: data.closed_issues,
      },
    };
  }

  async getProgress(
    id: MilestoneId
  ): Promise<{ openIssues: number; closedIssues: number }> {
    const milestone = await this.findById(id);
    if (!milestone) {
      throw new Error(`Milestone #${id} not found`);
    }
    return milestone.progress;
  }

  async getCompletionPercentage(id: MilestoneId): Promise<number> {
    const { openIssues, closedIssues } = await this.getProgress(id);
    const total = openIssues + closedIssues;
    if (total === 0) return 0;
    return (closedIssues / total) * 100;
  }

  async getDueInNext(days: number): Promise<Milestone[]> {
    const allMilestones = await this.findAll({ status: "open" });
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);

    return allMilestones.filter(
      (milestone) => milestone.dueDate && milestone.dueDate <= cutoffDate
    );
  }

  async getOverdue(): Promise<Milestone[]> {
    const allMilestones = await this.findAll({ status: "open" });
    const now = new Date();

    return allMilestones.filter(
      (milestone) => milestone.dueDate && milestone.dueDate < now
    );
  }
}
