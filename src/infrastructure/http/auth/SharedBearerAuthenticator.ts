import { createHash, timingSafeEqual } from "node:crypto";
import {
  type InboundAuthenticator,
  type InboundAuthResult,
  NO_AUTHENTICATOR_REASON,
  parseBearerHeader,
} from "./InboundAuthenticator";

/**
 * Shared-secret bearer (`EVENTS_AUTH_TOKEN`). The secret is read through
 * `source` on every check so a rotated secret takes effect without a restart.
 * Both sides are hashed to a fixed length before `timingSafeEqual`, so neither
 * content nor length of the secret leaks through comparison timing.
 */
export class SharedBearerAuthenticator implements InboundAuthenticator {
  constructor(private readonly source: () => string | undefined) {}

  private static digest(value: string): Buffer {
    return createHash("sha256").update(value, "utf8").digest();
  }

  /** Whether a shared secret is currently available. */
  isConfigured(): boolean {
    return Boolean(this.source());
  }

  /** Constant-time check of a presented token; used directly by the composite authenticator. */
  matches(token: string): boolean {
    const expected = this.source();
    if (!expected) {
      return false;
    }
    return timingSafeEqual(
      SharedBearerAuthenticator.digest(token),
      SharedBearerAuthenticator.digest(expected)
    );
  }

  async authenticate(authorizationHeader: string | undefined): Promise<InboundAuthResult> {
    if (!this.isConfigured()) {
      return { ok: false, status: 503, reason: NO_AUTHENTICATOR_REASON };
    }
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
    if (!this.matches(parsed.token)) {
      return { ok: false, status: 401, error: "invalid_token", reason: "shared_token_mismatch" };
    }
    return { ok: true, method: "shared-bearer" };
  }
}
