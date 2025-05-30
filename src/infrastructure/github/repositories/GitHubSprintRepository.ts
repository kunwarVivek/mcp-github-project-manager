import { BaseGitHubRepository } from "./BaseRepository";
import { IssueId, Sprint, SprintId, SprintRepository, Issue } from "../../../domain/types";
import { ResourceStatus, ResourceType } from "../../../domain/resource-types";
import { GitHubIssueRepository } from "./GitHubIssueRepository";
import { GitHubConfig } from "../GitHubConfig"; // Import the class, not the interface
import {
  CreateProjectV2FieldResponse,
  GraphQLResponse,
} from "../util/graphql-helpers";

interface GetIterationFieldResponse {
  node: {
    iteration: {
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
  };
}

interface ListIterationFieldsResponse {
  repository: {
    projectsV2: {
      nodes: Array<{
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

  async create(data: Omit<Sprint, "id" | "createdAt" | "updatedAt" | "type">): Promise<Sprint> {
    // GitHub Projects V2 doesn't support creating individual iterations via API
    // Iterations are managed through the project's iteration field configuration
    // For now, we'll create a mock sprint that represents the data structure

    const sprintId = `sprint_${Date.now()}`;

    const sprint: Sprint = {
      id: sprintId,
      title: data.title,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      status: this.determineSprintStatus(new Date(data.startDate), new Date(data.endDate)),
      issues: data.issues || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Note: In a real implementation, you would need to:
    // 1. Ensure an iteration field exists in the project
    // 2. Configure the iteration field with the appropriate iterations
    // 3. Use updateProjectV2ItemFieldValue to assign issues to iterations

    return sprint;
  }

  async update(id: SprintId, data: Partial<Sprint>): Promise<Sprint> {
    const sprint = await this.findById(id);
    if (!sprint) {
      throw new Error("Sprint not found");
    }

    // GitHub Projects V2 doesn't support updating individual iterations via API
    // For now, we'll return an updated mock sprint
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

    return updatedSprint;
  }

  async delete(id: SprintId): Promise<void> {
    // GitHub Projects V2 doesn't support deleting individual iterations via API
    // Iterations are managed through the project's iteration field configuration
    // For now, this is a no-op
    console.log(`Sprint ${id} deletion requested - not supported by GitHub Projects V2 API`);
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

  private async addIssuesToSprint(sprintId: string, issueIds: IssueId[]): Promise<void> {
    const addItemQuery = `
      mutation($input: UpdateProjectV2ItemFieldValueInput!) {
        updateProjectV2ItemFieldValue(input: $input) {
          projectV2Item {
            id
          }
        }
      }
    `;

    for (const issueId of issueIds) {
      await this.graphql(addItemQuery, {
        input: {
          projectId: this.config.projectId,
          itemId: `Issue_${issueId}`,
          fieldId: sprintId,
          value: "ITERATION",
        },
      });
    }
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

  private toISODate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0]; // YYYY-MM-DD format
  }
}
