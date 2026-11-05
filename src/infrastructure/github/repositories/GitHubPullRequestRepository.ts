import type { RestEndpointMethodTypes } from "@octokit/rest";
import { BaseGitHubRepository } from "./BaseRepository";

type Pulls = RestEndpointMethodTypes["pulls"];
type CreateParams = Pulls["create"]["parameters"];
type GetParams = Pulls["get"]["parameters"];
type ListParams = Pulls["list"]["parameters"];
type UpdateParams = Pulls["update"]["parameters"];
type MergeParams = Pulls["merge"]["parameters"];
type ListReviewsParams = Pulls["listReviews"]["parameters"];
type CreateReviewParams = Pulls["createReview"]["parameters"];

export interface PullRequestSummary {
  number: number;
  title: string;
  state: string;
  user: string;
  url: string;
}

export interface PullRequestDetails {
  number: number;
  title: string;
  state: string;
  body: string;
  head: string;
  base: string;
  user: string;
  merged: boolean;
  url: string;
}

export interface PullRequestReview {
  id: number;
  user: string;
  state: string;
  body: string;
}

/** REST access to pull requests of the configured repository. */
export class GitHubPullRequestRepository extends BaseGitHubRepository {
  async create(data: {
    title: string;
    body?: string;
    head: string;
    base: string;
    draft?: boolean;
  }): Promise<{ number: number; id: number; title: string; state: string; url: string }> {
    const pr = await this.rest((params: CreateParams) => this.octokit.rest.pulls.create(params), {
      title: data.title,
      body: data.body || "",
      head: data.head,
      base: data.base,
      draft: data.draft || false,
    });

    return {
      number: pr.number,
      id: pr.id,
      title: pr.title,
      state: pr.state,
      url: pr.html_url,
    };
  }

  async get(pullNumber: number): Promise<PullRequestDetails> {
    const pr = await this.rest((params: GetParams) => this.octokit.rest.pulls.get(params), {
      pull_number: pullNumber,
    });

    return {
      number: pr.number,
      title: pr.title,
      state: pr.state,
      body: pr.body || "",
      head: pr.head.ref,
      base: pr.base.ref,
      user: pr.user?.login || "unknown",
      merged: pr.merged,
      url: pr.html_url,
    };
  }

  async list(state: "open" | "closed" | "all" = "open", limit = 30): Promise<PullRequestSummary[]> {
    const prs = await this.rest((params: ListParams) => this.octokit.rest.pulls.list(params), {
      state,
      per_page: limit,
    });

    return prs.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      user: pr.user?.login || "unknown",
      url: pr.html_url,
    }));
  }

  async update(
    pullNumber: number,
    data: { title?: string; body?: string; state?: "open" | "closed" }
  ): Promise<{ number: number; title: string; state: string; url: string }> {
    const pr = await this.rest((params: UpdateParams) => this.octokit.rest.pulls.update(params), {
      pull_number: pullNumber,
      title: data.title,
      body: data.body,
      state: data.state,
    });

    return { number: pr.number, title: pr.title, state: pr.state, url: pr.html_url };
  }

  async merge(
    pullNumber: number,
    data: {
      mergeMethod?: "merge" | "squash" | "rebase";
      commitTitle?: string;
      commitMessage?: string;
    }
  ): Promise<{ merged: boolean; message: string; sha: string }> {
    const result = await this.rest((params: MergeParams) => this.octokit.rest.pulls.merge(params), {
      pull_number: pullNumber,
      merge_method: data.mergeMethod || "merge",
      commit_title: data.commitTitle,
      commit_message: data.commitMessage,
    });

    return { merged: result.merged, message: result.message, sha: result.sha };
  }

  async listReviews(pullNumber: number): Promise<PullRequestReview[]> {
    const reviews = await this.rest(
      (params: ListReviewsParams) => this.octokit.rest.pulls.listReviews(params),
      { pull_number: pullNumber }
    );

    return reviews.map((review) => ({
      id: review.id,
      user: review.user?.login || "unknown",
      state: review.state,
      body: review.body || "",
    }));
  }

  async createReview(
    pullNumber: number,
    data: {
      body?: string;
      event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
      comments?: Array<{ path: string; position?: number; body: string }>;
    }
  ): Promise<PullRequestReview> {
    const review = await this.rest(
      (params: CreateReviewParams) => this.octokit.rest.pulls.createReview(params),
      {
        pull_number: pullNumber,
        body: data.body,
        event: data.event,
        comments: data.comments,
      }
    );

    return {
      id: review.id,
      user: review.user?.login || "unknown",
      state: review.state,
      body: review.body || "",
    };
  }
}
