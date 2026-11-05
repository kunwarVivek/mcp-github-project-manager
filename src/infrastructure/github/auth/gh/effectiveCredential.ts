import {
  createDefaultSecretResolver,
  resolveSecretWithSource,
} from "../../../secrets/SecretProvider";
import { readGitHubAppCredentials } from "../appCredentials";
import type { GitHubAuthSource } from "../GitHubAuth";
import { loadStoredOAuthAuth, readOAuthConfig } from "../oauth";
import { selectGitHubAuth } from "../selectGitHubAuth";
import type { GhTokenSource } from "./GhTokenSource";

export interface EffectiveCredential {
  readonly mode: string;
  readonly source: GitHubAuthSource;
}

/**
 * The credential the server would pick right now, using the real precedence
 * ({@link selectGitHubAuth}) over the configuration visible to `env`. The
 * `--token` flag belongs to the server process and cannot be seen from here.
 * Offline and side-effect free; yields undefined when nothing is configured.
 */
export function describeEffectiveCredential(
  env: NodeJS.ProcessEnv,
  ghSource: GhTokenSource | undefined
): EffectiveCredential | undefined {
  const resolver = createDefaultSecretResolver(env);
  try {
    const auth = selectGitHubAuth({
      hermetic: () => false,
      appCredentials: () => readGitHubAppCredentials((name) => resolver.resolve(name) || undefined),
      cliToken: () => undefined,
      configuredToken: () => {
        const found = resolveSecretWithSource("GITHUB_TOKEN", env);
        return found ? { source: found.source, read: () => found.value } : undefined;
      },
      storedOAuth: () => loadStoredOAuthAuth({ config: readOAuthConfig({}, env), warn: () => {} }),
      ghTokenSource: () => ghSource,
    });
    return { mode: auth.mode, source: auth.source };
  } catch {
    return undefined;
  }
}

/** How to stop `source` from shadowing the GitHub CLI credential. */
export function shadowAdvice(source: GitHubAuthSource): string | undefined {
  switch (source) {
    case "github-app":
      return "unset GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY / GITHUB_APP_INSTALLATION_ID";
    case "cli-flag":
      return "drop the --token flag";
    case "secrets-dir":
      return "remove the GITHUB_TOKEN file from SECRETS_DIR";
    case "env":
      return "unset GITHUB_TOKEN";
    case "oauth-store":
      return "run `mcp-github-project-manager auth logout`";
    default:
      return undefined;
  }
}
