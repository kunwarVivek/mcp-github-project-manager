import type { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import type {
  ConvertedDraftIssue,
  GitHubProjectItemRepository,
} from "../infrastructure/github/repositories/GitHubProjectItemRepository";

/** Result of moving a project item. */
export interface ItemPositionResult {
  success: true;
  itemId: string;
  /** "first" or "after {id}". */
  position: string;
}

/**
 * Service for the item-level operations of a GitHub Project V2: converting a
 * draft issue into a real issue and reordering items.
 */
export class ProjectItemService {
  constructor(private readonly factory: GitHubRepositoryFactory) {}

  private get itemRepo(): GitHubProjectItemRepository {
    return this.factory.createProjectItemRepository();
  }

  /**
   * Convert a draft issue item into an issue of `owner/repo`. The draft's
   * title and body are preserved by GitHub.
   *
   * @throws Error if the repository does not exist or the item is not a draft
   */
  async convertDraftIssue(data: {
    itemId: string;
    owner: string;
    repo: string;
  }): Promise<ConvertedDraftIssue> {
    const repositoryId = await this.itemRepo.resolveRepositoryId(data.owner, data.repo);
    return this.itemRepo.convertDraftIssue(data.itemId, repositoryId);
  }

  /**
   * Move an item within a project. Omit `afterId` to move it to the first
   * position.
   */
  async updateItemPosition(data: {
    projectId: string;
    itemId: string;
    afterId?: string;
  }): Promise<ItemPositionResult> {
    await this.itemRepo.updateItemPosition(data.projectId, data.itemId, data.afterId);

    return {
      success: true,
      itemId: data.itemId,
      position: data.afterId ? `after ${data.afterId}` : "first",
    };
  }
}
