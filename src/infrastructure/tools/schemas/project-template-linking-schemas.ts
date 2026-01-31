/**
 * Zod schemas for project template and linking MCP tools.
 *
 * This module defines input and output schemas for:
 *
 * Template Operations (GHAPI-09 to GHAPI-12):
 * - mark_project_as_template (GHAPI-09)
 * - unmark_project_as_template (GHAPI-10)
 * - copy_project_from_template (GHAPI-11)
 * - list_organization_templates (GHAPI-12)
 *
 * Linking Operations (GHAPI-13 to GHAPI-18):
 * - link_project_to_repository (GHAPI-13)
 * - unlink_project_from_repository (GHAPI-14)
 * - link_project_to_team (GHAPI-15)
 * - unlink_project_from_team (GHAPI-16)
 * - list_linked_repositories (GHAPI-17)
 * - list_linked_teams (GHAPI-18)
 */

import { z } from "zod";

// ============================================================================
// Template Operation Input Schemas
// ============================================================================

/**
 * Input schema for mark_project_as_template tool (GHAPI-09).
 *
 * Marks a project as a template that can be copied by other users
 * in the organization.
 */
export const MarkProjectAsTemplateInputSchema = z.object({
  /** Project node ID (e.g., 'PVT_kwDO...') */
  projectId: z.string().min(1, "Project ID is required").describe("Project node ID"),
});

export type MarkProjectAsTemplateInput = z.infer<typeof MarkProjectAsTemplateInputSchema>;

/**
 * Input schema for unmark_project_as_template tool (GHAPI-10).
 *
 * Removes the template designation from a project.
 */
export const UnmarkProjectAsTemplateInputSchema = z.object({
  /** Project node ID (e.g., 'PVT_kwDO...') */
  projectId: z.string().min(1, "Project ID is required").describe("Project node ID"),
});

export type UnmarkProjectAsTemplateInput = z.infer<typeof UnmarkProjectAsTemplateInputSchema>;

/**
 * Input schema for copy_project_from_template tool (GHAPI-11).
 *
 * Creates a new project by copying from a template project.
 */
export const CopyProjectFromTemplateInputSchema = z.object({
  /** Source template project node ID (e.g., 'PVT_kwDO...') */
  projectId: z.string().min(1, "Project ID is required").describe("Source template project node ID"),
  /** Organization login to create the new project under */
  targetOwner: z.string().min(1, "Target owner is required").describe("Organization login"),
  /** Title for the new project */
  title: z.string().min(1, "Title is required").describe("New project title"),
  /** Whether to include draft issues from the template */
  includeDraftIssues: z.boolean().optional().default(false).describe("Include draft issues from template"),
});

export type CopyProjectFromTemplateInput = z.infer<typeof CopyProjectFromTemplateInputSchema>;

/**
 * Input schema for list_organization_templates tool (GHAPI-12).
 *
 * Lists all template projects available in an organization.
 */
export const ListOrganizationTemplatesInputSchema = z.object({
  /** Organization login */
  org: z.string().min(1, "Organization is required").describe("Organization login"),
  /** Number of templates to return (default: 20, max: 100) */
  first: z.number().int().positive().max(100).optional().default(20).describe("Number of templates to return"),
  /** Cursor for pagination */
  after: z.string().optional().describe("Pagination cursor"),
});

export type ListOrganizationTemplatesInput = z.infer<typeof ListOrganizationTemplatesInputSchema>;

// ============================================================================
// Linking Operation Input Schemas
// ============================================================================

/**
 * Input schema for link_project_to_repository tool (GHAPI-13).
 *
 * Links a project to a repository so issues/PRs from that repository
 * can be added to the project.
 */
export const LinkProjectToRepositoryInputSchema = z.object({
  /** Project node ID (e.g., 'PVT_kwDO...') */
  projectId: z.string().min(1, "Project ID is required").describe("Project node ID"),
  /** Repository owner (username or organization) */
  owner: z.string().min(1, "Owner is required").describe("Repository owner"),
  /** Repository name */
  repo: z.string().min(1, "Repository name is required").describe("Repository name"),
});

export type LinkProjectToRepositoryInput = z.infer<typeof LinkProjectToRepositoryInputSchema>;

