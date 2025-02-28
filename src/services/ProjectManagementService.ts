import {
  Issue,
  IssueId,
  Milestone,
  MilestoneId,
  Project,
  Sprint,
  SprintId,
} from "../domain/types";
import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory.js";

export class ProjectManagementService {
  private factory: GitHubRepositoryFactory;

  constructor(owner: string, repo: string, token: string) {
    this.factory = GitHubRepositoryFactory.getInstance();
    this.factory.configure(owner, repo, token);
  }

  async createRoadmap(data: {
    project: Omit<Project, "id" | "createdAt" | "updatedAt">;
    milestones: Array<{
      milestone: Omit<Milestone, "id" | "progress">;
      issues: Array<Omit<Issue, "id" | "createdAt" | "updatedAt">>;
    }>;
  }): Promise<{
    project: Project;
    milestones: Array<{
      milestone: Milestone;
      issues: Issue[];
    }>;
  }> {
    const projectRepo = this.factory.createProjectRepository();
    const milestoneRepo = this.factory.createMilestoneRepository();
    const issueRepo = this.factory.createIssueRepository();

    // Create project
    const project = await projectRepo.create(data.project);

    // Create milestones and their issues
    const milestones = await Promise.all(
      data.milestones.map(async ({ milestone, issues }) => {
        const createdMilestone = await milestoneRepo.create(milestone);
        const createdIssues = await Promise.all(
          issues.map((issue) =>
            issueRepo.create({
              ...issue,
              milestoneId: createdMilestone.id,
            })
          )
        );
        return { milestone: createdMilestone, issues: createdIssues };
      })
    );

    return { project, milestones };
  }

  async planSprint(data: {
    sprint: Omit<Sprint, "id">;
    issueIds: IssueId[];
  }): Promise<Sprint> {
    const sprintRepo = this.factory.createSprintRepository();
    const issueRepo = this.factory.createIssueRepository();

    // Verify all issues exist
    await Promise.all(
      data.issueIds.map(async (id) => {
        const issue = await issueRepo.findById(id);
        if (!issue) throw new Error(`Issue #${id} not found`);
        return issue;
      })
    );

    // Create sprint with verified issues
    return sprintRepo.create({
      ...data.sprint,
      issues: data.issueIds,
    });
  }

  async getMilestoneProgress(
    id: MilestoneId
  ): Promise<{ openIssues: number; closedIssues: number }> {
    const milestoneRepo = this.factory.createMilestoneRepository();
    return milestoneRepo.getProgress(id);
  }

  async getMilestoneCompletionPercentage(id: MilestoneId): Promise<number> {
    const milestoneRepo = this.factory.createMilestoneRepository();
    return milestoneRepo.getCompletionPercentage(id);
  }

  async getOverdueMilestones(): Promise<Milestone[]> {
    const milestoneRepo = this.factory.createMilestoneRepository();
    return milestoneRepo.getOverdue();
  }

  async getMilestonesInNext(days: number): Promise<Milestone[]> {
    const milestoneRepo = this.factory.createMilestoneRepository();
    return milestoneRepo.getDueInNext(days);
  }

  async getSprintMetrics(id: SprintId): Promise<{
    totalIssues: number;
    completedIssues: number;
    remainingIssues: number;
    completionPercentage: number;
  }> {
    const sprintRepo = this.factory.createSprintRepository();
    return sprintRepo.getSprintMetrics(id);
  }
}
