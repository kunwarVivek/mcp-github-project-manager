import { jest } from "@jest/globals";

// Mock environment variables
process.env.GITHUB_TOKEN = "test-token";
process.env.GITHUB_OWNER = "test-owner";
process.env.GITHUB_REPO = "test-repo";

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Helper to create Octokit response
const createOctokitResponse = <T>(data: T, status = 200) => ({
  data,
  headers: {
    "x-github-media-type": "github.v3; format=json",
    "x-ratelimit-limit": "5000",
    "x-ratelimit-remaining": "4999",
  },
  status,
  url: "https://api.github.com/test",
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
      gravatar_id: "",
      url: "https://api.github.com/users/test-user",
      html_url: "https://github.com/test-user",
      followers_url: "https://api.github.com/users/test-user/followers",
      following_url:
        "https://api.github.com/users/test-user/following{/other_user}",
      gists_url: "https://api.github.com/users/test-user/gists{/gist_id}",
      starred_url:
        "https://api.github.com/users/test-user/starred{/owner}{/repo}",
      subscriptions_url: "https://api.github.com/users/test-user/subscriptions",
      organizations_url: "https://api.github.com/users/test-user/orgs",
      repos_url: "https://api.github.com/users/test-user/repos",
      events_url: "https://api.github.com/users/test-user/events{/privacy}",
      received_events_url:
        "https://api.github.com/users/test-user/received_events",
      type: "User",
      site_admin: false,
    },
    labels: [
      {
        name: "priority:high",
        id: 1,
        node_id: "label-1",
        url: "https://api.github.com/repos/test-owner/test-repo/labels/priority:high",
        description: "",
        color: "ff0000",
        default: false,
      },
      {
        name: "type:feature",
        id: 2,
        node_id: "label-2",
        url: "https://api.github.com/repos/test-owner/test-repo/labels/type:feature",
        description: "",
        color: "0000ff",
        default: false,
      },
      {
        name: "test-label",
        id: 3,
        node_id: "label-3",
        url: "https://api.github.com/repos/test-owner/test-repo/labels/test-label",
        description: "",
        color: "000000",
        default: false,
      },
    ],
    assignee: {
      login: "user1",
      id: 1,
      node_id: "user-1",
      avatar_url: "https://github.com/images/error/user1.gif",
      gravatar_id: "",
      url: "https://api.github.com/users/user1",
      html_url: "https://github.com/user1",
      followers_url: "https://api.github.com/users/user1/followers",
      following_url:
        "https://api.github.com/users/user1/following{/other_user}",
      gists_url: "https://api.github.com/users/user1/gists{/gist_id}",
      starred_url: "https://api.github.com/users/user1/starred{/owner}{/repo}",
      subscriptions_url: "https://api.github.com/users/user1/subscriptions",
      organizations_url: "https://api.github.com/users/user1/orgs",
      repos_url: "https://api.github.com/users/user1/repos",
      events_url: "https://api.github.com/users/user1/events{/privacy}",
      received_events_url: "https://api.github.com/users/user1/received_events",
      type: "User",
      site_admin: false,
    },
    assignees: [
      {
        login: "user1",
        id: 1,
        node_id: "user-1",
        avatar_url: "https://github.com/images/error/user1.gif",
        gravatar_id: "",
        url: "https://api.github.com/users/user1",
        html_url: "https://github.com/user1",
        followers_url: "https://api.github.com/users/user1/followers",
        following_url:
          "https://api.github.com/users/user1/following{/other_user}",
        gists_url: "https://api.github.com/users/user1/gists{/gist_id}",
        starred_url:
          "https://api.github.com/users/user1/starred{/owner}{/repo}",
        subscriptions_url: "https://api.github.com/users/user1/subscriptions",
        organizations_url: "https://api.github.com/users/user1/orgs",
        repos_url: "https://api.github.com/users/user1/repos",
        events_url: "https://api.github.com/users/user1/events{/privacy}",
        received_events_url:
          "https://api.github.com/users/user1/received_events",
        type: "User",
        site_admin: false,
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
    pull_request: {
      merged_at: null,
      diff_url: null,
      html_url: null,
      patch_url: null,
      url: null,
    },
    closed_at: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    author_association: "OWNER" as const,
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
  },
  // Helper functions to create Octokit responses
  createIssueResponse: (status = 200) =>
    createOctokitResponse(mockData.issue, status),
  createIssuesResponse: (status = 200) =>
    createOctokitResponse([mockData.issue], status),
  createMilestoneResponse: (status = 200) =>
    createOctokitResponse(mockData.milestone, status),
  createMilestonesResponse: (status = 200) =>
    createOctokitResponse([mockData.milestone], status),
};
