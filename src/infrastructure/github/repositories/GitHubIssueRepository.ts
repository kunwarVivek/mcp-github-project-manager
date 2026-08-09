import { BaseGitHubRepository } from "./BaseRepository";
import type { Issue, CreateIssue, IssueRepository, IssueId } from "../../../domain/types";
import { ResourceStatus } from "../../../domain/resource-types";
import { parseResourceStatus, toStatusString } from '../../../domain/utils/StatusParser';

interface GitHubIssue {
  id: string;
  number: number;
  title: string;
  body: string | null;
  state: "OPEN" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  assignees: {
    nodes: Array<{
      login: string;
    }>;
  };
  labels: {
    nodes: Array<{
      name: string;
    }>;
  };
  milestone: {
    id: string;
  } | null;
}

interface CreateIssueResponse {
  createIssue: {
    issue: GitHubIssue;
  };
}

interface UpdateIssueResponse {
  updateIssue: {
    issue: GitHubIssue;
  };
}

interface GetIssueResponse {
  repository: {
    issue: GitHubIssue | null;
  };
}

interface ListIssuesResponse {
  repository: {
    issues: {
      nodes: GitHubIssue[];
    };
  };
}

export class GitHubIssueRepository extends BaseGitHubRepository implements IssueRepository {
  private mapGitHubIssueToIssue(githubIssue: GitHubIssue): Issue {
    return {
      id: githubIssue.id,
      number: parseInt(githubIssue.number.toString(), 10),
      title: githubIssue.title,
      description: githubIssue.body || "",
      status: parseResourceStatus(githubIssue.state, 'githubIssue'),
      assignees: githubIssue.assignees.nodes.map(node => node.login),
      labels: githubIssue.labels.nodes.map(node => node.name),
      milestoneId: githubIssue.milestone?.id,
      createdAt: githubIssue.createdAt,
      updatedAt: githubIssue.updatedAt,
      url: `https://github.com/${this.owner}/${this.repo}/issues/${githubIssue.number}`
    };
  }

  async create(data: CreateIssue): Promise<Issue> {
    const mutation = `
      mutation($input: CreateIssueInput!) {
        createIssue(input: $input) {
          issue {
            id
            number
            title
            body
            state
            createdAt
            updatedAt
            assignees(first: 100) {
              nodes {
                login
              }
            }
            labels(first: 100) {
              nodes {
                name
              }
            }
            milestone {
              id
            }
          }
        }
      }
    `;

    // createIssue requires the repository node ID (e.g. 'R_kgDO...'), not the
    // configured repo name — resolve it first. Labels are passed as names
    // (e.g. 'bug', 'priority:medium'); the mutation requires label node IDs,
    // so resolve each name to its ID and skip labels that don't exist.
    const repositoryId = await this.resolveRepositoryNodeId(this.owner, this.repo);
    const labelIds = await this.resolveLabelNodeIds(data.labels);

    const response = await this.graphql<CreateIssueResponse>(mutation, {
      input: {
        repositoryId,
        title: data.title,
        body: data.description,
        assigneeIds: data.assignees,
        labelIds,
        milestoneId: data.milestoneId,
      },
    });

    return this.mapGitHubIssueToIssue(response.createIssue.issue);
  }

  async update(id: IssueId, data: Partial<Issue>): Promise<Issue> {
    // GraphQL updateIssue needs the node ID (e.g. "I_kwDO...").
    // Callers may pass a numeric string (issue number) — resolve it first.
    const nodeId = await this.resolveNodeId(id);

    const mutation = `
      mutation($input: UpdateIssueInput!) {
        updateIssue(input: $input) {
          issue {
            id
            number
            title
            body
            state
            updatedAt
            assignees(first: 100) {
              nodes {
                login
              }
            }
            labels(first: 100) {
              nodes {
                name
              }
            }
            milestone {
              id
            }
          }
        }
      }
    `;

    // updateIssue accepts labelIds (node IDs); resolve label names first
    const labelIds = await this.resolveLabelNodeIds(data.labels);

    const response = await this.graphql<UpdateIssueResponse>(mutation, {
      input: {
        id: nodeId,
        title: data.title,
        body: data.description,
        state: toStatusString(data.status || ResourceStatus.ACTIVE, 'githubIssue'),
        assigneeIds: data.assignees,
        labelIds,
        milestoneId: data.milestoneId,
      },
    });

    return this.mapGitHubIssueToIssue(response.updateIssue.issue);
  }

