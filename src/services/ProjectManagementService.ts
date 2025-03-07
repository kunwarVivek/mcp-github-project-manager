import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { GitHubIssueRepository } from "../infrastructure/github/repositories/GitHubIssueRepository";
import { GitHubMilestoneRepository } from "../infrastructure/github/repositories/GitHubMilestoneRepository";
import { GitHubProjectRepository } from "../infrastructure/github/repositories/GitHubProjectRepository";
import { GitHubSprintRepository } from "../infrastructure/github/repositories/GitHubSprintRepository";
import { ResourceStatus, ResourceType } from "../domain/resource-types";
import {
  Issue,
  CreateIssue,
  Milestone,
  CreateMilestone,
  Project,
  CreateProject,
  Sprint,
  CreateSprint,
  CustomField,
  ProjectView,
  createResource
} from "../domain/types";
import { GitHubTypeConverter } from "../infrastructure/github/util/conversion";

export class ProjectManagementService {
  private readonly factory: GitHubRepositoryFactory;

  constructor(owner: string, repo: string, token: string) {
    this.factory = new GitHubRepositoryFactory(token, owner, repo);
  }

  private get issueRepo(): GitHubIssueRepository {
    return this.factory.createIssueRepository();
  }

  private get milestoneRepo(): GitHubMilestoneRepository {
    return this.factory.createMilestoneRepository();
  }

  private get projectRepo(): GitHubProjectRepository {
    return this.factory.createProjectRepository();
  }

  private get sprintRepo(): GitHubSprintRepository {
    return this.factory.createSprintRepository();
  }

  // Roadmap Management
  async createRoadmap(data: {
    project: CreateProject;
    milestones: Array<{
      milestone: CreateMilestone;
      issues: CreateIssue[];
    }>;
  }): Promise<{
    project: Project;
    milestones: Array<Milestone & { issues: Issue[] }>;
  }> {
    const project = await this.projectRepo.create(
      createResource<Project>(ResourceType.PROJECT, data.project)
    );

    const milestones = [];

    for (const { milestone, issues } of data.milestones) {
      const createdMilestone = await this.milestoneRepo.create(
        createResource<Milestone>(ResourceType.MILESTONE, milestone)
      );

      const createdIssues = await Promise.all(
        issues.map(issue =>
          this.issueRepo.create(
            createResource<Issue>(ResourceType.ISSUE, {
              ...issue,
              milestoneId: createdMilestone.id,
            })
          )
        )
      );

      milestones.push({
        ...createdMilestone,
        issues: createdIssues,
      });
    }

    return { project, milestones };
  }

  // Sprint Management
  async planSprint(data: {
    sprint: CreateSprint;
    issueIds: string[];
  }): Promise<Sprint> {
    const sprint = await this.sprintRepo.create(
      createResource<Sprint>(ResourceType.SPRINT, {
        ...data.sprint,
        issues: data.issueIds,
      })
    );

    if (data.issueIds.length > 0) {
      await Promise.all(
        data.issueIds.map(issueId =>
          this.issueRepo.update(issueId, { milestoneId: sprint.id })
        )
      );
    }

    return sprint;
  }

  async findSprints(filters?: { status?: ResourceStatus }): Promise<Sprint[]> {
    return this.sprintRepo.findAll(filters);
  }

  async updateSprint(id: string, data: Partial<Sprint>): Promise<Sprint> {
    return this.sprintRepo.update(id, data);
  }

  async getSprintMetrics(id: string): Promise<{
    totalIssues: number;
    completedIssues: number;
    remainingIssues: number;
    completionPercentage: number;
  }> {
    const sprint = await this.sprintRepo.findById(id);
    if (!sprint) {
      throw new Error("Sprint not found");
    }

    const issues = await Promise.all(
      sprint.issues.map(issueId => this.issueRepo.findById(issueId))
    );

    const totalIssues = issues.length;
    const completedIssues = issues.filter(
      issue => issue?.status === ResourceStatus.CLOSED || issue?.status === ResourceStatus.COMPLETED
    ).length;
    const remainingIssues = totalIssues - completedIssues;
    const completionPercentage = totalIssues > 0 ? (completedIssues / totalIssues) * 100 : 0;

    return {
      totalIssues,
      completedIssues,
      remainingIssues,
      completionPercentage,
    };
  }

  // Issue Management
  async createIssue(data: CreateIssue): Promise<Issue> {
    return this.issueRepo.create(
      createResource<Issue>(ResourceType.ISSUE, data)
    );
  }

  async updateIssue(id: string, data: Partial<Issue>): Promise<Issue> {
    return this.issueRepo.update(id, data);
  }

  async deleteIssue(id: string): Promise<void> {
    return this.issueRepo.delete(id);
  }

  async getIssue(id: string): Promise<Issue | null> {
    return this.issueRepo.findById(id);
  }

  async findIssues(): Promise<Issue[]> {
    return this.issueRepo.findAll();
  }

  async updateIssueStatus(
    id: string,
    status: ResourceStatus
  ): Promise<void> {
    await this.issueRepo.update(id, { status });
  }

  async getIssueHistory(id: string): Promise<Array<{
    timestamp: string;
    field: string;
    from: string;
    to: string;
  }>> {
    const issue = await this.issueRepo.findById(id);
    if (!issue) {
      throw new Error("Issue not found");
    }
    // TODO: Implement issue history tracking
    return [];
  }

  // Milestone Management
  async createMilestone(data: CreateMilestone): Promise<Milestone> {
    return this.milestoneRepo.create(
      createResource<Milestone>(ResourceType.MILESTONE, data)
    );
  }

  async updateMilestone(
    id: string,
    data: Partial<Milestone>
  ): Promise<Milestone> {
    return this.milestoneRepo.update(id, data);
  }

  async deleteMilestone(id: string): Promise<void> {
    return this.milestoneRepo.delete(id);
  }

  async getMilestone(id: string): Promise<Milestone | null> {
    return this.milestoneRepo.findById(id);
  }

  async findMilestones(): Promise<Milestone[]> {
    return this.milestoneRepo.findAll();
  }

  async assignIssueToMilestone(
    issueId: string,
    milestoneId: string
  ): Promise<void> {
    await this.issueRepo.update(issueId, { milestoneId });
  }

  async addIssueDependency(
    issueId: string,
    dependsOnId: string
  ): Promise<void> {
    const issue = await this.issueRepo.findById(issueId);
    const dependsOn = await this.issueRepo.findById(dependsOnId);

    if (!issue || !dependsOn) {
      throw new Error("One or both issues not found");
    }

    // TODO: Implement dependency tracking
  }

  async getIssueDependencies(issueId: string): Promise<string[]> {
    const issue = await this.issueRepo.findById(issueId);
    if (!issue) {
      throw new Error("Issue not found");
    }
    // TODO: Implement dependency tracking
    return [];
  }
}
