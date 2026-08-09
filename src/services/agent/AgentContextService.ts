import type { GitHubRepositoryFactory } from '../../infrastructure/github/GitHubRepositoryFactory';
import type { AgentTaskContext } from '../../domain/agent-orchestration-types';
import { AIServiceFactory } from '../ai/AIServiceFactory';
import { safeCall } from '../utils/safeCall';

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
  private readonly aiFactory: AIServiceFactory;

  /**
   * @param factory - GitHub repository factory for API access.
   * @param aiFactory - AI service factory for optional AI-augmented context.
   *     When omitted, defaults to the global singleton via `AIServiceFactory.getInstance()`.
   */
  constructor(factory: GitHubRepositoryFactory, aiFactory?: AIServiceFactory) {
    this.factory = factory;
    this.aiFactory = aiFactory ?? AIServiceFactory.getInstance();
  }

  /** Build a full AgentTaskContext for the given issue. */
  async getTaskContext(_issueId: string, issueNumber: number): Promise<AgentTaskContext> {
    return safeCall(async () => {
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

      const context: AgentTaskContext = {
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

      // AI augmentation (best-effort, graceful when unavailable)
      context.aiSuggestions = await this.generateAISuggestions(context, labels);

      return context;
    });
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Best-effort AI augmentation of the task context: suggested acceptance
   * criteria, a complexity estimate, and implementation guidance. Returns
   * `undefined` when AI is unavailable, disabled via `AGENT_AI_CONTEXT=false`,
   * or the call fails — the base GitHub-derived context is always returned
   * regardless.
   */
  private async generateAISuggestions(
    context: AgentTaskContext,
    labels: string[],
  ): Promise<AgentTaskContext['aiSuggestions']> {
    // Opt-out for latency/cost-sensitive deployments
    if (process.env.AGENT_AI_CONTEXT === 'false') return undefined;

    try {
      const model = this.aiFactory.getBestAvailableModel();
      if (!model) return undefined;

      const { generateObject } = await import('ai');
      const { z } = await import('zod');

      const schema = z.object({
        acceptanceCriteria: z.array(z.string()).describe('Testable acceptance criteria for the task'),
        complexityEstimate: z.number().int().min(1).max(13).describe('Story-point complexity estimate (1-13)'),
        implementationGuidance: z.string().describe('Concise step-by-step implementation guidance'),
        confidence: z.number().min(0).max(1).describe('Confidence in these suggestions (0-1)'),
      });

      const { object } = await generateObject({
        model,
        schema,
        system: 'You are an expert engineering advisor generating task context for an autonomous coding agent. ' +
          'Produce concise, actionable acceptance criteria, a complexity estimate, and implementation guidance. ' +
          'Do not invent repository facts; base everything on the provided task details.',
        prompt: `Task title: ${context.issue.title}\n\n` +
          `Task body:\n${(context.issue.body ?? '').slice(0, 4000)}\n\n` +
          `Labels: ${labels.join(', ') || 'none'}\n` +
          `Milestone: ${context.milestone?.title ?? 'none'} (due ${context.milestone?.dueDate ?? 'n/a'})\n` +
          `Existing acceptance criteria:\n${context.acceptanceCriteria.join('\n') || 'none'}\n\n` +
          `Repository coding standards:\n${(context.codingStandards ?? 'none').slice(0, 3000)}\n`,
        maxOutputTokens: 800,
      });

      return object;
    } catch {
      return undefined;
    }
  }

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
    // biome-ignore lint/suspicious/noAssignInExpressions: the assignment-in-condition
    // is the canonical form for iterating a /g regex with exec(); splitting it
    // would duplicate the exec call or drop the null check.
    while ((match = checkboxPattern.exec(body)) !== null) {
      const text = match[1]?.trim();
      if (text) {
        criteria.push(text);
      }
    }
  }

  return criteria;
}
