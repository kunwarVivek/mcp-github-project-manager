import type { GitHubRepositoryFactory } from '../github/GitHubRepositoryFactory.js';
import type { WorkProduct } from '../../domain/agent-orchestration-types.js';
import { WORK_PRODUCT_MARKER } from '../../domain/agent-orchestration-types.js';

/**
 * Stores work products as structured JSON comments on GitHub issues.
 *
 * Each comment leads with a human-readable summary (files changed, test
 * results, agent summary) followed by a hidden marker containing the full
 * JSON payload for machine-parseable retrieval.
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

    const humanReadable = [
      `## Agent Work Product`,
      '',
      `**Agent:** \`${product.agentId}\``,
      `**Branch:** ${product.branch || '_(none)_'}`,
      product.prNumber ? `**PR:** #${product.prNumber}` : null,
      '',
      `### Files Changed`,
      ...product.filesChanged.map((f) => `- \`${f}\``),
      '',
      product.testResults
        ? [
            `### Test Results`,
            `| Passed | Failed | Skipped | Total | Coverage |`,
            `|--------|--------|---------|-------|----------|`,
            `| ${product.testResults.passed} | ${product.testResults.failed} | ${product.testResults.skipped} | ${product.testResults.total} | ${product.testResults.coverage != null ? `${product.testResults.coverage}%` : 'N/A'} |`,
          ].join('\n')
        : null,
      '',
      `### Summary`,
      product.summary,
      '',
      `**Submitted:** ${product.submittedAt}`,
    ]
      .filter((line): line is string => line !== null)
      .join('\n');

    const body = `${humanReadable}\n\n${WORK_PRODUCT_MARKER} ${JSON.stringify(product)} -->\n`;

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
      if (!body) continue;

      // The marker may be preceded by a human-readable summary, so search
      // for it anywhere in the body rather than requiring it at the start.
      const markerIdx = body.indexOf(WORK_PRODUCT_MARKER);
      if (markerIdx < 0) continue;

      const jsonStart = markerIdx + WORK_PRODUCT_MARKER.length;
      const endIdx = body.indexOf('-->', jsonStart);
      if (endIdx < 0) continue;

      const jsonStr = body.substring(jsonStart, endIdx).trim();
      try {
        products.push(JSON.parse(jsonStr) as WorkProduct);
      } catch {
        /* skip malformed comments */
      }
    }

    return products;
  }
}
