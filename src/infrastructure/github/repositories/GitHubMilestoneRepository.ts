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

  async create(data: CreateMilestone): Promise<Milestone> {
    const mutation = `
      mutation($input: CreateMilestoneInput!) {
        createMilestone(input: $input) {
          milestone {
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

    const response = await this.graphql<CreateMilestoneResponse>(mutation, {
      input: {
        repositoryId: this.repo,
        title: data.title,
        description: data.description,
        dueOn: data.dueDate,
        // Default to "open" since status is not available in CreateMilestone
        state: "open",
      },
    });

    return this.mapGitHubMilestoneToMilestone(response.createMilestone.milestone);
  }

  async update(id: MilestoneId, data: Partial<Milestone>): Promise<Milestone> {
    const mutation = `
      mutation($input: UpdateMilestoneInput!) {
        updateMilestone(input: $input) {
          milestone {
            id
            number
            title
            description
            dueOn
            state
            updatedAt
            createdAt
          }
        }
      }
    `;

    const response = await this.graphql<UpdateMilestoneResponse>(mutation, {
      input: {
        milestoneId: id,
        title: data.title,
        description: data.description,
        dueOn: data.dueDate,
        state: data.status === ResourceStatus.CLOSED ? "closed" : "open",
      },
    });

    return this.mapGitHubMilestoneToMilestone(response.updateMilestone.milestone);
  }

  async delete(id: MilestoneId): Promise<void> {
    const mutation = `
      mutation($input: DeleteMilestoneInput!) {
        deleteMilestone(input: $input) {
          milestone {
            id
          }
        }
      }
    `;

    await this.graphql(mutation, {
      input: {
        milestoneId: id,
      },
    });
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
