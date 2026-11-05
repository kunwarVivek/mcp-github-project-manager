import type { ILogger } from "../../../logger";
import type { GhTokenSource } from "./GhTokenSource";
import { ghRefreshCommand, inspectTokenScopes, scopeGaps } from "./ghScopes";

export interface GhScopeWarningOptions {
  readonly tokenSource: GhTokenSource;
  readonly logger: Pick<ILogger, "warn" | "debug">;
  readonly fetch?: typeof fetch;
}

/**
 * One-shot startup check for a gh-sourced credential: warns, once, when the
 * token lacks a required scope. Asynchronous and best-effort — a network
 * failure or a fine-grained token (scopes unknowable) only produces a debug
 * line. Never throws, never blocks startup, never logs token characters.
 */
export async function warnOnMissingGhScopes(options: GhScopeWarningOptions): Promise<void> {
  const { tokenSource, logger } = options;
  try {
    const token = tokenSource.current();
    if (!token) return;
    const inspection = await inspectTokenScopes(token, options.fetch);
    if (inspection.status !== "known") {
      logger.debug(`GitHub CLI token scope check skipped (${inspection.status})`);
      return;
    }
    const { missingRequired } = scopeGaps(inspection.scopes);
    if (missingRequired.length === 0) return;
    const pinned = tokenSource.pinnedUser();
    const account = inspection.login ?? pinned ?? "the active account";
    logger.warn(
      `The GitHub CLI token for ${account} is missing the ${missingRequired
        .map((scope) => `"${scope}"`)
        .join(", ")} scope; the related GitHub operations will fail. ` +
        `Fix: ${ghRefreshCommand(missingRequired, pinned)}`
    );
  } catch (error) {
    logger.debug(
      `GitHub CLI token scope check failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
