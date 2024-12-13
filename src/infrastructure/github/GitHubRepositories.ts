import { Octokit } from "@octokit/rest";
import {
  IssueId,
  Project,
  ProjectId,
  ProjectRepository,
  Sprint,
  SprintId,
  SprintRepository,
} from "../../domain/types";
import { GitHubConfig } from "./GitHubConfig";
import {
  CreateFieldResponse,
  CreateIterationResponse,
  CreateProjectV2Response,
  GetIterationResponse,
  GetProjectV2Response,
  GraphQLResponse,
  IterationNode,
  ListIterationsResponse,
  ListProjectsV2Response,
  ProjectV2Node,
  UpdateIterationResponse,
  UpdateProjectV2Response,
} from "./graphql-types";

export class GitHubProjectRepository implements ProjectRepository {
  private octokit: Octokit;

  constructor(private config: GitHubConfig) {
    this.octokit = new Octokit({ auth: config.token });
  }

  async create(
    data: Omit<Project, "id" | "createdAt" | "updatedAt">
  ): Promise<Project> {
    const query = `
      mutation($input: CreateProjectV2Input!) {
        createProjectV2(input: $input) {
          projectV2 {
            id
            number
            title
            description
            url
            closed
            createdAt
            updatedAt
          }
        }
      }
    `;

    const response = await this.octokit.graphql<
      GraphQLResponse<CreateProjectV2Response>
    >(query, {
      input: {
        ownerId: this.config.owner,
        title: data.title,
        description: data.description,
        visibility: data.visibility?.toUpperCase(),
      },
    });

    if (!response.data?.createProjectV2?.projectV2) {
      throw new Error("Failed to create project");
    }

    return this.mapGraphQLToProject(response.data.createProjectV2.projectV2);
  }

  async update(id: ProjectId, data: Partial<Project>): Promise<Project> {
    const query = `
      mutation($input: UpdateProjectV2Input!) {
        updateProjectV2(input: $input) {
          projectV2 {
            id
            number
            title
            description
            url
            closed
            createdAt
            updatedAt
          }
        }
      }
    `;

    const response = await this.octokit.graphql<
      GraphQLResponse<UpdateProjectV2Response>
    >(query, {
      input: {
        projectId: id,
        title: data.title,
        description: data.description,
        closed: data.status === "closed",
      },
    });

    if (!response.data?.updateProjectV2?.projectV2) {
      throw new Error("Failed to update project");
    }

    return this.mapGraphQLToProject(response.data.updateProjectV2.projectV2);
  }

  async delete(id: ProjectId): Promise<void> {
    const query = `
      mutation($input: DeleteProjectV2Input!) {
        deleteProjectV2(input: $input) {
          projectV2 {
            id
          }
        }
      }
    `;

    await this.octokit.graphql(query, {
      input: {
        projectId: id,
      },
    });
  }

  async findById(id: ProjectId): Promise<Project | null> {
    const query = `
      query($owner: String!, $name: String!, $number: Int!) {
        repository(owner: $owner, name: $name) {
          projectV2(number: $number) {
            id
            number
            title
            description
            url
            closed
            createdAt
            updatedAt
          }
        }
      }
    `;

    const response = await this.octokit.graphql<
      GraphQLResponse<GetProjectV2Response>
    >(query, {
      owner: this.config.owner,
      name: this.config.repo,
      number: parseInt(id),
    });

    if (!response.data?.repository?.projectV2) return null;

    return this.mapGraphQLToProject(response.data.repository.projectV2);
  }

  async findAll(filters?: { status?: "open" | "closed" }): Promise<Project[]> {
    const query = `
      query($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          projectsV2(first: 100) {
            nodes {
              id
              number
              title
              description
              url
              closed
              createdAt
              updatedAt
            }
          }
        }
      }
    `;

    const response = await this.octokit.graphql<
      GraphQLResponse<ListProjectsV2Response>
    >(query, {
      owner: this.config.owner,
      name: this.config.repo,
    });

    if (!response.data?.repository?.projectsV2?.nodes) {
      return [];
    }

    return response.data.repository.projectsV2.nodes
      .filter((project) => {
        if (!filters?.status) return true;
        return filters.status === "closed" ? project.closed : !project.closed;
      })
      .map(this.mapGraphQLToProject);
  }

