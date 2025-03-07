import { BaseGitHubRepository } from "./BaseRepository";
import { IssueId, Sprint, SprintId, SprintRepository } from "../../../domain/types";
import { ResourceStatus, ResourceType } from "../../../domain/resource-types";
import {
  CreateProjectV2FieldResponse,
  CreateProjectV2FieldResponse as CreateProjectV2IterationFieldResponse,
  GraphQLResponse,
} from "../graphql-types";

interface GetIterationFieldResponse {
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
}

interface ListIterationFieldsResponse {
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

export class GitHubSprintRepository extends BaseGitHubRepository implements SprintRepository {
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
        projectId: this.repo,
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

    const iterationResponse = await this.graphql<CreateProjectV2IterationFieldResponse>(
      createIterationQuery,
      {
        input: {
          fieldId: fieldResponse.createProjectV2Field.projectV2Field.id,
          title: data.title,
          startDate: this.toISOString(data.startDate),
          duration: durationWeeks,
        },
      }
    );

    if (!iterationResponse.createProjectV2Field?.projectV2Field) {
      throw new Error("Failed to create sprint iteration");
    }

    const iteration = iterationResponse.createProjectV2Field.projectV2Field;

    if (data.issues.length > 0) {
      await this.addIssuesToSprint(iteration.id, data.issues);
    }

    const sprint: Sprint = {
      id: iteration.id,
      type: ResourceType.SPRINT,
      version: 1,
      title: data.title,
      startDate: data.startDate,
      endDate: data.endDate,
      status: this.determineSprintStatus(new Date(data.startDate), new Date(data.endDate)),
      goals: data.goals,
      issues: data.issues,
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
          startDate: this.toISOString(startDate),
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
      ...(data.startDate && { startDate: data.startDate }),
      ...(data.endDate && { endDate: data.endDate }),
      ...(data.status && { status: data.status }),
      ...(data.goals && { goals: data.goals }),
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

    const response = await this.graphql<{ data: GetIterationFieldResponse }>(query, {
      iterationId: id,
    });

    if (!response.data?.iteration) return null;

    const iteration = response.data.iteration;
    const startDate = new Date(iteration.startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + iteration.duration * 7);

    const sprint: Sprint = {
      id: iteration.id,
      type: ResourceType.SPRINT,
      version: 1,
      title: iteration.title,
      startDate: this.toISOString(startDate),
      endDate: this.toISOString(endDate),
      status: this.determineSprintStatus(startDate, endDate),
      goals: [],
      issues: iteration.items?.nodes?.map(node => node.content.number.toString()) || [],
      createdAt: this.toISOString(startDate),
      updatedAt: this.toISOString(new Date()),
    };

    return sprint;
  }

  async findAll(filters?: { status?: Sprint["status"] }): Promise<Sprint[]> {
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

    const response = await this.graphql<{ data: ListIterationFieldsResponse }>(query, {
      owner: this.owner,
      repo: this.repo,
    });

    if (!response.data?.iterations?.nodes) {
      return [];
    }

    const sprints: Sprint[] = response.data.iterations.nodes.map(iteration => {
      const startDate = new Date(iteration.startDate);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + iteration.duration * 7);

      return {
        id: iteration.id,
        type: ResourceType.SPRINT,
        version: 1,
        title: iteration.title,
        startDate: this.toISOString(startDate),
        endDate: this.toISOString(endDate),
        status: this.determineSprintStatus(startDate, endDate),
        goals: [],
        issues: iteration.items?.nodes?.map(node => node.content.number.toString()) || [],
        createdAt: this.toISOString(startDate),
        updatedAt: this.toISOString(new Date()),
      };
    });

    if (filters?.status) {
      return sprints.filter(sprint => sprint.status === filters.status);
    }

    return sprints;
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
          projectId: this.repo,
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
          projectId: this.repo,
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