/**
 * Input schema for unlink_project_from_repository tool (GHAPI-14).
 *
 * Removes the link between a project and a repository.
 */
export const UnlinkProjectFromRepositoryInputSchema = z.object({
  /** Project node ID (e.g., 'PVT_kwDO...') */
  projectId: z.string().min(1, "Project ID is required").describe("Project node ID"),
  /** Repository owner (username or organization) */
  owner: z.string().min(1, "Owner is required").describe("Repository owner"),
  /** Repository name */
  repo: z.string().min(1, "Repository name is required").describe("Repository name"),
});

export type UnlinkProjectFromRepositoryInput = z.infer<typeof UnlinkProjectFromRepositoryInputSchema>;

/**
 * Input schema for link_project_to_team tool (GHAPI-15).
 *
 * Links a project to a team, giving team members access to the project.
 */
export const LinkProjectToTeamInputSchema = z.object({
  /** Project node ID (e.g., 'PVT_kwDO...') */
  projectId: z.string().min(1, "Project ID is required").describe("Project node ID"),
  /** Organization login */
  org: z.string().min(1, "Organization is required").describe("Organization login"),
  /** Team slug (URL-friendly name, not display name) */
  teamSlug: z.string().min(1, "Team slug is required").describe("Team slug"),
});

export type LinkProjectToTeamInput = z.infer<typeof LinkProjectToTeamInputSchema>;

/**
 * Input schema for unlink_project_from_team tool (GHAPI-16).
 *
 * Removes the link between a project and a team.
 */
export const UnlinkProjectFromTeamInputSchema = z.object({
  /** Project node ID (e.g., 'PVT_kwDO...') */
  projectId: z.string().min(1, "Project ID is required").describe("Project node ID"),
  /** Organization login */
  org: z.string().min(1, "Organization is required").describe("Organization login"),
  /** Team slug (URL-friendly name, not display name) */
  teamSlug: z.string().min(1, "Team slug is required").describe("Team slug"),
});

export type UnlinkProjectFromTeamInput = z.infer<typeof UnlinkProjectFromTeamInputSchema>;

/**
 * Input schema for list_linked_repositories tool (GHAPI-17).
 *
 * Lists all repositories linked to a project.
 */
export const ListLinkedRepositoriesInputSchema = z.object({
  /** Project node ID (e.g., 'PVT_kwDO...') */
  projectId: z.string().min(1, "Project ID is required").describe("Project node ID"),
  /** Number of repositories to return (default: 20, max: 100) */
  first: z.number().int().positive().max(100).optional().default(20).describe("Number of repositories to return"),
  /** Cursor for pagination */
  after: z.string().optional().describe("Pagination cursor"),
});

export type ListLinkedRepositoriesInput = z.infer<typeof ListLinkedRepositoriesInputSchema>;

/**
 * Input schema for list_linked_teams tool (GHAPI-18).
 *
 * Lists all teams linked to a project.
 */
export const ListLinkedTeamsInputSchema = z.object({
  /** Project node ID (e.g., 'PVT_kwDO...') */
  projectId: z.string().min(1, "Project ID is required").describe("Project node ID"),
  /** Number of teams to return (default: 20, max: 100) */
  first: z.number().int().positive().max(100).optional().default(20).describe("Number of teams to return"),
  /** Cursor for pagination */
  after: z.string().optional().describe("Pagination cursor"),
});

export type ListLinkedTeamsInput = z.infer<typeof ListLinkedTeamsInputSchema>;

// ============================================================================
// Template Operation Output Schemas
// ============================================================================

/**
 * Output schema for a template project.
 *
 * Used for mark/unmark template operations and list results.
 */
export const TemplateProjectOutputSchema = z.object({
  /** Project node ID */
  id: z.string(),
  /** Project title */
  title: z.string(),
  /** Whether the project is marked as a template */
  isTemplate: z.boolean(),
  /** URL to the project */
  url: z.string(),
});

export type TemplateProjectOutput = z.infer<typeof TemplateProjectOutputSchema>;

/**
 * Output schema for a copied project.
 *
 * Returned when a new project is created from a template.
 */
