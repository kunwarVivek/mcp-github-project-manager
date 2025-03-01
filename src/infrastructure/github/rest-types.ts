import { Octokit } from "@octokit/rest";
import { components } from "@octokit/openapi-types";

type OctokitIssue = components["schemas"]["issue"];

export interface RequestParameters {
  [key: string]: any;
}

export interface RestUser {
  login: string;
  id: number;
  avatar_url?: string;
  gravatar_id?: string | null;
  url?: string;
}

export interface RestLabel {
  id?: number;
  name: string;
  color?: string | null;
  description?: string | null;
  default?: boolean;
  url?: string;
}

export interface RestMilestone {
  number: number;
  title: string;
  description: string | null;
  due_on: string | null;
  state: "open" | "closed";
  open_issues: number;
  closed_issues: number;
  created_at?: string;
  updated_at?: string;
  closed_at?: string | null;
  url?: string;
}

// Define the core fields we need for our application
export interface RestIssue {
  id: number;
  node_id: string;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: Array<string | RestLabel>;
  assignees: RestUser[];
  milestone?: RestMilestone | null;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  url: string;
  repository_url: string;
  labels_url: string;
  comments_url: string;
  events_url: string;
  html_url: string;
  user: RestUser;
}

export interface CreateIssueParams extends RequestParameters {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  milestone?: number;
  assignees?: string[];
  labels?: string[];
  state?: "open" | "closed";
}

export interface UpdateIssueParams extends RequestParameters {
  owner: string;
  repo: string;
  issue_number: number;
  title?: string;
  body?: string;
  state?: "open" | "closed";
  milestone?: number | null;
  assignees?: string[];
  labels?: string[];
}

export interface ListIssuesParams extends RequestParameters {
  owner: string;
  repo: string;
  state?: "open" | "closed" | "all";
  milestone?: string;
  assignee?: string;
  per_page?: number;
}

export interface CreateMilestoneParams extends RequestParameters {
  owner: string;
  repo: string;
  title: string;
  state?: "open" | "closed";
  description?: string;
  due_on?: string;
}

export interface UpdateMilestoneParams extends RequestParameters {
  owner: string;
  repo: string;
  milestone_number: number;
  title?: string;
  state?: "open" | "closed";
  description?: string;
  due_on?: string;
}

export interface ListMilestonesParams extends RequestParameters {
  owner: string;
  repo: string;
  state?: "open" | "closed" | "all";
  sort?: "due_on" | "completeness";
  direction?: "asc" | "desc";
  per_page?: number;
}

export interface CustomFieldValue {
  text?: string;
  number?: number;
  date?: string;
  singleSelect?: string;
  iteration?: {
    startDate: string;
    duration: number;
  };
}

// GraphQL Types
export interface GraphQLItemResponse {
  repository?: {
    issue?: {
      projectV2Items?: {
        nodes?: Array<{
          id: string;
        }>;
      };
    };
  };
}

export interface GraphQLResponse<T> {
  data: T;
  errors?: Array<{
    message: string;
    locations?: Array<{
      line: number;
      column: number;
    }>;
    path?: string[];
  }>;
}
// GitHub API Event types
export interface IssueEvent {
  id: number;
  node_id: string;
  url: string;
  actor: {
    login: string;
    id: number;
  };
  event: string;
  commit_id?: string | null;
  commit_url?: string | null;
  created_at: string;
  performed_via_github_app?: boolean;
  label?: {
    name: string;
    color?: string | null;
  };
  assignee?: RestUser;
  milestone?: RestMilestone;
}

// Helper function to ensure type safety when mapping API responses
export function mapOctokitResponseToRestIssue(response: OctokitIssue): RestIssue {
  const user = response.user || {
    login: "unknown",
    id: 0,
    type: "User",
  };

  return {
    id: response.id,
    node_id: response.node_id,
    number: response.number,
    title: response.title || "",
    body: response.body ?? null,
    state: response.state === "closed" ? "closed" : "open",
    labels: Array.isArray(response.labels)
      ? response.labels.map(label =>
          typeof label === "string"
            ? label
            : {
                id: label.id,
                name: label.name || "",
                color: label.color ?? null,
                description: label.description ?? null,
                default: label.default,
                url: label.url,
              }
        )
      : [],
    assignees: (response.assignees || []).map(assignee => ({
      login: assignee.login,
      id: assignee.id,
      avatar_url: assignee.avatar_url,
      gravatar_id: assignee.gravatar_id ?? null,
      url: assignee.url,
    })),
    milestone: response.milestone
      ? {
          number: response.milestone.number,
          title: response.milestone.title || "",
          description: response.milestone.description ?? null,
          due_on: response.milestone.due_on ?? null,
          state: response.milestone.state === "closed" ? "closed" : "open",
          open_issues: response.milestone.open_issues || 0,
          closed_issues: response.milestone.closed_issues || 0,
          created_at: response.milestone.created_at,
          updated_at: response.milestone.updated_at,
          closed_at: response.milestone.closed_at ?? null,
          url: response.milestone.url,
        }
      : null,
    created_at: response.created_at,
    updated_at: response.updated_at,
    closed_at: response.closed_at ?? null,
    url: response.url,
    repository_url: response.repository_url,
    labels_url: response.labels_url,
    comments_url: response.comments_url,
    events_url: response.events_url,
    html_url: response.html_url,
    user: {
      login: user.login,
      id: user.id,
      avatar_url: (user as any).avatar_url,
      gravatar_id: (user as any).gravatar_id ?? null,
      url: (user as any).url,
    },
  };
}
