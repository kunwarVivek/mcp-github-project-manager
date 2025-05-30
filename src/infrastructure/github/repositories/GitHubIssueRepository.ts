import { BaseGitHubRepository } from "./BaseRepository";
import { Issue, CreateIssue, IssueRepository, IssueId } from "../../../domain/types";
import { ResourceType, ResourceStatus } from "../../../domain/resource-types";

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
      number: parseInt(githubIssue.number.toString()),
      title: githubIssue.title,
      description: githubIssue.body || "",
      status: githubIssue.state === "OPEN" ? ResourceStatus.ACTIVE : ResourceStatus.CLOSED,
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

    const response = await this.graphql<CreateIssueResponse>(mutation, {
      input: {
        repositoryId: this.repo,
        title: data.title,
        body: data.description,
        assigneeIds: data.assignees,
        labelIds: data.labels,
        milestoneId: data.milestoneId,
      },
    });

    return this.mapGitHubIssueToIssue(response.createIssue.issue);
  }

  async update(id: IssueId, data: Partial<Issue>): Promise<Issue> {
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

    const response = await this.graphql<UpdateIssueResponse>(mutation, {
      input: {
        id,
        title: data.title,
        body: data.description,
        state: data.status === ResourceStatus.CLOSED ? "CLOSED" : "OPEN",
        assigneeIds: data.assignees,
        labelIds: data.labels,
        milestoneId: data.milestoneId,
      },
    });

    return this.mapGitHubIssueToIssue(response.updateIssue.issue);
  }

  async delete(id: IssueId): Promise<void> {
    await this.update(id, { status: ResourceStatus.DELETED });
  }

  async findById(id: IssueId): Promise<Issue | null> {
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
      number: parseInt(id),
    });

    const issue = response.repository.issue;
    if (!issue) return null;

    return this.mapGitHubIssueToIssue(issue);
  }

  async findAll(): Promise<Issue[]> {
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          issues(first: 100) {
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
