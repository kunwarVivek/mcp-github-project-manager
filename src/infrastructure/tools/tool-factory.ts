import { GitHubRepositoryFactory } from "../github/GitHubRepositoryFactory";
import { getSecret, getGitHubAppCredentials } from "../../env";

/**
 * Sentinel owner/repo used only when neither an explicit value nor the
 * configured GITHUB_OWNER/GITHUB_REPO env vars are available. Many project
 * tools operate purely on GitHub *project node IDs* and never resolve a
 * repository, so owner/repo are irrelevant for those calls — but the factory
 * constructor still requires them. Centralizing this here removes the
 * "placeholder" literal that was duplicated across five tool modules and makes
 * the intent explicit.
 */
const UNUSED_REPO_CONTEXT = "placeholder";

/**
 * Resolve the GitHub token through the full credential chain
 * (CLI flag -> SECRETS_DIR file -> env var -> `gh auth token`).
 *
 * This used to read `process.env.GITHUB_TOKEN` directly, which meant a token
 * supplied by any mechanism other than an environment variable never reached
 * the tool layer at all.
 *
 * Exported so the handful of tool modules that build their own Octokit share
 * one accessor rather than re-reading the environment.
 */
export function requireToken(): string {
  const token = getSecret("GITHUB_TOKEN");
  if (!token) {
    throw new Error(
      "No GitHub token available. Provide one via --token, GITHUB_TOKEN, " +
        "a SECRETS_DIR-mounted file, or an authenticated `gh` CLI.",
    );
  }
  return token;
}

/** Resolve the configured repository owner, or undefined when unset. */
export function resolveOwner(): string | undefined {
  return getSecret("GITHUB_OWNER");
}

/** Resolve the configured repository name, or undefined when unset. */
export function resolveRepo(): string | undefined {
  return getSecret("GITHUB_REPO");
}

/**
 * Create a GitHubRepositoryFactory for MCP tool handlers.
 *
 * - Repository/team-scoped operations pass an explicit owner/repo.
 * - Project-ID-scoped operations (lifecycle, status updates, advanced item ops,
 *   linking by project ID) call with no arguments; owner/repo fall back to the
 *   configured env vars, or the sentinel when unset.
 *
 * @param owner Explicit repository owner (optional).
 * @param repo  Explicit repository name (optional).
 */
export function createGitHubFactory(owner?: string, repo?: string): GitHubRepositoryFactory {
  // A fully configured GitHub App outranks the PAT. When the App is configured
  // the token is unused, so an App-only deployment needs no PAT at all.
  const app = getGitHubAppCredentials();
  return new GitHubRepositoryFactory(
    app ? "" : requireToken(),
    owner || resolveOwner() || UNUSED_REPO_CONTEXT,
    repo || resolveRepo() || UNUSED_REPO_CONTEXT,
    app ? { app } : {},
  );
}
