import { FieldType, ViewLayout } from "../../domain/types";

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

export interface ProjectV2ViewNode {
  id: string;
  name: string;
  layout: string;
  groupByField?: {
    field: {
      name: string;
    };
  };
  sortByFields?: Array<{
    field: {
      name: string;
    };
    direction: string;
  }>;
}

export interface ProjectV2FieldNode {
  id: string;
  name: string;
  dataType: string;
  options?: Array<{
    name: string;
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

export interface IterationFieldConfiguration {
  iterations: {
    nodes: Array<{
      id: string;
      title: string;
      startDate: string;
      duration: number;
      items?: {
        nodes?: Array<{
          content: {
            number: number;
          };
        }>;
      };
    }>;
  };
}

export interface CreateProjectV2Response {
  createProjectV2?: {
    projectV2: ProjectV2Node;
  };
}

export interface UpdateProjectV2Response {
  updateProjectV2?: {
    projectV2: ProjectV2Node;
  };
}

export interface GetProjectV2Response {
  repository?: {
    projectV2: ProjectV2Node;
  };
}

export interface ListProjectsV2Response {
  repository?: {
    projectsV2: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string;
      };
      nodes: ProjectV2Node[];
    };
  };
}

export interface CreateProjectV2ViewResponse {
  createProjectV2View?: {
    projectV2View: ProjectV2ViewNode;
  };
}

export interface UpdateProjectV2ViewResponse {
  updateProjectV2View?: {
    projectV2View: ProjectV2ViewNode;
  };
}

export interface CreateProjectV2FieldResponse {
  createProjectV2Field?: {
    projectV2Field: ProjectV2FieldNode;
  };
}

export interface UpdateProjectV2FieldResponse {
  updateProjectV2Field?: {
    projectV2Field: ProjectV2FieldNode;
  };
}

export interface CreateProjectV2IterationFieldResponse {
  createProjectV2IterationField?: {
    iteration: {
      id: string;
      title: string;
      startDate: string;
      duration: number;
    };
  };
}

export interface UpdateProjectV2IterationFieldResponse {
  updateProjectV2IterationField?: {
    iteration: {
      id: string;
      title: string;
      startDate: string;
      duration: number;
    };
  };
}

export interface GetIterationFieldResponse {
  iteration?: {
    id: string;
    title: string;
    startDate: string;
    duration: number;
    items?: {
      nodes?: Array<{
        content: {
          number: number;
        };
      }>;
    };
  };
}

export interface ListIterationFieldsResponse {
  iterations?: {
    nodes: Array<{
      id: string;
      title: string;
      startDate: string;
      duration: number;
      items?: {
        nodes?: Array<{
          content: {
            number: number;
          };
        }>;
      };
    }>;
  };
}

// Type mapping helpers
export const graphqlToViewLayout = (layout: string): ViewLayout => {
  const mapping: Record<string, ViewLayout> = {
    TABLE: "table",
    BOARD: "board",
    ROADMAP: "roadmap",
  };
  return mapping[layout.toUpperCase()] || "table";
};

export const viewLayoutToGraphQL = (layout: ViewLayout): string => {
  const mapping: Record<ViewLayout, string> = {
    table: "TABLE",
    board: "BOARD",
    roadmap: "ROADMAP",
  };
  return mapping[layout];
};

export const graphqlToFieldType = (type: string): FieldType => {
  const mapping: Record<string, FieldType> = {
    TEXT: "text",
    NUMBER: "number",
    DATE: "date",
    SINGLE_SELECT: "single_select",
    ITERATION: "iteration",
  };
  return mapping[type.toUpperCase()] as FieldType;
};

export const fieldTypeToGraphQL = (type: FieldType): string => {
  const mapping: Record<FieldType, string> = {
    text: "TEXT",
    number: "NUMBER",
    date: "DATE",
    single_select: "SINGLE_SELECT",
    iteration: "ITERATION",
  };
  return mapping[type];
};
