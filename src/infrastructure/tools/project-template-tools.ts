/**
 * MCP tools for managing GitHub Project V2 templates.
 *
 * Provides 4 tools (GHAPI-09 to GHAPI-12):
 * - mark_project_as_template: Marks an organization project as a template
 * - unmark_project_as_template: Removes template status from a project
 * - copy_project_from_template: Creates a new project by copying from a template
 * - list_organization_templates: Lists all template projects in an organization
 *
 * Templates allow organizations to create reusable project structures
 * with views, custom fields, draft issues (optional), workflows, and insights.
 */

import { ToolDefinition, ToolSchema } from "./ToolValidator.js";
import { ANNOTATION_PATTERNS } from "./annotations/tool-annotations.js";
import { GitHubRepositoryFactory } from "../github/GitHubRepositoryFactory.js";
import {
  MarkProjectAsTemplateInputSchema,
  MarkProjectAsTemplateInput,
  UnmarkProjectAsTemplateInputSchema,
  UnmarkProjectAsTemplateInput,
  CopyProjectFromTemplateInputSchema,
  CopyProjectFromTemplateInput,
  ListOrganizationTemplatesInputSchema,
  ListOrganizationTemplatesInput,
  TemplateProjectOutputSchema,
  TemplateProjectOutput,
  CopiedProjectOutputSchema,
  CopiedProjectOutput,
  TemplateListOutputSchema,
  TemplateListOutput,
} from "./schemas/project-template-linking-schemas.js";

// ============================================================================
// GraphQL Queries and Mutations
// ============================================================================

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
        totalCount
      }
    }
  }
