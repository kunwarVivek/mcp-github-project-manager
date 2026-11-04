import type { ILogger } from "../../logger/index";
import {
  type InboundAuthenticator,
  type InboundAuthResult,
  parseBearerHeader,
} from "./InboundAuthenticator";
import {
  OAuthResourceServerAuthenticator,
  type OAuthResourceServerConfig,
} from "./OAuthResourceServerAuthenticator";
import { SharedBearerAuthenticator } from "./SharedBearerAuthenticator";

export interface InboundAuthConfig {
  /** `EVENTS_AUTH_TOKEN`: static shared bearer. */
  sharedToken?: string;
  /** OAuth 2.1 resource-server settings; present when `OAUTH_ISSUER` is set. */
  oauth?: OAuthResourceServerConfig;
  /** `EVENTS_ALLOW_UNAUTHENTICATED`: explicit opt-out for trusted local/dev use. */
  allowUnauthenticated: boolean;
}

/** Fail closed: no authenticator is configured, so every request is rejected. */
export class RejectAllAuthenticator implements InboundAuthenticator {
  async authenticate(authorizationHeader: string | undefined): Promise<InboundAuthResult> {
    const presented = parseBearerHeader(authorizationHeader).kind !== "absent";
    return {
      ok: false,
      status: 401,
      ...(presented ? { error: "invalid_token" as const } : {}),
      reason: "no_authenticator_configured",
    };
  }
}

/** Explicit opt-out (`EVENTS_ALLOW_UNAUTHENTICATED=true`): accepts everything. */
class AllowAllAuthenticator implements InboundAuthenticator {
  async authenticate(): Promise<InboundAuthResult> {
    return { ok: true, method: "unauthenticated" };
  }
}

/**
 * Accepts a caller that satisfies either configured method. The shared secret is
 * checked first (cheap, constant-time); anything else is handed to OAuth, whose
 * verdict (including 403 insufficient_scope) is authoritative.
 */
class EitherAuthenticator implements InboundAuthenticator {
  readonly protectedResource?: InboundAuthenticator["protectedResource"];

  constructor(
    private readonly shared: SharedBearerAuthenticator | undefined,
    private readonly oauth: OAuthResourceServerAuthenticator | undefined
  ) {
    this.protectedResource = oauth?.protectedResource;
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
    if (this.shared?.matches(parsed.token)) {
      return { ok: true, method: "shared-bearer" };
    }
    if (this.oauth) {
      return this.oauth.authenticate(authorizationHeader);
    }
    return { ok: false, status: 401, error: "invalid_token", reason: "shared_token_mismatch" };
  }
}

/**
 * Build the inbound authenticator from config.
 *
 * - OAuth and/or shared bearer configured -> require one of them.
 * - Neither configured -> reject everything, unless `allowUnauthenticated`
 *   (logged as a startup warning, mirroring WEBHOOK_ALLOW_UNSIGNED).
 * - Configured credentials always win over `allowUnauthenticated`.
 *
 * Throws on an invalid OAuth configuration so startup fails fast.
 */
export function createInboundAuthenticator(
  config: InboundAuthConfig,
  logger: Pick<ILogger, "warn" | "info">
): InboundAuthenticator {
  const shared = config.sharedToken ? new SharedBearerAuthenticator(config.sharedToken) : undefined;
  const oauth = config.oauth
    ? new OAuthResourceServerAuthenticator(config.oauth, logger)
    : undefined;

  if (shared || oauth) {
    if (config.allowUnauthenticated) {
      logger.warn(
        "EVENTS_ALLOW_UNAUTHENTICATED is set but event authentication is configured — credentials are still required."
      );
    }
    logger.info(
      `Event endpoint authentication enabled (${[oauth && "oauth", shared && "shared-bearer"].filter(Boolean).join(" + ")})`
    );
    return new EitherAuthenticator(shared, oauth);
  }

  if (config.allowUnauthenticated) {
    logger.warn(
      "EVENTS_ALLOW_UNAUTHENTICATED is enabled and no EVENTS_AUTH_TOKEN/OAUTH_ISSUER is configured — " +
        "/events/* is open to anyone who can reach this port. Do NOT use this in production."
    );
    return new AllowAllAuthenticator();
  }

  logger.warn(
    "No event endpoint authentication configured: /events/* will reject all requests. " +
      "Set EVENTS_AUTH_TOKEN or OAUTH_ISSUER+OAUTH_AUDIENCE, or EVENTS_ALLOW_UNAUTHENTICATED=true for trusted local/dev use."
  );
  return new RejectAllAuthenticator();
}
