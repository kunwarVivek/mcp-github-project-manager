/**
 * Project automation workflows.
 *
 * GitHub exposes project automations through the `ProjectV2Workflow` GraphQL
 * type: a project holds workflows, and a workflow carries a name, a number, an
 * enabled flag and timestamps.
 *
 * The API deliberately stops there. There is no `createProjectV2Workflow` or
 * `updateProjectV2Workflow` mutation (workflows are authored in the GitHub UI)
 * and the type exposes no trigger/action payload, so the domain model holds
 * exactly what the API can express - no rule triggers, no rule actions and no
 * create/update/enable/disable operations.
 */
export interface ProjectWorkflow {
  id: string;
  name: string;
  number: number;
  enabled: boolean;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Repository interface for project automation workflows.
 */
export interface ProjectWorkflowRepository {
  /** Look up a single workflow by its GitHub node ID. */
  findById(id: string): Promise<ProjectWorkflow | null>;
  /** List every workflow attached to a project. */
  findByProject(projectId: string): Promise<ProjectWorkflow[]>;
  /** Delete a workflow. */
  delete(id: string): Promise<void>;
}
