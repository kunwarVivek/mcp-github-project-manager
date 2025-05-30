import { ResourceType, ResourceStatus } from "../domain/resource-types";
import { Project, Milestone, Issue } from "../domain/types";
import { TestFactory } from "./test-utils";

export const mockCache = {
  set: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
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
  graphql: jest.fn(),
  rest: jest.fn(),
});

jest.mock("../infrastructure/cache/ResourceCache", () => ({
  ResourceCache: {
    getInstance: jest.fn().mockReturnValue(mockCache),
  },
}));

jest.mock("@octokit/rest", () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    graphql: jest.fn(),
    rest: {
      issues: {
        create: jest.fn(),
        update: jest.fn(),
        get: jest.fn(),
        list: jest.fn(),
      },
      projects: {
        create: jest.fn(),
        update: jest.fn(),
        get: jest.fn(),
        list: jest.fn(),
      },
    },
  })),
}));
