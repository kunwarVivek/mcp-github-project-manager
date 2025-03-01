import { Octokit } from "@octokit/rest";
import { IssueId, Sprint, SprintId, SprintRepository } from "../../../domain/types";
import { GitHubConfig } from "../GitHubConfig";
import {
  CreateProjectV2FieldResponse,
  CreateProjectV2IterationFieldResponse,
  GetIterationFieldResponse,
  GraphQLResponse,
  ListIterationFieldsResponse,
  UpdateProjectV2IterationFieldResponse,
} from "../graphql-types";

export class GitHubSprintRepository implements SprintRepository {
  private octokit: Octokit;

  constructor(private config: GitHubConfig) {
    this.octokit = new Octokit({ auth: config.token });
  }

  async create(data: Omit<Sprint, "id">): Promise<Sprint> {
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

    const fieldResponse = await this.octokit.graphql<
      GraphQLResponse<CreateProjectV2FieldResponse>
    >(createFieldQuery, {
      input: {
        projectId: this.config.repo,
        name: "Sprint",
        dataType: "ITERATION",
      },
    });

    if (!fieldResponse.data?.createProjectV2Field?.projectV2Field) {
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
      (data.endDate.getTime() - data.startDate.getTime()) /
        (1000 * 60 * 60 * 24 * 7)
    );

    const iterationResponse = await this.octokit.graphql<
      GraphQLResponse<CreateProjectV2IterationFieldResponse>
    >(createIterationQuery, {
      input: {
        fieldId: fieldResponse.data.createProjectV2Field.projectV2Field.id,
        title: data.title,
        startDate: data.startDate.toISOString(),
        duration: durationWeeks,
      },
    });

    if (!iterationResponse.data?.createProjectV2IterationField?.iteration) {
      throw new Error("Failed to create sprint iteration");
    }

    const iteration = iterationResponse.data.createProjectV2IterationField.iteration;

    if (data.issues.length > 0) {
      await this.addIssuesToSprint(iteration.id, data.issues);
    }

    return {
      id: iteration.id,
      title: data.title,
      startDate: data.startDate,
      endDate: data.endDate,
      status: this.determineSprintStatus(data.startDate, data.endDate),
      goals: data.goals,
      issues: data.issues,
    };
  }

