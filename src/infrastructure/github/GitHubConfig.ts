/** Personal access token authentication. */
export interface GitHubPatAuth {
  kind: "pat";
  token: string;
}

/** GitHub App installation authentication. */
export interface GitHubAppAuth {
  kind: "app";
  appId: string | number;
  privateKey: string;
  installationId: string | number;
}

/** How the server authenticates to GitHub. */
export type GitHubAuth = GitHubPatAuth | GitHubAppAuth;

function assertAuth(auth: GitHubAuth): void {
  if (auth.kind === "pat") {
    if (!auth.token) throw new Error("Token is required");
    return;
  }
  if (!auth.appId) throw new Error("GitHub App id is required");
  if (!auth.privateKey) throw new Error("GitHub App private key is required");
  if (!auth.installationId) throw new Error("GitHub App installation id is required");
}

export class GitHubConfig {
  #owner: string;
  #repo: string;
  #auth: GitHubAuth;
  #projectId?: string;

  constructor(owner: string, repo: string, auth: GitHubAuth, projectId?: string) {
    if (!owner) throw new Error("Owner is required");
    if (!repo) throw new Error("Repository is required");
    assertAuth(auth);

    this.#owner = owner;
    this.#repo = repo;
    this.#auth = auth;
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
      // Credentials are non-enumerable on purpose: they stay out of
      // JSON.stringify, spreads, and anything else that walks own enumerable keys.
      auth: {
        get: () => this.#auth,
        enumerable: false,
        configurable: false,
      },
      token: {
        get: () => (this.#auth.kind === "pat" ? this.#auth.token : undefined),
        enumerable: false,
        configurable: false,
      },
      projectId: {
        get: () => this.#projectId,
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
    /** The credential descriptor. */
    readonly auth: GitHubAuth;
    /** The PAT, or undefined under GitHub App auth. */
    readonly token: string | undefined;
    readonly projectId?: string;
  }
}
