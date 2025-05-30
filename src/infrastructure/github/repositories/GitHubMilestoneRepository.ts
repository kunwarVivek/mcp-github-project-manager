import { BaseGitHubRepository } from "./BaseRepository";
import { Milestone, CreateMilestone, MilestoneRepository, MilestoneId, Issue } from "../../../domain/types";
import { ResourceType, ResourceStatus } from "../../../domain/resource-types";
import { GitHubIssueRepository } from "./GitHubIssueRepository";

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

interface CreateMilestoneResponse {
  createMilestone: {
    milestone: GitHubMilestone;
  };
}

interface UpdateMilestoneResponse {
  updateMilestone: {
    milestone: GitHubMilestone;
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
      number: parseInt(githubMilestone.number.toString()),
      title: githubMilestone.title,
      description: githubMilestone.description || "",
      dueDate: githubMilestone.dueOn || undefined,
      status: githubMilestone.state === "open" ? ResourceStatus.ACTIVE : ResourceStatus.CLOSED,
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
      status: restMilestone.state === "open" ? ResourceStatus.ACTIVE : ResourceStatus.CLOSED,
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
    // Use REST API for milestone updates since GraphQL doesn't support it
    const response = await this.rest(
      (params) => this.octokit.rest.issues.updateMilestone(params),
      {
        milestone_number: parseInt(id),
        title: data.title,
        description: data.description,
        due_on: data.dueDate,
        state: data.status === ResourceStatus.CLOSED ? "closed" : "open",
      }
    );

    return this.mapRestMilestoneToMilestone(response);
  }

  async delete(id: MilestoneId): Promise<void> {
    // Use REST API for milestone deletion since GraphQL doesn't support it
    await this.rest(
      (params) => this.octokit.rest.issues.deleteMilestone(params),
      {
        milestone_number: parseInt(id)
      }
    );
  }

  async findById(id: MilestoneId): Promise<Milestone | null> {
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
      number: parseInt(id),
    });

    const milestone = response.repository.milestone;
    if (!milestone) return null;

    return this.mapGitHubMilestoneToMilestone(milestone);
  }

  async findAll(): Promise<Milestone[]> {
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          milestones(first: 100) {
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
