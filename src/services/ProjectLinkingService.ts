import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { ProjectItem } from "../domain/types";
import { MCPErrorCode } from "../domain/mcp-types";
import {
  DomainError,
  ResourceNotFoundError,
  ValidationError,
  RateLimitError,
  UnauthorizedError,
  GitHubAPIError
} from "../domain/errors";
import { ResourceType } from "../domain/resource-types";

/**
 * ProjectLinkingService handles project item operations:
 * - Add issues/PRs to projects
 * - Remove items from projects
 * - Archive/unarchive items
 * - List project items
 *
 * Extracted from ProjectManagementService for better separation of concerns.
 */
export class ProjectLinkingService {
  private readonly factory: GitHubRepositoryFactory;

  constructor(factory: GitHubRepositoryFactory) {
    this.factory = factory;
  }

  // Helper method to map domain errors to MCP error codes
  private mapErrorToMCPError(error: unknown): Error {
    if (error instanceof ValidationError) {
      return new DomainError(`${MCPErrorCode.VALIDATION_ERROR}: ${error.message}`);
    }

    if (error instanceof ResourceNotFoundError) {
      return new DomainError(`${MCPErrorCode.RESOURCE_NOT_FOUND}: ${error.message}`);
    }

    if (error instanceof RateLimitError) {
      return new DomainError(`${MCPErrorCode.RATE_LIMITED}: ${error.message}`);
    }

    if (error instanceof UnauthorizedError) {
      return new DomainError(`${MCPErrorCode.UNAUTHORIZED}: ${error.message}`);
    }

    if (error instanceof GitHubAPIError) {
      return new DomainError(`${MCPErrorCode.INTERNAL_ERROR}: GitHub API Error - ${error.message}`);
    }

    // Default to internal error
    return new DomainError(`${MCPErrorCode.INTERNAL_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Project Item Operations
  async addProjectItem(data: {
    projectId: string;
    contentId: string;
    contentType: 'issue' | 'pull_request';
  }): Promise<ProjectItem> {
    try {
      // GraphQL mutation to add an item to a project
      const mutation = `
        mutation($input: AddProjectV2ItemByIdInput!) {
          addProjectV2ItemById(input: $input) {
            item {
              id
              content {
                ... on Issue {
                  id
                  title
                }
                ... on PullRequest {
                  id
                  title
                }
              }
            }
          }
        }
      `;

      interface AddProjectItemResponse {
        addProjectV2ItemById: {
          item: {
            id: string;
            content: {
              id: string;
              title: string;
            };
          };
        };
      }

      const response = await this.factory.graphql<AddProjectItemResponse>(mutation, {
        input: {
          projectId: data.projectId,
          contentId: data.contentId
        }
      });

      const itemId = response.addProjectV2ItemById.item.id;
      const contentId = response.addProjectV2ItemById.item.content.id;

      const resourceType = data.contentType === 'issue' ? ResourceType.ISSUE : ResourceType.PULL_REQUEST;

      return {
        id: itemId,
        contentId,
        contentType: resourceType,
        projectId: data.projectId,
        fieldValues: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async removeProjectItem(data: {
    projectId: string;
    itemId: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const mutation = `
        mutation($input: DeleteProjectV2ItemInput!) {
          deleteProjectV2Item(input: $input) {
            deletedItemId
          }
        }
      `;

      interface DeleteProjectItemResponse {
        deleteProjectV2Item: {
          deletedItemId: string;
        };
      }

      await this.factory.graphql<DeleteProjectItemResponse>(mutation, {
        input: {
          projectId: data.projectId,
          itemId: data.itemId
        }
      });

      return {
        success: true,
        message: `Item ${data.itemId} has been removed from project ${data.projectId}`
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async archiveProjectItem(data: {
    projectId: string;
    itemId: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const mutation = `
        mutation($input: ArchiveProjectV2ItemInput!) {
          archiveProjectV2Item(input: $input) {
            item {
              id
              isArchived
            }
          }
        }
      `;

      interface ArchiveProjectItemResponse {
        archiveProjectV2Item: {
          item: {
            id: string;
            isArchived: boolean;
          };
        };
      }

      await this.factory.graphql<ArchiveProjectItemResponse>(mutation, {
        input: {
          projectId: data.projectId,
          itemId: data.itemId
        }
      });

      return {
        success: true,
        message: `Item ${data.itemId} has been archived in project ${data.projectId}`
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async unarchiveProjectItem(data: {
    projectId: string;
    itemId: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const mutation = `
        mutation($input: UnarchiveProjectV2ItemInput!) {
          unarchiveProjectV2Item(input: $input) {
            item {
              id
              isArchived
            }
          }
        }
      `;

      interface UnarchiveProjectItemResponse {
        unarchiveProjectV2Item: {
          item: {
            id: string;
            isArchived: boolean;
          };
        };
      }

      await this.factory.graphql<UnarchiveProjectItemResponse>(mutation, {
        input: {
          projectId: data.projectId,
          itemId: data.itemId
        }
      });

      return {
        success: true,
        message: `Item ${data.itemId} has been unarchived in project ${data.projectId}`
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async listProjectItems(data: {
    projectId: string;
    limit?: number;
  }): Promise<ProjectItem[]> {
    try {
      const limit = data.limit || 50;
      const query = `
        query($projectId: ID!, $limit: Int!) {
          node(id: $projectId) {
            ... on ProjectV2 {
              items(first: $limit) {
                nodes {
                  id
                  content {
                    ... on Issue {
                      id
                      title
                      __typename
                    }
                    ... on PullRequest {
                      id
                      title
                      __typename
                    }
                  }
                  fieldValues(first: 20) {
                    nodes {
                      ... on ProjectV2ItemFieldTextValue {
                        text
                        field {
                          ... on ProjectV2Field {
                            id
                            name
                          }
                        }
                      }
                      ... on ProjectV2ItemFieldDateValue {
                        date
                        field {
                          ... on ProjectV2Field {
                            id
                            name
                          }
                        }
                      }
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        name
                        field {
                          ... on ProjectV2SingleSelectField {
                            id
                            name
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      interface ListProjectItemsResponse {
        node: {
          items: {
            nodes: Array<{
              id: string;
              content?: {
                id: string;
                title: string;
                __typename: string;
              };
              fieldValues: {
                nodes: Array<{
                  text?: string;
                  date?: string;
                  name?: string;
                  field: {
                    id: string;
                    name: string;
                  }
                }>
              }
            }>
          }
        }
      }

      const response = await this.factory.graphql<ListProjectItemsResponse>(query, {
        projectId: data.projectId,
        limit
      });

      // If project doesn't exist or has no items
      if (!response.node || !response.node.items || !response.node.items.nodes) {
        return [];
      }

      return response.node.items.nodes.map((item) => {
        // Build field values map
        const fieldValues: Record<string, any> = {};
        if (item.fieldValues && item.fieldValues.nodes) {
          item.fieldValues.nodes.forEach((fieldValue: any) => {
            if (!fieldValue || !fieldValue.field) return;

            const fieldId = fieldValue.field.id;
            const fieldName = fieldValue.field.name;

            if ('text' in fieldValue) {
              fieldValues[fieldId] = fieldValue.text;
            } else if ('date' in fieldValue) {
              fieldValues[fieldId] = fieldValue.date;
            } else if ('name' in fieldValue) {
              fieldValues[fieldId] = fieldValue.name;
            }
          });
        }

        // Determine content type
        let contentType = ResourceType.ISSUE; // Default
        if (item.content && item.content.__typename) {
          contentType = item.content.__typename === 'Issue'
            ? ResourceType.ISSUE
            : ResourceType.PULL_REQUEST;
        }

        return {
          id: item.id,
          contentId: item.content?.id || '',
          contentType,
          projectId: data.projectId,
          fieldValues,
          createdAt: new Date().toISOString(), // GitHub API doesn't provide creation date for items
          updatedAt: new Date().toISOString()
        };
      });
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }
}
