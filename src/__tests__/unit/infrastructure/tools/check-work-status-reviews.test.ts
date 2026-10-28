import { beforeEach, describe, expect, it, type Mock, type MockedClass, vi } from "vitest";
import { GitHubRepositoryFactory } from "../../../../infrastructure/github/GitHubRepositoryFactory";
import { executeCheckWorkStatus } from "../../../../infrastructure/tools/agent-orchestration-tools";

/**
 * The review status of a pull request must be derived from every review the
 * pull request has - not from the first page only.
 *
 * `pulls.listReviews` serves 30 reviews per page by default and the endpoint
 * has no cursor, so a pull request with more reviews than that silently lost
 * the rest, and with them the review that decides its outcome.
 */

vi.mock("../../../../infrastructure/github/GitHubRepositoryFactory.js", () => ({
  GitHubRepositoryFactory: vi.fn().mockImplementation(function () {
    return {
      getOctokit: vi.fn(),
      getConfig: vi.fn(),
    };
  }),
}));

const MockedFactory = GitHubRepositoryFactory as MockedClass<typeof GitHubRepositoryFactory>;

interface ReviewFixture {
  id: number;
  login: string;
  state: string;
  body?: string | null;
  submitted_at?: string | null;
}

function review(fixture: ReviewFixture) {
  return {
    id: fixture.id,
    user: { login: fixture.login },
    state: fixture.state,
    body: fixture.body ?? "",
    submitted_at: fixture.submitted_at ?? null,
  };
}

describe("check_work_status review handling", () => {
  let listReviews: Mock;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("GITHUB_TOKEN", "test-token");

    listReviews = vi.fn();

    MockedFactory.mockImplementation(function () {
      return {
        getOctokit: vi.fn().mockReturnValue({
          rest: {
            pulls: {
              get: vi.fn().mockResolvedValue({
                data: { merged: false, draft: false, state: "open" },
              }),
              listReviews,
            },
            issues: {
              listComments: vi.fn().mockResolvedValue({ data: [] }),
            },
          },
        }),
        getConfig: vi.fn().mockReturnValue({ owner: "octocat", repo: "hello-world" }),
      } as unknown as GitHubRepositoryFactory;
    });
  });

  it("requests the reviews page by page and stops after a short page", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      review({
        id: index + 1,
        login: `author-${index}`,
        state: "COMMENTED",
        body: "looks good",
        submitted_at: "2024-01-01T00:00:00Z",
      })
    );
    listReviews
      .mockResolvedValueOnce({ data: firstPage })
      .mockResolvedValueOnce({ data: [review({ id: 101, login: "octocat", state: "APPROVED" })] });

    const result = await executeCheckWorkStatus({
      agentId: "agent-1",
      taskId: "42",
      prNumber: 7,
    });

    expect(listReviews).toHaveBeenCalledTimes(2);
    expect(listReviews).toHaveBeenNthCalledWith(1, {
      owner: "octocat",
      repo: "hello-world",
      pull_number: 7,
      per_page: 100,
      page: 1,
    });
    expect(listReviews).toHaveBeenNthCalledWith(2, {
      owner: "octocat",
      repo: "hello-world",
      pull_number: 7,
      per_page: 100,
      page: 2,
    });
    expect(result.structuredContent.reviewStatus).toBe("approved");
  });

  it("stops after the first page when it is not full", async () => {
    listReviews.mockResolvedValue({
      data: [review({ id: 1, login: "octocat", state: "APPROVED" })],
    });

    const result = await executeCheckWorkStatus({
      agentId: "agent-1",
      taskId: "42",
      prNumber: 7,
    });

    expect(listReviews).toHaveBeenCalledTimes(1);
    expect(result.structuredContent.reviewStatus).toBe("approved");
  });

  it("keeps the newest review of every author across pages", async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) =>
      review({
        id: index + 1,
        login: `author-${index}`,
        state: "COMMENTED",
        body: "looks good",
        submitted_at: "2024-01-01T00:00:00Z",
      })
    );
    fullPage[0] = review({
      id: 1,
      login: "alice",
      state: "CHANGES_REQUESTED",
      body: "please fix",
      submitted_at: "2024-01-01T10:00:00Z",
    });
    fullPage[1] = review({
      id: 2,
      login: "bob",
      state: "COMMENTED",
      body: "one question",
      submitted_at: "2024-01-01T11:00:00Z",
    });

    listReviews.mockResolvedValueOnce({ data: fullPage }).mockResolvedValueOnce({
      data: [
        review({
          id: 101,
          login: "alice",
          state: "APPROVED",
          body: "looks good now",
          submitted_at: "2024-01-02T09:00:00Z",
        }),
      ],
    });

    const result = await executeCheckWorkStatus({
      agentId: "agent-1",
      taskId: "42",
      prNumber: 7,
    });

    expect(result.structuredContent.reviewStatus).toBe("approved");
    const comments = result.structuredContent.reviewComments ?? [];
    expect(comments.find((comment) => comment.author === "alice")).toEqual({
      author: "alice",
      state: "APPROVED",
      body: "looks good now",
    });
    expect(comments.find((comment) => comment.author === "bob")).toEqual({
      author: "bob",
      state: "COMMENTED",
      body: "one question",
    });
  });

  it("keeps the newest review of an author even when it arrives first", async () => {
    listReviews.mockResolvedValue({
      data: [
        review({
          id: 2,
          login: "alice",
          state: "APPROVED",
          body: "looks good now",
          submitted_at: "2024-01-02T09:00:00Z",
        }),
        review({
          id: 1,
          login: "alice",
          state: "CHANGES_REQUESTED",
          body: "please fix",
          submitted_at: "2024-01-01T10:00:00Z",
        }),
      ],
    });

    const result = await executeCheckWorkStatus({
      agentId: "agent-1",
      taskId: "42",
      prNumber: 7,
    });

    expect(result.structuredContent.reviewStatus).toBe("approved");
    expect(result.structuredContent.reviewComments).toEqual([
      { author: "alice", state: "APPROVED", body: "looks good now" },
    ]);
  });

  it("does not let a comment-only review without a body mask an approval", async () => {
    listReviews.mockResolvedValue({
      data: [
        review({
          id: 1,
          login: "alice",
          state: "APPROVED",
          body: "ship it",
          submitted_at: "2024-01-01T10:00:00Z",
        }),
        review({
          id: 2,
          login: "alice",
          state: "COMMENTED",
          body: "",
          submitted_at: "2024-01-02T10:00:00Z",
        }),
      ],
    });

    const result = await executeCheckWorkStatus({
      agentId: "agent-1",
      taskId: "42",
      prNumber: 7,
    });

    expect(result.structuredContent.reviewStatus).toBe("approved");
    expect(result.structuredContent.reviewComments).toEqual([
      { author: "alice", state: "APPROVED", body: "ship it" },
    ]);
  });

  it("reports a change request that is the newest review of its author", async () => {
    listReviews.mockResolvedValue({
      data: [
        review({
          id: 1,
          login: "alice",
          state: "APPROVED",
          body: "ship it",
          submitted_at: "2024-01-01T10:00:00Z",
        }),
        review({
          id: 2,
          login: "alice",
          state: "CHANGES_REQUESTED",
          body: "one more thing",
          submitted_at: "2024-01-02T10:00:00Z",
        }),
      ],
    });

    const result = await executeCheckWorkStatus({
      agentId: "agent-1",
      taskId: "42",
      prNumber: 7,
    });

    expect(result.structuredContent.reviewStatus).toBe("changes_requested");
    expect(result.structuredContent.actionRequired).toContain("Address review feedback");
  });
});
