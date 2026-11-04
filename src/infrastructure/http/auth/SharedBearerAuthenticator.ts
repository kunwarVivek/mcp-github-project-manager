import { createHash, timingSafeEqual } from "node:crypto";
import {
  type InboundAuthenticator,
  type InboundAuthResult,
  parseBearerHeader,
} from "./InboundAuthenticator";

/**
 * Static shared-secret bearer (`EVENTS_AUTH_TOKEN`). Both sides are hashed to a
 * fixed length before `timingSafeEqual`, so neither content nor length of the
 * secret leaks through comparison timing.
 */
export class SharedBearerAuthenticator implements InboundAuthenticator {
  private readonly expectedDigest: Buffer;

  constructor(sharedToken: string) {
    if (!sharedToken) {
      throw new Error("EVENTS_AUTH_TOKEN must not be empty");
    }
    this.expectedDigest = SharedBearerAuthenticator.digest(sharedToken);
  }

  private static digest(value: string): Buffer {
    return createHash("sha256").update(value, "utf8").digest();
  }

  /** Constant-time check of a presented token; used directly by the composite authenticator. */
  matches(token: string): boolean {
    return timingSafeEqual(SharedBearerAuthenticator.digest(token), this.expectedDigest);
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
    if (!this.matches(parsed.token)) {
      return { ok: false, status: 401, error: "invalid_token", reason: "shared_token_mismatch" };
    }
    return { ok: true, method: "shared-bearer" };
  }
}
