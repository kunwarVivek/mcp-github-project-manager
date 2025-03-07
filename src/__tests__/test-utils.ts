import { 
  Resource,
  ResourceStatus, 
  ResourceType 
} from "../domain/resource-types";
import { 
  Issue, 
  Milestone, 
  Project, 
  Sprint,
  CreateIssue,
  CreateProject,
  CreateMilestone,
  CreateSprint,
  IssueType,
  IssuePriority,
  ProjectView,
  CustomField,
  createResource
} from "../domain/types";

export class TestFactory {
  static createProject(overrides: Partial<CreateProject> = {}): CreateProject {
    return {
      title: "Test Project",
      description: "A test project",
      status: ResourceStatus.ACTIVE,
      visibility: "private",
      views: [],
      fields: [],
      ...overrides
    };
  }

  static createMilestone(overrides: Partial<CreateMilestone> = {}): CreateMilestone {
    return {
      title: "Test Milestone",
      description: "A test milestone",
      status: ResourceStatus.ACTIVE,
      dueDate: this.futureDate(30),
      ...overrides
    };
  }

  static createIssue(overrides: Partial<CreateIssue> = {}): CreateIssue {
    return {
      title: "Test Issue",
      description: "A test issue",
      status: ResourceStatus.ACTIVE,
      priority: "medium" as IssuePriority,
      issueType: "feature" as IssueType,
      assignees: [],
      labels: [],
      ...overrides
    };
  }

  static createSprint(overrides: Partial<CreateSprint> = {}): CreateSprint {
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 14);

    return {
      title: "Test Sprint",
      status: ResourceStatus.PLANNED,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      goals: ["Complete test tasks"],
      issues: [],
      ...overrides
    };
  }

  static createProjectView(overrides: Partial<ProjectView> = {}): ProjectView {
    return {
      id: `view-${Date.now()}`,
      name: "Test View",
      layout: "board",
      settings: {
        groupBy: "status",
        sortBy: [{ field: "priority", direction: "desc" }]
      },
      ...overrides
    };
  }

  static createCustomField(overrides: Partial<CustomField> = {}): CustomField {
    return {
      id: `field-${Date.now()}`,
      name: "Test Field",
      type: "text",
      options: [],
      ...overrides
    };
  }

  static completeProject(data: CreateProject = this.createProject()): Project {
    return createResource<Project>(ResourceType.PROJECT, data);
  }

  static completeMilestone(data: CreateMilestone = this.createMilestone()): Milestone {
    return {
      ...createResource<Milestone>(ResourceType.MILESTONE, data),
      progress: {
        openIssues: 0,
        closedIssues: 0,
        completionPercentage: 0
      }
    };
  }

  static completeIssue(data: CreateIssue = this.createIssue()): Issue {
    return createResource<Issue>(ResourceType.ISSUE, data);
  }

  static completeSprint(data: CreateSprint = this.createSprint()): Sprint {
    return createResource<Sprint>(ResourceType.SPRINT, data);
  }

  static futureDate(daysFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString();
  }

  static pastDate(daysAgo: number): string {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString();
  }

  static randomId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  static mockGitHubResponse<T>(data: T): Promise<{ data: T }> {
    return Promise.resolve({ data });
  }
}