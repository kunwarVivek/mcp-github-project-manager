import type { GitHubAppCredentials } from "./credentials";

/**
 * GitHub App credentials from `read`, or undefined when the App is not fully
 * configured. All three values are required — a partial configuration falls
 * back to a token rather than failing, so a half-set env cannot lock the
 * server out.
 */
export function readGitHubAppCredentials(
  read: (name: string) => string | undefined
): GitHubAppCredentials | undefined {
  const appId = read("GITHUB_APP_ID");
  const privateKey = read("GITHUB_APP_PRIVATE_KEY");
  const installationId = read("GITHUB_APP_INSTALLATION_ID");
  if (!appId || !privateKey || !installationId) return undefined;
  // Private keys are commonly supplied with literal \n escapes in env vars.
  return { appId, privateKey: privateKey.replace(/\\n/g, "\n"), installationId };
}
