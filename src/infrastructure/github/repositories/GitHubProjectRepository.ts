import { Octokit } from "@octokit/rest";
import { Project, ProjectId, ProjectRepository } from "../../../domain/types";
import { GitHubConfig } from "../GitHubConfig";
import {
  CreateProjectV2Response,
  GetProjectV2Response,
  GraphQLResponse,
  ListProjectsV2Response,
  ProjectV2Node,
  UpdateProjectV2Response,
} from "../graphql-types";

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

    try {
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
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`GitHub API error: ${error.message}`);
      }
      throw error;
    }
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

    return response.data?.repository?.projectV2
      ? this.mapGraphQLToProject(response.data.repository.projectV2)
      : null;
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
