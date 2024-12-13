import { jest } from "@jest/globals";
import type { components } from "@octokit/openapi-types";

// Mock environment variables
process.env.GITHUB_TOKEN = "test-token";
process.env.GITHUB_OWNER = "test-owner";
process.env.GITHUB_REPO = "test-repo";

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Test data
export const mockData = {
  project: {
    id: "project-1",
    number: 1,
    title: "Test Project",
    description: "Test Description",
    url: "https://github.com/test-owner/test-repo/projects/1",
    closed: false,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  issue: {
    id: 1,
    node_id: "issue-1",
    url: "https://api.github.com/repos/test-owner/test-repo/issues/1",
    repository_url: "https://api.github.com/repos/test-owner/test-repo",
    labels_url:
      "https://api.github.com/repos/test-owner/test-repo/issues/1/labels{/name}",
    comments_url:
      "https://api.github.com/repos/test-owner/test-repo/issues/1/comments",
    events_url:
      "https://api.github.com/repos/test-owner/test-repo/issues/1/events",
    html_url: "https://github.com/test-owner/test-repo/issues/1",
    number: 1,
    state: "open",
    title: "Test Issue",
    body: "Test Description",
    user: {
      login: "test-user",
      id: 1,
      node_id: "user-1",
      avatar_url: "https://github.com/images/error/test-user.gif",
      url: "https://api.github.com/users/test-user",
    },
    labels: [
      {
        name: "priority:high",
        id: 1,
        node_id: "label-1",
        url: "",
        description: "",
        color: "",
        default: false,
      },
      {
        name: "type:feature",
        id: 2,
        node_id: "label-2",
        url: "",
        description: "",
        color: "",
        default: false,
      },
      {
        name: "test-label",
        id: 3,
        node_id: "label-3",
        url: "",
        description: "",
        color: "",
        default: false,
      },
    ],
    assignees: [
      {
        login: "user1",
        id: 1,
        node_id: "user-1",
        avatar_url: "https://github.com/images/error/user1.gif",
        url: "https://api.github.com/users/user1",
      },
    ],
    milestone: {
      url: "https://api.github.com/repos/test-owner/test-repo/milestones/1",
      html_url: "https://github.com/test-owner/test-repo/milestone/1",
      labels_url:
        "https://api.github.com/repos/test-owner/test-repo/milestones/1/labels",
      id: 1,
      node_id: "milestone-1",
      number: 1,
      title: "Test Milestone",
      description: "Test Description",
      creator: null,
      open_issues: 2,
      closed_issues: 1,
      state: "open" as const,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      due_on: "2024-03-31T00:00:00Z",
      closed_at: null,
    },
    locked: false,
    active_lock_reason: null,
    comments: 0,
    pull_request: null,
    closed_at: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    author_association: "OWNER",
    state_reason: null,
  },
  milestone: {
    url: "https://api.github.com/repos/test-owner/test-repo/milestones/1",
    html_url: "https://github.com/test-owner/test-repo/milestone/1",
    labels_url:
      "https://api.github.com/repos/test-owner/test-repo/milestones/1/labels",
    id: 1,
    node_id: "milestone-1",
    number: 1,
    state: "open" as const,
    title: "Test Milestone",
    description: "Test Description",
    creator: null,
    open_issues: 2,
    closed_issues: 1,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    due_on: "2024-03-31T00:00:00Z",
    closed_at: null,
  } satisfies components["schemas"]["milestone"],
};
