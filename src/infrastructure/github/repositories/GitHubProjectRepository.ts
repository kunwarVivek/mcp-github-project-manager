import { Octokit } from "@octokit/rest";
import {
  Project,
  ProjectId,
  ProjectRepository,
  ProjectView,
  ViewId,
  CustomField,
  FieldId,
} from "../../../domain/types";
import { GitHubConfig } from "../GitHubConfig";
import {
  CreateProjectV2Response,
  CreateProjectV2ViewResponse,
  CreateProjectV2FieldResponse,
  GetProjectV2Response,
  GraphQLResponse,
  ListProjectsV2Response,
  ProjectV2Node,
  UpdateProjectV2Response,
  UpdateProjectV2ViewResponse,
  UpdateProjectV2FieldResponse,
  ProjectV2ViewNode,
  ProjectV2FieldNode,
  graphqlToFieldType,
  graphqlToViewLayout,
  viewLayoutToGraphQL,
  fieldTypeToGraphQL,
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
            views(first: 20) {
              nodes {
                id
                name
                layout
                groupByField {
                  field { name }
                }
                sortByFields {
                  field { name }
                  direction
                }
              }
            }
            fields(first: 20) {
              nodes {
                ... on ProjectV2Field {
                  id
                  name
                  dataType
                }
              }
            }
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
            views(first: 20) {
              nodes {
                id
                name
                layout
                groupByField {
                  field { name }
                }
                sortByFields {
                  field { name }
                  direction
                }
              }
            }
            fields(first: 20) {
              nodes {
                ... on ProjectV2Field {
                  id
                  name
                  dataType
                }
              }
            }
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
            views(first: 20) {
              nodes {
                id
                name
                layout
                groupByField {
                  field { name }
                }
                sortByFields {
                  field { name }
                  direction
                }
              }
            }
            fields(first: 20) {
              nodes {
                ... on ProjectV2Field {
                  id
                  name
                  dataType
                }
              }
            }
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
              views(first: 20) {
                nodes {
                  id
                  name
                  layout
                  groupByField {
                    field { name }
                  }
                  sortByFields {
                    field { name }
                    direction
                  }
                }
              }
              fields(first: 20) {
                nodes {
                  ... on ProjectV2Field {
                    id
                    name
                    dataType
                  }
                }
              }
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
      .map((project) => this.mapGraphQLToProject(project));
  }

  async createView(
    projectId: ProjectId,
    view: Omit<ProjectView, "id">
  ): Promise<ProjectView> {
    const query = `
      mutation($input: CreateProjectV2ViewInput!) {
        createProjectV2View(input: $input) {
          projectV2View {
            id
            name
            layout
            groupByField {
              field { name }
            }
            sortByFields {
              field { name }
              direction
            }
          }
        }
      }
    `;

    const response = await this.octokit.graphql<
      GraphQLResponse<CreateProjectV2ViewResponse>
    >(query, {
      input: {
        projectId,
        name: view.name,
        layout: viewLayoutToGraphQL(view.layout),
      },
    });

    if (!response.data?.createProjectV2View?.projectV2View) {
      throw new Error("Failed to create view");
    }

    return this.mapGraphQLToView(response.data.createProjectV2View.projectV2View);
  }

  async updateView(
    projectId: ProjectId,
    viewId: ViewId,
    data: Partial<ProjectView>
  ): Promise<ProjectView> {
    const query = `
      mutation($input: UpdateProjectV2ViewInput!) {
        updateProjectV2View(input: $input) {
          projectV2View {
            id
            name
            layout
            groupByField {
              field { name }
            }
            sortByFields {
              field { name }
              direction
            }
          }
        }
      }
    `;

    const response = await this.octokit.graphql<
      GraphQLResponse<UpdateProjectV2ViewResponse>
    >(query, {
      input: {
        projectId,
        viewId,
        name: data.name,
        layout: data.layout ? viewLayoutToGraphQL(data.layout) : undefined,
      },
    });

    if (!response.data?.updateProjectV2View?.projectV2View) {
      throw new Error("Failed to update view");
    }

    return this.mapGraphQLToView(response.data.updateProjectV2View.projectV2View);
  }

  async deleteView(projectId: ProjectId, viewId: ViewId): Promise<void> {
    const query = `
      mutation($input: DeleteProjectV2ViewInput!) {
        deleteProjectV2View(input: $input) {
          projectV2View {
            id
          }
        }
      }
    `;

    await this.octokit.graphql(query, {
      input: {
        projectId,
        viewId,
      },
    });
  }

  async createField(
    projectId: ProjectId,
    field: Omit<CustomField, "id">
  ): Promise<CustomField> {
    const query = `
      mutation($input: CreateProjectV2FieldInput!) {
        createProjectV2Field(input: $input) {
          projectV2Field {
            id
            name
            dataType
          }
        }
      }
    `;

    const response = await this.octokit.graphql<
      GraphQLResponse<CreateProjectV2FieldResponse>
    >(query, {
      input: {
        projectId,
        name: field.name,
        dataType: fieldTypeToGraphQL(field.type),
      },
    });

    if (!response.data?.createProjectV2Field?.projectV2Field) {
      throw new Error("Failed to create field");
    }

    return this.mapGraphQLToField(response.data.createProjectV2Field.projectV2Field);
  }

  async updateField(
    projectId: ProjectId,
    fieldId: FieldId,
    data: Partial<CustomField>
  ): Promise<CustomField> {
    const query = `
      mutation($input: UpdateProjectV2FieldInput!) {
        updateProjectV2Field(input: $input) {
          projectV2Field {
            id
            name
            dataType
          }
        }
      }
    `;

    const response = await this.octokit.graphql<
      GraphQLResponse<UpdateProjectV2FieldResponse>
    >(query, {
      input: {
        projectId,
        fieldId,
        name: data.name,
      },
    });

    if (!response.data?.updateProjectV2Field?.projectV2Field) {
      throw new Error("Failed to update field");
    }

    return this.mapGraphQLToField(response.data.updateProjectV2Field.projectV2Field);
  }

  async deleteField(projectId: ProjectId, fieldId: FieldId): Promise<void> {
    const query = `
      mutation($input: DeleteProjectV2FieldInput!) {
        deleteProjectV2Field(input: $input) {
          projectV2Field {
            id
          }
        }
      }
    `;

    await this.octokit.graphql(query, {
      input: {
        projectId,
        fieldId,
      },
    });
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
      views: data.views?.nodes?.map(node => this.mapGraphQLToView(node)) || [],
      fields: data.fields?.nodes?.map(node => this.mapGraphQLToField(node)) || [],
    };
  }

  private mapGraphQLToView(data: ProjectV2ViewNode): ProjectView {
    return {
      id: data.id,
      name: data.name,
      layout: graphqlToViewLayout(data.layout),
      settings: {
        groupBy: data.groupByField?.field?.name,
        sortBy: data.sortByFields?.map(sort => ({
          field: sort.field.name,
          direction: sort.direction.toLowerCase() as "asc" | "desc",
        })),
      },
    };
  }

  private mapGraphQLToField(data: ProjectV2FieldNode): CustomField {
    return {
      id: data.id,
      name: data.name,
      type: graphqlToFieldType(data.dataType),
      options: data.options?.map(opt => opt.name),
    };
  }
}
