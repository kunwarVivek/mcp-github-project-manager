import {
  type ConfiguredGitHubToken,
  getCliGitHubToken,
  getConfiguredGitHubToken,
  getGhCliGitHubToken,
  getGitHubAppCredentials,
} from "../../../env";
import {
  createAppInstallationAuth,
  createTokenAuth,
  type GitHubAppCredentials,
} from "./credentials";
import { type GitHubAuth, GitHubAuthUnavailableError } from "./GitHubAuth";
import { loadStoredOAuthAuth } from "./oauth";

/**
 * Every place a GitHub credential can come from. Injectable so the precedence
 * rules can be exercised without touching the process environment; the default
 * reads the live configuration on each call.
 */
export interface GitHubAuthSources {
  /** True when the hermetic unit-test credential must be used. */
  hermetic(): boolean;
  appCredentials(): GitHubAppCredentials | undefined;
  cliToken(): string | undefined;
  configuredToken(): ConfiguredGitHubToken | undefined;
  storedOAuth(): GitHubAuth | undefined;
  ghCliToken(): string | undefined;
}

const defaultSources: GitHubAuthSources = {
  // Under NODE_ENV=test no real credential is ever consulted, unless a live
  // E2E run opts in explicitly with E2E_REAL_API=true.
  hermetic: () => process.env.NODE_ENV === "test" && process.env.E2E_REAL_API !== "true",
  appCredentials: getGitHubAppCredentials,
  cliToken: getCliGitHubToken,
  configuredToken: getConfiguredGitHubToken,
  storedOAuth: () => loadStoredOAuthAuth(),
  ghCliToken: getGhCliGitHubToken,
};

/**
 * Resolve the GitHub credential. Precedence, highest first:
 *
 * 1. GitHub App installation (all of GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY /
 *    GITHUB_APP_INSTALLATION_ID; a partial configuration falls through)
 * 2. `--token` CLI flag
 * 3. `$SECRETS_DIR/GITHUB_TOKEN`
 * 4. `GITHUB_TOKEN` environment variable
 * 5. OAuth token stored by `auth login`
 * 6. `gh auth token`
 *
 * Resolution reads the live configuration, so call it per use (not once at
 * boot) to observe rotated tokens and a login performed after start.
 *
 * @throws GitHubAuthUnavailableError when no source yields a credential.
 */
export function resolveGitHubAuth(sources: GitHubAuthSources = defaultSources): GitHubAuth {
  if (sources.hermetic()) {
    return createTokenAuth(() => "test-token", "test");
  }

  const app = sources.appCredentials();
  if (app) return createAppInstallationAuth(app);

  const cliToken = sources.cliToken();
  if (cliToken) return createTokenAuth(() => cliToken, "cli-flag");

  const configured = sources.configuredToken();
  if (configured) return createTokenAuth(configured.read, configured.source);

  const stored = sources.storedOAuth();
  if (stored) return stored;

  const ghToken = sources.ghCliToken();
  if (ghToken) return createTokenAuth(() => ghToken, "gh-cli");

  throw new GitHubAuthUnavailableError();
}
