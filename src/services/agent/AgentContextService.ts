import type { GitHubRepositoryFactory } from '../../infrastructure/github/GitHubRepositoryFactory';
import type { AgentTaskContext } from '../../domain/agent-orchestration-types';
import { mapErrorToMCPError } from '../utils/ErrorMapper';

// ---------------------------------------------------------------------------
// GraphQL response types (private to this module)
// ---------------------------------------------------------------------------

interface IssueNode {
  id: string;
  number: number;
  title: string;
  body: string;
  state: string;
  createdAt: string;
  labels: { nodes: Array<{ name: string }> };
  assignees: { nodes: Array<{ login: string }> };
  milestone: {
    title: string;
    description: string;
    dueOn: string | null;
    closedIssues: { totalCount: number };
    openIssues: { totalCount: number };
  } | null;
  parent: {
    id: string;
    number: number;
    title: string;
    body: string;
  } | null;
}

interface IssueQueryResponse {
  repository: {
    issue: IssueNode | null;
  };
}

interface MilestoneIssuesResponse {
  repository: {
    milestones: {
      nodes: Array<{
        issues: {
          nodes: Array<{
            number: number;
            title: string;
            state: string;
            labels: { nodes: Array<{ name: string }> };
          }>;
        };
      }>;
    };
  };
}

interface FileContentResponse {
  repository: {
    object: {
      text: string;
    } | null;
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const ISSUE_CONTEXT_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        id
        number
        title
        body
        state
        createdAt
        labels(first: 50) { nodes { name } }
        assignees(first: 20) { nodes { login } }
        milestone {
          title
          description
          dueOn
          closedIssues: issues(states: CLOSED) { totalCount }
          openIssues: issues(states: OPEN) { totalCount }
        }
        parent {
          id
          number
          title
          body
        }
      }
    }
  }
