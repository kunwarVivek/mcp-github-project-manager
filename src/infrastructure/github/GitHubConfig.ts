export class GitHubConfig {
  #owner: string;
  #repo: string;
  #token: string;

  constructor(owner: string, repo: string, token: string) {
    if (!owner) throw new Error("Owner is required");
    if (!repo) throw new Error("Repository is required");
    if (!token) throw new Error("Token is required");

    this.#owner = owner;
    this.#repo = repo;
    this.#token = token;

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
      token: {
        get: () => this.#token,
        enumerable: true,
        configurable: false,
      },
    });
  }
}

// Add type declarations for the getters
declare module "./GitHubConfig" {
  interface GitHubConfig {
    readonly owner: string;
    readonly repo: string;
    readonly token: string;
  }
}