export const CopiedProjectOutputSchema = z.object({
  /** New project node ID */
  id: z.string(),
  /** New project title */
  title: z.string(),
  /** Project number within the organization */
  number: z.number(),
  /** URL to the new project */
  url: z.string(),
  /** ISO 8601 timestamp when the project was created */
  createdAt: z.string(),
});

export type CopiedProjectOutput = z.infer<typeof CopiedProjectOutputSchema>;

/**
 * Extended template project schema for list results.
 *
 * Includes additional metadata like number, description, and timestamps.
 */
export const TemplateListItemSchema = TemplateProjectOutputSchema.extend({
  /** Project number within the organization */
  number: z.number(),
  /** Short description of the project (may be null) */
  shortDescription: z.string().nullable(),
  /** ISO 8601 timestamp when the project was created */
  createdAt: z.string(),
  /** ISO 8601 timestamp when the project was last updated */
  updatedAt: z.string(),
});

export type TemplateListItem = z.infer<typeof TemplateListItemSchema>;

/**
 * Schema for pagination info in list responses.
 */
export const PageInfoSchema = z.object({
  /** Whether there are more results available */
  hasNextPage: z.boolean(),
  /** Cursor to use for fetching the next page (null if no more pages) */
  endCursor: z.string().nullable(),
});

export type PageInfo = z.infer<typeof PageInfoSchema>;

/**
 * Output schema for list_organization_templates tool.
 *
 * Returns a paginated list of template projects.
 */
export const TemplateListOutputSchema = z.object({
  /** Array of template projects */
  templates: z.array(TemplateListItemSchema),
  /** Pagination information */
  pageInfo: PageInfoSchema,
  /** Total number of templates in the organization */
  totalCount: z.number(),
});

export type TemplateListOutput = z.infer<typeof TemplateListOutputSchema>;

// ============================================================================
// Linking Operation Output Schemas
// ============================================================================

/**
 * Output schema for a linked repository.
 */
export const LinkedRepositoryOutputSchema = z.object({
  /** Repository node ID */
  id: z.string(),
  /** Repository name */
  name: z.string(),
  /** Full name including owner (e.g., 'owner/repo') */
  nameWithOwner: z.string(),
  /** URL to the repository */
  url: z.string(),
  /** Repository description (may be null) */
  description: z.string().nullable(),
});

export type LinkedRepositoryOutput = z.infer<typeof LinkedRepositoryOutputSchema>;

/**
 * Output schema for a linked team.
 */
export const LinkedTeamOutputSchema = z.object({
  /** Team node ID */
  id: z.string(),
  /** Team display name */
  name: z.string(),
  /** Team slug (URL-friendly identifier) */
  slug: z.string(),
  /** Team description (may be null) */
  description: z.string().nullable(),
});

export type LinkedTeamOutput = z.infer<typeof LinkedTeamOutputSchema>;

/**
 * Output schema for list_linked_repositories tool.
 *
 * Returns a paginated list of repositories linked to a project.
 */
export const LinkedRepositoriesListOutputSchema = z.object({
  /** Array of linked repositories */
  repositories: z.array(LinkedRepositoryOutputSchema),
  /** Pagination information */
  pageInfo: PageInfoSchema,
  /** Total number of linked repositories */
  totalCount: z.number(),
});

export type LinkedRepositoriesListOutput = z.infer<typeof LinkedRepositoriesListOutputSchema>;

/**
 * Output schema for list_linked_teams tool.
 *
 * Returns a paginated list of teams linked to a project.
 */
export const LinkedTeamsListOutputSchema = z.object({
  /** Array of linked teams */
  teams: z.array(LinkedTeamOutputSchema),
  /** Pagination information */
  pageInfo: PageInfoSchema,
  /** Total number of linked teams */
  totalCount: z.number(),
});

export type LinkedTeamsListOutput = z.infer<typeof LinkedTeamsListOutputSchema>;

/**
 * Output schema for link/unlink operations.
 *
 * Used for link_project_to_repository, unlink_project_from_repository,
 * link_project_to_team, and unlink_project_from_team tools.
 */
export const LinkOperationOutputSchema = z.object({
  /** Whether the operation succeeded */
  success: z.boolean(),
  /** Human-readable message describing the result */
  message: z.string(),
});

export type LinkOperationOutput = z.infer<typeof LinkOperationOutputSchema>;
