import {
  getCliGitHubToken,
  getConfiguredGitHubToken,
  getGhCliTokenSource,
  getGitHubAppCredentials,
} from "../../../env";
import type { GitHubAuth } from "./GitHubAuth";
import { loadStoredOAuthAuth } from "./oauth";
import { type GitHubAuthSources, selectGitHubAuth } from "./selectGitHubAuth";

export type { ConfiguredGitHubToken, GitHubAuthSources } from "./selectGitHubAuth";

const defaultSources: GitHubAuthSources = {
  // Under NODE_ENV=test no real credential is ever consulted, unless a live
  // E2E run opts in explicitly with E2E_REAL_API=true.
  hermetic: () => process.env.NODE_ENV === "test" && process.env.E2E_REAL_API !== "true",
  appCredentials: getGitHubAppCredentials,
  cliToken: getCliGitHubToken,
  configuredToken: getConfiguredGitHubToken,
  storedOAuth: () => loadStoredOAuthAuth(),
  ghTokenSource: getGhCliTokenSource,
};

/**
 * Resolve the GitHub credential from the live configuration. Precedence is
 * documented on {@link selectGitHubAuth}.
 *
 * Resolution reads the live configuration, so call it per use (not once at
 * boot) to observe rotated tokens and a login performed after start.
 *
 * @throws GitHubAuthUnavailableError when no source yields a credential.
 */
export function resolveGitHubAuth(sources: GitHubAuthSources = defaultSources): GitHubAuth {
  return selectGitHubAuth(sources);
}
