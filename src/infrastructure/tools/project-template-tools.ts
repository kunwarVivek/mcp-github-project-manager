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

import { ProjectTemplateService } from "../../services/ProjectTemplateService";
import { ANNOTATION_PATTERNS } from "./annotations/tool-annotations";
import {
  type CopiedProjectOutput,
  CopiedProjectOutputSchema,
  type CopyProjectFromTemplateInput,
  CopyProjectFromTemplateInputSchema,
  type ListOrganizationTemplatesInput,
  ListOrganizationTemplatesInputSchema,
  type MarkProjectAsTemplateInput,
  MarkProjectAsTemplateInputSchema,
  type TemplateListOutput,
  TemplateListOutputSchema,
  type TemplateProjectOutput,
  TemplateProjectOutputSchema,
  type UnmarkProjectAsTemplateInput,
  UnmarkProjectAsTemplateInputSchema,
} from "./schemas/project-template-linking-schemas";
import type { ToolDefinition, ToolSchema } from "./ToolValidator";
import { createGitHubFactory } from "./tool-factory";

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
  schema:
    ListOrganizationTemplatesInputSchema as unknown as ToolSchema<ListOrganizationTemplatesInput>,
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

function createTemplateService(): ProjectTemplateService {
  return new ProjectTemplateService(createGitHubFactory());
}

/**
 * Execute the mark_project_as_template tool.
 *
 * @param args - Validated input arguments
 * @returns The marked template project
 * @throws Error if no GitHub credential is available or the API call fails
 */
export async function executeMarkProjectAsTemplate(args: MarkProjectAsTemplateInput): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: TemplateProjectOutput;
}> {
  const project = await createTemplateService().markProjectAsTemplate({
    projectId: args.projectId,
  });

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
 * @param args - Validated input arguments
 * @returns The unmarked project
 * @throws Error if no GitHub credential is available or the API call fails
 */
export async function executeUnmarkProjectAsTemplate(args: UnmarkProjectAsTemplateInput): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: TemplateProjectOutput;
}> {
  const project = await createTemplateService().unmarkProjectAsTemplate({
    projectId: args.projectId,
  });

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
 * @param args - Validated input arguments
 * @returns The newly created project
 * @throws Error if no GitHub credential is available or the API call fails
 */
export async function executeCopyProjectFromTemplate(args: CopyProjectFromTemplateInput): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: CopiedProjectOutput;
}> {
  const project = await createTemplateService().copyProjectFromTemplate({
    projectId: args.projectId,
    targetOwner: args.targetOwner,
    title: args.title,
    includeDraftIssues: args.includeDraftIssues,
  });

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
 * @param args - Validated input arguments
 * @returns Paginated list of template projects
 * @throws Error if no GitHub credential is available or the API call fails
 */
export async function executeListOrganizationTemplates(
  args: ListOrganizationTemplatesInput
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: TemplateListOutput;
}> {
  const page = await createTemplateService().listOrganizationTemplates({
    org: args.org,
    first: args.first,
    after: args.after,
  });

  const result: TemplateListOutput = {
    templates: page.templates.map((template) => ({
      id: template.id,
      title: template.title,
      isTemplate: true,
      url: template.url,
      number: template.number,
      shortDescription: template.shortDescription,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    })),
    pageInfo: page.pageInfo,
    // Templates are filtered client-side, so the count is of this page's templates.
    totalCount: page.templates.length,
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
