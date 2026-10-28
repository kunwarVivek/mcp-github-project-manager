import type { ProjectWorkflow } from "../../domain/automation-types";

// GitHub GraphQL types for project automation workflows.
//
// The only workflow-related operations the API exposes are:
//   - query  ProjectV2.workflows / ProjectV2.workflow(number)
//   - query  node(id:) { ... on ProjectV2Workflow }
//   - mutate deleteProjectV2Workflow(input: DeleteProjectV2WorkflowInput)
//
// There is no create/update mutation and the `ProjectV2Workflow` type carries
// no trigger/action payload, so none is modelled here.

/** A project automation workflow as returned by the GraphQL API. */
export interface GitHubProjectWorkflowNode {
  id: string;
  name: string;
  number: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  project: { id: string } | null;
}

/** Response of the `ProjectV2.workflows` connection query. */
export interface ListProjectWorkflowsResponse {
  node: {
    workflows: {
      totalCount: number;
      nodes: GitHubProjectWorkflowNode[];
    } | null;
  } | null;
}

/** Response of the `node(id:)` workflow lookup. */
export interface GetProjectWorkflowResponse {
  node: GitHubProjectWorkflowNode | null;
}

/** Response of the `deleteProjectV2Workflow` mutation. */
export interface DeleteProjectWorkflowResponse {
  deleteProjectV2Workflow: {
    deletedWorkflowId: string | null;
    projectV2: { id: string } | null;
  } | null;
}

/**
 * Maps a GraphQL workflow node onto the domain workflow.
 *
 * `fallbackProjectId` is used when the node carries no project link, which
 * happens for the workflow connection query where the project is already known.
 */
export function mapWorkflowNodeToProjectWorkflow(
  node: GitHubProjectWorkflowNode,
  fallbackProjectId = ""
): ProjectWorkflow {
  return {
    id: node.id,
    name: node.name,
    number: node.number,
    enabled: node.enabled,
    projectId: node.project?.id ?? fallbackProjectId,
    createdAt: new Date(node.createdAt),
    updatedAt: new Date(node.updatedAt),
  };
}
