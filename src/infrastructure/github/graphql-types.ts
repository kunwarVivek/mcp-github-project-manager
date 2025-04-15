import { ViewLayout, FieldType } from "../../domain/types";

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

export interface ProjectV2ViewNode {
  id: string;
  name: string;
  layout: string;
  groupByField?: {
    field: { name: string };
  };
  sortByFields?: Array<{
    field: { name: string };
    direction: string;
  }>;
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

export type GraphQLViewLayout = 'BOARD_LAYOUT' | 'TABLE_LAYOUT' | 'TIMELINE_LAYOUT' | 'ROADMAP_LAYOUT';
export type GraphQLFieldType = 
  | 'TEXT' 
  | 'NUMBER' 
  | 'DATE' 
  | 'SINGLE_SELECT' 
  | 'ITERATION' 
  | 'MILESTONE' 
  | 'ASSIGNEES' 
  | 'LABELS'
  | 'REPOSITORY'
  | 'TRACKED_BY'  // Fixed name to match mapToGraphQLFieldType
  | 'TRACKS';     // Fixed name to match mapToGraphQLFieldType

/**
 * Maps domain view layout to GitHub GraphQL layout
 */
export function mapToGraphQLViewLayout(layout: ViewLayout): GraphQLViewLayout {
  const mappings: Record<ViewLayout, GraphQLViewLayout> = {
    'board': 'BOARD_LAYOUT',
    'table': 'TABLE_LAYOUT',
    'timeline': 'TIMELINE_LAYOUT',
    'roadmap': 'ROADMAP_LAYOUT'
  };
  return mappings[layout];
}

/**
 * Maps domain field type to GitHub GraphQL field type
 */
export function mapToGraphQLFieldType(type: FieldType): GraphQLFieldType {
  const mappings: Partial<Record<string, GraphQLFieldType>> = {
    'text': 'TEXT',
    'number': 'NUMBER',
    'date': 'DATE',
    'single_select': 'SINGLE_SELECT',
    'iteration': 'ITERATION',
    'milestone': 'MILESTONE',
    'assignees': 'ASSIGNEES',
    'labels': 'LABELS',
    'repository': 'REPOSITORY',
    'tracked_by': 'TRACKED_BY',
    'tracks': 'TRACKS'
  };
  return mappings[type] || 'TEXT';
}

/**
 * Maps GitHub GraphQL field type to domain field type
 */
export function mapFromGraphQLFieldType(type: GraphQLFieldType): FieldType {
  const mappings: Partial<Record<GraphQLFieldType, FieldType>> = {
    'TEXT': 'text',
    'NUMBER': 'number',
    'DATE': 'date',
    'SINGLE_SELECT': 'single_select',
    'ITERATION': 'iteration',
    'MILESTONE': 'milestone',
    'ASSIGNEES': 'assignees',
    'LABELS': 'labels',
    'REPOSITORY': 'repository',
    'TRACKED_BY': 'tracked_by'
    // Remove the 'TRACKS' mapping as it doesn't have a corresponding FieldType
  };
  return mappings[type] || 'text';
}
