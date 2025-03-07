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
  version: 1,
  status: ResourceStatus.ACTIVE,
  title: "Test Project",
  description: "Test Description",
  visibility: "private",
  views: [],
  fields: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
};

export const mockMilestone: Milestone = {
  id: "test-milestone-id",
  type: ResourceType.MILESTONE,
  version: 1,
  status: ResourceStatus.ACTIVE,
  title: "Test Milestone",
  description: "Test Description",
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  progress: {
    openIssues: 0,
    closedIssues: 0,
    completionPercentage: 0,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
};

export const mockIssue: Issue = {
  id: "test-issue-id",
  type: ResourceType.ISSUE,
  version: 1,
  status: ResourceStatus.ACTIVE,
  title: "Test Issue",
  description: "Test Description",
  priority: "medium",
  issueType: "feature",
  assignees: [],
  labels: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
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
