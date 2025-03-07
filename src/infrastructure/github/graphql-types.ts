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

type GraphQLViewLayout = 'BOARD_LAYOUT' | 'TABLE_LAYOUT' | 'TIMELINE_LAYOUT' | 'ROADMAP_LAYOUT';
type GraphQLFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'SINGLE_SELECT' | 'MULTI_SELECT' | 'ITERATION';

const VIEW_LAYOUT_MAP: Record<ViewLayout, GraphQLViewLayout> = {
  board: 'BOARD_LAYOUT',
  table: 'TABLE_LAYOUT',
  timeline: 'TIMELINE_LAYOUT',
  roadmap: 'ROADMAP_LAYOUT'
};

const FIELD_TYPE_MAP: Record<FieldType, GraphQLFieldType> = {
  text: 'TEXT',
  number: 'NUMBER',
  date: 'DATE',
  single_select: 'SINGLE_SELECT',
  multi_select: 'MULTI_SELECT',
  iteration: 'ITERATION'
};

export const viewLayoutToGraphQL = (layout: ViewLayout): GraphQLViewLayout => {
  return VIEW_LAYOUT_MAP[layout];
};

export const graphqlToViewLayout = (layout: string): ViewLayout => {
  const reverseMap = Object.entries(VIEW_LAYOUT_MAP).find(([_, value]) => value === layout);
  return (reverseMap?.[0] as ViewLayout) || 'table';
};

export const fieldTypeToGraphQL = (type: FieldType): GraphQLFieldType => {
  return FIELD_TYPE_MAP[type];
};

export const graphqlToFieldType = (type: string): FieldType => {
  const reverseMap = Object.entries(FIELD_TYPE_MAP).find(([_, value]) => value === type);
  return (reverseMap?.[0] as FieldType) || 'text';
};
