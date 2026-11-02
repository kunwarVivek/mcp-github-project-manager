import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubIssueCommentRepository } from "../../../../../infrastructure/github/repositories/GitHubIssueCommentRepository";
import { asOctokit, type RestCallFn } from "../../../../helpers/mockTypes";

describe("GitHubIssueCommentRepository", () => {
  let repository: GitHubIssueCommentRepository;
  let issues: Record<
    "createComment" | "updateComment" | "deleteComment" | "listComments",
    Mock<RestCallFn>
  >;

  const apiComment = {
    id: 1,
    body: "Test comment",
    user: { login: "user1" },
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
  };
  const comment = {
    id: 1,
    body: "Test comment",
    user: "user1",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
  };

  beforeEach(() => {
    issues = {
      createComment: vi.fn<RestCallFn>(),
      updateComment: vi.fn<RestCallFn>(),
      deleteComment: vi.fn<RestCallFn>(),
      listComments: vi.fn<RestCallFn>(),
    };
    repository = new GitHubIssueCommentRepository(
      asOctokit({ rest: { issues } }),
      new GitHubConfig("testOwner", "testRepo", { kind: "pat", token: "token" })
    );
  });

  it("creates a comment on an issue number", async () => {
    issues.createComment.mockResolvedValueOnce({ data: apiComment });

    const result = await repository.create(7, "Test comment");

    expect(result).toEqual(comment);
    expect(issues.createComment).toHaveBeenCalledWith({
      owner: "testOwner",
      repo: "testRepo",
      issue_number: 7,
      body: "Test comment",
    });
  });

  it("maps a missing body and author to defaults", async () => {
    issues.updateComment.mockResolvedValueOnce({
      data: { ...apiComment, body: null, user: null },
    });

    const result = await repository.update(5, "x");

    expect(result.body).toBe("");
    expect(result.user).toBe("unknown");
    expect(issues.updateComment).toHaveBeenCalledWith({
      owner: "testOwner",
      repo: "testRepo",
      comment_id: 5,
      body: "x",
    });
  });

  it("deletes a comment by id", async () => {
    issues.deleteComment.mockResolvedValueOnce({ data: undefined });

    await repository.delete(9);

    expect(issues.deleteComment).toHaveBeenCalledWith({
      owner: "testOwner",
      repo: "testRepo",
      comment_id: 9,
    });
  });

  it("lists comments with the default and a custom page size", async () => {
    issues.listComments.mockResolvedValue({ data: [apiComment] });

    expect(await repository.list(1)).toEqual([comment]);
    expect(issues.listComments).toHaveBeenLastCalledWith(
      expect.objectContaining({ issue_number: 1, per_page: 30 })
    );

    await repository.list(1, 10);
    expect(issues.listComments).toHaveBeenLastCalledWith(expect.objectContaining({ per_page: 10 }));
  });
});