`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a GitHubRepositoryFactory from environment variables.
 *
 * Template operations work at the project level (via projectId), so owner/repo
 * are only needed for factory initialization. We use placeholders since template
 * operations don't actually require a specific repo context.
 */
function createFactory(owner?: string, repo?: string): GitHubRepositoryFactory {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }

  // Owner/repo are required by factory but not used for template operations
  // which work purely with project node IDs
  const effectiveOwner = owner || process.env.GITHUB_OWNER || "placeholder";
  const effectiveRepo = repo || process.env.GITHUB_REPO || "placeholder";

  return new GitHubRepositoryFactory(token, effectiveOwner, effectiveRepo);
}

/**
 * Resolves an organization login to its GitHub node ID.
 *
 * This is needed because copyProjectV2 requires the target owner's node ID,
 * but users provide the organization login for convenience.
 */
async function resolveOrganizationId(
  factory: GitHubRepositoryFactory,
  orgLogin: string
): Promise<string> {
  interface OrgIdResponse {
    organization: {
      id: string;
    } | null;
  }

  const response = await factory.graphql<OrgIdResponse>(RESOLVE_ORG_ID_QUERY, {
    login: orgLogin,
  });

  if (!response.organization) {
    throw new Error(`Organization '${orgLogin}' not found`);
  }

  return response.organization.id;
}

// ============================================================================
// GraphQL Response Types
// ============================================================================

interface MarkProjectAsTemplateResponse {
  markProjectV2AsTemplate: {
    projectV2: {
      id: string;
      title: string;
      url: string;
    };
  };
}

interface UnmarkProjectAsTemplateResponse {
  unmarkProjectV2AsTemplate: {
    projectV2: {
      id: string;
      title: string;
      url: string;
    };
  };
}

interface CopyProjectV2Response {
  copyProjectV2: {
    projectV2: {
      id: string;
      title: string;
      number: number;
      url: string;
      createdAt: string;
    };
  };
}

interface ProjectNode {
  id: string;
  title: string;
  number: number;
  shortDescription: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
  template: boolean;
}

interface ListOrganizationProjectsResponse {
  organization: {
    projectsV2: {
      nodes: ProjectNode[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      totalCount: number;
    };
  } | null;
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * mark_project_as_template tool (GHAPI-09)
 *
 * Marks an organization project as a template that can be copied
 * by other users in the organization.
 */
export const markProjectAsTemplateTool: ToolDefinition<
  MarkProjectAsTemplateInput,
  TemplateProjectOutput
> = {
  name: "mark_project_as_template",
  title: "Mark Project as Template",
  description:
    "Marks an organization project as a template. Only organization-owned projects can be templates. Templates can be copied to create new projects with the same structure.",
  schema: MarkProjectAsTemplateInputSchema as unknown as ToolSchema<MarkProjectAsTemplateInput>,
  outputSchema: TemplateProjectOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Mark project as template",
      description: "Mark a project as a reusable template",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
      },
    },
  ],
};

/**
 * unmark_project_as_template tool (GHAPI-10)
 *
 * Removes the template designation from a project.
 */
export const unmarkProjectAsTemplateTool: ToolDefinition<
  UnmarkProjectAsTemplateInput,
  TemplateProjectOutput
> = {
  name: "unmark_project_as_template",
  title: "Unmark Project as Template",
  description:
    "Removes template status from a project. The project remains but can no longer be used as a template for creating new projects.",
  schema: UnmarkProjectAsTemplateInputSchema as unknown as ToolSchema<UnmarkProjectAsTemplateInput>,
  outputSchema: TemplateProjectOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Unmark project as template",
      description: "Remove template status from a project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
      },
    },
  ],
};

/**
 * copy_project_from_template tool (GHAPI-11)
 *
 * Creates a new project by copying from a template project.
 * Copies views, custom fields, draft issues (optional), workflows, and insights.
 */
export const copyProjectFromTemplateTool: ToolDefinition<
  CopyProjectFromTemplateInput,
  CopiedProjectOutput
> = {
  name: "copy_project_from_template",
  title: "Copy Project from Template",
  description:
    "Creates a new project by copying from a template. Copies views, custom fields, draft issues (optional), workflows, and insights. The target owner must be an organization.",
  schema: CopyProjectFromTemplateInputSchema as unknown as ToolSchema<CopyProjectFromTemplateInput>,
  outputSchema: CopiedProjectOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
  examples: [
    {
      name: "Copy project from template",
      description: "Create a new project from a template",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        targetOwner: "my-organization",
        title: "Q1 2025 Sprint Board",
        includeDraftIssues: true,
      },
    },
    {
      name: "Copy template without draft issues",
      description: "Create a new project from a template without copying draft issues",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        targetOwner: "my-organization",
        title: "New Feature Project",
        includeDraftIssues: false,
      },
    },
  ],
};

/**
 * list_organization_templates tool (GHAPI-12)
 *
 * Lists all template projects available in an organization.
 */
export const listOrganizationTemplatesTool: ToolDefinition<
  ListOrganizationTemplatesInput,
  TemplateListOutput
> = {
  name: "list_organization_templates",
  title: "List Organization Templates",
  description:
    "Lists all project templates in an organization. Returns templates with their metadata, including title, description, and URLs.",
  schema: ListOrganizationTemplatesInputSchema as unknown as ToolSchema<ListOrganizationTemplatesInput>,
  outputSchema: TemplateListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "List organization templates",
      description: "Get all project templates in an organization",
      args: {
        org: "my-organization",
        first: 20,
      },
    },
    {
      name: "Paginate templates",
      description: "Get the next page of templates",
      args: {
        org: "my-organization",
        first: 10,
        after: "Y3Vyc29yOnYyOpK5MjAyNS0wMS0xNVQxMDowMDowMFo=",
      },
    },
  ],
};

// ============================================================================
// Executor Functions
// ============================================================================

/**
 * Execute the mark_project_as_template tool.
 *
 * Marks an organization project as a template via the GraphQL API.
 *
 * @param args - Validated input arguments
 * @returns The marked template project
 * @throws Error if GITHUB_TOKEN is not set or API call fails
 */
export async function executeMarkProjectAsTemplate(
  args: MarkProjectAsTemplateInput
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: TemplateProjectOutput;
}> {
  const factory = createFactory();

  const response = await factory.graphql<MarkProjectAsTemplateResponse>(
    MARK_PROJECT_AS_TEMPLATE_MUTATION,
    {
      input: {
        projectId: args.projectId,
      },
    }
  );

  const project = response.markProjectV2AsTemplate.projectV2;

  const result: TemplateProjectOutput = {
    id: project.id,
    title: project.title,
    isTemplate: true,
    url: project.url,
  };

  return {
    content: [
      {
        type: "text",
        text: `Marked project "${result.title}" as a template`,
      },
    ],
    structuredContent: result,
  };
}

/**
 * Execute the unmark_project_as_template tool.
 *
 * Removes template status from a project via the GraphQL API.
 *
 * @param args - Validated input arguments
 * @returns The unmarked project
 * @throws Error if GITHUB_TOKEN is not set or API call fails
 */
export async function executeUnmarkProjectAsTemplate(
  args: UnmarkProjectAsTemplateInput
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: TemplateProjectOutput;
}> {
  const factory = createFactory();

  const response = await factory.graphql<UnmarkProjectAsTemplateResponse>(
    UNMARK_PROJECT_AS_TEMPLATE_MUTATION,
    {
      input: {
        projectId: args.projectId,
      },
    }
  );

  const project = response.unmarkProjectV2AsTemplate.projectV2;

  const result: TemplateProjectOutput = {
    id: project.id,
    title: project.title,
    isTemplate: false,
    url: project.url,
  };

  return {
    content: [
      {
        type: "text",
        text: `Removed template status from project "${result.title}"`,
      },
    ],
    structuredContent: result,
  };
}

/**
 * Execute the copy_project_from_template tool.
 *
 * Creates a new project by copying from a template via the GraphQL API.
 *
 * @param args - Validated input arguments
 * @returns The newly created project
 * @throws Error if GITHUB_TOKEN is not set or API call fails
 */
export async function executeCopyProjectFromTemplate(
  args: CopyProjectFromTemplateInput
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: CopiedProjectOutput;
}> {
  const factory = createFactory();

  // Resolve the target owner (organization login) to its node ID
  const ownerId = await resolveOrganizationId(factory, args.targetOwner);

  const response = await factory.graphql<CopyProjectV2Response>(
    COPY_PROJECT_V2_MUTATION,
    {
      input: {
        projectId: args.projectId,
        ownerId: ownerId,
        title: args.title,
        includeDraftIssues: args.includeDraftIssues ?? false,
      },
    }
  );

  const project = response.copyProjectV2.projectV2;

  const result: CopiedProjectOutput = {
    id: project.id,
    title: project.title,
    number: project.number,
    url: project.url,
    createdAt: project.createdAt,
  };

  return {
    content: [
      {
        type: "text",
        text: `Created project "${result.title}" (#${result.number}) from template`,
      },
    ],
    structuredContent: result,
  };
}

