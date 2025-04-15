import { FieldType } from '../../../domain/types';
import { GraphQLFieldType } from '../graphql-types';

/**
 * Maps a domain field type to a GraphQL field type
 */
export function mapToGraphQLFieldType(fieldType: FieldType): string {
  switch (fieldType) {
    case 'text':
      return 'TEXT';
    case 'number':
      return 'NUMBER';
    case 'date':
      return 'DATE';
    case 'single_select':
      return 'SINGLE_SELECT';
    case 'iteration':
      return 'ITERATION';
    case 'milestone':
      return 'MILESTONE';
    case 'assignees':
      return 'ASSIGNEES';
    case 'labels':
      return 'LABELS';
    case 'tracked_by':
      return 'TRACKED_BY';
    case 'repository':
      return 'REPOSITORY';
    default:
      return 'TEXT';
  }
}

/**
 * Maps a GraphQL field type to a domain field type
 */
export function mapFromGraphQLFieldType(fieldType: GraphQLFieldType): FieldType {
  switch (fieldType) {
    case 'TEXT':
      return 'text';
    case 'NUMBER':
      return 'number';
    case 'DATE':
      return 'date';
    case 'SINGLE_SELECT':
      return 'single_select';
    case 'ITERATION':
      return 'iteration';
    case 'MILESTONE':
      return 'milestone';
    case 'ASSIGNEES':
      return 'assignees';
    case 'LABELS':
      return 'labels';
    case 'TRACKED_BY':
      return 'tracked_by';
    case 'REPOSITORY':
      return 'repository';
    default:
      return 'text';
  }
}

// GraphQL response helper types for GitHub API

/**
 * Base response type for all GraphQL responses
 */
export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{
      line: number;
      column: number;
    }>;
    path?: string[];
    extensions?: any;
  }>;
}

/**
 * Response type for creating a ProjectV2Field
 */
export interface CreateProjectV2FieldResponse {
  createProjectV2Field: {
    projectV2Field: {
      id: string;
      name: string;
    };
  };
}

/**
 * Response type for getting a project
 */
export interface GetProjectResponse {
  repository: {
    projectV2: {
      id: string;
      title: string;
      number: number;
      closed: boolean;
      url: string;
      shortDescription: string;
      public: boolean;
      owner: {
        login: string;
      };
      creator: {
        login: string;
      };
      createdAt: string;
      updatedAt: string;
    };
  };
}

/**
 * Response type for listing projects
 */
export interface ListProjectsResponse {
  repository: {
    projectsV2: {
      nodes: Array<{
        id: string;
        title: string;
        number: number;
        closed: boolean;
        url: string;
        shortDescription: string;
        public: boolean;
        owner: {
          login: string;
        };
        creator: {
          login: string;
        };
        createdAt: string;
        updatedAt: string;
      }>;
    };
  };
}

/**
 * Response type for getting a project item
 */
export interface GetProjectItemResponse {
  node: {
    id: string;
    type: string;
    fieldValues: {
      nodes: Array<{
        field: {
          id: string;
          name: string;
        };
        value?: any;
      }>;
    };
    content: {
      __typename: string;
      title?: string;
      number?: number;
      body?: string;
      state?: string;
      url?: string;
      createdAt?: string;
      updatedAt?: string;
      author?: {
        login: string;
      };
      repository?: {
        name: string;
        owner: {
          login: string;
        };
      };
    };
  };
}

/**
 * Response type for listing project items
 */
export interface ListProjectItemsResponse {
  repository: {
    projectV2: {
      items: {
        nodes: Array<{
          id: string;
          type: string;
          fieldValues: {
            nodes: Array<{
              field: {
                id: string;
                name: string;
              };
              value?: any;
            }>;
          };
          content: {
            __typename: string;
            title?: string;
            number?: number;
            body?: string;
            state?: string;
            url?: string;
            createdAt?: string;
            updatedAt?: string;
            author?: {
              login: string;
            };
            repository?: {
              name: string;
              owner: {
                login: string;
              };
            };
          };
        }>;
      };
    };
  };
}

/**
 * Response type for updating a ProjectV2Field
 */
export interface UpdateProjectV2FieldResponse {
  updateProjectV2Field: {
    projectV2Field: {
      id: string;
      name: string;
      dataType?: string;
    };
  };
}