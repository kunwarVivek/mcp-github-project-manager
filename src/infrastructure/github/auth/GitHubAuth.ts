import type { Octokit } from "@octokit/rest";

type OctokitOptions = NonNullable<ConstructorParameters<typeof Octokit>[0]>;

/** The `authStrategy` / `auth` pair handed to `new Octokit(...)`. */
export type GitHubOctokitAuth = Pick<OctokitOptions, "authStrategy" | "auth">;

/**
 * How the server authenticates to GitHub.
 *
 * - `app-installation`: GitHub App installation token, minted and refreshed by
 *   `@octokit/auth-app`.
 * - `token`: a static bearer token (PAT or `gh auth token`).
 * - `oauth-user`: a user token obtained through `auth login` (OAuth device
 *   flow), refreshed automatically when GitHub issued a refresh token.
 */
export type GitHubAuthMode = "app-installation" | "token" | "oauth-user";

/** Where the credential came from. Never contains secret material. */
export type GitHubAuthSource =
  | "github-app"
  | "cli-flag"
  | "secrets-dir"
  | "env"
  | "oauth-store"
  | "gh-cli"
  | "test";

/**
 * A resolved GitHub credential. This is the single seam every Octokit
 * construction goes through; nothing outside the auth module handles a raw
 * token string.
 */
export interface GitHubAuth {
  readonly mode: GitHubAuthMode;
  readonly source: GitHubAuthSource;
  /** Options for `new Octokit(...)`. Strategies refresh tokens themselves. */
  octokitAuth(): GitHubOctokitAuth;
  /**
   * A currently valid bearer token, for the few non-Octokit HTTP calls.
   * Async because OAuth and App tokens may need refreshing first.
   */
  getToken(): Promise<string>;
}

/** Thrown when no credential source yields a usable GitHub credential. */
export class GitHubAuthUnavailableError extends Error {
  constructor(detail?: string) {
    super(
      "No GitHub credential available. Provide one via a GitHub App " +
        "(GITHUB_APP_ID/GITHUB_APP_PRIVATE_KEY/GITHUB_APP_INSTALLATION_ID), --token, " +
        "a SECRETS_DIR-mounted GITHUB_TOKEN, the GITHUB_TOKEN env var, " +
        "`mcp-github-project-manager auth login`, or an authenticated `gh` CLI." +
        (detail ? ` ${detail}` : "")
    );
    this.name = "GitHubAuthUnavailableError";
  }
}
