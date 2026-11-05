import type { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import type { GitHubLabelRepository } from "../infrastructure/github/repositories/GitHubLabelRepository";
import { safeCall } from "./utils/safeCall";

/**
 * Service for managing GitHub repository labels.
 *
 * Handles:
 * - Creating new labels with custom colors and descriptions
 * - Listing all labels in a repository
 *
 * Can be instantiated directly with a GitHubRepositoryFactory or via dependency injection.
 */
export class LabelService {
  private readonly factory: GitHubRepositoryFactory;

  constructor(factory: GitHubRepositoryFactory) {
    this.factory = factory;
  }

  private get labelRepo(): GitHubLabelRepository {
    return this.factory.createLabelRepository();
  }

  async createLabel(data: {
    name: string;
    color?: string;
    description?: string;
  }): Promise<{ id: number; name: string; color: string; description: string }> {
    return safeCall(async () => this.labelRepo.create(data));
  }

  async listLabels(data: { limit?: number } = {}): Promise<
    Array<{
      id: number;
      name: string;
      color: string;
      description: string;
    }>
  > {
    return safeCall(async () => this.labelRepo.list(data.limit || 100));
  }
}
