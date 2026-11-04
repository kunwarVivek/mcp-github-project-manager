import type { FetchLike } from "./deviceFlow";

export type RevokeOutcome =
  | { readonly outcome: "revoked" }
  | { readonly outcome: "failed"; readonly reason: string };

/** Where a user can revoke the app's access by hand. */
export function manualRevocationUrl(clientId: string): string {
  return `https://github.com/settings/connections/applications/${clientId}`;
}

/**
 * Revokes one access token: `DELETE /applications/{client_id}/token`, which GitHub
 * only accepts with HTTP Basic client_id:client_secret. A 404 means the token is
 * already invalid, which is the goal state.
 * https://docs.github.com/en/rest/apps/oauth-applications#delete-an-app-token
 */
export async function revokeAccessToken(
  fetchImpl: FetchLike,
  credentials: { clientId: string; clientSecret: string },
  accessToken: string
): Promise<RevokeOutcome> {
  const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString(
    "base64"
  );
  try {
    const response = await fetchImpl(
      `https://api.github.com/applications/${encodeURIComponent(credentials.clientId)}/token`,
      {
        method: "DELETE",
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Basic ${basic}`,
          "content-type": "application/json",
          "user-agent": "mcp-github-project-manager",
        },
        body: JSON.stringify({ access_token: accessToken }),
      }
    );
    if (response.status === 204 || response.status === 404) return { outcome: "revoked" };
    return { outcome: "failed", reason: `GitHub answered HTTP ${response.status}` };
  } catch (error) {
    return { outcome: "failed", reason: error instanceof Error ? error.message : String(error) };
  }
}
