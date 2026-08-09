import type { GitHubRepositoryFactory } from '../github/GitHubRepositoryFactory.js';
import type { WorkProduct } from '../../domain/agent-orchestration-types.js';
import { WORK_PRODUCT_MARKER } from '../../domain/agent-orchestration-types.js';

/**
 * Stores work products as structured JSON comments on GitHub issues.
 *
 * Each comment begins with a hidden marker containing the full JSON payload,
 * followed by a human-readable summary.
 */
export class WorkProductStore {
  private readonly factory: GitHubRepositoryFactory;

  constructor(factory: GitHubRepositoryFactory) {
    this.factory = factory;
  }

  /** Submit a work product as a structured comment on the issue. */
  async submit(issueNumber: number, product: WorkProduct): Promise<void> {
    const octokit = this.factory.getOctokit();
    const config = this.factory.getConfig();

    const testLine = product.testResults
      ? `- Tests: ${product.testResults.passed}/${product.testResults.total} passed\n`
      : '';

    const body = [
      `${WORK_PRODUCT_MARKER} ${JSON.stringify(product)} -->`,
      '',
      `**Work Product** submitted by \`${product.agentId}\``,
      '',
      `- Branch: \`${product.branch || 'N/A'}\``,
      `- PR: ${product.prNumber ? `#${product.prNumber}` : 'N/A'}`,
      `- Commits: ${product.commitShas?.join(', ') || 'N/A'}`,
      `- Files: ${product.filesChanged.length} changed`,
      testLine ? testLine.trimEnd() : null,
      '',
      product.summary,
    ]
      .filter((line): line is string => line !== null)
      .join('\n');

    await octokit.rest.issues.createComment({
      owner: config.owner,
      repo: config.repo,
      issue_number: issueNumber,
      body,
    });
  }

  /** List work products for an issue by parsing structured comments. */
  async listForIssue(issueNumber: number): Promise<WorkProduct[]> {
    const octokit = this.factory.getOctokit();
    const config = this.factory.getConfig();

    const { data: comments } = await octokit.rest.issues.listComments({
      owner: config.owner,
      repo: config.repo,
      issue_number: issueNumber,
      per_page: 100,
    });

    const products: WorkProduct[] = [];
    for (const comment of comments) {
      const body = comment.body;
      if (!body?.startsWith(WORK_PRODUCT_MARKER)) continue;

      const endIdx = body.indexOf('-->');
      if (endIdx < 0) continue;

      const jsonStr = body.substring(WORK_PRODUCT_MARKER.length, endIdx).trim();
      try {
        products.push(JSON.parse(jsonStr) as WorkProduct);
      } catch {
        /* skip malformed comments */
      }
    }

    return products;
  }
}
