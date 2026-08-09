import { BaseGitHubRepository } from "./BaseRepository";
import { logger } from "../../logger";
import type { IssueId, Sprint, SprintId, SprintRepository, Issue } from "../../../domain/types";
import { ResourceStatus, } from "../../../domain/resource-types";
import { GitHubIssueRepository } from "./GitHubIssueRepository";
import type { GitHubConfig } from "../GitHubConfig"; // Import the class, not the interface

interface ListIterationFieldsResponse {
  repository: {
    projectsV2: {
      nodes: Array<{
        id: string;
        fields: {
          nodes: Array<{
            id?: string;
            name?: string;
            configuration?: {
              iterations: Array<{
                id: string;
                title: string;
                startDate: string;
                duration: number;
              }>;
            };
          }>;
        };
      }>;
    };
  };
}

// Note: GitHub Projects V2 API doesn't support creating individual iterations
// Iterations are managed through the project's iteration field configuration

export class GitHubSprintRepository extends BaseGitHubRepository implements SprintRepository {
  private readonly factory: any;

  constructor(octokit: any, config: GitHubConfig) {
    super(octokit, config);
    // We need to add a factory field to the class in order to create other repositories
    this.factory = {
      createIssueRepository: () => {
        return new GitHubIssueRepository(octokit, config);
      }
    };
  }

