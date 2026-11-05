import { createRemoteJWKSet, errors, type JWTPayload, type JWTVerifyGetKey, jwtVerify } from "jose";
import type { ILogger } from "../../logger/index";
import {
  type InboundAuthenticator,
  type InboundAuthResult,
  type ProtectedResourceMetadata,
  parseBearerHeader,
} from "./InboundAuthenticator";

/** Asymmetric algorithms only: `none` and every HS* (shared-secret) algorithm are rejected. */
export const ALLOWED_JWT_ALGORITHMS = [
  "RS256",
  "RS384",
  "RS512",
  "PS256",
  "PS384",
  "PS512",
  "ES256",
  "ES384",
  "ES512",
  "EdDSA",
];

const CLOCK_TOLERANCE_SECONDS = 30;
const DISCOVERY_TIMEOUT_MS = 5000;
export const PROTECTED_RESOURCE_WELL_KNOWN = "/.well-known/oauth-protected-resource";

export interface OAuthResourceServerConfig {
  /** Authorization server issuer identifier; the token `iss` must equal it exactly. */
  issuer: string;
  /** This server's resource identifier; the token `aud` must contain it (RFC 8707 §2). */
  audience: string;
  /** Explicit JWKS endpoint; discovered from the issuer's metadata when omitted. */
  jwksUri?: string;
  requiredScopes: string[];
  /** Public URL of this server, published as `resource` in RFC 9728 metadata. */
  resourceUrl?: string;
}

type KeyResolver = JWTVerifyGetKey;

/** jose errors that mean "this token is bad" (401) as opposed to "we could not fetch keys" (503). */
function isInvalidTokenError(error: unknown): boolean {
  return (
    error instanceof errors.JWTClaimValidationFailed ||
    error instanceof errors.JWTExpired ||
    error instanceof errors.JWTInvalid ||
    error instanceof errors.JWSInvalid ||
    error instanceof errors.JWSSignatureVerificationFailed ||
    error instanceof errors.JOSEAlgNotAllowed ||
    error instanceof errors.JOSENotSupported ||
    error instanceof errors.JWKSNoMatchingKey ||
    error instanceof errors.JWKSMultipleMatchingKeys
  );
}

function invalidTokenReason(error: unknown): string {
  if (error instanceof errors.JWTExpired) return "token_expired";
  if (error instanceof errors.JWTClaimValidationFailed)
    return `claim_${error.claim}_${error.reason}`;
  if (error instanceof errors.JOSEAlgNotAllowed) return "algorithm_not_allowed";
  if (error instanceof errors.JWSSignatureVerificationFailed) return "signature_invalid";
  if (error instanceof errors.JWKSNoMatchingKey) return "signing_key_unknown";
  return "token_malformed";
}

