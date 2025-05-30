import { jest, beforeAll, afterAll, beforeEach } from "@jest/globals";
import nock from "nock";

// Check if we should run real E2E tests with actual APIs
const isRealE2ETest = process.env.E2E_REAL_API === 'true';
const hasGitHubCredentials = !!(process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO);
const hasAICredentials = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);

beforeAll(() => {
  if (!isRealE2ETest) {
    // Disable external network requests during mock tests
    nock.disableNetConnect();
  } else {
    // For real E2E tests, ensure we have credentials
    if (!hasGitHubCredentials) {
      console.warn('⚠️  Real E2E tests require GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO environment variables');
    }
    if (!hasAICredentials) {
      console.warn('⚠️  AI tool tests require at least one AI API key (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)');
    }
  }
});

afterAll(() => {
  if (!isRealE2ETest) {
    // Re-enable network requests after mock tests
    nock.enableNetConnect();
  }
});

beforeEach(() => {
  if (!isRealE2ETest) {
    // Clear all nock interceptors for mock tests
    nock.cleanAll();
  }

  // Set up environment variables (use real ones if available, otherwise use test values)
  if (!process.env.GITHUB_TOKEN) process.env.GITHUB_TOKEN = "test-token";
  if (!process.env.GITHUB_OWNER) process.env.GITHUB_OWNER = "test-owner";
  if (!process.env.GITHUB_REPO) process.env.GITHUB_REPO = "test-repo";

  // Set up AI environment variables for testing
  if (!process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
  if (!process.env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = "sk-test-openai-key";
  if (!process.env.GOOGLE_API_KEY) process.env.GOOGLE_API_KEY = "test-google-key";
  if (!process.env.PERPLEXITY_API_KEY) process.env.PERPLEXITY_API_KEY = "pplx-test-key";

  // Use fake timers for consistent testing
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2025-03-01T12:00:00Z"));
});

afterEach(() => {
  if (!isRealE2ETest) {
    // Ensure all nock interceptors were used in mock tests
    if (!nock.isDone()) {
      console.warn('⚠️  Not all nock interceptors were used:', nock.pendingMocks());
      nock.cleanAll(); // Clean up unused mocks
    }
  }

  // Clear mocks and restore timers
  jest.clearAllMocks();
  jest.useRealTimers();
});

// Export test configuration
export const testConfig = {
  isRealE2ETest,
  hasGitHubCredentials,
  hasAICredentials,
  skipIfNoCredentials: (testType: 'github' | 'ai' | 'both') => {
    if (!isRealE2ETest) return false; // Mock tests always run

    switch (testType) {
      case 'github':
        return !hasGitHubCredentials;
      case 'ai':
        return !hasAICredentials;
      case 'both':
        return !hasGitHubCredentials || !hasAICredentials;
      default:
        return false;
    }
  }
};

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