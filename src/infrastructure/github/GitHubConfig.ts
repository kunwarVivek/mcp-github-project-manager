export class GitHubConfig {
  #owner: string;
  #repo: string;
  #projectId?: string;

  constructor(owner: string, repo: string, projectId?: string) {
    if (!owner) throw new Error("Owner is required");
    if (!repo) throw new Error("Repository is required");

    this.#owner = owner;
    this.#repo = repo;
    this.#projectId = projectId;

    // Make properties read-only but accessible
    Object.defineProperties(this, {
      owner: {
        get: () => this.#owner,
        enumerable: true,
        configurable: false,
      },
      repo: {
        get: () => this.#repo,
        enumerable: true,
        configurable: false,
      },
      projectId: {
        get: () => this.#projectId,
        enumerable: true,
        configurable: false,
      },
    });
  }

  static create(owner: string, repo: string, projectId?: string): GitHubConfig {
    return new GitHubConfig(owner, repo, projectId);
  }
}

// Add type declarations for the getters
declare module "./GitHubConfig" {
  interface GitHubConfig {
    readonly owner: string;
    readonly repo: string;
    readonly projectId?: string;
  }
}
