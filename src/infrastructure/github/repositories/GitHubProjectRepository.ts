import { ResourceStatus, ResourceType } from "../../../domain/resource-types";
import type {
  CreateProject,
  CustomField,
  Project,
  ProjectCollaborator,
  ProjectCollaboratorGrant,
  ProjectId,
  ProjectRepository,
  ProjectRole,
  ProjectView,
} from "../../../domain/types";
import {
  type CreateProjectV2ViewResponse,
  fromGraphQLOrderDirection,
  fromGraphQLViewLayout,
  mapToGraphQLViewLayout,
  type ProjectV2ViewNode,
  type UpdateProjectV2CollaboratorsResponse,
  type UpdateProjectV2ViewResponse,
} from "../graphql-types";
import { projectFieldUnionSelection } from "../project-field-fragments";
import {
  buildFieldOptions,
  type CreateProjectV2FieldResponse,
  type FieldOptionInput,
  mapFromGraphQLFieldType,
  mapToGraphQLFieldType,
  toGraphQLDate,
  type UpdateProjectV2FieldResponse,
} from "../util/graphql-helpers";
import { BaseGitHubRepository } from "./BaseRepository";

/** The `CreateProjectV2FieldInput` payload the API accepts. */
type CreateProjectV2FieldVariables = {
  input: {
    projectId: string;
    dataType: string;
    name: string;
    singleSelectOptions?: FieldOptionInput[];
    multiSelectOptions?: FieldOptionInput[];
    iterationConfiguration?: {
      startDate: string;
      duration: number;
      iterations: Array<{ title: string; startDate: string; duration: number }>;
    };
  };
};

/** The `UpdateProjectV2FieldInput` payload the API accepts. */
type UpdateProjectV2FieldVariables = {
  input: {
    fieldId: string;
    name?: string;
    singleSelectOptions?: FieldOptionInput[];
    multiSelectOptions?: FieldOptionInput[];
  };
};

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

/** ProjectV2.fields is a ProjectV2FieldConfiguration UNION — use fragments. */
/**
 * Does this look like a Project v2 field NODE ID rather than a field name?
 *
 * The ids differ per field type: "PVTF_" (text, number, date, ...),
 * "PVTSSF_" (single select), "PVTMSF_" (multi select), "PVTIF_" (iteration).
 * Only the first one used to be recognised, so a single-select id was passed
 * to `field(name:)` as if it were a name and GitHub answered
 * "Could not resolve to a Unions::ProjectV2FieldConfiguration with the name
 * PVTSSF_...".
 */
function looksLikeFieldNodeId(value: string): boolean {
  return /^PVT[A-Z]*_/.test(value);
}

const LIST_PROJECT_FIELDS_QUERY = `
  query($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        fields(first: 100) {
          nodes {
            __typename
            ${projectFieldUnionSelection()}
          }
        }
      }
    }
  }
`;

/** One option of a single-select or multi-select field. */
interface ListedFieldOption {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

/** A project field as the API reports it. */
interface ListedProjectField {
  id: string;
  name: string;
  /** The field data type, e.g. `TEXT` or `SINGLE_SELECT`. */
  dataType: string;
  options?: ListedFieldOption[];
  multiSelectOptions?: ListedFieldOption[];
  configuration?: {
    duration: number;
    startDay: string;
    iterations: Array<{ id: string; title: string; startDate: string; duration: number }>;
  };
}

/** The response of the project field list query. */
interface ProjectFieldListResponse {
  node?: {
    fields?: {
      nodes?: Array<{ id: string; name: string }>;
    };
  } | null;
}

/** The response of the single project field query. */
interface ProjectFieldResponse {
  node?: {
    field?: ListedProjectField | null;
  } | null;
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

    // Build input according to official GitHub schema.
    // createProjectV2 requires node IDs (e.g. 'U_kgDO...', 'R_kgDO...'), not
    // the configured owner login / repo name — resolve them first.
    const ownerId = await this.resolveOwnerNodeId(this.owner);

    const createInput: any = {
      ownerId,
      title: data.title,
    };