/** RFC 9728 §3: the metadata well-known URI is inserted between host and path of the resource. */
export function protectedResourcePath(resourceUrl: string): string {
  const { pathname } = new URL(resourceUrl);
  return pathname === "/"
    ? PROTECTED_RESOURCE_WELL_KNOWN
    : `${PROTECTED_RESOURCE_WELL_KNOWN}${pathname}`;
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function assertHttpsOrLoopback(name: string, value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL, got: ${value}`);
  }
  if (
    parsed.protocol !== "https:" &&
    !(parsed.protocol === "http:" && isLoopbackHost(parsed.hostname))
  ) {
    throw new Error(
      `${name} must use https (http is only allowed for loopback hosts), got: ${value}`
    );
  }
  return parsed;
}

/**
 * OAuth 2.1 resource server: validates JWT access tokens (RFC 9068 shape) minted
 * by a configured authorization server for this specific resource.
 */
export class OAuthResourceServerAuthenticator implements InboundAuthenticator {
  readonly protectedResource?: InboundAuthenticator["protectedResource"];

  private keyResolver?: Promise<KeyResolver>;

  constructor(
    private readonly config: OAuthResourceServerConfig,
    private readonly logger: Pick<ILogger, "warn">,
    private readonly fetchImpl: typeof fetch = fetch
  ) {
    OAuthResourceServerAuthenticator.validateConfig(config);

    const resourceUrl =
      config.resourceUrl ?? OAuthResourceServerAuthenticator.urlOrUndefined(config.audience);
    if (resourceUrl) {
      const metadata: ProtectedResourceMetadata = {
        resource: resourceUrl,
        authorization_servers: [config.issuer],
        bearer_methods_supported: ["header"],
        ...(config.requiredScopes.length > 0 ? { scopes_supported: config.requiredScopes } : {}),
      };
      const path = protectedResourcePath(resourceUrl);
      this.protectedResource = { path, url: `${new URL(resourceUrl).origin}${path}`, metadata };
    }
  }

  /** Fail-fast validation, run at construction so a bad config aborts startup. */
  static validateConfig(config: OAuthResourceServerConfig): void {
    if (!config.issuer) {
      throw new Error("OAUTH_ISSUER is required to enable OAuth bearer authentication");
    }
    if (!config.audience) {
      throw new Error(
        "OAUTH_AUDIENCE is required when OAUTH_ISSUER is set: tokens must be bound to this server as audience (RFC 8707)"
      );
    }
    assertHttpsOrLoopback("OAUTH_ISSUER", config.issuer);
    if (config.jwksUri) assertHttpsOrLoopback("OAUTH_JWKS_URI", config.jwksUri);
    if (config.resourceUrl) {
      const resource = assertHttpsOrLoopback("OAUTH_RESOURCE_URL", config.resourceUrl);
      if (resource.hash) {
        throw new Error("OAUTH_RESOURCE_URL must not contain a fragment");
      }
    }
  }

  private static urlOrUndefined(value: string): string | undefined {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? value : undefined;
    } catch {
      return undefined;
    }
  }

  async authenticate(authorizationHeader: string | undefined): Promise<InboundAuthResult> {
    const parsed = parseBearerHeader(authorizationHeader);
    if (parsed.kind === "absent") {
      return { ok: false, status: 401, reason: "no_credentials" };
    }
    if (parsed.kind === "malformed") {
      return {
        ok: false,
        status: 400,
        error: "invalid_request",
        reason: "malformed_authorization",
      };
    }

    let payload: JWTPayload;
    try {
      const keys = await this.getKeyResolver();
      ({ payload } = await jwtVerify(parsed.token, keys, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: ALLOWED_JWT_ALGORITHMS,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
        requiredClaims: ["exp"],
      }));
    } catch (error) {
      if (isInvalidTokenError(error)) {
        return {
          ok: false,
          status: 401,
          error: "invalid_token",
          reason: invalidTokenReason(error),
        };
      }
      this.logger.warn(
        `OAuth key material unavailable (${error instanceof Error ? error.name : "unknown error"})`
      );
      return { ok: false, status: 503, reason: "jwks_unavailable" };
    }

    const granted = new Set(OAuthResourceServerAuthenticator.grantedScopes(payload));
    const missing = this.config.requiredScopes.filter((scope) => !granted.has(scope));
    if (missing.length > 0) {
      return {
        ok: false,
        status: 403,
        error: "insufficient_scope",
        reason: "scope_missing",
        requiredScopes: this.config.requiredScopes,
      };
    }

    return { ok: true, method: "oauth", subject: payload.sub, expiresAt: payload.exp };
  }

  /** `scope` is a space-delimited string (RFC 9068 §2.2.3); some servers emit an `scp` array/string instead. */
  private static grantedScopes(payload: JWTPayload): string[] {
    const fromScope = typeof payload.scope === "string" ? payload.scope.split(/\s+/) : [];
    const scp = payload.scp;
    const fromScp = Array.isArray(scp)
      ? scp.filter((s): s is string => typeof s === "string")
      : typeof scp === "string"
        ? scp.split(/\s+/)
        : [];
    return [...fromScope, ...fromScp].filter(Boolean);
  }

  /** Resolve (and cache) the JWKS key resolver; a failed discovery is retried on the next request. */
  private getKeyResolver(): Promise<KeyResolver> {
    if (!this.keyResolver) {
      const pending = this.buildKeyResolver();
      this.keyResolver = pending;
      pending.catch(() => {
        if (this.keyResolver === pending) this.keyResolver = undefined;
      });
    }
    return this.keyResolver;
  }

  private async buildKeyResolver(): Promise<KeyResolver> {
    const jwksUri = this.config.jwksUri ?? (await this.discoverJwksUri());
    return createRemoteJWKSet(new URL(jwksUri), { timeoutDuration: DISCOVERY_TIMEOUT_MS });
  }

  /**
   * Discover `jwks_uri` from RFC 8414 metadata, then OpenID Connect discovery.
   * The advertised `issuer` must equal the configured one (RFC 8414 §3.3), else a
   * hostile metadata response could redirect key lookup.
   */
  private async discoverJwksUri(): Promise<string> {
    const issuer = new URL(this.config.issuer);
    const issuerPath = issuer.pathname === "/" ? "" : issuer.pathname.replace(/\/$/, "");
    const candidates = [
      `${issuer.origin}/.well-known/oauth-authorization-server${issuerPath}`,
      `${issuer.origin}${issuerPath}/.well-known/openid-configuration`,
    ];

    for (const candidate of candidates) {
      try {
        const response = await this.fetchImpl(candidate, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
        });
        if (!response.ok) continue;
        const doc = (await response.json()) as { issuer?: unknown; jwks_uri?: unknown };
        if (doc.issuer !== this.config.issuer || typeof doc.jwks_uri !== "string") continue;
        assertHttpsOrLoopback("jwks_uri", doc.jwks_uri);
        return doc.jwks_uri;
      } catch {
        // try the next discovery document
      }
    }
    throw new Error(`Could not discover jwks_uri for issuer ${this.config.issuer}`);
  }
}
