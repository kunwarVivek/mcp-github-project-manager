import { vi } from 'vitest';
import { ResourceType, ResourceStatus } from "../domain/resource-types";
import type { Project, Milestone, Issue } from "../domain/types";

export const mockCache = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
};

export const mockOwner = "test-owner";
export const mockRepo = "test-repo";
export const mockToken = "test-token";

export const mockProject: Project = {
  id: "test-project-id",
  type: ResourceType.PROJECT,
  title: "Test Project",
  description: "Test Description",
  owner: "test-owner",
  number: 123,
  url: "https://github.com/test-owner/test-repo/projects/123",
  fields: [],
  views: [],
  closed: false,
  visibility: "private",
  status: ResourceStatus.ACTIVE,
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const mockMilestone: Milestone = {
  id: "test-milestone-id",
  number: 1,
  title: "Test Milestone",
  description: "Test Description",
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  status: ResourceStatus.ACTIVE,
  progress: {
    percent: 0,
    complete: 0,
    total: 5
  },
  url: "https://github.com/test-owner/test-repo/milestones/1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const mockIssue: Issue = {
  id: "test-issue-id",
  number: 42,
  title: "Test Issue",
  description: "Test Description",
  status: ResourceStatus.ACTIVE,
  assignees: [],
  labels: [],
  url: "https://github.com/test-owner/test-repo/issues/42",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Mock API Response Data
export const mockGitHubResponses = {
  project: {
    id: mockProject.id,
    title: mockProject.title,
    description: mockProject.description,
    closed: false,
    createdAt: mockProject.createdAt,
    updatedAt: mockProject.updatedAt,
  },
  milestone: {
    id: mockMilestone.id,
    title: mockMilestone.title,
    description: mockMilestone.description,
    dueOn: mockMilestone.dueDate,
    state: "open",
    createdAt: mockMilestone.createdAt,
    updatedAt: mockMilestone.updatedAt,
  },
  issue: {
    id: mockIssue.id,
    title: mockIssue.title,
    body: mockIssue.description,
    state: "OPEN",
    createdAt: mockIssue.createdAt,
    updatedAt: mockIssue.updatedAt,
    assignees: { nodes: [] },
    labels: { nodes: [] },
    milestone: null,
  },
};

// Export mockData to fix import errors in tests
export const mockData = {
  project: mockProject,
  milestone: mockMilestone,
  issue: mockIssue,
  responses: mockGitHubResponses
};

// Mock Factory Functions
export const createMockRepository = () => ({
  graphql: vi.fn(),
  rest: vi.fn(),
});

vi.mock("../infrastructure/cache/ResourceCache", () => ({
  ResourceCache: {
    getInstance: vi.fn().mockReturnValue(mockCache),
  },
}));

vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(function () { return ({
    graphql: vi.fn(),
    rest: {
      issues: {
        create: vi.fn(),
        update: vi.fn(),
        get: vi.fn(),
        list: vi.fn(),
      },
      projects: {
        create: vi.fn(),
        update: vi.fn(),
        get: vi.fn(),
        list: vi.fn(),
      },
    },
  }); }),
}));