    // Add optional repositoryId if available
    if (this.repo) {
      createInput.repositoryId = await this.resolveRepositoryNodeId(this.owner, this.repo);
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
      number: parseInt(project.id.split("_").pop() || "0", 10),
      url: `https://github.com/orgs/${this.owner}/projects/${parseInt(project.id.split("_").pop() || "0", 10)}`,
      status: project.closed ? ResourceStatus.CLOSED : ResourceStatus.ACTIVE,
      visibility: data.visibility || "private",
      views: data.views || [],
      fields: data.fields || [],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      closed: project.closed,
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
      number: parseInt(project.id.split("_").pop() || "0", 10),
      url: `https://github.com/orgs/${this.owner}/projects/${parseInt(project.id.split("_").pop() || "0", 10)}`,
      status: project.closed ? ResourceStatus.CLOSED : ResourceStatus.ACTIVE,
      visibility: "private",
      views: [],
      fields: [],
      createdAt: new Date().toISOString(),
      updatedAt: project.updatedAt,
      closed: project.closed,
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
      number: parseInt(project.id.split("_").pop() || "0", 10),
      url: `https://github.com/orgs/${this.owner}/projects/${parseInt(project.id.split("_").pop() || "0", 10)}`,
      status: project.closed ? ResourceStatus.CLOSED : ResourceStatus.ACTIVE,
      visibility: "private",
      views: [],
      fields: [],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      closed: project.closed,
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
      number: parseInt(project.id.split("_").pop() || "0", 10),
      url: `https://github.com/orgs/${this.owner}/projects/${parseInt(project.id.split("_").pop() || "0", 10)}`,
      status: project.closed ? ResourceStatus.CLOSED : ResourceStatus.ACTIVE,
      visibility: "private",
      views: [],
      fields: [],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      closed: project.closed,
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
        number: parseInt(project.id.split("_").pop() || "0", 10),
        url: `https://github.com/${owner}/projects/${parseInt(project.id.split("_").pop() || "0", 10)}`,
        status: project.closed ? ResourceStatus.CLOSED : ResourceStatus.ACTIVE,
        visibility: "private",
        views: [],
        fields: [],
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        closed: project.closed,
      }));

      return projects;
    } catch (error) {
      this.logger.error(`Failed to fetch projects for owner ${owner}`, error);
      throw this.handleGraphQLError(error);
    }
  }

  async createView(
    projectId: ProjectId,
    name: string,
    layout: ProjectView["layout"]
  ): Promise<ProjectView> {
    const mutation = `
      mutation($input: CreateProjectV2ViewInput!) {
        createProjectV2View(input: $input) {
          projectV2View {
            id
            name
            layout
          }
        }
      }
    `;

    try {
      const graphqlLayout = mapToGraphQLViewLayout(layout);

      const variables = {
        input: {
          projectId,
          name,
          layout: graphqlLayout,
        },
      };

      const response = await this.graphql<CreateProjectV2ViewResponse>(mutation, variables);

      if (!response.createProjectV2View?.projectV2View) {
        throw new Error("Failed to create project view: Invalid response from GitHub API");
      }

      const view = response.createProjectV2View.projectV2View;

      return {
        id: view.id,
        name: view.name,
        layout: fromGraphQLViewLayout(view.layout),
        fields: [],
        sortBy: [],
        filters: [],
      };
    } catch (error) {
      this.logger.error(`Failed to create project view for project ${projectId}`, error);
      throw this.handleGraphQLError(error);
    }
  }

  /**
   * The views of a project, with the configuration GitHub stores for them.
   *
   * The configuration is what makes a view usable as a server-side pool:
   * `filter` is the predicate the view selects its items with, `groupByFields`
   * and `sortByFields` are the field configurations the view groups and
   * sorts by, and `configuration.visibleFields` are the fields it shows.
   *
   * @param projectId - The project to read the views of
   * @param options - Narrow the result down to a single view, by name or id
   */
  async listViews(
    projectId: ProjectId,
    options: { name?: string; viewId?: string } = {}
  ): Promise<ProjectView[]> {
    const query = `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            views(first: 50) {
              nodes {
                id
                name
                layout
                filter
                groupByFields(first: 10) {
                  nodes {
                    ${projectFieldUnionSelection()}
                  }
                }
                sortByFields(first: 10) {
                  nodes {
                    direction
                    field {
                      ${projectFieldUnionSelection()}
                    }
                  }
                }
                configuration {
                  visibleFields(first: 50) {
                    nodes {
                      ${projectFieldUnionSelection()}
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    interface ListViewsResponse {
      node: {
        views: {
          nodes: ProjectV2ViewNode[];
        };
      } | null;
    }

    try {
      const response = await this.graphql<ListViewsResponse>(query, { projectId });
      const views = response.node?.views?.nodes ?? [];
      const selected = views.filter(
        (view) =>
          (options.name === undefined || view.name === options.name) &&
          (options.viewId === undefined || view.id === options.viewId)
      );

      return selected.map((view) => ({
        id: view.id,
        name: view.name,
        layout: fromGraphQLViewLayout(view.layout),
        fields: [],
        sortBy: (view.sortByFields?.nodes ?? []).map((sort) => ({
          field: sort.field.name,
          direction: fromGraphQLOrderDirection(sort.direction),
        })),
        groupByFields: (view.groupByFields?.nodes ?? []).map((field) => field.name),
        filter: view.filter ?? null,
        visibleFields: (view.configuration?.visibleFields?.nodes ?? []).map((field) => field.name),
        filters: [],
      }));
    } catch (error) {
      this.logger.error(`Failed to list views for project ${projectId}`, error);
      throw this.handleGraphQLError(error);
    }
  }

  async updateView(
    projectId: ProjectId,
    viewId: string,
    data: Partial<ProjectView>
  ): Promise<ProjectView> {
    const mutation = `
      mutation($input: UpdateProjectV2ViewInput!) {
        updateProjectV2View(input: $input) {
          projectV2View {
            id
            name
            layout
          }
        }
      }
    `;

    try {
      // UpdateProjectV2ViewInput carries the view id only — the project is
      // implied by the view. Sending `projectId` is a schema error
      // ("Field 'projectId' is not defined by type 'UpdateProjectV2ViewInput'").
      const input: Record<string, any> = {
        viewId,
      };

      if (data.name !== undefined) {
        input.name = data.name;
      }

      if (data.layout !== undefined) {
        input.layout = mapToGraphQLViewLayout(data.layout);
      }

      const response = await this.graphql<UpdateProjectV2ViewResponse>(mutation, {
        input,
      });

      if (!response.updateProjectV2View?.projectV2View) {
        throw new Error("Failed to update project view: Invalid response from GitHub API");
      }

      const view = response.updateProjectV2View.projectV2View;

      return {
        id: view.id,
        name: view.name,
        layout: fromGraphQLViewLayout(view.layout),
        fields: [],
        sortBy: [],
        filters: [],
      };
    } catch (error) {
      this.logger.error(`Failed to update project view ${viewId}`, error);
      throw this.handleGraphQLError(error);
    }
  }

  async deleteView(projectId: ProjectId, viewId: string): Promise<void> {
    const mutation = `
      mutation($input: DeleteProjectV2ViewInput!) {
        deleteProjectV2View(input: $input) {
          projectV2View {
            id
          }
        }
      }
    `;

    try {
      await this.graphql(mutation, {
        input: {
          // DeleteProjectV2ViewInput carries the view id only.
          viewId,
        },
      });

      this.logger.info(`Deleted project view ${viewId} from project ${projectId}`);
    } catch (error) {
      this.logger.error(`Failed to delete project view ${viewId}`, error);
      throw this.handleGraphQLError(error);
    }
  }

  /**
   * Sets the roles of a project's collaborators.
   *
   * GitHub's `updateProjectV2Collaborators` takes the collaborators to
   * update - each with a `userId` or a `teamId` and one of the four
   * `ProjectV2Roles` roles - and answers with the project's collaborators.
   *
   * The payload reports the actors that have access but NOT their roles:
   * `ProjectV2` has no `collaborators` field and `ProjectV2Actor` carries
   * no role, so a role can never be read back from GitHub. The roles this
   * method returns are the ones it just granted; a collaborator that was
   * already on the project comes back without a role.
   *
   * @param projectId - The project to set the roles on
   * @param grants - The roles to grant, one entry per user or team
   * @param org - The organization that owns the teams. Defaults to the
   *   configured owner.
   */
  async updateCollaborators(
    projectId: ProjectId,
    grants: ProjectCollaboratorGrant[],
    org?: string
  ): Promise<ProjectCollaborator[]> {
    const collaborators: Array<{ userId?: string; teamId?: string; role: ProjectRole }> = [];
    // The roles this call granted, keyed by the node id they were granted to.
    const grantedRoles = new Map<string, ProjectRole>();

    for (const grant of grants) {
      if (grant.userLogin) {
        const userId = await this.resolveUserNodeId(grant.userLogin);
        collaborators.push({ userId, role: grant.role });
        grantedRoles.set(userId, grant.role);
      } else if (grant.teamSlug) {
        const teamId = await this.resolveTeamNodeId(org ?? this.owner, grant.teamSlug);
        collaborators.push({ teamId, role: grant.role });
        grantedRoles.set(teamId, grant.role);
      } else {
        throw new Error(
          `A collaborator needs a userLogin or a teamSlug to grant the role ${grant.role} to.`
        );
      }
    }

    const mutation = `
      mutation($input: UpdateProjectV2CollaboratorsInput!) {
        updateProjectV2Collaborators(input: $input) {
          collaborators(first: 100) {
            totalCount
            nodes {
              ... on User {
                id
                login
              }
              ... on Team {
                id
                slug
                name
              }
            }
          }
        }
      }
    `;

    try {
      const response = await this.graphql<UpdateProjectV2CollaboratorsResponse>(mutation, {
        input: { projectId, collaborators },
      });

      const actors = response.updateProjectV2Collaborators?.collaborators?.nodes ?? [];

      return actors.map((actor) => {
        const isTeam = actor.__typename === "Team";
        return {
          id: actor.id,
          login: isTeam ? (actor.slug ?? "") : (actor.login ?? ""),
          type: isTeam ? "team" : "user",
          role: grantedRoles.get(actor.id),
        };
      });
    } catch (error) {
      this.logger.error(`Failed to update collaborators of project ${projectId}`, error);
      throw this.handleGraphQLError(error);
    }
  }

  /**
   * Resolves a user login to the node id the API wants.
   */
  private async resolveUserNodeId(login: string): Promise<string> {
    const query = `
      query GetCollaboratorUserNodeId($login: String!) {
        user(login: $login) {
          id
        }
      }
    `;

    const response = await this.graphql<{ user?: { id: string } | null }>(query, { login });
    if (!response.user?.id) {
      throw new Error(`User ${login} not found.`);
    }
    return response.user.id;
  }

  /**
   * Resolves a team slug to the node id the API wants.
   */
  private async resolveTeamNodeId(org: string, slug: string): Promise<string> {
    const query = `
      query GetCollaboratorTeamNodeId($org: String!, $slug: String!) {
        organization(login: $org) {
          team(slug: $slug) {
            id
          }
        }
      }
    `;

    const response = await this.graphql<{
      organization?: { team?: { id: string } | null } | null;
    }>(query, { org, slug });
    const teamId = response.organization?.team?.id;
    if (!teamId) {
      throw new Error(`Team ${slug} not found in ${org}.`);
    }
    return teamId;
  }

  async createField(projectId: ProjectId, field: Omit<CustomField, "id">): Promise<CustomField> {
    // createProjectV2Field.projectV2Field returns the ProjectV2FieldConfiguration
    // UNION — selections must use concrete-type fragments, never direct fields.
    const mutation = `
      mutation($input: CreateProjectV2FieldInput!) {
        createProjectV2Field(input: $input) {
          projectV2Field {
            __typename
            ${projectFieldUnionSelection()}
          }
        }
      }
    `;

    try {
      const githubFieldType = mapToGraphQLFieldType(field.type);

      const variables: CreateProjectV2FieldVariables = {
        input: {
          projectId,
          dataType: githubFieldType,
          name: field.name,
        },
      };

      if (field.type === "single_select" && field.options && field.options.length > 0) {
        // `ProjectV2SingleSelectFieldOptionInput` requires a description and a
        // color — sending null for either is a schema error.
        variables.input.singleSelectOptions = buildFieldOptions([], field.options);
      }

      if (field.type === "multi_select" && field.options && field.options.length > 0) {
        // A multi-select field carries its options in `multiSelectOptions`; the
        // payload shape is the same as the single-select one.
        variables.input.multiSelectOptions = buildFieldOptions([], field.options);
      }

      if (field.type === "iteration" && field.config) {
        // The iteration setup lives in `iterationConfiguration`; there are no
        // top-level `iterationDuration` / `iterationStartDate` input fields.
        variables.input.iterationConfiguration = {
          startDate: toGraphQLDate(field.config.iterationStart ?? new Date()),
          duration: field.config.iterationDuration ?? 14,
          iterations: [],
        };
      }

      const response = await this.graphql<CreateProjectV2FieldResponse>(mutation, variables);
      const createdField = response.createProjectV2Field.projectV2Field;

      // Since the createdField object doesn't have a dataType property, we need
      // to fetch it (getField resolves id → name internally)
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
        config: field.config,
      };
    } catch (error) {
      this.logger.error(`Failed to create field ${field.name} for project ${projectId}`, error);
      throw this.handleGraphQLError(error);
    }
  }

  async updateField(
    projectId: ProjectId,
    fieldId: string,
    updates: Partial<CustomField>
  ): Promise<CustomField> {
    // updateProjectV2Field.projectV2Field returns the ProjectV2FieldConfiguration
    // UNION — selections must use concrete-type fragments.
    const mutation = `
      mutation($input: UpdateProjectV2FieldInput!) {
        updateProjectV2Field(input: $input) {
          projectV2Field {
            __typename
            ${projectFieldUnionSelection()}
          }
        }
      }
    `;

    try {
      const variables: UpdateProjectV2FieldVariables = {
        input: {
          // UpdateProjectV2FieldInput carries the field id only — the project
          // is implied by the field.
          fieldId,
        },
      };

      if (updates.name !== undefined) {
        variables.input.name = updates.name;
      }

      // Select-option changes (single-select and multi-select).
      //
      // GitHub has no "add / update / delete option" mutation: the option set
      // of a select field is REPLACED by the list sent with
      // `updateProjectV2Field`, and an option sent without its `id` is a new
      // one while an option sent with its `id` keeps its identity. The whole
      // list is therefore sent — the existing options with their ids plus the
      // ones that are missing — which adds what is missing, keeps the identity
      // (and the item values pointing at it) of what is already there, and
      // drops what was removed.
      if (updates.options) {
        const currentField = await this.getField(projectId, fieldId);
        if (currentField?.type === "single_select") {
          variables.input.singleSelectOptions = buildFieldOptions(
            currentField.options ?? [],
            updates.options
          );
        } else if (currentField?.type === "multi_select") {
          variables.input.multiSelectOptions = buildFieldOptions(
            currentField.options ?? [],
            updates.options
          );
        }
      }

      const response = await this.graphql<UpdateProjectV2FieldResponse>(mutation, variables);
      const updatedField = response.updateProjectV2Field.projectV2Field;

      return (await this.getField(projectId, updatedField.id ?? fieldId)) as CustomField;
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
          // DeleteProjectV2FieldInput carries the field id only.
          fieldId,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to delete field ${fieldId} from project ${projectId}`, error);
      throw this.handleGraphQLError(error);
    }
  }

  /**
   * Get a field by id (or by name when the id is not available).
   *
   * ProjectV2.field resolves by NAME only (no id argument), so we first
   * resolve the name from the project's field list when only an id is known,
   * then fetch the full field. The field value is a ProjectV2FieldConfiguration
   * UNION — selections use concrete-type fragments with __typename.
   */
  private async getField(projectId: ProjectId, fieldIdOrName: string): Promise<CustomField | null> {
    // Resolve name from id if needed (ProjectV2.field takes name, not id)
    let fieldName = fieldIdOrName;
    if (looksLikeFieldNodeId(fieldIdOrName)) {
      const listResp = await this.graphql<ProjectFieldListResponse>(LIST_PROJECT_FIELDS_QUERY, {
        projectId,
      });
      const match = (listResp.node?.fields?.nodes ?? []).find(
        (f: { id: string }) => f.id === fieldIdOrName
      );
      if (!match) return null;
      fieldName = match.name;
    }

    const query = `
      query($projectId: ID!, $fieldName: String!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            field(name: $fieldName) {
              __typename
              ${projectFieldUnionSelection({
                singleSelect: `options {
                  id
                  name
                  description
                  color
                }`,
                multiSelect: `multiSelectOptions {
                  id
                  name
                  description
                  color
                }`,
                iteration: `configuration {
                  duration
                  startDay
                  iterations {
                    id
                    title
                    startDate
                    duration
                  }
                }`,
              })}
            }
          }
        }
      }
    `;

    try {
      const response = await this.graphql<ProjectFieldResponse>(query, { projectId, fieldName });
      const fieldData = response.node?.field;

      if (!fieldData) return null;

      const customField: CustomField = {
        id: fieldData.id,
        name: fieldData.name,
        // A built-in project field (Assignees, Labels, Milestone, …) has no
        // domain field type — the mapping refuses it with a message that says
        // so instead of reporting it as some other kind of field.
        type: mapFromGraphQLFieldType(fieldData.dataType),
        description: "",
      };

      if (fieldData.dataType === "SINGLE_SELECT" && fieldData.options) {
        customField.options = fieldData.options.map((opt) => ({
          id: opt.id,
          name: opt.name,
          description: opt.description,
          color: opt.color,
        }));
      }

      if (fieldData.dataType === "MULTI_SELECT" && fieldData.multiSelectOptions) {
        customField.options = fieldData.multiSelectOptions.map((opt) => ({
          id: opt.id,
          name: opt.name,
          description: opt.description,
          color: opt.color,
        }));
      }

      if (fieldData.dataType === "ITERATION" && fieldData.configuration) {
        customField.config = {
          iterationDuration: fieldData.configuration.duration,
          iterationStart: fieldData.configuration.iterations[0]?.startDate,
        };
      }

      return customField;
    } catch (error) {
      this.logger.error(`Failed to fetch field ${fieldName} for project ${projectId}`, error);
      throw this.handleGraphQLError(error);
    }
  }
}
