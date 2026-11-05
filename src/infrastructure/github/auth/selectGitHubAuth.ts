import {
  createAppInstallationAuth,
  createTokenAuth,
  type GitHubAppCredentials,
} from "./credentials";
import { type GitHubAuth, GitHubAuthUnavailableError } from "./GitHubAuth";
import type { GhTokenSource } from "./gh/GhTokenSource";

/** A token pinned to the tier that supplied it (`SECRETS_DIR` file or env var). */
export interface ConfiguredGitHubToken {
  source: "secrets-dir" | "env";
  /** Re-reads the same tier; undefined once that tier no longer has a token. */
  read(): string | undefined;
}

/**
 * Every place a GitHub credential can come from. Injectable so the precedence
 * rules can be exercised without touching the process environment.
 */
export interface GitHubAuthSources {
  /** True when the hermetic unit-test credential must be used. */
  hermetic(): boolean;
  appCredentials(): GitHubAppCredentials | undefined;
  cliToken(): string | undefined;
  configuredToken(): ConfiguredGitHubToken | undefined;
  storedOAuth(): GitHubAuth | undefined;
  /** The GitHub CLI token source, or undefined when the gh tier is disabled. */
  ghTokenSource(): GhTokenSource | undefined;
}

/**
 * Pick the credential from `sources`. Precedence, highest first:
 *
 * 1. GitHub App installation (all of GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY /
 *    GITHUB_APP_INSTALLATION_ID; a partial configuration falls through)
 * 2. `--token` CLI flag
 * 3. `$SECRETS_DIR/GITHUB_TOKEN`
 * 4. `GITHUB_TOKEN` environment variable
 * 5. OAuth token stored by `auth login`
 * 6. `gh auth token` (re-read every 60 s; re-read at once on a 401)
 *
 * This module never imports `src/env.ts`, so the `auth` CLI can reuse the exact
 * server precedence without the server's import-time configuration checks.
 *
 * @throws GitHubAuthUnavailableError when no source yields a credential.
 */
export function selectGitHubAuth(sources: GitHubAuthSources): GitHubAuth {
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

  const gh = sources.ghTokenSource();
  if (gh?.current()) {
    return createTokenAuth(() => gh.current(), "gh-cli", { refresh: () => gh.refresh() });
  }

  throw new GitHubAuthUnavailableError();
}
