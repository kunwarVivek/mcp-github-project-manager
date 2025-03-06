import { 
  Resource, 
  ResourceType, 
  ResourceStatus,
  mapStatus,
  mapType 
} from '../domain/resource-types';
import { Project, Milestone, Issue, Sprint } from '../domain/types';

export class TestUtils {
  static baseResource: Resource = {
    id: 'test-id',
    type: ResourceType.PROJECT,
    status: ResourceStatus.ACTIVE,
    version: 1,
    createdAt: '2025-03-01T12:00:00Z',
    updatedAt: '2025-03-01T12:00:00Z',
    deletedAt: null,
    metadata: {},
  };

  static project: Project = {
    ...this.baseResource,
    title: 'Test Project',
    description: 'Test Description',
    visibility: 'private',
    views: [],
    fields: [],
  };

  static milestone: Milestone = {
    ...this.baseResource,
    type: ResourceType.MILESTONE,
    title: 'Test Milestone',
    description: 'Test Description',
    dueDate: '2025-04-01T12:00:00Z',
    progress: {
      openIssues: 0,
      closedIssues: 0,
      completionPercentage: 0,
    },
    url: 'https://github.com/test-owner/test-repo/milestone/1',
  };

  static issue: Issue = {
    ...this.baseResource,
    type: ResourceType.ISSUE,
    number: 1,
    title: 'Test Issue',
    description: 'Test Description',
    milestoneId: undefined,
    assignees: [],
    labels: [],
    closedAt: null,
    url: 'https://github.com/test-owner/test-repo/issues/1',
  };

  static sprint: Sprint = {
    ...this.baseResource,
    type: ResourceType.SPRINT,
    title: 'Test Sprint',
    startDate: '2025-03-01T12:00:00Z',
    endDate: '2025-03-15T12:00:00Z',
    goals: ['Complete feature X', 'Fix critical bugs'],
    issues: [],
  };

  static createDate(date: Date = new Date()): string {
    return date.toISOString();
  }

  static createResourceId(): string {
    return `test-${Math.random().toString(36).substring(2, 9)}`;
  }

  static createMetadata(): Record<string, unknown> {
    return {
      testKey: 'testValue',
      timestamp: this.createDate(),
    };
  }

  static mapStatus(status: string): ResourceStatus {
    return mapStatus(status);
  }

  static mapType(type: string): ResourceType {
    return mapType(type);
  }

  static mockCurrentDate(): void {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-03-01T12:00:00Z'));
  }

  static restoreCurrentDate(): void {
    jest.useRealTimers();
  }

  static createMockProject(overrides: Partial<Project> = {}): Project {
    return {
      ...this.project,
      ...overrides,
      id: overrides.id ?? this.createResourceId(),
      createdAt: overrides.createdAt ?? this.createDate(),
      updatedAt: overrides.updatedAt ?? this.createDate(),
    };
  }

  static createMockMilestone(overrides: Partial<Milestone> = {}): Milestone {
    return {
      ...this.milestone,
      ...overrides,
      id: overrides.id ?? this.createResourceId(),
      createdAt: overrides.createdAt ?? this.createDate(),
      updatedAt: overrides.updatedAt ?? this.createDate(),
    };
  }

  static createMockIssue(overrides: Partial<Issue> = {}): Issue {
    return {
      ...this.issue,
      ...overrides,
      id: overrides.id ?? this.createResourceId(),
      createdAt: overrides.createdAt ?? this.createDate(),
      updatedAt: overrides.updatedAt ?? this.createDate(),
    };
  }

  static createMockSprint(overrides: Partial<Sprint> = {}): Sprint {
    return {
      ...this.sprint,
      ...overrides,
      id: overrides.id ?? this.createResourceId(),
      createdAt: overrides.createdAt ?? this.createDate(),
      updatedAt: overrides.updatedAt ?? this.createDate(),
    };
  }

  // Type conversion helpers
  static convertToISOString(date: Date): string {
    return date.toISOString();
  }

  static convertToResourceId(id: number | string): string {
    return String(id);
  }
}

export const mockData = {
  ...TestUtils,
  baseResource: TestUtils.baseResource,
  project: TestUtils.project,
  milestone: TestUtils.milestone,
  issue: TestUtils.issue,
  sprint: TestUtils.sprint,
};