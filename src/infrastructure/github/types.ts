import { Octokit } from "@octokit/rest";

export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
  projectId?: string; // Adding the missing projectId property
}

export interface GitHubError extends Error {
  status?: number;
  response?: {
    status: number;
    data: any;
    headers?: Record<string, string>;
    url?: string; // Added the missing url property
  };
  headers?: Record<string, string>;
}

export interface GitHubErrorResponse {
  status: number;
  data: any;
  headers?: Record<string, string>;
  url?: string; // Adding the missing url property
}

export interface GitHubLabel {
  id: number;
  node_id: string;
  url: string;
  name: string;
  description?: string;
  color: string;
  default: boolean;
}

export interface GitHubUser {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  url: string;
  html_url: string;
  type: string;
  site_admin: boolean;
}

export interface GitHubIssue {
  id: number;
  node_id: string;
  number: number;
  title: string;
  user: GitHubUser;
  labels: GitHubLabel[];
  state: "open" | "closed";
  state_reason?: "completed" | "not_planned" | "reopened";
  locked: boolean;
  assignee: GitHubUser | null;
  assignees: GitHubUser[];
  milestone: GitHubMilestone | null;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  author_association: string;
  body: string;
  reactions: {
    url: string;
    total_count: number;
    [key: string]: any;
  };
  timeline_url: string;
  performed_via_github_app: any | null;
  draft?: boolean;
}

export interface RequestError extends GitHubError {
  name: "HttpError";
  status: number;
  headers: Record<string, string>;
}

export interface RateLimitError extends GitHubError {
  status: 403;
  headers: {
    "x-ratelimit-limit": string;
    "x-ratelimit-remaining": string;
    "x-ratelimit-reset": string;
  };
}

export interface RateLimit {
  limit: number;
  remaining: number;
  reset: number;
}

export type OctokitInstance = InstanceType<typeof Octokit>;

// GraphQL Types
export interface GraphQLError {
  type?: string;
  message: string;
  locations?: Array<{
    line: number;
    column: number;
  }>;
  path?: string[];
}

export interface GraphQLErrorResponse {
  errors: GraphQLError[];
}

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: GraphQLError[];
}

// GitHub API Types
export interface GitHubProjectV2 {
  id: string;
  number: number;
  title: string;
  shortDescription: string;
  closed: boolean;
  createdAt: string;
  updatedAt: string;
  resourcePath: string;
  url: string;
}

export interface GitHubProjectV2View {
  id: string;
  name: string;
  layout: string;
  fields: {
    nodes: Array<{
      id: string;
      name: string;
    }>;
  };
}

export interface GitHubProjectV2Field {
  id: string;
  name: string;
  dataType: string;
  options?: Array<{
    id: string;
    name: string;
  }>;
}

export interface GitHubMilestone {
  url: string;
  html_url: string;
  id: number;
  node_id: string;
  number: number;
  title: string;
  description: string | null;
  creator: GitHubUser | null;
  open_issues: number;
  closed_issues: number;
  state: "open" | "closed";
  created_at: string;
  updated_at: string;
  due_on: string | null;
  closed_at: string | null;
}

// Type Guards
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isGitHubError(error: unknown): error is GitHubError {
  return error instanceof Error && 
    ('status' in error || 'response' in error);
}

export function isRequestError(error: unknown): error is RequestError {
  return isGitHubError(error) && 
    'status' in error &&
    'headers' in error &&
    error.name === 'HttpError';
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return isGitHubError(error) &&
    error.status === 403 &&
    'headers' in error &&
    'x-ratelimit-remaining' in (error.headers || {});
}

export function isGraphQLErrorResponse(error: unknown): error is GraphQLErrorResponse {
  return isRecord(error) &&
    Array.isArray((error as any).errors) &&
    (error as any).errors.every((e: unknown) => 
      isRecord(e) && typeof (e as any).message === 'string'
    );
}