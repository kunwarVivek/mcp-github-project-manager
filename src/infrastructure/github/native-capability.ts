/**
 * Detection of a deployment that does not expose a native GitHub capability.
 *
 * GitHub's native issue edges (`Issue.blockedBy` / `Issue.blocking`), the
 * native issue types (`Issue.issueType`) and their mutations are not
 * available on every deployment — older GitHub Enterprise Server instances
 * and some API versions do not know the fields at all. GraphQL answers such
 * a request with a *validation* error ("Field 'blockedBy' doesn't exist on
 * type 'Issue'") instead of a result, so the platform can detect it and fall
 * back to its label emulation (`blocked-by:#123`, `type:bug`).
 *
 * Only schema errors are treated as "the capability is missing". Every other
 * failure (auth, rate limit, network) is a real error and must surface.
 */

/** The GraphQL wording GitHub uses for a field the schema does not know. */
const MISSING_CAPABILITY_PATTERNS = [
  /doesn't exist on type/i,
  /does not exist on type/i,
  /cannot query field/i,
  /unknown field/i,
  /unknown mutation/i,
  /is not defined by type/i,
  /no longer available/i,
];

/** Collect every message an error carries, wherever it hides. */
function collectMessages(error: unknown): string[] {
  const messages: string[] = [];

  if (error instanceof Error && error.message) {
    messages.push(error.message);
  }

  if (error && typeof error === "object") {
    const candidate = error as {
      errors?: Array<{ message?: string }>;
      response?: { data?: { errors?: Array<{ message?: string }> } };
    };

    for (const entry of candidate.errors ?? []) {
      if (entry?.message) messages.push(entry.message);
    }
    for (const entry of candidate.response?.data?.errors ?? []) {
      if (entry?.message) messages.push(entry.message);
    }
  }

  return messages;
}

/**
 * Whether the error means "this deployment does not have the native field".
 */
export function isMissingNativeCapability(error: unknown): boolean {
  const messages = collectMessages(error);
  if (messages.length === 0) return false;
  return messages.some((message) =>
    MISSING_CAPABILITY_PATTERNS.some((pattern) => pattern.test(message))
  );
}
