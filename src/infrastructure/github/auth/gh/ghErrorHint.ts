import type { GitHubAuthSource } from "../GitHubAuth";
import { ghRefreshCommand } from "./ghScopes";

const SCOPE_ERROR_MARKERS = [
  "insufficient_scopes",
  "required scopes",
  "required scope",
  "resource not accessible",
  "requires one of the following scopes",
  "requires the following scopes",
  "oauth scope",
] as const;

function collectText(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  const parts: string[] = [];
  const { message, errors, response } = error as {
    message?: unknown;
    errors?: unknown;
    response?: { data?: { message?: unknown; errors?: unknown } };
  };
  if (typeof message === "string") parts.push(message);
  if (typeof response?.data?.message === "string") parts.push(response.data.message);
  for (const list of [errors, response?.data?.errors]) {
    if (Array.isArray(list)) {
      for (const entry of list) {
        if (typeof entry === "string") parts.push(entry);
        else if (typeof entry === "object" && entry !== null) {
          const { type, message: entryMessage } = entry as { type?: unknown; message?: unknown };
          if (typeof type === "string") parts.push(type);
          if (typeof entryMessage === "string") parts.push(entryMessage);
        }
      }
    }
  }
  return parts.join(" ").toLowerCase();
}

/** Whether a GitHub error was caused by the token lacking an OAuth scope. */
export function isInsufficientScopeError(error: unknown): boolean {
  const text = collectText(error);
  return SCOPE_ERROR_MARKERS.some((marker) => text.includes(marker));
}

export interface GhCredentialContext {
  readonly source: GitHubAuthSource | undefined;
  readonly pinnedUser?: string;
}

/**
 * The fix-it hint appended to a tool error, or undefined. Only a credential
 * that came from the GitHub CLI gets one: for any other source the scopes are
 * not something `gh` can fix.
 */
export function ghScopeErrorHint(
  error: unknown,
  credential: () => GhCredentialContext
): string | undefined {
  if (!isInsufficientScopeError(error)) return undefined;
  const { source, pinnedUser } = credential();
  if (source !== "gh-cli") return undefined;
  return `The credential is the GitHub CLI token and may lack a required scope. Fix: ${ghRefreshCommand(["project"], pinnedUser)} (then retry; the server re-reads the token automatically).`;
}
