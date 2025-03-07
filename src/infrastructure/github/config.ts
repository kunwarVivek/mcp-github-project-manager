export class GitHubConfig {
  constructor(
    private readonly _owner: string,
    private readonly _repo: string,
    private readonly _token: string
  ) {}

  get owner(): string {
    return this._owner;
  }

  get repo(): string {
    return this._repo;
  }

  get token(): string {
    return this._token;
  }

  static create(owner: string, repo: string, token: string): GitHubConfig {
    if (!owner || !repo || !token) {
      throw new Error('GitHub configuration requires owner, repo, and token');
    }
    return new GitHubConfig(owner, repo, token);
  }

  toJSON(): { owner: string; repo: string; token: string } {
    return {
      owner: this.owner,
      repo: this.repo,
      token: this.token,
    };
  }
}