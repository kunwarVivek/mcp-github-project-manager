import type {
  CopiedProject,
  CopyProjectFromTemplateParams,
  OrganizationTemplatePage,
  ProjectTemplateRepository,
  TemplateProject,
} from "../../../domain/project-template-linking-types";
import { BaseGitHubRepository } from "./BaseRepository";

const GET_README_QUERY = `
  query($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        readme
      }
    }
  }
`;

const UPDATE_README_MUTATION = `
  mutation($input: UpdateProjectV2Input!) {
    updateProjectV2(input: $input) {
      projectV2 {
        id
        readme
      }
    }
  }
`;

const MARK_PROJECT_AS_TEMPLATE_MUTATION = `
  mutation MarkProjectV2AsTemplate($input: MarkProjectV2AsTemplateInput!) {
    markProjectV2AsTemplate(input: $input) {
      projectV2 {
        id
        title
        url
      }
    }
  }
`;

const UNMARK_PROJECT_AS_TEMPLATE_MUTATION = `
  mutation UnmarkProjectV2AsTemplate($input: UnmarkProjectV2AsTemplateInput!) {
    unmarkProjectV2AsTemplate(input: $input) {
      projectV2 {
        id
        title
        url
      }
    }
  }
`;

const COPY_PROJECT_V2_MUTATION = `
  mutation CopyProjectV2($input: CopyProjectV2Input!) {
    copyProjectV2(input: $input) {
      projectV2 {
        id
        title
        number
        url
        createdAt
      }
    }
  }
`;

const RESOLVE_ORG_ID_QUERY = `
  query ResolveOrganizationId($login: String!) {
    organization(login: $login) {
      id
    }
  }
`;

const LIST_ORGANIZATION_PROJECTS_QUERY = `
  query ListOrganizationTemplates($orgLogin: String!, $first: Int!, $after: String) {
    organization(login: $orgLogin) {
      projectsV2(first: $first, after: $after) {
        nodes {
          id
          title
          number
          shortDescription
          url
          createdAt
          updatedAt
          template
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

interface TemplateProjectNode {
  id: string;
  title: string;
  url: string;
}

interface ListedProjectNode extends TemplateProjectNode {
  number: number;
  shortDescription: string | null;
  createdAt: string;
  updatedAt: string;
  template: boolean;
}

/**
 * GraphQL access to project READMEs and templates. Runs on the shared
 * throttle/retry path of {@link BaseGitHubRepository}.
 */
export class GitHubProjectTemplateRepository
  extends BaseGitHubRepository
  implements ProjectTemplateRepository
{
  async getReadme(projectId: string): Promise<string> {
    const response = await this.graphql<{ node: { readme: string | null } | null }>(
      GET_README_QUERY,
      { projectId }
    );
    return response.node?.readme || "";
  }

  async updateReadme(projectId: string, readme: string): Promise<void> {
    await this.graphql(UPDATE_README_MUTATION, { input: { projectId, readme } });
  }

  async markAsTemplate(projectId: string): Promise<TemplateProject> {
    const response = await this.graphql<{
      markProjectV2AsTemplate: { projectV2: TemplateProjectNode };
    }>(MARK_PROJECT_AS_TEMPLATE_MUTATION, { input: { projectId } });
    return this.toTemplateProject(response.markProjectV2AsTemplate.projectV2);
  }

  async unmarkAsTemplate(projectId: string): Promise<TemplateProject> {
    const response = await this.graphql<{
      unmarkProjectV2AsTemplate: { projectV2: TemplateProjectNode };
    }>(UNMARK_PROJECT_AS_TEMPLATE_MUTATION, { input: { projectId } });
    return this.toTemplateProject(response.unmarkProjectV2AsTemplate.projectV2);
  }

  async copyFromTemplate(params: CopyProjectFromTemplateParams): Promise<CopiedProject> {
    const ownerId = await this.resolveOrganizationId(params.targetOwner);

    const response = await this.graphql<{
      copyProjectV2: {
        projectV2: {
          id: string;
          title: string;
          number: number;
          url: string;
          createdAt: string;
        };
      };
    }>(COPY_PROJECT_V2_MUTATION, {
      input: {
        projectId: params.projectId,
        ownerId,
        title: params.title,
        includeDraftIssues: params.includeDraftIssues,
      },
    });

    const project = response.copyProjectV2.projectV2;
    return {
      id: project.id,
      title: project.title,
      number: project.number,
      url: project.url,
      createdAt: project.createdAt,
    };
  }

  async listOrganizationTemplates(params: {
    org: string;
    first: number;
    after?: string;
  }): Promise<OrganizationTemplatePage> {
    const response = await this.graphql<{
      organization: {
        projectsV2: {
          nodes: ListedProjectNode[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      } | null;
    }>(LIST_ORGANIZATION_PROJECTS_QUERY, {
      orgLogin: params.org,
      first: params.first,
      after: params.after,
    });

    if (!response.organization) {
      throw new Error(`Organization '${params.org}' not found`);
    }

    const { projectsV2 } = response.organization;
    return {
      templates: projectsV2.nodes
        .filter((node) => node.template)
        .map((node) => ({
          id: node.id,
          title: node.title,
          url: node.url,
          number: node.number,
          shortDescription: node.shortDescription,
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
        })),
      pageInfo: {
        hasNextPage: projectsV2.pageInfo.hasNextPage,
        endCursor: projectsV2.pageInfo.endCursor,
      },
    };
  }

  /** copyProjectV2 needs the target owner's node ID, but callers pass the org login. */
  private async resolveOrganizationId(login: string): Promise<string> {
    const response = await this.graphql<{ organization: { id: string } | null }>(
      RESOLVE_ORG_ID_QUERY,
      { login }
    );
    if (!response.organization) {
      throw new Error(`Organization '${login}' not found`);
    }
    return response.organization.id;
  }

  private toTemplateProject(node: TemplateProjectNode): TemplateProject {
    return { id: node.id, title: node.title, url: node.url };
  }
}
