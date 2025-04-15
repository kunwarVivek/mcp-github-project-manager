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
      }>;
    };
  };
}

interface CreateIterationFieldResponse {
  createProjectV2IterationField: {
    iteration: {
      id: string;
      title: string;
      startDate: string;
      duration: number;
    };
  };
}

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
    const createFieldQuery = `
      mutation($input: CreateProjectV2FieldInput!) {
        createProjectV2Field(input: $input) {
          projectV2Field {
            id
            name
          }
        }
      }
    `;

    const fieldResponse = await this.graphql<CreateProjectV2FieldResponse>(createFieldQuery, {
      input: {
        projectId: this.config.projectId,
        name: "Sprint",
        dataType: "ITERATION",
      },
    });

    if (!fieldResponse.createProjectV2Field?.projectV2Field) {
      throw new Error("Failed to create sprint field");
    }

    const createIterationQuery = `
      mutation($input: CreateProjectV2IterationFieldIterationInput!) {
        createProjectV2IterationField(input: $input) {
          iteration {
            id
            title
            startDate
            duration
          }
        }
      }
    `;

    const durationWeeks = Math.ceil(
      (new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) /
        (1000 * 60 * 60 * 24 * 7)
    );

    const iterationResponse = await this.graphql<CreateIterationFieldResponse>(
      createIterationQuery,
      {
        input: {
          fieldId: fieldResponse.createProjectV2Field.projectV2Field.id,
          title: data.title,
          startDate: this.toISODate(data.startDate),
          duration: durationWeeks,
        },
      }
    );

    if (!iterationResponse.createProjectV2IterationField?.iteration) {
      throw new Error("Failed to create sprint iteration");
    }

    const iteration = iterationResponse.createProjectV2IterationField.iteration;

    if (data.issues && data.issues.length > 0) {
      await this.addIssuesToSprint(iteration.id, data.issues);
    }

    const sprint: Sprint = {
      id: iteration.id,
      title: data.title,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      status: this.determineSprintStatus(new Date(data.startDate), new Date(data.endDate)),
      issues: data.issues || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return sprint;
  }

  async update(id: SprintId, data: Partial<Sprint>): Promise<Sprint> {
    const sprint = await this.findById(id);
    if (!sprint) {
      throw new Error("Sprint not found");
    }

    const updateQuery = `
      mutation($input: UpdateProjectV2IterationFieldIterationInput!) {
        updateProjectV2IterationField(input: $input) {
          iteration {
            id
            title
            startDate
            duration
          }
        }
      }
    `;

    if (data.startDate || data.endDate) {
      const startDate = data.startDate ? new Date(data.startDate) : new Date(sprint.startDate);
      const endDate = data.endDate ? new Date(data.endDate) : new Date(sprint.endDate);
      
      const durationWeeks = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
      );

      await this.graphql(updateQuery, {
        input: {
          iterationId: id,
          startDate: this.toISODate(startDate),
          duration: durationWeeks,
          title: data.title || sprint.title,
        },
      });
    }

    if (data.issues) {
      await this.updateSprintIssues(id, data.issues);
    }

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
    const query = `
      mutation($input: DeleteProjectV2IterationFieldIterationInput!) {
        deleteProjectV2IterationField(input: $input) {
          iteration {
            id
          }
        }
      }
    `;

    await this.graphql(query, {
      input: {
        iterationId: id,
      },
    });
  }

  async findById(id: SprintId): Promise<Sprint | null> {
    const query = `
      query($iterationId: ID!) {
        node(id: $iterationId) {
          ... on ProjectV2IterationField {
            iteration {
              id
              title
              startDate
              duration
              items {
                nodes {
                  content {
                    ... on Issue {
                      number
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await this.graphql<GetIterationFieldResponse>(query, {
      iterationId: id,
    });

    if (!response.node?.iteration) return null;

    const iteration = response.node.iteration;
    const startDate = new Date(iteration.startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + iteration.duration * 7);

    const sprint: Sprint = {
      id: iteration.id,
      title: iteration.title,
      description: "Sprint created from GitHub Projects iteration", // Default description
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: this.determineSprintStatus(startDate, endDate),
      issues: iteration.items?.nodes?.map(node => node.content.number.toString()) || [],
      createdAt: startDate.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return sprint;
  }

  async findAll(options?: { status?: ResourceStatus }): Promise<Sprint[]> {
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          projectsV2(first: 1) {
            nodes {
              iterations(first: 100) {
                nodes {
                  id
                  title
                  startDate
                  duration
                  items {
                    nodes {
                      content {
                        ... on Issue {
                          number
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

    if (!response.repository?.projectsV2?.nodes?.[0]?.iterations?.nodes) {
      return [];
    }

    const sprints: Sprint[] = response.repository.projectsV2.nodes[0].iterations.nodes.map(iteration => {
      const startDate = new Date(iteration.startDate);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + iteration.duration * 7);

      return {
        id: iteration.id,
        title: iteration.title,
        description: "Sprint created from GitHub Projects iteration", // Default description
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        status: this.determineSprintStatus(startDate, endDate),
        issues: iteration.items?.nodes?.map(node => node.content.number.toString()) || [],
        createdAt: startDate.toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

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
