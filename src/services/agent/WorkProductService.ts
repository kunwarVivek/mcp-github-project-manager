import type { GitHubRepositoryFactory } from '../../infrastructure/github/GitHubRepositoryFactory';
import type { WorkProductStore } from '../../infrastructure/agent/WorkProductStore';
import type { WorkProduct } from '../../domain/agent-orchestration-types';
import { AGENT_FIELDS } from '../../domain/agent-orchestration-types';
import { safeCall } from '../utils/safeCall';

// ---------------------------------------------------------------------------
// GraphQL helpers
// ---------------------------------------------------------------------------

/** Find the project item ID for an issue in a project. */
const FIND_PROJECT_ITEM_QUERY = `
  query($owner: String!, $repo: String!, $issueNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issueNumber) {
        projectItems(first: 10) {
          nodes {
            id
            project { id }
            fieldValues(first: 30) {
              nodes {
                ... on ProjectV2ItemFieldTextValue  { field { ... on ProjectV2Field { name } } text }
                ... on ProjectV2ItemFieldNumberValue { field { ... on ProjectV2Field { name } } number }
              }
            }
          }
        }
      }
    }
  }
`;

interface ProjectItemNode {
  id: string;
  project: { id: string };
  fieldValues: {
    nodes: Array<{
      field?: { name: string };
      text?: string;
      number?: number;
    }>;
  };
}

interface FindProjectItemResponse {
  repository: {
    issue: {
      projectItems: {
        nodes: ProjectItemNode[];
      };
    } | null;
  };
}

const LIST_FIELDS_QUERY = `
  query($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        fields(first: 50) {
          nodes {
            ... on ProjectV2Field { id name dataType }
            ... on ProjectV2SingleSelectField { id name dataType options { id name } }
          }
        }
      }
    }
  }
`;

interface FieldNode {
  id: string;
  name: string;
  dataType: string;
  options?: Array<{ id: string; name: string }>;
}

interface ListFieldsResponse {
  node: {
    fields: {
      nodes: FieldNode[];
    };
  };
}

const UPDATE_TEXT_FIELD = `
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { text: $value }
    }) { projectV2Item { id } }
  }
`;

const UPDATE_NUMBER_FIELD = `
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: Float!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { number: $value }
    }) { projectV2Item { id } }
  }
`;

const UPDATE_SELECT_FIELD = `
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { singleSelectOptionId: $value }
    }) { projectV2Item { id } }
  }
`;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Manages work product submissions and queries.
 *
 * When a product is submitted the service persists it via WorkProductStore
 * and — when a project item exists — updates the issue's project fields
 * (agent_work_branch, agent_pr_number, agent_status → 'review').
 */
export class WorkProductService {
  private readonly factory: GitHubRepositoryFactory;
  private readonly workProductStore: WorkProductStore;

  constructor(factory: GitHubRepositoryFactory, workProductStore: WorkProductStore) {
    this.factory = factory;
    this.workProductStore = workProductStore;
  }

  /** Submit a work product and update project fields. */
  async submitWorkProduct(product: WorkProduct): Promise<void> {
    return safeCall(async () => {
      // Parse issueNumber from taskId (expected format: issue number as string)
      const issueNumber = parseInt(product.taskId, 10);
      if (Number.isNaN(issueNumber)) {
        throw new Error(`Invalid taskId — expected issue number, got: ${product.taskId}`);
      }

      // Persist the work product
      await this.workProductStore.submit(issueNumber, product);

      // Best-effort: update project fields if the issue is in a project
      await this.updateProjectFields(issueNumber, product).catch(() => {
        // Non-fatal — the work product is already persisted
      });
    });
  }

  /** List work products for an issue. */
  async listWorkProducts(issueNumber: number): Promise<WorkProduct[]> {
    return safeCall(() => this.workProductStore.listForIssue(issueNumber));
  }

  /** List all work products submitted by a specific agent (across issues). */
  async getWorkProductsByAgent(agentId: string): Promise<WorkProduct[]> {
    return safeCall(async () => {
      // WorkProductStore only supports per-issue listing, so we need to
      // scan the agent store's known tasks. For now, use the octokit REST API
      // to find issues with agent comments, then filter.
      const config = this.factory.getConfig();
      const octokit = this.factory.getOctokit();

      // Search for issues that have agent work product comments
      const { data: issues } = await octokit.rest.issues.listForRepo({
        owner: config.owner,
        repo: config.repo,
        state: 'all',
        per_page: 100,
      });

      const results: WorkProduct[] = [];
      for (const issue of issues) {
        if (issue.pull_request) continue; // skip PRs
        const products = await this.workProductStore.listForIssue(issue.number);
        for (const p of products) {
          if (p.agentId === agentId) {
            results.push(p);
          }
        }
      }

      return results;
    });
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Update agent_work_branch, agent_pr_number, agent_status on the project item. */
  private async updateProjectFields(issueNumber: number, product: WorkProduct): Promise<void> {
    const config = this.factory.getConfig();

    // Find the project item for this issue
    const itemResp = await this.factory.graphql<FindProjectItemResponse>(FIND_PROJECT_ITEM_QUERY, {
      owner: config.owner,
      repo: config.repo,
      issueNumber,
    });

    const items = itemResp.repository.issue?.projectItems.nodes;
    if (!items || items.length === 0) return;

    const item = items[0]!;
    const projectId = item.project.id;
    const itemId = item.id;

    // Load project fields to find our custom field IDs
    const fieldsResp = await this.factory.graphql<ListFieldsResponse>(LIST_FIELDS_QUERY, {
      projectId,
    });

    const fields = fieldsResp.node.fields.nodes;
    const fieldMap = new Map(fields.map(f => [f.name, f]));

    // Update branch
    if (product.branch) {
      const branchField = fieldMap.get(AGENT_FIELDS.WORK_BRANCH);
      if (branchField) {
        await this.factory.graphql(UPDATE_TEXT_FIELD, {
          projectId, itemId, fieldId: branchField.id, value: product.branch,
        });
      }
    }

    // Update PR number
    if (product.prNumber != null) {
      const prField = fieldMap.get(AGENT_FIELDS.PR_NUMBER);
      if (prField) {
        await this.factory.graphql(UPDATE_NUMBER_FIELD, {
          projectId, itemId, fieldId: prField.id, value: product.prNumber,
        });
      }
    }

    // Update status to 'review'
    const statusField = fieldMap.get(AGENT_FIELDS.STATUS);
    if (statusField?.options) {
      const reviewOption = statusField.options.find(o => o.name === 'review');
      if (reviewOption) {
        await this.factory.graphql(UPDATE_SELECT_FIELD, {
          projectId, itemId, fieldId: statusField.id, value: reviewOption.id,
        });
      }
    }
  }
}
