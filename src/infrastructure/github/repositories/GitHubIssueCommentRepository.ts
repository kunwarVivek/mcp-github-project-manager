import type { RestEndpointMethodTypes } from "@octokit/rest";
import { BaseGitHubRepository } from "./BaseRepository";

type CreateCommentParams = RestEndpointMethodTypes["issues"]["createComment"]["parameters"];
type UpdateCommentParams = RestEndpointMethodTypes["issues"]["updateComment"]["parameters"];
type DeleteCommentParams = RestEndpointMethodTypes["issues"]["deleteComment"]["parameters"];
type ListCommentsParams = RestEndpointMethodTypes["issues"]["listComments"]["parameters"];

/** A GitHub issue comment as returned by the REST API. */
export interface IssueComment {
  id: number;
  body: string;
  user: string;
  createdAt: string;
  updatedAt: string;
}

interface CommentPayload {
  id: number;
  body?: string | null;
  user?: { login: string } | null;
  created_at: string;
  updated_at: string;
}

function toComment(comment: CommentPayload): IssueComment {
  return {
    id: comment.id,
    body: comment.body || "",
    user: comment.user?.login || "unknown",
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
  };
}

/** REST access to issue comments of the configured repository. */
export class GitHubIssueCommentRepository extends BaseGitHubRepository {
  async create(issueNumber: number, body: string): Promise<IssueComment> {
    const comment = await this.rest(
      (params: CreateCommentParams) => this.octokit.rest.issues.createComment(params),
      { issue_number: issueNumber, body }
    );
    return toComment(comment);
  }

  async update(commentId: number, body: string): Promise<IssueComment> {
    const comment = await this.rest(
      (params: UpdateCommentParams) => this.octokit.rest.issues.updateComment(params),
      { comment_id: commentId, body }
    );
    return toComment(comment);
  }

  async delete(commentId: number): Promise<void> {
    await this.rest(
      (params: DeleteCommentParams) => this.octokit.rest.issues.deleteComment(params),
      {
        comment_id: commentId,
      }
    );
  }

  async list(issueNumber: number, limit = 30): Promise<IssueComment[]> {
    const comments = await this.rest(
      (params: ListCommentsParams) => this.octokit.rest.issues.listComments(params),
      { issue_number: issueNumber, per_page: limit }
    );
    return comments.map(toComment);
  }
}
