import { GH_HOSTNAME } from "./ghRunner";

export const USER_ENDPOINT = "https://api.github.com/user";
const SCOPE_CHECK_TIMEOUT_MS = 5_000;

/** Scopes the server needs for full functionality. */
export const REQUIRED_SCOPES = ["repo", "project"] as const;
/** Scopes that are not strictly required but unlock organization projects. */
export const RECOMMENDED_SCOPES = ["read:org"] as const;

/** A broader scope that also grants the narrower one (admin:org ⊇ write:org ⊇ read:org). */
const SATISFIED_BY: Readonly<Record<string, readonly string[]>> = {
  "read:org": ["read:org", "write:org", "admin:org"],
};

export type GhScopeInspection =
  /** A classic/OAuth token: `X-OAuth-Scopes` was reported. */
  | { readonly status: "known"; readonly login?: string; readonly scopes: readonly string[] }
  /** Fine-grained token (no `X-OAuth-Scopes` header): scopes cannot be checked. */
  | { readonly status: "unknown"; readonly login?: string }
  /** GitHub answered 401: the token is revoked or invalid. */
  | { readonly status: "rejected" }
  /** Network failure or an unexpected response. */
  | { readonly status: "unreachable" };

/**
 * Ask GitHub which scopes a token carries. Never throws and never logs the
 * token. `GET /user` returns the granted scopes in `X-OAuth-Scopes` for
 * classic and OAuth tokens only.
 */
export async function inspectTokenScopes(
  token: string,
  fetchImpl: typeof fetch = (input, init) => globalThis.fetch(input, init)
): Promise<GhScopeInspection> {
  try {
    const response = await fetchImpl(USER_ENDPOINT, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `token ${token}`,
        "user-agent": "mcp-github-project-manager",
      },
      signal: AbortSignal.timeout(SCOPE_CHECK_TIMEOUT_MS),
    });
    if (response.status === 401) return { status: "rejected" };
    if (!response.ok) return { status: "unreachable" };

    const login = await readLogin(response);
    const header = response.headers.get("x-oauth-scopes");
    if (header === null) return { status: "unknown", login };
    const scopes = header
      .split(",")
      .map((scope) => scope.trim())
      .filter((scope) => scope.length > 0);
    return { status: "known", login, scopes };
  } catch {
    return { status: "unreachable" };
  }
}

async function readLogin(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    const login = (body as { login?: unknown } | null)?.login;
    return typeof login === "string" ? login : undefined;
  } catch {
    return undefined;
  }
}

export interface ScopeGaps {
  readonly missingRequired: readonly string[];
  readonly missingRecommended: readonly string[];
}

function holds(granted: ReadonlySet<string>, scope: string): boolean {
  return (SATISFIED_BY[scope] ?? [scope]).some((candidate) => granted.has(candidate));
}

export function scopeGaps(scopes: readonly string[]): ScopeGaps {
  const granted = new Set(scopes);
  return {
    missingRequired: REQUIRED_SCOPES.filter((scope) => !holds(granted, scope)),
    missingRecommended: RECOMMENDED_SCOPES.filter((scope) => !holds(granted, scope)),
  };
}

/**
 * The command that grants `scopes` to the GitHub CLI account. `gh auth refresh`
 * only acts on the ACTIVE account, so a pinned account (GH_CLI_USER) needs a
 * `gh auth switch` first.
 */
export function ghRefreshCommand(scopes: readonly string[], pinnedUser?: string): string {
  const refresh = `gh auth refresh -h ${GH_HOSTNAME} -s ${scopes.join(",")}`;
  return pinnedUser ? `gh auth switch -h ${GH_HOSTNAME} -u ${pinnedUser} && ${refresh}` : refresh;
}