`;

const FILE_CONTENT_QUERY = `
  query($owner: String!, $repo: String!, $expression: String!) {
    repository(owner: $owner, name: $repo) {
      object(expression: $expression) {
        ... on Blob { text }
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Assembles enriched context when an agent checks out a task.
 *
 * Pulls together the issue, its parent (if a sub-issue), milestone context,
 * related issues, repository coding standards, and a branch name suggestion
 * into a single AgentTaskContext payload.
 */
export class AgentContextService {
  private readonly factory: GitHubRepositoryFactory;

  constructor(factory: GitHubRepositoryFactory) {
    this.factory = factory;
  }

  /** Build a full AgentTaskContext for the given issue. */
  async getTaskContext(issueId: string, issueNumber: number): Promise<AgentTaskContext> {
    try {
      const config = this.factory.getConfig();

      // Fetch issue details (including parent and milestone) in a single query
      const issueData = await this.factory.graphql<IssueQueryResponse>(ISSUE_CONTEXT_QUERY, {
        owner: config.owner,
        repo: config.repo,
        number: issueNumber,
      });

      const issue = issueData.repository.issue;
      if (!issue) {
        throw new Error(`Issue #${issueNumber} not found`);
      }

      const labels = issue.labels.nodes.map(l => l.name);
      const assignees = issue.assignees.nodes.map(a => a.login);

      // Parallel fetches for related issues and coding standards
      const [relatedIssues, codingStandards] = await Promise.all([
        this.fetchRelatedIssues(config.owner, config.repo, issue),
        this.fetchCodingStandards(config.owner, config.repo),
      ]);

      // Build milestone context
      let milestoneCtx: AgentTaskContext['milestone'] | undefined;
      if (issue.milestone) {
        const closed = issue.milestone.closedIssues.totalCount;
        const open = issue.milestone.openIssues.totalCount;
        const total = closed + open;
        milestoneCtx = {
          title: issue.milestone.title,
          description: issue.milestone.description ?? '',
          dueDate: issue.milestone.dueOn ?? undefined,
          progress: total > 0 ? Math.round((closed / total) * 100) : undefined,
        };
      }

      // Build parent context
      let parentIssue: AgentTaskContext['parentIssue'] | undefined;
      if (issue.parent) {
        parentIssue = {
          id: issue.parent.id,
          number: issue.parent.number,
          title: issue.parent.title,
          body: issue.parent.body ?? '',
        };
      }

      return {
        issue: {
          id: issue.id,
          number: issue.number,
          title: issue.title,
          body: issue.body ?? '',
          labels,
          assignees,
          state: issue.state,
          createdAt: issue.createdAt,
        },
        parentIssue,
        milestone: milestoneCtx,
        relatedIssues,
        codingStandards: codingStandards ?? undefined,
        branchSuggestion: buildBranchName(issue.number, issue.title),
        acceptanceCriteria: extractAcceptanceCriteria(issue.body ?? ''),
      };
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Fetch issues from the same milestone (excluding the current issue). */
  private async fetchRelatedIssues(
    owner: string,
    repo: string,
    issue: IssueNode,
  ): Promise<AgentTaskContext['relatedIssues']> {
    if (!issue.milestone) return [];

    try {
      const query = `
        query($owner: String!, $repo: String!, $milestoneTitle: String!) {
          repository(owner: $owner, name: $repo) {
            milestones(query: $milestoneTitle, first: 1) {
              nodes {
                issues(first: 50) {
                  nodes {
                    number
                    title
                    state
                    labels(first: 20) { nodes { name } }
                  }
                }
              }
            }
          }
        }
      `;

      const resp = await this.factory.graphql<MilestoneIssuesResponse>(query, {
        owner, repo,
        milestoneTitle: issue.milestone.title,
      });

      const milestoneNode = resp.repository.milestones.nodes[0];
      if (!milestoneNode) return [];

      return milestoneNode.issues.nodes
        .filter(i => i.number !== issue.number)
        .map(i => ({
          number: i.number,
          title: i.title,
          state: i.state,
          labels: i.labels.nodes.map(l => l.name),
        }));
    } catch {
      // Non-fatal — return empty if milestone query fails
      return [];
    }
  }

  /** Try to read CLAUDE.md and AGENTS.md from the repository root. */
  private async fetchCodingStandards(owner: string, repo: string): Promise<string | null> {
    const files = ['CLAUDE.md', 'AGENTS.md'];
    const parts: string[] = [];

    for (const file of files) {
      try {
        const resp = await this.factory.graphql<FileContentResponse>(FILE_CONTENT_QUERY, {
          owner, repo,
          expression: `HEAD:${file}`,
        });
        if (resp.repository.object?.text) {
          parts.push(`# ${file}\n\n${resp.repository.object.text}`);
        }
      } catch {
        // File may not exist — skip silently
      }
    }

    return parts.length > 0 ? parts.join('\n\n---\n\n') : null;
  }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Build a conventional branch name from issue number and title. */
function buildBranchName(issueNumber: number, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `agent/${issueNumber}-${slug}`;
}

/** Extract acceptance criteria from markdown issue body. */
function extractAcceptanceCriteria(body: string): string[] {
  const criteria: string[] = [];

  // Strategy 1: Look for an "Acceptance Criteria" heading and collect items beneath it
  const headingPattern = /#{1,3}\s*acceptance\s+criteria\s*/i;
  const headingMatch = headingPattern.exec(body);
  if (headingMatch) {
    const afterHeading = body.slice(headingMatch.index + headingMatch[0].length);
    // Stop at the next heading or end of string
    const section = afterHeading.split(/^#{1,3}\s/m)[0] ?? afterHeading;
    const lines = section.split('\n');
    for (const line of lines) {
      const item = line.replace(/^[\s]*[-*]\s*(\[[ x]\]\s*)?/, '').trim();
      if (item.length > 0) {
        criteria.push(item);
      }
    }
  }

  // Strategy 2: If no heading found, look for checkbox lines anywhere
  if (criteria.length === 0) {
    const checkboxPattern = /^[\s]*[-*]\s*\[[ x]\]\s*(.+)$/gm;
    let match: RegExpExecArray | null;
    while ((match = checkboxPattern.exec(body)) !== null) {
      const text = match[1]?.trim();
      if (text) {
        criteria.push(text);
      }
    }
  }

  return criteria;
}
