import { BaseGitHubRepository } from "./BaseRepository";
import { Project, CreateProject, ProjectRepository, ProjectId, ProjectView, CustomField } from "../../../domain/types";
import { ResourceType, ResourceStatus } from "../../../domain/resource-types";
import { GitHubTypeConverter } from "../util/conversion";
import { 
  mapToGraphQLFieldType, 
  mapFromGraphQLFieldType,
  CreateProjectV2FieldResponse, 
  UpdateProjectV2FieldResponse 
} from "../util/graphql-helpers";
import { GraphQLFieldType } from "../graphql-types";

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
    // Step 1: Create project with valid CreateProjectV2Input schema
    const createMutation = `
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

    // Build input according to official GitHub schema
    const createInput: any = {
      ownerId: this.owner,
      title: data.title,
    };

    // Add optional repositoryId if available
    if (this.repo) {
      createInput.repositoryId = this.repo;
    }

    const createResponse = await this.graphql<CreateProjectResponse>(createMutation, {
      input: createInput,
    });

    let project = createResponse.createProjectV2.projectV2;

    // Step 2: Update project with description if provided (shortDescription is not part of CreateProjectV2Input)
    if (data.shortDescription) {
      const updateMutation = `
        mutation($input: UpdateProjectV2Input!) {
          updateProjectV2(input: $input) {
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

      const updateResponse = await this.graphql<UpdateProjectResponse>(updateMutation, {
        input: {
          projectId: project.id,
          shortDescription: data.shortDescription,
        },
      });

      project = updateResponse.updateProjectV2.projectV2;
    }

    return {
      id: project.id,
      type: ResourceType.PROJECT,
      title: project.title,
      description: project.shortDescription || "",
      owner: this.owner,
      number: parseInt(project.id.split('_').pop() || '0'),
      url: `https://github.com/orgs/${this.owner}/projects/${parseInt(project.id.split('_').pop() || '0')}`,
      status: project.closed ? ResourceStatus.CLOSED : ResourceStatus.ACTIVE,
      visibility: data.visibility || "private",
      views: data.views || [],
      fields: data.fields || [],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      closed: project.closed
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
      title: project.title,
      description: project.shortDescription || "",
      owner: this.owner,
      number: parseInt(project.id.split('_').pop() || '0'),
      url: `https://github.com/orgs/${this.owner}/projects/${parseInt(project.id.split('_').pop() || '0')}`,
      status: project.closed ? ResourceStatus.CLOSED : ResourceStatus.ACTIVE,
      visibility: "private",
      views: [],
      fields: [],
      createdAt: new Date().toISOString(),
      updatedAt: project.updatedAt,
      closed: project.closed
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
      title: project.title,
      description: project.shortDescription || "",
      owner: this.owner,
      number: parseInt(project.id.split('_').pop() || '0'),
      url: `https://github.com/orgs/${this.owner}/projects/${parseInt(project.id.split('_').pop() || '0')}`,
      status: project.closed ? ResourceStatus.CLOSED : ResourceStatus.ACTIVE,
      visibility: "private",
      views: [],
      fields: [],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      closed: project.closed
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
      title: project.title,
      description: project.shortDescription || "",
      owner: this.owner,
      number: parseInt(project.id.split('_').pop() || '0'),
      url: `https://github.com/orgs/${this.owner}/projects/${parseInt(project.id.split('_').pop() || '0')}`,
      status: project.closed ? ResourceStatus.CLOSED : ResourceStatus.ACTIVE,
      visibility: "private",
      views: [],
      fields: [],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      closed: project.closed
    }));
  }

  async findByOwner(owner: string): Promise<Project[]> {
    const query = `
      query($owner: String!) {
        user(login: $owner) {
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
        organization(login: $owner) {
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

    try {
      const response = await this.graphql<any>(query, { owner });
      
      // Combine projects from both user and organization contexts
      const userProjects = response.user?.projectsV2?.nodes || [];
      const orgProjects = response.organization?.projectsV2?.nodes || [];
      
      const projects = [...userProjects, ...orgProjects].map((project: GitHubProject) => ({
        id: project.id,
        type: ResourceType.PROJECT,
        title: project.title,
        description: project.shortDescription || "",
        owner: owner,
        number: parseInt(project.id.split('_').pop() || '0'),
        url: `https://github.com/${owner}/projects/${parseInt(project.id.split('_').pop() || '0')}`,
        status: project.closed ? ResourceStatus.CLOSED : ResourceStatus.ACTIVE,
        visibility: "private",
        views: [],
        fields: [],
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        closed: project.closed
      }));
      
      return projects;
    } catch (error) {
      this.logger.error(`Failed to fetch projects for owner ${owner}`, error);
      throw this.handleGraphQLError(error);
    }
  }

  async createView(projectId: ProjectId, name: string, layout: ProjectView["layout"]): Promise<ProjectView> {
    // Convert parameters to match the implementation needs
    const view: Omit<ProjectView, "id"> = {
      name,
      layout,
      settings: { groupBy: "", sortBy: [] }
    };
    
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
    const mutation = `
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

    try {
      const githubFieldType = mapToGraphQLFieldType(field.type);
      
      const variables: any = {
        input: {
          projectId,
          dataType: githubFieldType,
          name: field.name,
        }
      };

      if (field.type === 'single_select' && field.options && field.options.length > 0) {
        variables.input.singleSelectOptions = field.options.map(option => ({
          name: option.name,
          description: option.description || null,
          color: option.color || null
        }));
      }

      if (field.type === 'iteration' && field.config) {
        if (field.config.iterationDuration) {
          variables.input.iterationDuration = field.config.iterationDuration;
        }
        if (field.config.iterationStart) {
          variables.input.iterationStartDate = field.config.iterationStart;
        }
      }

      const response = await this.graphql<CreateProjectV2FieldResponse>(mutation, variables);
      const createdField = response.createProjectV2Field.projectV2Field;

      // Since the createdField object doesn't have a dataType property, we need to fetch it
      const fieldDetails = await this.getField(projectId, createdField.id);
      
      return {
        id: createdField.id,
        name: createdField.name,
        type: fieldDetails?.type || field.type, // Use fetched type or fallback to original
        options: field.options || [],
        description: field.description,
        required: field.required || false,
        defaultValue: field.defaultValue,
        validation: field.validation,
        config: field.config
      };
    } catch (error) {
      this.logger.error(`Failed to create field ${field.name} for project ${projectId}`, error);
      throw this.handleGraphQLError(error);
    }
  }
  
  async updateField(projectId: ProjectId, fieldId: string, updates: Partial<CustomField>): Promise<CustomField> {
    const mutation = `
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

    try {
      const variables: any = {
        input: {
          projectId,
          fieldId,
          name: updates.name,
        }
      };

      if (updates.type === 'single_select' && updates.options && updates.options.length > 0) {
        const currentField = await this.getField(projectId, fieldId);
        
        if (currentField && currentField.type === 'single_select') {
          // TODO: Implement option diff and update operations
        }
      }

      const response = await this.graphql<UpdateProjectV2FieldResponse>(mutation, variables);
      const updatedField = response.updateProjectV2Field.projectV2Field;

      return await this.getField(projectId, fieldId) as CustomField;
    } catch (error) {
      this.logger.error(`Failed to update field ${fieldId} for project ${projectId}`, error);
      throw this.handleGraphQLError(error);
    }
  }

  async deleteField(projectId: ProjectId, fieldId: string): Promise<void> {
    const mutation = `
      mutation($input: DeleteProjectV2FieldInput!) {
        deleteProjectV2Field(input: $input) {
          deletedFieldId
        }
      }
    `;

    try {
      await this.graphql(mutation, {
        input: {
          projectId,
          fieldId
        }
      });
    } catch (error) {
      this.logger.error(`Failed to delete field ${fieldId} from project ${projectId}`, error);
      throw this.handleGraphQLError(error);
    }
  }

  private async getField(projectId: ProjectId, fieldId: string): Promise<CustomField | null> {
    const query = `
      query($projectId: ID!, $fieldId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            field(id: $fieldId) {
              ... on ProjectV2Field {
                id
                name
                dataType
              }
              ... on ProjectV2SingleSelectField {
                id
                name
                dataType
                options {
                  id
                  name
                  description
                  color
                }
              }
              ... on ProjectV2IterationField {
                id
                name
                dataType
                configuration {
                  duration
                  startDay
                  iterations {
                    id
                    title
                    startDate
                    endDate
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response = await this.graphql<any>(query, { projectId, fieldId });
      const fieldData = response.node?.field;
      
      if (!fieldData) return null;
      
      const customField: CustomField = {
        id: fieldData.id,
        name: fieldData.name,
        type: mapFromGraphQLFieldType(fieldData.dataType as GraphQLFieldType),
        description: "",
      };
      
      if (fieldData.dataType === 'SINGLE_SELECT' && fieldData.options) {
        customField.options = fieldData.options.map((opt: any) => ({
          id: opt.id,
          name: opt.name,
          description: opt.description,
          color: opt.color
        }));
      }
      
      if (fieldData.dataType === 'ITERATION' && fieldData.configuration) {
        customField.config = {
          iterationDuration: fieldData.configuration.duration,
          iterationStart: fieldData.configuration.iterations[0]?.startDate
        };
      }
      
      return customField;
    } catch (error) {
      this.logger.error(`Failed to fetch field ${fieldId} for project ${projectId}`, error);
      throw this.handleGraphQLError(error);
    }
  }
}
