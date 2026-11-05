import { GH_HOSTNAME, type GhRunner, systemGhRunner } from "./ghRunner";

/** How long a `gh auth token` result (success or failure) is reused. */
export const GH_TOKEN_TTL_MS = 60_000;

/**
 * A forced re-read (after a 401) is skipped when the cached read is younger
 * than this, so a burst of concurrent 401s cannot spawn a `gh` per request.
 */
const FORCED_REREAD_MIN_AGE_MS = 1_000;

/** GitHub logins: alphanumerics and single hyphens. Also keeps a value from reading as a flag. */
const LOGIN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

export type GhTokenRead =
  | { readonly status: "ok"; readonly token: string }
  | { readonly status: "missing" }
  | { readonly status: "unavailable" }
  | { readonly status: "invalid-user" };

export interface GhTokenSourceOptions {
  readonly runner?: GhRunner;
  /** The pinned gh account (GH_CLI_USER), read on every use. */
  readonly user?: () => string | undefined;
  readonly now?: () => number;
  readonly ttlMs?: number;
}

interface CacheEntry {
  readonly user: string | undefined;
  readonly at: number;
  readonly read: GhTokenRead;
}

/**
 * The token of an authenticated GitHub CLI, kept fresh.
 *
 * `gh auth token` is re-run once the cached result is older than the TTL, so a
 * `gh auth refresh` / `gh auth switch` / re-login is picked up without
 * restarting the server. Failures are cached for the same window (so a missing
 * `gh` is not spawned per request) and retried on the next one.
 */
export class GhTokenSource {
  private readonly runner: GhRunner;
  private readonly userSupplier: () => string | undefined;
  private readonly now: () => number;
  private readonly ttlMs: number;
  private cache: CacheEntry | undefined;

  constructor(options: GhTokenSourceOptions = {}) {
    this.runner = options.runner ?? systemGhRunner;
    this.userSupplier = options.user ?? (() => undefined);
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? GH_TOKEN_TTL_MS;
  }

  /** The gh account pinned through GH_CLI_USER, if any. */
  pinnedUser(): string | undefined {
    const user = this.userSupplier()?.trim();
    return user ? user : undefined;
  }

  /** The current token, reusing the cached read inside the TTL window. */
  current(): string | undefined {
    const read = this.cachedRead(false);
    return read.status === "ok" ? read.token : undefined;
  }

  /** Drop the cache and re-read now (see the minimum age note above). */
  refresh(): string | undefined {
    const read = this.cachedRead(true);
    return read.status === "ok" ? read.token : undefined;
  }

  /** Always re-reads, reporting why a token is unavailable. For `auth status` / `auth login`. */
  inspect(): GhTokenRead {
    return this.cachedRead(true, true);
  }

  invalidate(): void {
    this.cache = undefined;
  }

  private cachedRead(force: boolean, ignoreMinAge = false): GhTokenRead {
    const user = this.pinnedUser();
    const cached = this.cache;
    if (cached && cached.user === user) {
      const age = this.now() - cached.at;
      const reusable = force ? !ignoreMinAge && age < FORCED_REREAD_MIN_AGE_MS : age < this.ttlMs;
      if (reusable) return cached.read;
    }
    const read = this.readToken(user);
    this.cache = { user, at: this.now(), read };
    return read;
  }

  private readToken(user: string | undefined): GhTokenRead {
    if (user !== undefined && !LOGIN_PATTERN.test(user)) {
      return { status: "invalid-user" };
    }
    const args = ["auth", "token", "--hostname", GH_HOSTNAME];
    if (user !== undefined) args.push("--user", user);
    const result = this.runner.capture(args);
    if (result.status === "missing") return { status: "missing" };
    if (result.status !== "ok") return { status: "unavailable" };
    const token = result.stdout.trim();
    return token.length > 0 ? { status: "ok", token } : { status: "unavailable" };
  }
}
