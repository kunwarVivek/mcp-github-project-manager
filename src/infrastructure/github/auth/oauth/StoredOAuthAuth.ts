import { createOAuthUserAuth } from "@octokit/auth-oauth-user";
import { Octokit } from "@octokit/rest";
import type { EndpointOptions, RequestInterface } from "@octokit/types";
import { redactSecretPatterns } from "../../../logger/redaction";
import type { GitHubAuth, GitHubOctokitAuth } from "../GitHubAuth";
import type { FetchLike } from "./deviceFlow";
import { OAuthTokenStore, type StoredOAuthToken } from "./OAuthTokenStore";
import { type OAuthConfig, readOAuthConfig } from "./oauthConfig";

/** Refresh this long before expiry so a token never lapses mid-request. */
const REFRESH_SKEW_MS = 60_000;
const LOGIN_COMMAND = "mcp-github-project-manager auth login";
const REFRESH_REJECTED_STATUSES = new Set([400, 401, 403]);

/** The stored token can no longer be used and only a new login fixes it. */
export class OAuthLoginRequiredError extends Error {
  constructor(reason: string, options?: ErrorOptions) {
    super(
      `GitHub OAuth token unusable: ${reason}. Run \`${LOGIN_COMMAND}\` to sign in again.`,
      options
    );
    this.name = "OAuthLoginRequiredError";
  }
}

/** Why a stored token is, or is not, usable. Never carries token material. */
export type OAuthStoreState =
  | { readonly state: "ready"; readonly stored: StoredOAuthToken }
  | { readonly state: "absent" }
  | { readonly state: "no-client-id" }
  | { readonly state: "client-id-mismatch"; readonly storedClientId: string }
  | { readonly state: "insecure-permissions"; readonly mode: number }
  | { readonly state: "corrupt"; readonly reason: string };

export function inspectOAuthStore(store: OAuthTokenStore, config: OAuthConfig): OAuthStoreState {
  const result = store.read();
  switch (result.status) {
    case "absent":
      return { state: "absent" };
    case "insecure-permissions":
      return { state: "insecure-permissions", mode: result.mode };
    case "corrupt":
      return { state: "corrupt", reason: result.reason };
    case "ok":
      if (!config.clientId) return { state: "no-client-id" };
      if (result.token.clientId !== config.clientId) {
        return { state: "client-id-mismatch", storedClientId: result.token.clientId };
      }
      return { state: "ready", stored: result.token };
  }
}

/** A one-line, secret-free explanation for states that make the store unusable. */
export function describeUnusableState(state: OAuthStoreState, path: string): string | undefined {
  switch (state.state) {
    case "insecure-permissions":
      return `OAuth token file ${path} is accessible by group/other (mode ${state.mode.toString(8).padStart(3, "0")}); ignoring it. Run chmod 600 on it or \`${LOGIN_COMMAND}\` again.`;
    case "corrupt":
      return `OAuth token file ${path} is invalid (${state.reason}); ignoring it. Run \`${LOGIN_COMMAND}\` again.`;
    case "client-id-mismatch":
      return `OAuth token file ${path} belongs to a different client id than GITHUB_OAUTH_CLIENT_ID; ignoring it. Run \`${LOGIN_COMMAND}\` to sign in with the configured app.`;
    default:
      return undefined;
  }
}

/**
 * The refresh endpoint rejects an empty `client_secret`, but device-flow tokens
 * must be refreshed WITHOUT one. The library always sends the field, so strip
 * it when no secret is configured.
 * https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens
 */
function omitEmptyClientSecret(base: FetchLike | undefined): FetchLike {
  return (input, init) => {
    const target = base ?? globalThis.fetch;
    if (typeof init?.body === "string" && String(input).endsWith("/login/oauth/access_token")) {
      const body: unknown = JSON.parse(init.body);
      if (typeof body === "object" && body !== null && "client_secret" in body) {
        if (body.client_secret === "") {
          const { client_secret: _omitted, ...rest } = body;
          return target(input, { ...init, body: JSON.stringify(rest) });
        }
      }
    }
    return target(input, init);
  };
}

export interface StoredOAuthAuthDeps {
  readonly store: OAuthTokenStore;
  readonly config: OAuthConfig;
  readonly fetch?: FetchLike;
  readonly now?: () => number;
  /** Receives non-fatal, secret-free diagnostics. Defaults to stderr. */
  readonly warn?: (message: string) => void;
}

function defaultWarn(message: string): void {
  process.stderr.write(`[oauth] ${redactSecretPatterns(message)}\n`);
}

/**
 * GitHub credential backed by the token `auth login` stored on disk.
 *
 * One instance owns the token for the whole process: refreshes are single-flight
 * and every refreshed token is written back immediately. That matters because a
 * refresh token is single-use — if two Octokit clients each refreshed with the
 * same one, the loser would be locked out.
 */
export class StoredOAuthAuth implements GitHubAuth {
  readonly mode = "oauth-user" as const;
  readonly source = "oauth-store" as const;

  private current: StoredOAuthToken;
  private inflight: Promise<string> | undefined;
  private readonly now: () => number;
  private readonly warn: (message: string) => void;
  private readonly refreshRequest: RequestInterface;