  async create(data: Omit<Sprint, "id" | "createdAt" | "updatedAt" | "type"> & { projectId?: string }): Promise<Sprint> {
    // Find the target project's iteration field, creating one if needed
    const { fieldId, projectId, existingIterations } = await this.ensureIterationField(data.projectId);

    // Calculate duration in days (GitHub stores as weeks but the input is days)
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    const durationDays = Math.max(7, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    // GitHub iteration duration is in DAYS (despite what docs sometimes suggest)
    const durationValue = durationDays;

    // Append new iteration to existing ones via updateProjectV2Field
    // The API replaces all iterations, so we must include existing ones
    const allIterations = [
      ...existingIterations.map(iter => ({
        title: iter.title,
        startDate: iter.startDate,
        duration: iter.duration,
      })),
      {
        title: data.title,
        startDate: startDate.toISOString().split('T')[0],
        duration: durationValue,
      },
    ];

    const mutation = `
      mutation($input: UpdateProjectV2FieldInput!) {
        updateProjectV2Field(input: $input) {
          projectV2Field {
            ... on ProjectV2IterationField {
              id
              configuration {
                ... on ProjectV2IterationFieldConfiguration {
                  iterations { id title startDate duration }
                }
              }
            }
          }
        }
      }
    `;

    const response = await this.graphql<{
      updateProjectV2Field: {
        projectV2Field: {
          id: string;
          configuration: { iterations: Array<{ id: string; title: string; startDate: string; duration: number }> };
        };
      };
    }>(mutation, {
      input: {
        fieldId,
        iterationConfiguration: {
          startDate: allIterations[0].startDate,
          duration: durationValue,
          iterations: allIterations,
        },
      },
    });

    // Find the newly created iteration by title match
    const created = response.updateProjectV2Field.projectV2Field.configuration.iterations
      .find(i => i.title === data.title);

    if (!created) {
      throw new Error(`Iteration "${data.title}" was not found after creation`);
    }

    const createdStart = new Date(created.startDate);
    const createdEnd = new Date(createdStart);
    createdEnd.setDate(createdEnd.getDate() + created.duration);

    return {
      id: created.id,
      title: created.title,
      description: data.description || '',
      startDate: createdStart.toISOString(),
      endDate: createdEnd.toISOString(),
      status: this.determineSprintStatus(createdStart, createdEnd),
      issues: data.issues || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Find or create the iteration field on a project.
   * If targetProjectId is provided, queries that specific project.
   * Otherwise falls back to the most recently created project.
   */
  private async ensureIterationField(targetProjectId?: string): Promise<{
    fieldId: string;
    projectId: string;
    existingIterations: Array<{ id: string; title: string; startDate: string; duration: number }>;
  }> {
    let projectNode: { id: string; fields: { nodes: any[] } } | undefined;

    if (targetProjectId) {
      // Query the specific project by node ID
      const query = `
        query($id: ID!) {
          node(id: $id) {
            ... on ProjectV2 {
              id
              fields(first: 100) {
                nodes {
                  ... on ProjectV2IterationField {
                    id
                    name
                    configuration {
                      ... on ProjectV2IterationFieldConfiguration {
                        iterations { id title startDate duration }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;
      const result = await this.graphql<{ node: { id: string; fields: { nodes: any[] } } | null }>(query, { id: targetProjectId });
      projectNode = result.node || undefined;
    } else {
      // Fallback: most recent project
      const query = `
        query($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            projectsV2(first: 1, orderBy: { field: CREATED_AT, direction: DESC }) {
              nodes {
                id
                fields(first: 100) {
                  nodes {
                    ... on ProjectV2IterationField {
                      id
                      name
                      configuration {
                        ... on ProjectV2IterationFieldConfiguration {
                          iterations { id title startDate duration }
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
      const result = await this.graphql<ListIterationFieldsResponse>(query, { owner: this.owner, repo: this.repo });
      projectNode = result.repository?.projectsV2?.nodes?.[0];
    }

    if (!projectNode) {
      throw new Error('No GitHub Project V2 found. Create a project first.');
    }

    // Look for an existing iteration field
    const iterField = projectNode.fields.nodes.find(
      (f: any) => f.configuration?.iterations !== undefined
    );

    if (iterField) {
      return {
        fieldId: iterField.id!,
        projectId: projectNode.id,
        existingIterations: iterField.configuration?.iterations || [],
      };
    }

    // No iteration field — create one
    const createMutation = `
      mutation($input: CreateProjectV2FieldInput!) {
        createProjectV2Field(input: $input) {
          projectV2Field {
            ... on ProjectV2IterationField {
              id
              configuration {
                ... on ProjectV2IterationFieldConfiguration {
                  iterations { id title startDate duration }
                }
              }
            }
          }
        }
      }
    `;

    const createResult = await this.graphql<{
      createProjectV2Field: {
        projectV2Field: {
          id: string;
          configuration: { iterations: Array<{ id: string; title: string; startDate: string; duration: number }> };
        };
      };
    }>(createMutation, {
      input: {
        projectId: projectNode.id,
        dataType: 'ITERATION',
        name: 'Sprint',
        iterationConfiguration: {
          startDate: new Date().toISOString().split('T')[0],
          duration: 14,
          iterations: [],
        },
      },
    });

    return {
      fieldId: createResult.createProjectV2Field.projectV2Field.id,
      projectId: projectNode.id,
      existingIterations: createResult.createProjectV2Field.projectV2Field.configuration?.iterations || [],
    };
  }

  async update(id: SprintId, data: Partial<Sprint>): Promise<Sprint> {
    const sprint = await this.findById(id);
    if (!sprint) {
      throw new Error("Sprint not found");
    }

    // GitHub Projects V2 doesn't support updating iteration metadata (title/dates) via API
    // but issue assignments ARE supported via updateSprintIssues()
    const updatedSprint: Sprint = {
      ...sprint,
      ...(data.title && { title: data.title }),
      ...(data.description && { description: data.description }),
      ...(data.startDate && { startDate: data.startDate }),
      ...(data.endDate && { endDate: data.endDate }),
      ...(data.status && { status: data.status }),
      ...(data.issues && { issues: data.issues }),
      updatedAt: new Date().toISOString(),
    };

    // Write issue assignments to GitHub via GraphQL mutations
    if (data.issues) {
      await this.updateSprintIssues(id, data.issues);
    }

    return updatedSprint;
  }

  async delete(id: SprintId): Promise<void> {
    // GitHub Projects V2 doesn't support deleting individual iterations via API
    // Iterations are managed through the project's iteration field configuration
    // For now, this is a no-op
    // MUST NOT be console.log: this server speaks JSON-RPC over stdout, so any
    // stray stdout write corrupts the protocol stream and drops the client.
    logger.warn(`Sprint ${id} deletion requested - not supported by GitHub Projects V2 API`);
  }

  async findById(id: SprintId): Promise<Sprint | null> {
    // GitHub Projects V2 doesn't support querying individual iterations by ID
    // For now, we'll search through all sprints to find the matching one
    const allSprints = await this.findAll();
    return allSprints.find(sprint => sprint.id === id) || null;
  }

  async findAll(options?: { status?: ResourceStatus }): Promise<Sprint[]> {
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          projectsV2(first: 1) {
            nodes {
              fields(first: 100) {
                nodes {
                  ... on ProjectV2IterationField {
                    id
                    name
                    configuration {
                      ... on ProjectV2IterationFieldConfiguration {
                        iterations {
                          id
                          title
                          startDate
                          duration
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

    const response = await this.graphql<ListIterationFieldsResponse>(query, {
      owner: this.owner,
      repo: this.repo,
    });

    if (!response.repository?.projectsV2?.nodes?.[0]?.fields?.nodes) {
      return [];
    }

    const sprints: Sprint[] = [];

    // Find iteration fields and extract their iterations
    for (const field of response.repository.projectsV2.nodes[0].fields.nodes) {
      if (field.configuration?.iterations) {
        for (const iteration of field.configuration.iterations) {
          const startDate = new Date(iteration.startDate);
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + iteration.duration * 7);

          sprints.push({
            id: iteration.id,
            title: iteration.title,
            description: "Sprint created from GitHub Projects iteration", // Default description
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            status: this.determineSprintStatus(startDate, endDate),
            issues: [], // Issues would need separate query
            createdAt: startDate.toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    if (options?.status) {
      return sprints.filter(sprint => sprint.status === options.status);
    }

    return sprints;
  }

  async findCurrent(): Promise<Sprint | null> {
    const now = new Date();
    const sprints = await this.findAll();
    
    // Find a sprint that contains the current date
    return sprints.find(sprint => {
      const startDate = new Date(sprint.startDate);
      const endDate = new Date(sprint.endDate);
      return startDate <= now && now <= endDate;
    }) || null;
  }

  async addIssue(sprintId: SprintId, issueId: IssueId): Promise<Sprint> {
    const sprint = await this.findById(sprintId);
    if (!sprint) {
      throw new Error("Sprint not found");
    }

    // Check if issue is already in the sprint
    if (sprint.issues.includes(issueId)) {
      return sprint;
    }

    // Add the issue to the sprint
    await this.addIssuesToSprint(sprintId, [issueId]);
    
    // Return the updated sprint
    return {
      ...sprint,
      issues: [...sprint.issues, issueId],
      updatedAt: new Date().toISOString()
    };
  }

  async removeIssue(sprintId: SprintId, issueId: IssueId): Promise<Sprint> {
    const sprint = await this.findById(sprintId);
    if (!sprint) {
      throw new Error("Sprint not found");
    }

    // Check if issue is not in the sprint
    if (!sprint.issues.includes(issueId)) {
      return sprint;
    }

    // Remove the issue from the sprint
    const removeQuery = `
      mutation($input: UpdateProjectV2ItemFieldValueInput!) {
        updateProjectV2ItemFieldValue(input: $input) {
          projectV2Item {
            id
          }
        }
      }
    `;

    await this.graphql(removeQuery, {
      input: {
        projectId: this.config.projectId,
        itemId: `Issue_${issueId}`,
        fieldId: sprintId,
        value: null,
      },
    });
    
    // Return the updated sprint
    return {
      ...sprint,
      issues: sprint.issues.filter(id => id !== issueId),
      updatedAt: new Date().toISOString()
    };
  }

  async getIssues(sprintId: SprintId): Promise<Issue[]> {
    const sprint = await this.findById(sprintId);
    if (!sprint) {
      throw new Error("Sprint not found");
    }

    if (sprint.issues.length === 0) {
      return [];
    }

    // Use factory to create an issue repository
    const issueRepo = this.factory.createIssueRepository();

    const issues = await Promise.all(
      sprint.issues.map(issueId => issueRepo.findById(issueId))
    );

    // Filter out any null results
    return issues.filter((issue): issue is Issue => issue !== null);
  }

  private determineSprintStatus(startDate: Date, endDate: Date): ResourceStatus {
    const now = new Date();
    if (now < startDate) return ResourceStatus.PLANNED;
    if (now > endDate) return ResourceStatus.COMPLETED;
    return ResourceStatus.ACTIVE;
  }

  /**
   * Assign issues to a sprint iteration.
   *
   * Requires three distinct IDs:
   * - projectId: the project node ID (PVT_...)
   * - iterationFieldId: the iteration FIELD id (PVTIF_...) — NOT the instance id
   * - iterationId: the specific iteration instance id (e.g. "dfd5195e")
   * - itemId: the ProjectV2Item id (PVTI_...) — NOT the issue id
   *
   * The caller must provide iterationFieldId and projectId. issueIds are
   * resolved to project item IDs by querying the project.
   */
  async addIssuesToSprint(
    sprintId: string,
    issueIds: IssueId[],
    iterationFieldId?: string,
    projectId?: string,
  ): Promise<void> {
    // Resolve the iteration field ID and project ID if not provided
    if (!iterationFieldId || !projectId) {
      const fieldInfo = await this.ensureIterationField();
      iterationFieldId = iterationFieldId || fieldInfo.fieldId;
      projectId = projectId || fieldInfo.projectId;
    }

    // Resolve issue node IDs → project item IDs by querying the project
    const itemIds = await this.resolveProjectItemIds(projectId, issueIds);

    const mutation = `
      mutation($input: UpdateProjectV2ItemFieldValueInput!) {
        updateProjectV2ItemFieldValue(input: $input) {
          projectV2Item { id }
        }
      }
    `;

    for (const { itemId } of itemIds) {
      await this.graphql(mutation, {
        input: {
          projectId,
          itemId,                          // PVTI_... (project item, not issue)
          fieldId: iterationFieldId,       // PVTIF_... (iteration field, not instance)
          value: { iterationId: sprintId }, // iteration instance ID
        },
      });
    }
  }

  /**
   * Resolve issue IDs to their ProjectV2Item IDs within a project.
   * An issue must have been added to the project via addProjectItem first.
   */
  private async resolveProjectItemIds(
    projectId: string,
    issueIds: string[],
  ): Promise<Array<{ issueId: string; itemId: string }>> {
    const query = `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 100) {
              nodes {
                id
                content {
                  ... on Issue { id }
                }
              }
            }
          }
        }
      }
    `;

    const response = await this.graphql<{
      node: { items: { nodes: Array<{ id: string; content: { id: string } | null }> } } | null;
    }>(query, { projectId });

    const issueSet = new Set(issueIds);
    const results: Array<{ issueId: string; itemId: string }> = [];

    for (const item of response.node?.items?.nodes || []) {
      if (item.content && issueSet.has(item.content.id)) {
        results.push({ issueId: item.content.id, itemId: item.id });
      }
    }

    return results;
  }

  private async updateSprintIssues(sprintId: string, issueIds: IssueId[]): Promise<void> {
    const sprint = await this.findById(sprintId);
    if (!sprint) {
      throw new Error("Sprint not found");
    }

    // Remove existing issues
    const removeQuery = `
      mutation($input: UpdateProjectV2ItemFieldValueInput!) {
        updateProjectV2ItemFieldValue(input: $input) {
          projectV2Item {
            id
          }
        }
      }
    `;

    for (const issueId of sprint.issues) {
      await this.graphql(removeQuery, {
        input: {
          projectId: this.config.projectId,
          itemId: `Issue_${issueId}`,
          fieldId: sprintId,
          value: null,
        },
      });
    }

    // Add new issues
    await this.addIssuesToSprint(sprintId, issueIds);
  }
}