  async update(id: SprintId, data: Partial<Sprint>): Promise<Sprint> {
    const updateIterationQuery = `
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

    const updateData = {
      iterationId: id,
      ...(data.title && { title: data.title }),
      ...(data.startDate && { startDate: data.startDate.toISOString() }),
      ...(data.endDate && data.startDate && {
        duration: Math.ceil(
          (data.endDate.getTime() - data.startDate.getTime()) /
            (1000 * 60 * 60 * 24 * 7)
        ),
      }),
    };

    const response = await this.octokit.graphql<
      GraphQLResponse<UpdateProjectV2IterationFieldResponse>
    >(updateIterationQuery, {
      input: updateData,
    });

    if (!response.data?.updateProjectV2IterationField?.iteration) {
      throw new Error("Failed to update sprint");
    }

    if (data.issues) {
      await this.updateSprintIssues(id, data.issues);
    }

    const sprint = await this.findById(id);
    if (!sprint) {
      throw new Error("Sprint not found after update");
    }

    return {
      ...sprint,
      ...(data.title && { title: data.title }),
      ...(data.startDate && { startDate: data.startDate }),
      ...(data.endDate && { endDate: data.endDate }),
      ...(data.status && { status: data.status }),
      ...(data.goals && { goals: data.goals }),
      ...(data.issues && { issues: data.issues }),
    };
  }

  async delete(id: SprintId): Promise<void> {
    const deleteIterationQuery = `
      mutation($input: DeleteProjectV2IterationFieldIterationInput!) {
        deleteProjectV2IterationField(input: $input) {
          iteration {
            id
          }
        }
      }
    `;

    await this.octokit.graphql(deleteIterationQuery, {
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

    const response = await this.octokit.graphql<
      GraphQLResponse<GetIterationFieldResponse>
    >(query, {
      iterationId: id,
    });

    if (!response.data?.iteration) return null;

    const iteration = response.data.iteration;
    const startDate = new Date(iteration.startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + iteration.duration * 7);

    return {
      id: iteration.id,
      title: iteration.title,
      startDate,
      endDate,
      status: this.determineSprintStatus(startDate, endDate),
      goals: [],
      issues: iteration.items?.nodes?.map(
        (node: { content: { number: number } }) => node.content.number
      ) || [],
    };
  }

  async findAll(filters?: {
    status?: "planned" | "active" | "completed";
  }): Promise<Sprint[]> {
    const query = `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
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
    `;

    const response = await this.octokit.graphql<
      GraphQLResponse<ListIterationFieldsResponse>
    >(query, {
      projectId: this.config.repo,
    });

    if (!response.data?.iterations?.nodes) {
      return [];
    }

    const sprints = response.data.iterations.nodes.map((iteration) => {
      const startDate = new Date(iteration.startDate);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + iteration.duration * 7);

      return {
        id: iteration.id,
        title: iteration.title,
        startDate,
        endDate,
        status: this.determineSprintStatus(startDate, endDate),
        goals: [],
        issues: iteration.items?.nodes?.map(node => node.content.number) || [],
      };
    });

    if (filters?.status) {
      return sprints.filter(sprint => sprint.status === filters.status);
    }

    return sprints;
  }

  async getSprintMetrics(id: SprintId): Promise<{
    totalIssues: number;
    completedIssues: number;
    remainingIssues: number;
    completionPercentage: number;
  }> {
    const sprint = await this.findById(id);
    if (!sprint) {
      throw new Error("Sprint not found");
    }

    const issueQuery = `
      query($owner: String!, $repo: String!, $issueIds: [ID!]!) {
        repository(owner: $owner, name: $repo) {
          issues(first: 100, where: { ids: $issueIds }) {
            nodes {
              id
              state
            }
          }
        }
      }
    `;

    interface IssueQueryResponse {
      repository: {
        issues: {
          nodes: Array<{
            id: string;
            state: string;
          }>;
        };
      };
    }

    const response = await this.octokit.graphql<GraphQLResponse<IssueQueryResponse>>(
      issueQuery,
      {
        owner: this.config.owner,
        repo: this.config.repo,
        issueIds: sprint.issues.map(id => `Issue_${id}`),
      }
    );

    const issues = response.data.repository.issues.nodes;
    const totalIssues = issues.length;
    const completedIssues = issues.filter(issue => issue.state === "CLOSED").length;
    const remainingIssues = totalIssues - completedIssues;
    const completionPercentage = totalIssues > 0 ? (completedIssues / totalIssues) * 100 : 0;

    return {
      totalIssues,
      completedIssues,
      remainingIssues,
      completionPercentage,
    };
  }

  private determineSprintStatus(
    startDate: Date,
    endDate: Date
  ): "planned" | "active" | "completed" {
    const now = new Date();
    if (now < startDate) return "planned";
    if (now > endDate) return "completed";
    return "active";
  }

  private async addIssuesToSprint(
    sprintId: string,
    issueIds: IssueId[]
  ): Promise<void> {
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
      await this.octokit.graphql(addItemQuery, {
        input: {
          projectId: this.config.repo,
          itemId: `Issue_${issueId}`,
          fieldId: sprintId,
          value: "ITERATION",
        },
      });
    }
  }

  private async updateSprintIssues(
    sprintId: string,
    issueIds: IssueId[]
  ): Promise<void> {
    const removeItemQuery = `
      mutation($input: UpdateProjectV2ItemFieldValueInput!) {
        updateProjectV2ItemFieldValue(input: $input) {
          projectV2Item {
            id
          }
        }
      }
    `;

    const currentSprint = await this.findById(sprintId);
    if (!currentSprint) {
      throw new Error("Sprint not found");
    }

    for (const issueId of currentSprint.issues) {
      await this.octokit.graphql(removeItemQuery, {
        input: {
          projectId: this.config.repo,
          itemId: `Issue_${issueId}`,
          fieldId: sprintId,
          value: null,
        },
      });
    }

    await this.addIssuesToSprint(sprintId, issueIds);
  }
}
