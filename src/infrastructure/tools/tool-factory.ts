import { GitHubRepositoryFactory } from "../github/GitHubRepositoryFactory";

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

function requireToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }
  return token;
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
  return new GitHubRepositoryFactory(
    requireToken(),
    owner || process.env.GITHUB_OWNER || UNUSED_REPO_CONTEXT,
    repo || process.env.GITHUB_REPO || UNUSED_REPO_CONTEXT,
  );
}
