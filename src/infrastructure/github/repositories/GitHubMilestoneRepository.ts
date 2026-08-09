import { BaseGitHubRepository } from "./BaseRepository";
import type { Milestone, CreateMilestone, MilestoneRepository, MilestoneId, Issue } from "../../../domain/types";
import { ResourceStatus } from "../../../domain/resource-types";
import { GitHubIssueRepository } from "./GitHubIssueRepository";
import { parseResourceStatus, toStatusString } from '../../../domain/utils/StatusParser';

interface GitHubMilestone {
  id: string;
  number: number;
  title: string;
  description: string | null;
  dueOn: string | null;
  state: "open" | "closed";
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  progress: {
    enabled: boolean;
    openIssues: number;
    closedIssues: number;
    completionPercentage: number;
  };
}

interface GetMilestoneResponse {
  repository: {
    milestone: GitHubMilestone | null;
  };
}

interface ListMilestonesResponse {
  repository: {
    milestones: {
      nodes: GitHubMilestone[];
    };
  };
}

export class GitHubMilestoneRepository extends BaseGitHubRepository implements MilestoneRepository {
  private readonly factory: any;

  constructor(octokit: any, config: any) {
    super(octokit, config);
    // We need to add a factory field to the class in order to create other repositories
    this.factory = {
      createIssueRepository: () => {
        return new GitHubIssueRepository(octokit, config);
      }
    };
  }

  private mapGitHubMilestoneToMilestone(githubMilestone: GitHubMilestone): Milestone {
    return {
      id: githubMilestone.id,
      number: parseInt(githubMilestone.number.toString(), 10),
      title: githubMilestone.title,
      description: githubMilestone.description || "",
      dueDate: githubMilestone.dueOn || undefined,
      status: parseResourceStatus(githubMilestone.state, 'githubMilestone'),
      progress: {
        percent: githubMilestone.progress?.completionPercentage || 0,
        complete: githubMilestone.progress?.closedIssues || 0,
        total: (githubMilestone.progress?.openIssues || 0) + (githubMilestone.progress?.closedIssues || 0)
      },
      createdAt: githubMilestone.createdAt,
      updatedAt: githubMilestone.updatedAt,
      url: `https://github.com/${this.owner}/${this.repo}/milestone/${githubMilestone.number}`
    };
  }

  private mapRestMilestoneToMilestone(restMilestone: any): Milestone {
    return {
      id: restMilestone.node_id,
      number: restMilestone.number,
      title: restMilestone.title,
      description: restMilestone.description || "",
      dueDate: restMilestone.due_on || undefined,
      status: parseResourceStatus(restMilestone.state, 'githubMilestone'),
      progress: {
        percent: 0, // REST API doesn't provide progress info
        complete: restMilestone.closed_issues || 0,
        total: (restMilestone.open_issues || 0) + (restMilestone.closed_issues || 0)
      },
      createdAt: restMilestone.created_at,
      updatedAt: restMilestone.updated_at,
      url: `https://github.com/${this.owner}/${this.repo}/milestone/${restMilestone.number}`
    };
  }

  async create(data: CreateMilestone): Promise<Milestone> {
    // Use REST API for milestone creation since GraphQL doesn't support it
    const response = await this.rest(
      (params) => this.octokit.rest.issues.createMilestone(params),
      {
        title: data.title,
        description: data.description,
        due_on: data.dueDate,
        state: 'open'
      }
    );

    return this.mapRestMilestoneToMilestone(response);
  }

  async update(id: MilestoneId, data: Partial<Milestone>): Promise<Milestone> {
    // REST API needs milestone_number (integer). Callers may pass either a
    // numeric string ("22") or a GraphQL node ID ("MI_kwDO...").
    const milestoneNumber = await this.resolveNumber(id);

    const response = await this.rest(
      (params) => this.octokit.rest.issues.updateMilestone(params),
      {
        milestone_number: milestoneNumber,
        title: data.title,
        description: data.description,
        due_on: data.dueDate,
        state: toStatusString(data.status || ResourceStatus.ACTIVE, 'githubMilestone'),
      }
    );

    return this.mapRestMilestoneToMilestone(response);
  }

  async delete(id: MilestoneId): Promise<void> {
    const milestoneNumber = await this.resolveNumber(id);

    await this.rest(
      (params) => this.octokit.rest.issues.deleteMilestone(params),
      {
        milestone_number: milestoneNumber
      }
    );
  }

  /** Resolve any milestone ID format to its numeric milestone_number. */
  private async resolveNumber(id: MilestoneId): Promise<number> {
    const parsed = parseInt(id, 10);
    if (!isNaN(parsed) && String(parsed) === id) return parsed;
    // Node ID — look up the milestone to get its number
    const milestone = await this.findByNodeId(id);
    if (!milestone) throw new Error(`Milestone not found: ${id}`);
    return milestone.number;
  }

  async findById(id: MilestoneId): Promise<Milestone | null> {
    const milestoneNumber = parseInt(id, 10);

    // If id is a numeric string (e.g. "22"), query by milestone number.
    // If id is a node ID (e.g. "MI_kwDO..."), query by node ID.
    if (!isNaN(milestoneNumber) && String(milestoneNumber) === id) {
      return this.findByNumber(milestoneNumber);
    }
    return this.findByNodeId(id);
  }

  private async findByNumber(number: number): Promise<Milestone | null> {
    const query = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          milestone(number: $number) {
            id
            number
            title
            description
            dueOn
            state
            createdAt
            updatedAt
          }
        }
      }
    `;

    const response = await this.graphql<GetMilestoneResponse>(query, {
      owner: this.owner,
      repo: this.repo,
      number,
    });

    const milestone = response.repository.milestone;
    if (!milestone) return null;

    return this.mapGitHubMilestoneToMilestone(milestone);
  }

  private async findByNodeId(nodeId: string): Promise<Milestone | null> {
    const query = `
      query($id: ID!) {
        node(id: $id) {
          ... on Milestone {
            id
            number
            title
            description
            dueOn
            state
            createdAt
            updatedAt
          }
        }
      }
    `;

    type NodeResponse = { node: { id: string; number: number; title: string; description: string; dueOn: string; state: string; createdAt: string; updatedAt: string } | null };
    const response = await this.graphql<NodeResponse>(query, { id: nodeId });
    if (!response.node) return null;

    return this.mapGitHubMilestoneToMilestone(response.node as any);
  }

  async findAll(): Promise<Milestone[]> {
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          milestones(first: 100, orderBy: { field: CREATED_AT, direction: DESC }) {
            nodes {
              id
              number
              title
              description
              dueOn
              state
              createdAt
              updatedAt
            }
          }
        }
      }
    `;

    const response = await this.graphql<ListMilestonesResponse>(query, {
      owner: this.owner,
      repo: this.repo,
    });

    return response.repository.milestones.nodes.map(milestone => 
      this.mapGitHubMilestoneToMilestone(milestone)
    );
  }

  async findByDueDate(before: Date): Promise<Milestone[]> {
    const all = await this.findAll();
    return all.filter(milestone => {
      if (!milestone.dueDate) return false;
      return new Date(milestone.dueDate) <= before;
    });
  }

  async getOverdue(): Promise<Milestone[]> {
    return this.findByDueDate(new Date());
  }

  async getIssues(id: MilestoneId): Promise<Issue[]> {
    // We can leverage the IssueRepository's findByMilestone method
    const issueRepo = this.factory.createIssueRepository();
    return issueRepo.findByMilestone(id);
  }
}
