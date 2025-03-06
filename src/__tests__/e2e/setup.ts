import { jest } from "@jest/globals";
import nock from "nock";

beforeAll(() => {
  // Disable external network requests during tests
  nock.disableNetConnect();
});

afterAll(() => {
  // Re-enable network requests after tests
  nock.enableNetConnect();
});

beforeEach(() => {
  // Clear all nock interceptors
  nock.cleanAll();
  
  // Mock environment variables
  process.env.GITHUB_TOKEN = "test-token";
  process.env.GITHUB_OWNER = "test-owner";
  process.env.GITHUB_REPO = "test-repo";

  // Use fake timers
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2025-03-01T12:00:00Z"));
});

afterEach(() => {
  // Ensure all nock interceptors were used
  expect(nock.isDone()).toBe(true);
  
  // Clear mocks and restore timers
  jest.clearAllMocks();
  jest.useRealTimers();
});

// Mock data for tests
export const mockData = {
  project: {
    id: "test-project-id",
    number: 1,
    title: "Test Project",
    body: "Test project description",
    state: "open",
    created_at: "2025-03-01T12:00:00Z",
    updated_at: "2025-03-01T12:00:00Z",
    node_id: "test-node-id",
  },
  issue: {
    id: 1,
    node_id: "test-issue-node-id",
    number: 1,
    title: "Test Issue",
    body: "Test issue description",
    state: "open",
    labels: [],
    assignees: [],
    milestone: null,
    created_at: "2025-03-01T12:00:00Z",
    updated_at: "2025-03-01T12:00:00Z",
    closed_at: null,
    url: "https://api.github.com/repos/test-owner/test-repo/issues/1",
    repository_url: "https://api.github.com/repos/test-owner/test-repo",
    labels_url: "https://api.github.com/repos/test-owner/test-repo/issues/1/labels{/name}",
    comments_url: "https://api.github.com/repos/test-owner/test-repo/issues/1/comments",
    events_url: "https://api.github.com/repos/test-owner/test-repo/issues/1/events",
    html_url: "https://github.com/test-owner/test-repo/issues/1",
    user: {
      login: "test-user",
    },
    state_reason: null,
  },
  milestone: {
    id: 1,
    node_id: "test-milestone-node-id",
    number: 1,
    title: "Test Milestone",
    description: "Test milestone description",
    state: "open",
    open_issues: 0,
    closed_issues: 0,
    created_at: "2025-03-01T12:00:00Z",
    updated_at: "2025-03-01T12:00:00Z",
    closed_at: null,
    due_on: "2025-04-01T12:00:00Z",
    url: "https://api.github.com/repos/test-owner/test-repo/milestones/1",
  },
};

// Helper function to mock GitHub API responses
export function mockGitHubAPI() {
  return nock("https://api.github.com")
    .persist()
    .defaultReplyHeaders({
      "access-control-allow-origin": "*",
      "access-control-allow-credentials": "true",
    })
    .intercept(/.*/, "OPTIONS")
    .reply(200, {}, {
      "access-control-allow-headers": "Authorization, Content-Type",
      "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE",
    });
}