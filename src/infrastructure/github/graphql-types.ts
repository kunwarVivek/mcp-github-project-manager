import type { ViewLayout } from "../../domain/types";

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

export interface ProjectV2Node {
  id: string;
  number: number;
  title: string;
  description: string;
  url: string;
  closed: boolean;
  createdAt: string;
  updatedAt: string;
  views?: {
    nodes?: ProjectV2ViewNode[];
  };
  fields?: {
    nodes?: ProjectV2FieldNode[];
  };
}

/**
 * A project field as the view configuration reports it.
 *
 * `groupByFields`, `sortByFields.field` and `configuration.visibleFields`
 * all point at the `ProjectV2FieldConfiguration` union, so a selection of
 * them has to cover all four members (see `projectFieldUnionSelection`).
 */
export interface ProjectV2ViewFieldNode {
  id: string;
  name: string;
}

export interface ProjectV2ViewNode {
  id: string;
  name: string;
  layout: string;
  /** The view's server-side filter expression; `null` when it has none. */
  filter?: string | null;
  /** The fields the view groups by, in order. */
  groupByFields?: {
    nodes?: ProjectV2ViewFieldNode[];
  };
  /** The fields the view sorts by, with the direction of each. */
  sortByFields?: {
    nodes?: Array<{
      direction: string;
      field: ProjectV2ViewFieldNode;
    }>;
  };
  /** The view's own configuration - which fields it shows. */
  configuration?: {
    visibleFields?: {
      nodes?: ProjectV2ViewFieldNode[];
    };
  };
}

/**
 * A user or a team - the members of the `ProjectV2Actor` union the
 * collaborators payload returns.
 */
export interface ProjectV2ActorNode {
  id: string;
  /** Set for a user. */
  login?: string;
  /** Set for a team. */
  slug?: string;
  /** Set for a team. */
  name?: string;
  /** `User` or `Team`. */
  __typename?: string;
}

/**
 * The response of `updateProjectV2Collaborators`.
 *
 * The payload reports the project's collaborators - the actors that have
 * access - but NOT their roles: `ProjectV2` has no `collaborators` field
 * and `ProjectV2Actor` carries no role, so a role can never be read back
 * from GitHub.
 */
export interface UpdateProjectV2CollaboratorsResponse {
  updateProjectV2Collaborators: {
    collaborators?: {
      totalCount?: number;
      nodes?: ProjectV2ActorNode[];
    } | null;
  } | null;
}

export interface ProjectV2FieldNode {
  id: string;
  name: string;
  dataType: string;
  options?: Array<{ name: string }>;
}

export interface CreateProjectV2Response {
  createProjectV2: {
    projectV2: ProjectV2Node;
  };
}

export interface UpdateProjectV2Response {
  updateProjectV2: {
    projectV2: ProjectV2Node;
  };
}

export interface GetProjectV2Response {
  repository: {
    projectV2: ProjectV2Node;
  };
}

export interface ListProjectsV2Response {
  repository: {
    projectsV2: {
      nodes: ProjectV2Node[];
    };
  };
}

export interface CreateProjectV2ViewResponse {
  createProjectV2View: {
    projectV2View: ProjectV2ViewNode;
  };
}

export interface UpdateProjectV2ViewResponse {
  updateProjectV2View: {
    projectV2View: ProjectV2ViewNode;
  };
}

export interface CreateProjectV2FieldResponse {
  createProjectV2Field: {
    projectV2Field: ProjectV2FieldNode;
  };
}

export interface UpdateProjectV2FieldResponse {
  updateProjectV2Field: {
    projectV2Field: ProjectV2FieldNode;
  };
}

/**
 * The layouts GitHub's GraphQL API accepts.
 *
 * `ProjectV2ViewLayout` has exactly three members — there is no timeline
 * layout, so sending one is a schema error ("Expected type
 * ProjectV2ViewLayout, found TIMELINE_LAYOUT").
 */
export type GraphQLViewLayout = "BOARD_LAYOUT" | "TABLE_LAYOUT" | "ROADMAP_LAYOUT";

/**
 * The field data types GitHub's GraphQL API can create.
 *
 * `ProjectV2CustomFieldType` has exactly six members. The other project
 * fields (Assignees, Labels, Milestone, Repository, Tracked by, Tracks, …) are
 * built-in fields GitHub adds to every project; the API cannot create them.
 */
export type GraphQLFieldType =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "SINGLE_SELECT"
  | "MULTI_SELECT"
  | "ITERATION";

/**
 * Maps domain view layout to GitHub GraphQL layout
 *
 * A layout GitHub does not have is rejected here with a readable message
 * instead of failing later as a GraphQL schema error.
 */
export function mapToGraphQLViewLayout(layout: ViewLayout): GraphQLViewLayout {
  const mappings: Partial<Record<ViewLayout, GraphQLViewLayout>> = {
    board: "BOARD_LAYOUT",
    table: "TABLE_LAYOUT",
    roadmap: "ROADMAP_LAYOUT",
  };
  const mapped = mappings[layout];
  if (!mapped) {
    throw new Error(
      `GitHub Projects has no "${layout}" view layout — use board, table or roadmap.`
    );
  }
  return mapped;
}

/**
 * Maps a GitHub GraphQL layout back to the domain layout.
 */
export function fromGraphQLViewLayout(layout: string): ViewLayout {
  switch (layout) {
    case "TABLE_LAYOUT":
      return "table";
    case "ROADMAP_LAYOUT":
      return "roadmap";
    default:
      return "board";
  }
}

/**
 * The sort direction GitHub's `OrderDirection` enum reports.
 *
 * The enum has exactly two members - ASC and DESC.
 */
export type GraphQLOrderDirection = "ASC" | "DESC";

/**
 * Maps the sort direction of a view's sort-by field to the domain
 * direction. Anything GitHub reports that is not `DESC` sorts ascending.
 */
export function fromGraphQLOrderDirection(direction: string): GraphQLOrderDirection {
  return direction === "DESC" ? "DESC" : "ASC";
}
