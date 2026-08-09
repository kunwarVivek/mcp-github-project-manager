import type { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { safeCall } from './utils/safeCall';

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

  async createLabel(data: {
    name: string;
    color?: string;
    description?: string;
  }): Promise<{ id: number; name: string; color: string; description: string }> {
    return safeCall(async () => {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.issues.createLabel({
        owner: config.owner,
        repo: config.repo,
        name: data.name,
        color: data.color?.replace('#', '') || 'ededed',
        description: data.description || ''
      });

      return {
        id: response.data.id,
        name: response.data.name,
        color: response.data.color,
        description: response.data.description || ''
      };
    });
  }

  async listLabels(data: { limit?: number } = {}): Promise<Array<{
    id: number;
    name: string;
    color: string;
    description: string;
  }>> {
    return safeCall(async () => {
      const octokit = this.factory.getOctokit();
      const config = this.factory.getConfig();

      const response = await octokit.rest.issues.listLabelsForRepo({
        owner: config.owner,
        repo: config.repo,
        per_page: data.limit || 100
      });

      return response.data.map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description || ''
      }));
    });
  }
}
