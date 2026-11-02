import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubPullRequestRepository } from "../../../../../infrastructure/github/repositories/GitHubPullRequestRepository";
import { asOctokit, type RestCallFn } from "../../../../helpers/mockTypes";

describe("GitHubPullRequestRepository", () => {
  let repository: GitHubPullRequestRepository;
  let pulls: Record<
    "create" | "get" | "list" | "update" | "merge" | "listReviews" | "createReview",
    Mock<RestCallFn>
  >;

  beforeEach(() => {
    pulls = {
      create: vi.fn<RestCallFn>(),
      get: vi.fn<RestCallFn>(),
      list: vi.fn<RestCallFn>(),
      update: vi.fn<RestCallFn>(),
      merge: vi.fn<RestCallFn>(),
      listReviews: vi.fn<RestCallFn>(),
      createReview: vi.fn<RestCallFn>(),
    };
    repository = new GitHubPullRequestRepository(
      asOctokit({ rest: { pulls } }),
      new GitHubConfig("testOwner", "testRepo", { kind: "pat", token: "token" })
    );
  });

  describe("create", () => {
    it("creates a non-draft pull request with an empty body by default", async () => {
      pulls.create.mockResolvedValueOnce({
        data: { number: 1, id: 100, title: "Feature", state: "open", html_url: "https://pr/1" },
      });

      const result = await repository.create({ title: "Feature", head: "feature", base: "main" });

      expect(result).toEqual({
        number: 1,
        id: 100,
        title: "Feature",
        state: "open",
        url: "https://pr/1",
      });
      expect(pulls.create).toHaveBeenCalledWith({
        owner: "testOwner",
        repo: "testRepo",
        title: "Feature",
        body: "",
        head: "feature",
        base: "main",
        draft: false,
      });
    });

    it("passes the draft flag", async () => {
      pulls.create.mockResolvedValueOnce({
        data: { number: 2, id: 101, title: "WIP", state: "open", html_url: "u" },
      });

      await repository.create({ title: "WIP", head: "h", base: "b", draft: true });

      expect(pulls.create).toHaveBeenCalledWith(expect.objectContaining({ draft: true }));
    });

    it("rejects on API failure", async () => {
      pulls.create.mockRejectedValueOnce(new Error("Conflict"));

      await expect(repository.create({ title: "PR", head: "h", base: "b" })).rejects.toThrow();
    });
  });

  describe("get", () => {
    it("flattens refs and author", async () => {
      pulls.get.mockResolvedValueOnce({
        data: {
          number: 1,
          title: "PR",
          state: "open",
          body: "desc",
          head: { ref: "feature" },
          base: { ref: "main" },
          user: { login: "alice" },
          merged: false,
          html_url: "u",
        },
      });

      expect(await repository.get(1)).toEqual({
        number: 1,
        title: "PR",
        state: "open",
        body: "desc",
        head: "feature",
        base: "main",
        user: "alice",
        merged: false,
        url: "u",
      });
      expect(pulls.get).toHaveBeenCalledWith({
        owner: "testOwner",
        repo: "testRepo",
        pull_number: 1,
      });
    });

    it("defaults a missing author and body", async () => {
      pulls.get.mockResolvedValueOnce({
        data: {
          number: 1,
          title: "PR",
          state: "open",
          body: null,
          head: { ref: "f" },
          base: { ref: "m" },
          user: null,
          merged: false,
          html_url: "u",
        },
      });

      const result = await repository.get(1);

      expect(result.user).toBe("unknown");
      expect(result.body).toBe("");
    });
  });

  describe("list", () => {
    it("defaults to open PRs, 30 per page, and maps a missing author", async () => {
      pulls.list.mockResolvedValueOnce({
        data: [
          { number: 1, title: "A", state: "open", user: { login: "bob" }, html_url: "u1" },
          { number: 2, title: "B", state: "closed", user: null, html_url: "u2" },
        ],
      });

      const result = await repository.list();

      expect(result[1].user).toBe("unknown");
      expect(pulls.list).toHaveBeenCalledWith(
        expect.objectContaining({ state: "open", per_page: 30 })
      );
    });

    it("passes custom state and limit", async () => {
      pulls.list.mockResolvedValueOnce({ data: [] });

      await repository.list("closed", 5);

      expect(pulls.list).toHaveBeenCalledWith(
        expect.objectContaining({ state: "closed", per_page: 5 })
      );
    });
  });

  describe("update", () => {
    it("sends the PR number and fields", async () => {
      pulls.update.mockResolvedValueOnce({
        data: { number: 1, title: "Updated", state: "closed", html_url: "u" },
      });

      const result = await repository.update(1, { title: "Updated", state: "closed" });

      expect(result).toEqual({ number: 1, title: "Updated", state: "closed", url: "u" });
      expect(pulls.update).toHaveBeenCalledWith(
        expect.objectContaining({ pull_number: 1, title: "Updated", state: "closed" })
      );
    });
  });

  describe("merge", () => {
    it("defaults to the merge method", async () => {
      pulls.merge.mockResolvedValueOnce({ data: { merged: true, message: "Merged", sha: "abc" } });

      const result = await repository.merge(1, {});

      expect(result).toEqual({ merged: true, message: "Merged", sha: "abc" });
      expect(pulls.merge).toHaveBeenCalledWith(expect.objectContaining({ merge_method: "merge" }));
    });

    it("passes the squash method and commit title", async () => {
      pulls.merge.mockResolvedValueOnce({ data: { merged: true, message: "m", sha: "def" } });

      await repository.merge(2, { mergeMethod: "squash", commitTitle: "feat: squash" });

      expect(pulls.merge).toHaveBeenCalledWith(
        expect.objectContaining({
          pull_number: 2,
          merge_method: "squash",
          commit_title: "feat: squash",
        })
      );
    });

    it("rejects on merge conflict", async () => {
      pulls.merge.mockRejectedValueOnce(new Error("Merge conflict"));

      await expect(repository.merge(1, {})).rejects.toThrow();
    });
  });

  describe("reviews", () => {
    it("lists reviews and defaults a missing author and body", async () => {
      pulls.listReviews.mockResolvedValueOnce({
        data: [
          { id: 10, user: { login: "reviewer" }, state: "APPROVED", body: "LGTM" },
          { id: 11, user: null, state: "COMMENTED", body: null },
        ],
      });

      expect(await repository.listReviews(1)).toEqual([
        { id: 10, user: "reviewer", state: "APPROVED", body: "LGTM" },
        { id: 11, user: "unknown", state: "COMMENTED", body: "" },
      ]);
    });

    it("creates a review with its event and inline comments", async () => {
      pulls.createReview.mockResolvedValueOnce({
        data: { id: 20, user: { login: "alice" }, state: "CHANGES_REQUESTED", body: "no" },
      });
      const comments = [{ path: "a.ts", position: 3, body: "fix" }];

      const result = await repository.createReview(1, {
        event: "REQUEST_CHANGES",
        body: "no",
        comments,
      });

      expect(result).toEqual({ id: 20, user: "alice", state: "CHANGES_REQUESTED", body: "no" });
      expect(pulls.createReview).toHaveBeenCalledWith(
        expect.objectContaining({ pull_number: 1, event: "REQUEST_CHANGES", comments })
      );
    });
  });
});
