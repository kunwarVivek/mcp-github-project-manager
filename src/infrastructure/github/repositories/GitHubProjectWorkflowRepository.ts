import type { ProjectWorkflow, ProjectWorkflowRepository } from "../../../domain/automation-types";
import {
  type DeleteProjectWorkflowResponse,
  type GetProjectWorkflowResponse,
  type ListProjectWorkflowsResponse,
  mapWorkflowNodeToProjectWorkflow,
} from "../automation-types";
import { BaseGitHubRepository } from "./BaseRepository";

/**
 * Repository for GitHub project automation workflows (`ProjectV2Workflow`).
 *
 * The API exposes workflows read-only apart from deletion: they are authored
 * in the GitHub UI, so this repository can list them, read one by node ID and
 * delete one - and nothing else.
 */
export class GitHubProjectWorkflowRepository
  extends BaseGitHubRepository
  implements ProjectWorkflowRepository
{
  async findById(id: string): Promise<ProjectWorkflow | null> {
    const query = `
      query($id: ID!) {
        node(id: $id) {
          ... on ProjectV2Workflow {
            id
            name
            number
            enabled
            createdAt
            updatedAt
            project {
              id
            }
          }
        }
      }
    `;

    try {
      const response = await this.graphql<GetProjectWorkflowResponse>(query, { id });
      if (!response.node) return null;

      return mapWorkflowNodeToProjectWorkflow(response.node);
    } catch (error) {
      this.logger.error(`Failed to fetch project workflow ${id}`, error);
      throw this.handleGraphQLError(error);
    }
  }

  async findByProject(projectId: string): Promise<ProjectWorkflow[]> {
    const query = `
      query($projectId: ID!, $first: Int!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            id
            workflows(first: $first) {
              totalCount
              nodes {
                id
                name
                number
                enabled
                createdAt
                updatedAt
                project {
                  id
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response = await this.graphql<ListProjectWorkflowsResponse>(query, {
        projectId,
        first: 100,
      });
      const nodes = response.node?.workflows?.nodes ?? [];

      return nodes.map((node) => mapWorkflowNodeToProjectWorkflow(node, projectId));
    } catch (error) {
      this.logger.error(`Failed to fetch project workflows for project ${projectId}`, error);
      throw this.handleGraphQLError(error);
    }
  }

  async delete(id: string): Promise<void> {
    const mutation = `
      mutation($input: DeleteProjectV2WorkflowInput!) {
        deleteProjectV2Workflow(input: $input) {
          deletedWorkflowId
          projectV2 {
            id
          }
        }
      }
    `;

    try {
      const response = await this.graphql<DeleteProjectWorkflowResponse>(mutation, {
        input: { workflowId: id },
      });

      if (!response.deleteProjectV2Workflow?.deletedWorkflowId) {
        throw new Error(`Project workflow ${id} was not deleted`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete project workflow ${id}`, error);
      throw this.handleGraphQLError(error);
    }
  }
}
