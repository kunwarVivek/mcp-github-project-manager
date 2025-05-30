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
  ProjectView,
  CustomField,
  createResource
} from "../domain/types";

export class TestFactory {
  static createProject(overrides: Partial<CreateProject> = {}): CreateProject {
    return {
      title: "Test Project",
      shortDescription: "A test project",
      owner: "test-owner",
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
      dueDate: this.futureDate(30),
      ...overrides
    };
  }

  static createIssue(overrides: Partial<CreateIssue> = {}): CreateIssue {
    return {
      title: "Test Issue",
      description: "A test issue",
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
      description: "A test sprint",
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: ResourceStatus.PLANNED,
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
    return {
      id: `proj-${Date.now()}`,
      type: ResourceType.PROJECT,
      title: data.title,
      description: data.shortDescription || "",
      owner: data.owner,
      number: 1,
      url: `https://github.com/${data.owner}/projects/1`,
      fields: data.fields || [],
      views: data.views || [],
      closed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: ResourceStatus.ACTIVE,
      visibility: data.visibility || "private",
      version: 1
    };
  }

  static completeMilestone(data: CreateMilestone = this.createMilestone()): Milestone {
    return {
      id: `milestone-${Date.now()}`,
      number: 1,
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      status: ResourceStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      url: `https://github.com/test-owner/test-repo/milestone/1`,
      progress: {
        percent: 0,
        complete: 0,
        total: 0
      }
    };
  }

  static completeIssue(data: CreateIssue = this.createIssue()): Issue {
    return {
      id: `issue-${Date.now()}`,
      number: 1,
      title: data.title,
      description: data.description,
      status: ResourceStatus.ACTIVE,
      assignees: data.assignees || [],
      labels: data.labels || [],
      milestoneId: data.milestoneId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      url: `https://github.com/test-owner/test-repo/issues/1`
    };
  }

  static completeSprint(data: CreateSprint = this.createSprint()): Sprint {
    return {
      id: `sprint-${Date.now()}`,
      title: data.title,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status || ResourceStatus.ACTIVE,
      issues: data.issues || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
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

  // Field Value Test Data Helpers
  static createFieldValueTestData(fieldType: string, overrides: any = {}) {
    const baseData = {
      projectId: "PVT_kwDOLhQ7gc4AOEbH",
      itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7",
      fieldId: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI1",
    };

    const fieldTypeValues = {
      TEXT: "Sample text value",
      NUMBER: 42,
      DATE: "2025-06-15",
      SINGLE_SELECT: "In Progress",
      ITERATION: "PVTI_kwDOLhQ7gc4AOEbHzM4AOAIter1",
      MILESTONE: "MI_kwDOLhQ7gc4AOEbHzM4AOAMile1",
      ASSIGNEES: ["MDQ6VXNlcjEyMzQ1Njc4", "MDQ6VXNlcjg3NjU0MzIx"],
      LABELS: ["LA_kwDOLhQ7gc4AOEbHzM4AOAL1", "LA_kwDOLhQ7gc4AOEbHzM4AOAL2"]
    };

    return {
      ...baseData,
      value: fieldTypeValues[fieldType as keyof typeof fieldTypeValues],
      ...overrides
    };
  }

  static createMockField(fieldType: string, overrides: any = {}) {
    const baseField = {
      id: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI1",
      name: `Test ${fieldType} Field`,
      dataType: fieldType
    };

    if (fieldType === 'SINGLE_SELECT') {
      return {
        ...baseField,
        options: [
          { id: 'OPTION_1', name: 'To Do' },
          { id: 'OPTION_2', name: 'In Progress' },
          { id: 'OPTION_3', name: 'Done' }
        ],
        ...overrides
      };
    }

    return { ...baseField, ...overrides };
  }

  static createMockFieldValueResponse(fieldType: string, value: any) {
    const baseField = {
      name: `Test ${fieldType} Field`,
      dataType: fieldType
    };

    // Create the field value object based on type
    let fieldValue: any = { field: baseField };

    switch (fieldType) {
      case 'TEXT':
        fieldValue.text = value;
        break;
      case 'NUMBER':
        fieldValue.number = value;
        break;
      case 'DATE':
        fieldValue.date = value;
        break;
      case 'SINGLE_SELECT':
        fieldValue.name = value;
        break;
      case 'ITERATION':
        fieldValue.iterationId = typeof value === 'object' ? value.iterationId : value;
        fieldValue.title = typeof value === 'object' ? value.title : 'Sprint 1';
        break;
      case 'MILESTONE':
        fieldValue.milestoneId = typeof value === 'object' ? value.milestoneId : value;
        fieldValue.title = typeof value === 'object' ? value.title : 'v1.0 Release';
        break;
      case 'ASSIGNEES':
        fieldValue.users = {
          nodes: Array.isArray(value) ? value : [value]
        };
        break;
      case 'LABELS':
        fieldValue.labels = {
          nodes: Array.isArray(value) ? value : [value]
        };
        break;
    }

    return {
      node: {
        item: {
          fieldValueByName: fieldValue
        }
      }
    };
  }

  static createMockUpdateResponse() {
    return {
      updateProjectV2ItemFieldValue: {
        projectV2Item: {
          id: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7"
        }
      }
    };
  }
}