/**
 * Execute the list_organization_templates tool.
 *
 * Lists template projects in an organization via the GraphQL API.
 * Filters to only return projects marked as templates.
 *
 * @param args - Validated input arguments
 * @returns Paginated list of template projects
 * @throws Error if GITHUB_TOKEN is not set or API call fails
 */
export async function executeListOrganizationTemplates(
  args: ListOrganizationTemplatesInput
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: TemplateListOutput;
}> {
  const factory = createFactory();

  const response = await factory.graphql<ListOrganizationProjectsResponse>(
    LIST_ORGANIZATION_PROJECTS_QUERY,
    {
      orgLogin: args.org,
      first: args.first ?? 20,
      after: args.after,
    }
  );

  if (!response.organization) {
    throw new Error(`Organization '${args.org}' not found`);
  }

  const { projectsV2 } = response.organization;

  // Filter to only include projects marked as templates
  const templateNodes = projectsV2.nodes.filter((node) => node.template);

  const result: TemplateListOutput = {
    templates: templateNodes.map((node) => ({
      id: node.id,
      title: node.title,
      isTemplate: true,
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
    // totalCount is the count of templates, not all projects
    // Since we're filtering client-side, we return the filtered count
    totalCount: templateNodes.length,
  };

  return {
    content: [
      {
        type: "text",
        text: `Found ${result.totalCount} template(s) in organization "${args.org}"`,
      },
    ],
    structuredContent: result,
  };
}
