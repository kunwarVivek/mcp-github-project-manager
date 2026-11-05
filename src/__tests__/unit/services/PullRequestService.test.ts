import { beforeEach, describe, expect, it, type Mocked, vi } from "vitest";
import { DomainError } from "../../../domain/errors";
import type { GitHubPullRequestRepository } from "../../../infrastructure/github/repositories/GitHubPullRequestRepository";
import { PullRequestService } from "../../../services/PullRequestService";
import { asFactory } from "../../helpers/mockTypes";

describe("PullRequestService", () => {
  let service: PullRequestService;
  let prRepo: Mocked<GitHubPullRequestRepository>;

  beforeEach(() => {
    prRepo = {
      create: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      merge: vi.fn(),
      listReviews: vi.fn(),
      createReview: vi.fn(),
    } as unknown as Mocked<GitHubPullRequestRepository>;
    service = new PullRequestService(asFactory({ createPullRequestRepository: () => prRepo }));
  });

  it("creates a pull request through the repository", async () => {
    const created = { number: 1, id: 100, title: "Feature", state: "open", url: "u" };
    prRepo.create.mockResolvedValueOnce(created);

    const data = { title: "Feature", head: "feature", base: "main" };
    expect(await service.createPullRequest(data)).toEqual(created);
    expect(prRepo.create).toHaveBeenCalledWith(data);
  });

  it("gets a pull request by number", async () => {
    const pr = {
      number: 1,
      title: "PR",
      state: "open",
      body: "",
      head: "f",
      base: "m",
      user: "alice",
      merged: false,
      url: "u",
    };
    prRepo.get.mockResolvedValueOnce(pr);

    expect(await service.getPullRequest({ pullNumber: 1 })).toEqual(pr);
    expect(prRepo.get).toHaveBeenCalledWith(1);
  });

  it("lists with open/30 defaults and passes explicit state and limit", async () => {
    prRepo.list.mockResolvedValue([]);

    await service.listPullRequests({});
    expect(prRepo.list).toHaveBeenLastCalledWith("open", 30);

    await service.listPullRequests({ state: "closed", limit: 5 });
    expect(prRepo.list).toHaveBeenLastCalledWith("closed", 5);
  });

  it("updates, merges and reviews by pull number", async () => {
    prRepo.update.mockResolvedValueOnce({ number: 1, title: "T", state: "open", url: "u" });
    prRepo.merge.mockResolvedValueOnce({ merged: true, message: "Merged", sha: "abc" });
    prRepo.listReviews.mockResolvedValueOnce([]);
    prRepo.createReview.mockResolvedValueOnce({ id: 1, user: "a", state: "APPROVED", body: "" });

    await service.updatePullRequest({ pullNumber: 1, title: "T" });
    expect(prRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ title: "T" }));

    await service.mergePullRequest({ pullNumber: 2, mergeMethod: "squash" });
    expect(prRepo.merge).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ mergeMethod: "squash" })
    );

    await service.listPullRequestReviews({ pullNumber: 3 });
    expect(prRepo.listReviews).toHaveBeenCalledWith(3);

    await service.createPullRequestReview({ pullNumber: 4, event: "APPROVE" });
    expect(prRepo.createReview).toHaveBeenCalledWith(
      4,
      expect.objectContaining({ event: "APPROVE" })
    );
  });

  it("maps repository failures to domain errors", async () => {
    prRepo.merge.mockRejectedValueOnce(new Error("Merge conflict"));

    await expect(service.mergePullRequest({ pullNumber: 1 })).rejects.toThrow(DomainError);
  });
});
