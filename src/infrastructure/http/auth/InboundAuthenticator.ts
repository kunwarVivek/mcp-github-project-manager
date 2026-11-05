/**
 * Inbound (caller -> this server) authentication for the HTTP surface.
 *
 * References:
 * - MCP authorization (2025-06-18): https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
 * - RFC 6750 (Bearer usage, WWW-Authenticate): https://www.rfc-editor.org/rfc/rfc6750
 * - RFC 9728 (Protected Resource Metadata): https://www.rfc-editor.org/rfc/rfc9728
 * - RFC 8707 (Resource Indicators / audience binding): https://www.rfc-editor.org/rfc/rfc8707
 */

/** How an accepted caller was authenticated. */
export type InboundAuthMethod = "oauth" | "shared-bearer" | "unauthenticated";

/**
 * RFC 6750 §3.1 error codes. `invalid_request` is a malformed request (400),
 * `invalid_token` a bad/expired/foreign token (401), `insufficient_scope` a
 * valid token lacking a required scope (403).
 */
export type BearerErrorCode = "invalid_request" | "invalid_token" | "insufficient_scope";

export interface InboundAuthAccepted {
  ok: true;
  method: InboundAuthMethod;
  /** Token subject (`sub`) when the method carries one. */
  subject?: string;
  /** Credential expiry (JWT `exp`, epoch seconds); absent for credentials that do not expire. */
  expiresAt?: number;
}

export interface InboundAuthRejected {
  ok: false;
  /** 400 malformed, 401 unauthenticated/invalid, 403 scope, 503 key material unavailable. */
  status: 400 | 401 | 403 | 503;
  /** RFC 6750 error code; absent when the caller presented no credentials at all (§3.1). */
  error?: BearerErrorCode;
  /** Machine-readable cause for logs/audit. Never contains token material. */
  reason: string;
  /** Scopes the caller needs, echoed in `WWW-Authenticate` for `insufficient_scope`. */
  requiredScopes?: string[];
}

export type InboundAuthResult = InboundAuthAccepted | InboundAuthRejected;

/** RFC 9728 §2 Protected Resource Metadata document (the subset we publish). */
export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported?: string[];
  bearer_methods_supported: ["header"];
}

export interface InboundAuthenticator {
  /**
   * Authenticate a request from its raw `Authorization` header value.
   * Tokens are only ever read from this header, never from the query string.
   */
  authenticate(authorizationHeader: string | undefined): Promise<InboundAuthResult>;

  /** RFC 9728 document and the path it is served on; undefined when no OAuth issuer is configured. */
  readonly protectedResource?: {
    path: string;
    url: string;
    metadata: ProtectedResourceMetadata;
  };
}

/** Realm advertised in `WWW-Authenticate`. */
export const AUTH_REALM = "github-project-manager-events";

/**
 * Parse an `Authorization` header into a bearer token (RFC 6750 §2.1 `b64token`).
 * - no header / another scheme  -> `{ kind: "absent" }` (caller offered no bearer credentials)
 * - `Bearer` with a malformed or empty credential -> `{ kind: "malformed" }`
 */
export function parseBearerHeader(
  header: string | undefined
): { kind: "token"; token: string } | { kind: "absent" } | { kind: "malformed" } {
  if (header === undefined) return { kind: "absent" };
  const match = /^bearer(?: +(.*))?$/i.exec(header.trim());
  if (!match) return { kind: "absent" };
  const credential = match[1];
  if (credential === undefined || !/^[A-Za-z0-9\-._~+/]+=*$/.test(credential)) {
    return { kind: "malformed" };
  }
  return { kind: "token", token: credential };
}

/**
 * Build the `WWW-Authenticate` header for a rejection (RFC 6750 §3, RFC 9728 §5.1).
 * `resource_metadata` is included whenever a metadata URL is known.
 */
export function buildWwwAuthenticate(
  rejection: InboundAuthRejected,
  resourceMetadataUrl: string | undefined
): string {
  const params: string[] = [`realm="${AUTH_REALM}"`];
  if (rejection.error) params.push(`error="${rejection.error}"`);
  if (rejection.error === "insufficient_scope" && rejection.requiredScopes?.length) {
    params.push(`scope="${rejection.requiredScopes.join(" ")}"`);
  }
  if (resourceMetadataUrl) params.push(`resource_metadata="${resourceMetadataUrl}"`);
  return `Bearer ${params.join(", ")}`;
}
