import type { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import type { GitHubPullRequestRepository } from "../infrastructure/github/repositories/GitHubPullRequestRepository";
import { safeCall } from "./utils/safeCall";

/**
 * Service for managing GitHub pull requests.
 *
 * Handles:
 * - Creating pull requests (draft or ready for review)
 * - Getting pull request details
 * - Listing pull requests with state filtering
 * - Updating pull request properties (title, body, state)
 * - Merging pull requests (merge, squash, rebase)
 * - Managing pull request reviews (list, create with approval/changes)
 *
 * Can be instantiated directly with a GitHubRepositoryFactory or via dependency injection.
 */
export class PullRequestService {
  private readonly factory: GitHubRepositoryFactory;

  constructor(factory: GitHubRepositoryFactory) {
    this.factory = factory;
  }

  private get pullRequestRepo(): GitHubPullRequestRepository {
    return this.factory.createPullRequestRepository();
  }

  async createPullRequest(data: {
    title: string;
    body?: string;
    head: string;
    base: string;
    draft?: boolean;
  }): Promise<{ number: number; id: number; title: string; state: string; url: string }> {
    return safeCall(async () => this.pullRequestRepo.create(data));
  }

  async getPullRequest(data: { pullNumber: number }): Promise<{
    number: number;
    title: string;
    state: string;
    body: string;
    head: string;
    base: string;
    user: string;
    merged: boolean;
    url: string;
  }> {
    return safeCall(async () => this.pullRequestRepo.get(data.pullNumber));
  }

  async listPullRequests(data: {
    state?: "open" | "closed" | "all";
    limit?: number;
  }): Promise<Array<{ number: number; title: string; state: string; user: string; url: string }>> {
    return safeCall(async () => this.pullRequestRepo.list(data.state || "open", data.limit || 30));
  }

  async updatePullRequest(data: {
    pullNumber: number;
    title?: string;
    body?: string;
    state?: "open" | "closed";
  }): Promise<{ number: number; title: string; state: string; url: string }> {
    return safeCall(async () => this.pullRequestRepo.update(data.pullNumber, data));
  }

  async mergePullRequest(data: {
    pullNumber: number;
    mergeMethod?: "merge" | "squash" | "rebase";
    commitTitle?: string;
    commitMessage?: string;
  }): Promise<{ merged: boolean; message: string; sha: string }> {
    return safeCall(async () => this.pullRequestRepo.merge(data.pullNumber, data));
  }

  async listPullRequestReviews(data: { pullNumber: number }): Promise<
    Array<{
      id: number;
      user: string;
      state: string;
      body: string;
    }>
  > {
    return safeCall(async () => this.pullRequestRepo.listReviews(data.pullNumber));
  }

  async createPullRequestReview(data: {
    pullNumber: number;
    body?: string;
    event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
    comments?: Array<{ path: string; position?: number; body: string }>;
  }): Promise<{ id: number; user: string; state: string; body: string }> {
    return safeCall(async () => this.pullRequestRepo.createReview(data.pullNumber, data));
  }
}