  private mapGraphQLToProject(data: ProjectV2Node): Project {
    return {
      id: data.number.toString(),
      title: data.title,
      description: data.description || "",
      visibility: "public", // GitHub Projects V2 are always public within the repo
      status: data.closed ? "closed" : "open",
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }
}

export class GitHubSprintRepository implements SprintRepository {
  private octokit: Octokit;

  constructor(private config: GitHubConfig) {
    this.octokit = new Octokit({ auth: config.token });
  }

  async create(data: Omit<Sprint, "id">): Promise<Sprint> {
    // Create an iteration field in the project if it doesn't exist
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
      GraphQLResponse<CreateFieldResponse>
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

    // Create the sprint iteration
    const createIterationQuery = `
      mutation($input: CreateProjectV2IterationFieldIterationInput!) {
        createProjectV2IterationFieldIteration(input: $input) {
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
      GraphQLResponse<CreateIterationResponse>
    >(createIterationQuery, {
      input: {
        fieldId: fieldResponse.data.createProjectV2Field.projectV2Field.id,
        title: data.title,
        startDate: data.startDate.toISOString(),
        duration: durationWeeks,
      },
    });

    if (
      !iterationResponse.data?.createProjectV2IterationFieldIteration?.iteration
    ) {
      throw new Error("Failed to create sprint iteration");
    }

    const iteration =
      iterationResponse.data.createProjectV2IterationFieldIteration.iteration;

    // Add issues to the sprint
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
        updateProjectV2IterationFieldIteration(input: $input) {
          iteration {
            id
            title
            startDate
            duration
          }
        }
      }
    `;

    const updateData: any = {
      iterationId: id,
    };

    if (data.title) {
      updateData.title = data.title;
    }

    if (data.startDate) {
      updateData.startDate = data.startDate.toISOString();
    }

    if (data.endDate && data.startDate) {
      updateData.duration = Math.ceil(
        (data.endDate.getTime() - data.startDate.getTime()) /
          (1000 * 60 * 60 * 24 * 7)
      );
    }

    const response = await this.octokit.graphql<
      GraphQLResponse<UpdateIterationResponse>
    >(updateIterationQuery, {
      input: updateData,
    });

    if (!response.data?.updateProjectV2IterationFieldIteration?.iteration) {
      throw new Error("Failed to update sprint");
    }

    // Update issues if provided
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
        deleteProjectV2IterationFieldIteration(input: $input) {
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
          ... on ProjectV2IterationFieldIteration {
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
    `;

    const response = await this.octokit.graphql<
      GraphQLResponse<GetIterationResponse>
    >(query, {
      iterationId: id,
    });

    if (!response.data?.node) return null;

    const iteration = response.data.node;
    const startDate = new Date(iteration.startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + iteration.duration * 7);

    return {
      id: iteration.id,
      title: iteration.title,
      startDate,
      endDate,
      status: this.determineSprintStatus(startDate, endDate),
      goals: [], // GitHub doesn't store sprint goals directly
      issues: iteration.items?.nodes?.map((node) => node.content.number) || [],
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
      GraphQLResponse<ListIterationsResponse>
    >(query, {
      projectId: this.config.repo,
    });

    if (!response.data?.node?.iterations?.nodes) {
      return [];
    }

    const sprints = response.data.node.iterations.nodes.map(
      (iteration: IterationNode) => {
        const startDate = new Date(iteration.startDate);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + iteration.duration * 7);

        return {
          id: iteration.id,
          title: iteration.title,
          startDate,
          endDate,
          status: this.determineSprintStatus(startDate, endDate),
          goals: [], // GitHub doesn't store sprint goals directly
          issues:
            iteration.items?.nodes?.map((node) => node.content.number) || [],
        };
      }
    );

    if (filters?.status) {
      return sprints.filter(
        (sprint: Sprint) => sprint.status === filters.status
      );
    }

    return sprints;
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
    // First, remove all issues from the sprint
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

    // Then add the new issues
    await this.addIssuesToSprint(sprintId, issueIds);
  }
}
