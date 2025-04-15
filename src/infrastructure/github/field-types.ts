import { FieldType } from "../../domain/types";

// GitHub GraphQL field data types
export type GraphQLFieldType = 
  | 'TEXT' 
  | 'NUMBER' 
  | 'DATE' 
  | 'SINGLE_SELECT' 
  | 'ITERATION'
  | 'MILESTONE'
  | 'ASSIGNEES'
  | 'LABELS'
  | 'TRACKED_BY'
  | 'REPOSITORY';

export interface CreateProjectV2FieldResponse {
  createProjectV2Field: {
    projectV2Field: {
      id: string;
      name: string;
      dataType: string;
    }
  }
}

export interface UpdateProjectV2FieldResponse {
  updateProjectV2Field: {
    projectV2Field: {
      id: string;
      name: string;
      dataType: string;
    }
  }
}

/**
 * Maps domain field type to GitHub GraphQL field type
 */
export function mapToGraphQLFieldType(type: FieldType): GraphQLFieldType {
  const mappings: Record<FieldType, GraphQLFieldType> = {
    'text': 'TEXT',
    'number': 'NUMBER',
    'date': 'DATE',
    'single_select': 'SINGLE_SELECT',
    'iteration': 'ITERATION',
    'milestone': 'MILESTONE',
    'assignees': 'ASSIGNEES',
    'labels': 'LABELS',
    'tracked_by': 'TRACKED_BY',
    'repository': 'REPOSITORY',
    'tracks': 'TRACKED_BY' // Map 'tracks' to 'TRACKED_BY' as it's the closest equivalent
  };
  return mappings[type];
}

/**
 * Maps GitHub GraphQL field type to domain field type
 */
export function mapFromGraphQLFieldType(type: GraphQLFieldType): FieldType {
  const mappings: Record<GraphQLFieldType, FieldType> = {
    'TEXT': 'text',
    'NUMBER': 'number',
    'DATE': 'date',
    'SINGLE_SELECT': 'single_select',
    'ITERATION': 'iteration',
    'MILESTONE': 'milestone',
    'ASSIGNEES': 'assignees',
    'LABELS': 'labels',
    'TRACKED_BY': 'tracked_by',
    'REPOSITORY': 'repository'
  };
  return mappings[type];
}