  constructor(
    initial: StoredOAuthToken,
    private readonly deps: StoredOAuthAuthDeps
  ) {
    this.current = initial;
    this.now = deps.now ?? Date.now;
    this.warn = deps.warn ?? defaultWarn;
    this.refreshRequest = new Octokit({
      request: { fetch: omitEmptyClientSecret(deps.fetch) },
    }).request;
  }

  octokitAuth(): GitHubOctokitAuth {
    // Octokit wraps `request` with `hook`, calling it as (request, endpointOptions).
    const authStrategy = () => {
      const auth = async () => ({
        type: "token",
        tokenType: "oauth",
        token: await this.getToken(),
      });
      const hook = async (request: RequestInterface, options: EndpointOptions) => {
        const endpoint = request.endpoint.merge(options);
        endpoint.headers.authorization = `token ${await this.getToken()}`;
        return request(endpoint);
      };
      return Object.assign(auth, { hook });
    };
    return { authStrategy };
  }

  getToken(): Promise<string> {
    // Single-flight: concurrent callers share one refresh round-trip.
    this.inflight ??= this.resolveToken().finally(() => {
      this.inflight = undefined;
    });
    return this.inflight;
  }

  private isDue(): boolean {
    const { expiresAt } = this.current;
    return expiresAt !== undefined && Date.parse(expiresAt) - this.now() <= REFRESH_SKEW_MS;
  }

  private async resolveToken(): Promise<string> {
    if (!this.isDue()) return this.current.token;
    // Another server process sharing this file may already have refreshed.
    if (this.adoptSiblingRefresh() && !this.isDue()) return this.current.token;

    const { refreshToken, expiresAt, refreshTokenExpiresAt } = this.current;
    if (
      refreshToken === undefined ||
      expiresAt === undefined ||
      refreshTokenExpiresAt === undefined
    ) {
      throw new OAuthLoginRequiredError("the access token expired and has no refresh token");
    }
    if (Date.parse(refreshTokenExpiresAt) <= this.now()) {
      throw new OAuthLoginRequiredError("the refresh token expired");
    }

    try {
      await this.refresh({ refreshToken, expiresAt, refreshTokenExpiresAt });
    } catch (error) {
      if (this.adoptSiblingRefresh() && !this.isDue()) return this.current.token;
      if (
        error instanceof Error &&
        "status" in error &&
        typeof error.status === "number" &&
        REFRESH_REJECTED_STATUSES.has(error.status)
      ) {
        throw new OAuthLoginRequiredError(`GitHub rejected the refresh token (${error.message})`, {
          cause: error,
        });
      }
      throw error;
    }
    return this.current.token;
  }

  /** Exchanges the refresh token via `@octokit/auth-oauth-user` and persists the result. */
  private async refresh(expiring: {
    refreshToken: string;
    expiresAt: string;
    refreshTokenExpiresAt: string;
  }): Promise<void> {
    const { current } = this;
    const auth = createOAuthUserAuth({
      clientType: "github-app",
      clientId: current.clientId,
      clientSecret: this.deps.config.clientSecret ?? "",
      request: this.refreshRequest,
      token: current.token,
      ...expiring,
    });
    const refreshed = await auth({ type: "refresh" });
    if (!("refreshToken" in refreshed)) {
      throw new OAuthLoginRequiredError("GitHub did not return a refresh token");
    }
    this.current = {
      ...current,
      token: refreshed.token,
      refreshToken: refreshed.refreshToken,
      expiresAt: refreshed.expiresAt,
      refreshTokenExpiresAt: refreshed.refreshTokenExpiresAt,
    };
    try {
      this.deps.store.save(this.current);
    } catch (error) {
      // The old refresh token is already spent, so the next process start will
      // need a new login; this process can still run on the in-memory token.
      const reason = error instanceof Error ? error.message : String(error);
      this.warn(
        `could not persist the refreshed OAuth token (${reason}); it is valid for this session only`
      );
    }
  }

  /** Adopts the stored token when another process rotated it. True if it changed. */
  private adoptSiblingRefresh(): boolean {
    const stored = this.deps.store.read();
    if (
      stored.status !== "ok" ||
      stored.token.clientId !== this.current.clientId ||
      stored.token.token === this.current.token
    ) {
      return false;
    }
    this.current = stored.token;
    return true;
  }
}

export interface LoadStoredOAuthAuthOptions {
  readonly config?: OAuthConfig;
  readonly store?: OAuthTokenStore;
  readonly fetch?: FetchLike;
  readonly now?: () => number;
  readonly warn?: (message: string) => void;
}

/**
 * The credential saved by `mcp-github-project-manager auth login`, or
 * undefined when there is none the server may use (no file, no configured
 * client id, a different client id, an insecure or corrupt file).
 *
 * Synchronous and offline: refreshing happens lazily on the first request.
 */
export function loadStoredOAuthAuth(
  options: LoadStoredOAuthAuthOptions = {}
): GitHubAuth | undefined {
  const config = options.config ?? readOAuthConfig();
  const store = options.store ?? new OAuthTokenStore(config.tokenFile);
  const state = inspectOAuthStore(store, config);

  const problem = describeUnusableState(state, store.path);
  if (problem) (options.warn ?? defaultWarn)(problem);
  if (state.state !== "ready") return undefined;

  return new StoredOAuthAuth(state.stored, {
    store,
    config,
    fetch: options.fetch,
    now: options.now,
    warn: options.warn,
  });
}
