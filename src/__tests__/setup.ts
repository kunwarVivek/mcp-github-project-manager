import { jest } from '@jest/globals';
import { Resource, ResourceType, ResourceStatus } from '../domain/resource-types';
import { ResourceCache } from '../infrastructure/cache/ResourceCache';
import type { Project, Milestone, Issue, Sprint } from '../domain/types';

// Mock repositories
jest.mock('../infrastructure/cache/ResourceCache');
jest.mock('../infrastructure/github/repositories/GitHubProjectRepository');
jest.mock('../infrastructure/github/repositories/GitHubIssueRepository');
jest.mock('../infrastructure/github/repositories/GitHubMilestoneRepository');
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}));

// Mock timers
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2025-03-01T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

// Mock console methods to avoid noise in test output
const originalConsole = { ...console };

beforeEach(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
  console.debug = jest.fn();
});

afterEach(() => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;
});

// Base resource for testing
const baseResource: Resource = {
  id: 'test-id',
  type: ResourceType.PROJECT,
  status: ResourceStatus.ACTIVE,
  version: 1,
  createdAt: '2025-03-01T12:00:00Z',
  updatedAt: '2025-03-01T12:00:00Z',
  deletedAt: null,
  metadata: {},
};

// Export mock data for tests
export const mockData = {
  baseResource,

  project: {
    ...baseResource,
    title: 'Test Project',
    description: 'Test Description',
    visibility: 'private' as const,
    views: [],
    fields: [],
  } satisfies Project,

  milestone: {
    ...baseResource,
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
  } satisfies Milestone,

  issue: {
    ...baseResource,
    type: ResourceType.ISSUE,
    number: 1,
    title: 'Test Issue',
    description: 'Test Description',
    milestoneId: undefined,
    assignees: [],
    labels: [],
    closedAt: null,
    url: 'https://github.com/test-owner/test-repo/issues/1',
  } satisfies Issue,

  sprint: {
    ...baseResource,
    type: ResourceType.SPRINT,
    title: 'Test Sprint',
    startDate: '2025-03-01T12:00:00Z',
    endDate: '2025-03-15T12:00:00Z',
    goals: ['Complete feature X', 'Fix critical bugs'],
    issues: [],
  } satisfies Sprint,

  // Helper to create dates in ISO format
  createDate(date: Date = new Date()): string {
    return date.toISOString();
  },

  // Helper to create resource IDs
  createResourceId(): string {
    return `test-${Math.random().toString(36).substr(2, 9)}`;
  },

  // Helper to create metadata
  createMetadata(): Record<string, unknown> {
    return {
      testKey: 'testValue',
      timestamp: new Date().toISOString(),
    };
  },
};

// Mock ResourceCache instance
const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  clearByType: jest.fn(),
  clearByTag: jest.fn(),
  getByTag: jest.fn(),
};

(ResourceCache.getInstance as jest.Mock).mockReturnValue(mockCache);
