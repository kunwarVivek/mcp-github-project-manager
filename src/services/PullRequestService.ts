import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { safeCall } from './utils/safeCall';

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

  async createPullRequest(data: {
    title: string;
    body?: string;
    head: string;
    base: string;
    draft?: boolean;
  }): Promise<{ number: number; id: number; title: string; state: string; url: string }> {
    return safeCall(async () => {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.pulls.create({
        owner: config.owner,
        repo: config.repo,
        title: data.title,
        body: data.body || '',
        head: data.head,
        base: data.base,
        draft: data.draft || false
      });

      return {
        number: response.data.number,
        id: response.data.id,
        title: response.data.title,
        state: response.data.state,
        url: response.data.html_url
      };
    });
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
    return safeCall(async () => {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.pulls.get({
        owner: config.owner,
        repo: config.repo,
        pull_number: data.pullNumber
      });

      return {
        number: response.data.number,
        title: response.data.title,
        state: response.data.state,
        body: response.data.body || '',
        head: response.data.head.ref,
        base: response.data.base.ref,
        user: response.data.user?.login || 'unknown',
        merged: response.data.merged,
        url: response.data.html_url
      };
    });
  }

  async listPullRequests(data: {
    state?: 'open' | 'closed' | 'all';
    limit?: number;
  }): Promise<Array<{ number: number; title: string; state: string; user: string; url: string }>> {
    return safeCall(async () => {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.pulls.list({
        owner: config.owner,
        repo: config.repo,
        state: data.state || 'open',
        per_page: data.limit || 30
      });

      return response.data.map(pr => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        user: pr.user?.login || 'unknown',
        url: pr.html_url
      }));
    });
  }

  async updatePullRequest(data: {
    pullNumber: number;
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
  }): Promise<{ number: number; title: string; state: string; url: string }> {
    return safeCall(async () => {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.pulls.update({
        owner: config.owner,
        repo: config.repo,
        pull_number: data.pullNumber,
        title: data.title,
        body: data.body,
        state: data.state
      });

      return {
        number: response.data.number,
        title: response.data.title,
        state: response.data.state,
        url: response.data.html_url
      };
    });
  }

  async mergePullRequest(data: {
    pullNumber: number;
    mergeMethod?: 'merge' | 'squash' | 'rebase';
    commitTitle?: string;
    commitMessage?: string;
  }): Promise<{ merged: boolean; message: string; sha: string }> {
    return safeCall(async () => {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.pulls.merge({
        owner: config.owner,
        repo: config.repo,
        pull_number: data.pullNumber,
        merge_method: data.mergeMethod || 'merge',
        commit_title: data.commitTitle,
        commit_message: data.commitMessage
      });

      return {
        merged: response.data.merged,
        message: response.data.message,
        sha: response.data.sha
      };
    });
  }

  async listPullRequestReviews(data: { pullNumber: number }): Promise<Array<{
    id: number;
    user: string;
    state: string;
    body: string;
  }>> {
    return safeCall(async () => {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.pulls.listReviews({
        owner: config.owner,
        repo: config.repo,
        pull_number: data.pullNumber
      });

      return response.data.map(review => ({
        id: review.id,
        user: review.user?.login || 'unknown',
        state: review.state,
        body: review.body || ''
      }));
    });
  }

  async createPullRequestReview(data: {
    pullNumber: number;
    body?: string;
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
    comments?: Array<{ path: string; position?: number; body: string }>;
  }): Promise<{ id: number; user: string; state: string; body: string }> {
    return safeCall(async () => {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.pulls.createReview({
        owner: config.owner,
        repo: config.repo,
        pull_number: data.pullNumber,
        body: data.body,
        event: data.event,
        comments: data.comments
      });

      return {
        id: response.data.id,
        user: response.data.user?.login || 'unknown',
        state: response.data.state,
        body: response.data.body || ''
      };
    });
  }
}
