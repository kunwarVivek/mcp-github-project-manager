import type { components } from "@octokit/openapi-types";
import type { Octokit } from "@octokit/rest";

// Base types from Octokit's OpenAPI definitions
export type RestIssue = components["schemas"]["issue"];
export type RestMilestone = components["schemas"]["milestone"];
export type RestComment = components["schemas"]["issue-comment"];
export type RestUser = components["schemas"]["simple-user"];

// Define a more flexible label type that matches GitHub's API
export type RestLabel = {
  id?: number;
  node_id?: string;
  url?: string;
  name: string;
  description?: string | null;
  color?: string | null;
  default?: boolean;
};

// Extract method types from Octokit instance type
type OctokitInstance = InstanceType<typeof Octokit>;

// Parameter types extracted from Octokit's method signatures
export type CreateIssueParams = Parameters<
  OctokitInstance["issues"]["create"]
>[0];
export type UpdateIssueParams = Parameters<
  OctokitInstance["issues"]["update"]
>[0];
export type ListIssuesParams = Parameters<
  OctokitInstance["issues"]["listForRepo"]
>[0];
export type CreateMilestoneParams = Parameters<
  OctokitInstance["issues"]["createMilestone"]
>[0];
export type UpdateMilestoneParams = Parameters<
  OctokitInstance["issues"]["updateMilestone"]
>[0];
export type ListMilestonesParams = Parameters<
  OctokitInstance["issues"]["listMilestones"]
>[0];
export type CreateCommentParams = Parameters<
  OctokitInstance["issues"]["createComment"]
>[0];
export type UpdateCommentParams = Parameters<
  OctokitInstance["issues"]["updateComment"]
>[0];
export type ListCommentsParams = Parameters<
  OctokitInstance["issues"]["listComments"]
>[0];
export type AddAssigneesParams = Parameters<
  OctokitInstance["issues"]["addAssignees"]
>[0];
export type RemoveAssigneesParams = Parameters<
  OctokitInstance["issues"]["removeAssignees"]
>[0];
export type AddLabelsParams = Parameters<
  OctokitInstance["issues"]["addLabels"]
>[0];
export type RemoveLabelParams = Parameters<
  OctokitInstance["issues"]["removeLabel"]
>[0];

// Response types with proper data shapes
export interface IssueResponse {
  data: RestIssue;
}

export interface MilestoneResponse {
  data: RestMilestone;
}

export interface CommentResponse {
  data: RestComment;
}

export interface ListIssuesResponse {
  data: RestIssue[];
}

export interface ListMilestonesResponse {
  data: RestMilestone[];
}

export interface ListCommentsResponse {
  data: RestComment[];
}

// Error types
export interface RestErrorResponse {
  status: number;
  message: string;
  documentation_url?: string;
  errors?: Array<{
    resource: string;
    field: string;
    code: string;
    message?: string;
  }>;
}

// Type guards
export function isRestErrorResponse(
  error: unknown
): error is RestErrorResponse {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as RestErrorResponse).message === "string" &&
    "status" in error &&
    typeof (error as RestErrorResponse).status === "number"
  );
}

// Helper types for strongly typed request bodies
export interface IssueBody {
  title: string;
  body?: string;
  assignees?: string[];
  milestone?: number | null;
  labels?: string[];
  state?: "open" | "closed";
  state_reason?: "completed" | "not_planned" | "reopened";
}

export interface MilestoneBody {
  title: string;
  description?: string;
  due_on?: string;
  state?: "open" | "closed";
}

export interface CommentBody {
  body: string;
}

// Helper functions for type checking
export function isIssue(data: unknown): data is RestIssue {
  return (
    typeof data === "object" &&
    data !== null &&
    "number" in data &&
    "title" in data &&
    "state" in data
  );
}

export function isMilestone(data: unknown): data is RestMilestone {
  return (
    typeof data === "object" &&
    data !== null &&
    "number" in data &&
    "title" in data &&
    "state" in data &&
    "open_issues" in data &&
    "closed_issues" in data
  );
}

export function isComment(data: unknown): data is RestComment {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "body" in data &&
    "user" in data
  );
}

// Type assertions for label handling
export function isLabelObject(label: string | RestLabel): label is RestLabel {
  return (
    typeof label !== "string" &&
    typeof label === "object" &&
    label !== null &&
    typeof (label as RestLabel).name === "string"
  );
}

export function getLabelName(label: string | RestLabel): string {
  if (typeof label === "string") return label;
  return label.name || "";
}

// Helper type for label arrays
export type Label = string | RestLabel;
export type Labels = Array<Label>;
