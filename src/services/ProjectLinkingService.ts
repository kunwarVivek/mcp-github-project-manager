import type {
  LinkedRepositoriesPage,
  LinkedRepository,
  LinkedTeam,
  LinkedTeamsPage,
  ProjectLinkingRepository,
} from "../domain/project-template-linking-types";
import { ResourceType } from "../domain/resource-types";
import type { ProjectItem } from "../domain/types";
import type { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { safeCall } from "./utils/safeCall";

/**
 * ProjectLinkingService handles project linking operations:
 * - Add issues/PRs to projects
 * - Remove items from projects
 * - Archive/unarchive items
 * - List project items
 * - Link/unlink repositories and teams, list linked repositories/teams
 *
 * Extracted from ProjectManagementService for better separation of concerns.
 */
export class ProjectLinkingService {
  private readonly factory: GitHubRepositoryFactory;

  constructor(factory: GitHubRepositoryFactory) {
    this.factory = factory;
  }

  private get linkingRepo(): ProjectLinkingRepository {
    return this.factory.createProjectLinkingRepository();
  }

  // Project Item Operations
  async addProjectItem(data: {
    projectId: string;
    contentId: string;
    contentType: "issue" | "pull_request";
  }): Promise<ProjectItem> {
    return safeCall(async () => {
      const added = await this.linkingRepo.addItem(data.projectId, data.contentId);

      const resourceType =
        data.contentType === "issue" ? ResourceType.ISSUE : ResourceType.PULL_REQUEST;

      return {
        id: added.itemId,
        contentId: added.contentId,
        contentType: resourceType,
        projectId: data.projectId,
        fieldValues: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  async removeProjectItem(data: {
    projectId: string;
    itemId: string;
  }): Promise<{ success: boolean; message: string }> {
    return safeCall(async () => {
      await this.linkingRepo.removeItem(data.projectId, data.itemId);
      return {
        success: true,
        message: `Item ${data.itemId} has been removed from project ${data.projectId}`,
      };
    });
  }

  async archiveProjectItem(data: {
    projectId: string;
    itemId: string;
  }): Promise<{ success: boolean; message: string }> {
    return safeCall(async () => {
      await this.linkingRepo.archiveItem(data.projectId, data.itemId);
      return {
        success: true,
        message: `Item ${data.itemId} has been archived in project ${data.projectId}`,
      };
    });
  }

  async unarchiveProjectItem(data: {
    projectId: string;
    itemId: string;
  }): Promise<{ success: boolean; message: string }> {
    return safeCall(async () => {
      await this.linkingRepo.unarchiveItem(data.projectId, data.itemId);
      return {
        success: true,
        message: `Item ${data.itemId} has been unarchived in project ${data.projectId}`,
      };
    });
  }

  async listProjectItems(data: { projectId: string; limit?: number }): Promise<ProjectItem[]> {
    return safeCall(() => this.linkingRepo.listItems(data.projectId, data.limit || 50));
  }

  // Repository / team links
  async linkProjectToRepository(data: {
    projectId: string;
    owner: string;
    repo: string;
  }): Promise<LinkedRepository> {
    return safeCall(() => this.linkingRepo.linkRepository(data.projectId, data.owner, data.repo));
  }

  async unlinkProjectFromRepository(data: {
    projectId: string;
    owner: string;
    repo: string;
  }): Promise<{ success: boolean; message: string }> {
    return safeCall(async () => {
      await this.linkingRepo.unlinkRepository(data.projectId, data.owner, data.repo);
      return {
        success: true,
        message: `Successfully unlinked repository ${data.owner}/${data.repo} from project`,
      };
    });
  }

  async linkProjectToTeam(data: {
    projectId: string;
    org: string;
    teamSlug: string;
  }): Promise<LinkedTeam> {
    return safeCall(() => this.linkingRepo.linkTeam(data.projectId, data.org, data.teamSlug));
  }

  async unlinkProjectFromTeam(data: {
    projectId: string;
    org: string;
    teamSlug: string;
  }): Promise<{ success: boolean; message: string }> {
    return safeCall(async () => {
      await this.linkingRepo.unlinkTeam(data.projectId, data.org, data.teamSlug);
      return {
        success: true,
        message: `Successfully unlinked team ${data.teamSlug} from project`,
      };
    });
  }

  async listLinkedRepositories(data: {
    projectId: string;
    first?: number;
    after?: string;
  }): Promise<LinkedRepositoriesPage> {
    return safeCall(() =>
      this.linkingRepo.listRepositories({
        projectId: data.projectId,
        first: data.first ?? 20,
        after: data.after,
      })
    );
  }

  async listLinkedTeams(data: {
    projectId: string;
    first?: number;
    after?: string;
  }): Promise<LinkedTeamsPage> {
    return safeCall(() =>
      this.linkingRepo.listTeams({
        projectId: data.projectId,
        first: data.first ?? 20,
        after: data.after,
      })
    );
  }
}
