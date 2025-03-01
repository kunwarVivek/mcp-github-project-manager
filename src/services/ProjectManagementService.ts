import {
  Issue,
  IssueId,
  Milestone,
  MilestoneId,
  Project,
  ProjectId,
  Sprint,
  SprintId,
  ProjectView,
  CustomField,
  ViewId,
  FieldId,
} from "../domain/types";
import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";

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

    try {
      // Create project
      const project = await projectRepo.create(data.project);

      // Create default views if not specified
      if (!data.project.views) {
        await this.createDefaultViews(project.id);
      }

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
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create roadmap: ${error.message}`);
      }
      throw error;
    }
  }

  private async createDefaultViews(projectId: ProjectId): Promise<ProjectView[]> {
    const projectRepo = this.factory.createProjectRepository();
    
    const views = [
      {
        name: "Table",
        layout: "table" as const,
        settings: {
          sortBy: [{ field: "Title", direction: "asc" as const }],
        },
      },
      {
        name: "Board",
        layout: "board" as const,
        settings: {
          groupBy: "Status",
        },
      },
      {
        name: "Roadmap",
        layout: "roadmap" as const,
        settings: {
          groupBy: "Milestone",
        },
      },
    ];

    return Promise.all(views.map((view) => projectRepo.createView(projectId, view)));
  }

  async planSprint(data: {
    sprint: Omit<Sprint, "id">;
    issueIds: IssueId[];
  }): Promise<Sprint> {
    const sprintRepo = this.factory.createSprintRepository();
    const issueRepo = this.factory.createIssueRepository();

    try {
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
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to plan sprint: ${error.message}`);
      }
      throw error;
    }
  }

  // Project Views Management
  async createProjectView(projectId: ProjectId, view: Omit<ProjectView, "id">): Promise<ProjectView> {
    const projectRepo = this.factory.createProjectRepository();
    try {
      return await projectRepo.createView(projectId, view);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create project view: ${error.message}`);
      }
      throw error;
    }
  }

  async updateProjectView(
    projectId: ProjectId,
    viewId: ViewId,
    data: Partial<ProjectView>
  ): Promise<ProjectView> {
    const projectRepo = this.factory.createProjectRepository();
    try {
      return await projectRepo.updateView(projectId, viewId, data);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update project view: ${error.message}`);
      }
      throw error;
    }
  }

  async deleteProjectView(projectId: ProjectId, viewId: ViewId): Promise<void> {
    const projectRepo = this.factory.createProjectRepository();
    try {
      await projectRepo.deleteView(projectId, viewId);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to delete project view: ${error.message}`);
      }
      throw error;
    }
  }

  // Custom Fields Management
  async createCustomField(
    projectId: ProjectId,
    field: Omit<CustomField, "id">
  ): Promise<CustomField> {
    const projectRepo = this.factory.createProjectRepository();
    try {
      return await projectRepo.createField(projectId, field);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create custom field: ${error.message}`);
      }
      throw error;
    }
  }

  async updateCustomField(
    projectId: ProjectId,
    fieldId: FieldId,
    data: Partial<CustomField>
  ): Promise<CustomField> {
    const projectRepo = this.factory.createProjectRepository();
    try {
      return await projectRepo.updateField(projectId, fieldId, data);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update custom field: ${error.message}`);
      }
      throw error;
    }
  }

  async deleteCustomField(projectId: ProjectId, fieldId: FieldId): Promise<void> {
    const projectRepo = this.factory.createProjectRepository();
    try {
      await projectRepo.deleteField(projectId, fieldId);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to delete custom field: ${error.message}`);
      }
      throw error;
    }
  }

  // Issue Custom Field Management
  async updateIssueCustomField(
    issueId: IssueId,
    fieldId: FieldId,
    value: any
  ): Promise<void> {
    const issueRepo = this.factory.createIssueRepository();
    try {
      await issueRepo.updateCustomField(issueId, fieldId, value);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update issue custom field: ${error.message}`);
      }
      throw error;
    }
  }

  // Milestone Progress Tracking
  async getMilestoneProgress(
    id: MilestoneId
  ): Promise<{ openIssues: number; closedIssues: number }> {
    const milestoneRepo = this.factory.createMilestoneRepository();
    try {
      return await milestoneRepo.getProgress(id);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get milestone progress: ${error.message}`);
      }
      throw error;
    }
  }

  async getMilestoneCompletionPercentage(id: MilestoneId): Promise<number> {
    const milestoneRepo = this.factory.createMilestoneRepository();
    try {
      return await milestoneRepo.getCompletionPercentage(id);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get milestone completion percentage: ${error.message}`);
      }
      throw error;
    }
  }

  async getOverdueMilestones(): Promise<Milestone[]> {
    const milestoneRepo = this.factory.createMilestoneRepository();
    try {
      return await milestoneRepo.getOverdue();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get overdue milestones: ${error.message}`);
      }
      throw error;
    }
  }

  async getMilestonesInNext(days: number): Promise<Milestone[]> {
    const milestoneRepo = this.factory.createMilestoneRepository();
    try {
      return await milestoneRepo.getDueInNext(days);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get upcoming milestones: ${error.message}`);
      }
      throw error;
    }
  }

  // Sprint Metrics
  async getSprintMetrics(id: SprintId): Promise<{
    totalIssues: number;
    completedIssues: number;
    remainingIssues: number;
    completionPercentage: number;
  }> {
    const sprintRepo = this.factory.createSprintRepository();
    try {
      return await sprintRepo.getSprintMetrics(id);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get sprint metrics: ${error.message}`);
      }
      throw error;
    }
  }
}