  async delete(id: IssueId): Promise<void> {
    await this.update(id, { status: ResourceStatus.DELETED });
  }

  /** Resolve any issue ID format to its GraphQL node ID. */
  private async resolveNodeId(id: IssueId): Promise<string> {
    const parsed = parseInt(id, 10);
    if (isNaN(parsed) || String(parsed) !== id) return id; // already a node ID
    // Numeric — look up the issue to get the node ID
    const issue = await this.findByNumber(parsed);
    if (!issue) throw new Error(`Issue not found: ${id}`);
    return issue.id;
  }

  async findById(id: IssueId): Promise<Issue | null> {
    const issueNumber = parseInt(id, 10);

    // If id is a numeric string (e.g. "42"), query by issue number.
    // If id is a node ID (e.g. "I_kwDOTxNJaM8..."), query by node ID.
    if (!isNaN(issueNumber) && String(issueNumber) === id) {
      return this.findByNumber(issueNumber);
    }
    return this.findByNodeId(id);
  }

  private async findByNumber(number: number): Promise<Issue | null> {
    const query = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            id
            number
            title
            body
            state
            createdAt
            updatedAt
            assignees(first: 100) {
              nodes {
                login
              }
            }
            labels(first: 100) {
              nodes {
                name
              }
            }
            milestone {
              id
            }
          }
        }
      }
    `;

    const response = await this.graphql<GetIssueResponse>(query, {
      owner: this.owner,
      repo: this.repo,
      number,
    });

    const issue = response.repository.issue;
    if (!issue) return null;

    return this.mapGitHubIssueToIssue(issue);
  }

  private async findByNodeId(nodeId: string): Promise<Issue | null> {
    const query = `
      query($id: ID!) {
        node(id: $id) {
          ... on Issue {
            id
            number
            title
            body
            state
            createdAt
            updatedAt
            assignees(first: 100) {
              nodes {
                login
              }
            }
            labels(first: 100) {
              nodes {
                name
              }
            }
            milestone {
              id
            }
          }
        }
      }
    `;

    const response = await this.graphql<{ node: GitHubIssue | null }>(query, { id: nodeId });
    if (!response.node) return null;

    return this.mapGitHubIssueToIssue(response.node);
  }

  async findAll(): Promise<Issue[]> {
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          issues(first: 100, orderBy: { field: CREATED_AT, direction: DESC }) {
            nodes {
              id
              number
              title
              body
              state
              createdAt
              updatedAt
              assignees(first: 100) {
                nodes {
                  login
                }
              }
              labels(first: 100) {
                nodes {
                  name
                }
              }
              milestone {
                id
              }
            }
          }
        }
      }
    `;

    const response = await this.graphql<ListIssuesResponse>(query, {
      owner: this.owner,
      repo: this.repo,
    });

    return response.repository.issues.nodes.map(issue =>
      this.mapGitHubIssueToIssue(issue)
    );
  }

  async findByMilestone(milestoneId: string): Promise<Issue[]> {
    const query = `
      query($owner: String!, $repo: String!, $milestoneId: ID!) {
        repository(owner: $owner, name: $repo) {
          issues(first: 100, filterBy: { milestoneId: $milestoneId }) {
            nodes {
              id
              number
              title
              body
              state
              createdAt
              updatedAt
              assignees(first: 100) {
                nodes {
                  login
                }
              }
              labels(first: 100) {
                nodes {
                  name
                }
              }
              milestone {
                id
              }
            }
          }
        }
      }
    `;

    const response = await this.graphql<ListIssuesResponse>(query, {
      owner: this.owner,
      repo: this.repo,
      milestoneId
    });

    return response.repository.issues.nodes.map(issue =>
      this.mapGitHubIssueToIssue(issue)
    );
  }
}
