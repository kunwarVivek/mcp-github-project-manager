import { getGitHubAppCredentials, getSecret } from "../../env";
import type { GitHubAuth } from "./GitHubConfig";

/**
 * Resolve how to authenticate to GitHub, per the documented chain:
 * a fully configured GitHub App (all three GITHUB_APP_* values) outranks the PAT;
 * a partial App configuration falls back to the PAT; with neither, throw.
 *
 * Every credential read goes through `getSecret()` / `getGitHubAppCredentials()`,
 * so `--token`, `SECRETS_DIR` files and the `gh` fallback all apply.
 */
export function resolveGitHubAuth(): GitHubAuth {
  const app = getGitHubAppCredentials();
  if (app) {
    return { kind: "app", ...app };
  }

  const token = getSecret("GITHUB_TOKEN");
  if (token) {
    return { kind: "pat", token };
  }

  throw new Error(
    "No GitHub credentials available. Provide a GitHub App (GITHUB_APP_ID, " +
      "GITHUB_APP_PRIVATE_KEY, GITHUB_APP_INSTALLATION_ID) or a token via --token, " +
      "GITHUB_TOKEN, a SECRETS_DIR-mounted file, or an authenticated `gh` CLI."
  );
}
