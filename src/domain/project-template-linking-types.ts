import type { ProjectItem } from "./types";

/**
 * Project templates and project linking (repositories, teams, items).
 *
 * All identifiers are GitHub node IDs. Organization/team/repository inputs are
 * human-readable logins/slugs; the repository implementations resolve them to
 * node IDs.
 */

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

// ============================================================================
// Templates
// ============================================================================

/** A project whose template flag was just changed. */
export interface TemplateProject {
  id: string;
  title: string;
  url: string;
}

/** A template project as listed for an organization. */
export interface OrganizationTemplate extends TemplateProject {
  number: number;
  shortDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A project created by copying a template. */
export interface CopiedProject {
  id: string;
  title: string;
  number: number;
  url: string;
  createdAt: string;
}

/** One page of an organization's projects, with the template-flagged ones only. */
export interface OrganizationTemplatePage {
  templates: OrganizationTemplate[];
  pageInfo: PageInfo;
}

export interface CopyProjectFromTemplateParams {
  projectId: string;
  /** Organization login that will own the new project. */
  targetOwner: string;
  title: string;
  includeDraftIssues: boolean;
}

export interface ProjectTemplateRepository {
  /** The project README, or an empty string when none is set. */
  getReadme(projectId: string): Promise<string>;
  updateReadme(projectId: string, readme: string): Promise<void>;
  markAsTemplate(projectId: string): Promise<TemplateProject>;
  unmarkAsTemplate(projectId: string): Promise<TemplateProject>;
  copyFromTemplate(params: CopyProjectFromTemplateParams): Promise<CopiedProject>;
  /** One page of an organization's projects filtered to templates. */
  listOrganizationTemplates(params: {
    org: string;
    first: number;
    after?: string;
  }): Promise<OrganizationTemplatePage>;
}

// ============================================================================
// Linking
// ============================================================================

export interface LinkedRepository {
  id: string;
  name: string;
  nameWithOwner: string;
  url: string;
  description: string | null;
}

export interface LinkedTeam {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface LinkedRepositoriesPage {
  repositories: LinkedRepository[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface LinkedTeamsPage {
  teams: LinkedTeam[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface ProjectLinkingRepository {
  /** Add an issue/PR node to a project; returns the new item and content IDs. */
  addItem(projectId: string, contentId: string): Promise<{ itemId: string; contentId: string }>;
  removeItem(projectId: string, itemId: string): Promise<void>;
  archiveItem(projectId: string, itemId: string): Promise<void>;
  unarchiveItem(projectId: string, itemId: string): Promise<void>;
  listItems(projectId: string, limit: number): Promise<ProjectItem[]>;

  linkRepository(projectId: string, owner: string, repo: string): Promise<LinkedRepository>;
  unlinkRepository(projectId: string, owner: string, repo: string): Promise<void>;
  linkTeam(projectId: string, org: string, teamSlug: string): Promise<LinkedTeam>;
  unlinkTeam(projectId: string, org: string, teamSlug: string): Promise<void>;
  listRepositories(params: {
    projectId: string;
    first: number;
    after?: string;
  }): Promise<LinkedRepositoriesPage>;
  listTeams(params: { projectId: string; first: number; after?: string }): Promise<LinkedTeamsPage>;
}
