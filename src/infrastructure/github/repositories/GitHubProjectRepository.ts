import { BaseGitHubRepository } from "./BaseRepository";
import { Project, CreateProject, ProjectRepository, ProjectId, ProjectView, CustomField } from "../../../domain/types";
import { ResourceType, ResourceStatus } from "../../../domain/resource-types";
import { GitHubTypeConverter } from "../util/conversion";

interface GitHubProject {
  id: string;
  title: string;
  shortDescription: string | null;
  closed: boolean;
  createdAt: string;
  updatedAt: string;
  version?: number;
}

interface CreateProjectResponse {
  createProjectV2: {
    projectV2: GitHubProject;
  };
}

interface UpdateProjectResponse {
  updateProjectV2: {
    projectV2: GitHubProject;
  };
}

interface GetProjectResponse {
  node: GitHubProject | null;
}

interface ListProjectsResponse {
  repository: {
    projectsV2: {
      nodes: GitHubProject[];
    };
  };
}

export class GitHubProjectRepository extends BaseGitHubRepository implements ProjectRepository {
  async create(data: CreateProject): Promise<Project> {
    const mutation = `
      mutation($input: CreateProjectV2Input!) {
        createProjectV2(input: $input) {
          projectV2 {
            id
            title
            shortDescription
            closed
            createdAt
            updatedAt
          }
        }
      }
    `;

    const response = await this.graphql<CreateProjectResponse>(mutation, {
      input: {
        ownerId: this.owner,
        title: data.title,
        description: data.description,
        repositoryId: this.repo,
      },
    });

    const project = response.createProjectV2.projectV2;

    return {
      id: project.id,
      type: ResourceType.PROJECT,
      version: 1,
      title: project.title,
      description: project.shortDescription || "",
      status: project.closed ? ResourceStatus.CLOSED : ResourceStatus.ACTIVE,
      visibility: data.visibility,
      views: data.views,
      fields: data.fields,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  async update(id: ProjectId, data: Partial<Project>): Promise<Project> {
    const mutation = `
      mutation($input: UpdateProjectV2Input!) {
        updateProjectV2(input: $input) {
          projectV2 {
            id
            title
            shortDescription
            closed
            updatedAt
          }
        }
      }
    `;

    const response = await this.graphql<UpdateProjectResponse>(mutation, {
      input: {
        projectId: id,
        title: data.title,
        shortDescription: data.description,
        closed: data.status === ResourceStatus.CLOSED,
      },
    });

    const project = response.updateProjectV2.projectV2;

    return {
      id: project.id,
      type: ResourceType.PROJECT,
      version: (project.version || 0) + 1,
      title: project.title,
      description: project.shortDescription || "",
      status: project.closed ? ResourceStatus.CLOSED : ResourceStatus.ACTIVE,
      visibility: "private",
      views: [],
      fields: [],
      createdAt: new Date().toISOString(),
      updatedAt: project.updatedAt,
    };
  }

  async delete(id: ProjectId): Promise<void> {
    const mutation = `
      mutation($input: DeleteProjectV2Input!) {
        deleteProjectV2(input: $input) {
          projectV2 {
            id
          }
        }
      }
    `;

    await this.graphql(mutation, {
      input: {
        projectId: id,
      },
    });
  }

  async findById(id: ProjectId): Promise<Project | null> {
    const query = `
      query($id: ID!) {
        node(id: $id) {
          ... on ProjectV2 {
            id
            title
            shortDescription
            closed
            createdAt
            updatedAt
          }
        }
      }
    `;

    const response = await this.graphql<GetProjectResponse>(query, { id });
    if (!response.node) return null;

    const project = response.node;
    return {
      id: project.id,
      type: ResourceType.PROJECT,
      version: 1,
      title: project.title,
      description: project.shortDescription || "",
      status: project.closed ? ResourceStatus.CLOSED : ResourceStatus.ACTIVE,
      visibility: "private",
      views: [],
      fields: [],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  async findAll(): Promise<Project[]> {
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          projectsV2(first: 100) {
            nodes {
              id
              title
              shortDescription
              closed
              createdAt
              updatedAt
            }
          }
        }
      }
    `;

    const response = await this.graphql<ListProjectsResponse>(query, {
      owner: this.owner,
      repo: this.repo,
    });

    return response.repository.projectsV2.nodes.map((project: GitHubProject) => ({
      id: project.id,
      type: ResourceType.PROJECT,
      version: 1,
      title: project.title,
      description: project.shortDescription || "",
      status: project.closed ? ResourceStatus.CLOSED : ResourceStatus.ACTIVE,
      visibility: "private",
      views: [],
      fields: [],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }));
  }

  async createView(projectId: ProjectId, view: Omit<ProjectView, "id">): Promise<ProjectView> {
    // TODO: Implement project view creation using GitHub's API
    return {
      id: `view_${Date.now()}`,
      ...view,
    };
  }

  async updateView(projectId: ProjectId, viewId: string, data: Partial<ProjectView>): Promise<ProjectView> {
    // TODO: Implement project view update using GitHub's API
    return {
      id: viewId,
      name: data.name || "",
      layout: data.layout || "board",
      settings: data.settings || { groupBy: "", sortBy: [] },
    };
  }

  async deleteView(projectId: ProjectId, viewId: string): Promise<void> {
    // TODO: Implement project view deletion using GitHub's API
  }

  async createField(projectId: ProjectId, field: Omit<CustomField, "id">): Promise<CustomField> {
    // TODO: Implement custom field creation using GitHub's API
    return {
      id: `field_${Date.now()}`,
      ...field,
    };
  }
}
