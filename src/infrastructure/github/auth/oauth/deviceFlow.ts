import { setTimeout as sleep } from "node:timers/promises";
import { z } from "zod";
import type { StoredOAuthToken } from "./OAuthTokenStore";
import { parseScopes } from "./oauthConfig";

/**
 * GitHub OAuth device flow (RFC 8628).
 * https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
 */
export const DEVICE_CODE_URL = "https://github.com/login/device/code";
export const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const USER_URL = "https://api.github.com/user";

const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";
/** Added to the polling interval on every `slow_down`, per the device-flow docs. */
const SLOW_DOWN_STEP_SECONDS = 5;

export type FetchLike = typeof fetch;

export type DeviceFlowFailure =
  | "access_denied"
  | "expired_token"
  | "device_flow_disabled"
  | "incorrect_client_credentials"
  | "unexpected_response";

export class DeviceFlowError extends Error {
  constructor(
    readonly code: DeviceFlowFailure,
    message: string
  ) {
    super(message);
    this.name = "DeviceFlowError";
  }
}

export interface DeviceAuthorization {
  readonly deviceCode: string;
  readonly userCode: string;
  readonly verificationUri: string;
  readonly expiresInSeconds: number;
  readonly intervalSeconds: number;
}

export interface DeviceFlowClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const systemClock: DeviceFlowClock = {
  now: () => Date.now(),
  sleep: (ms) => sleep(ms),
};

const errorBody = z.object({
  error: z.string(),
  error_description: z.string().optional(),
  interval: z.number().optional(),
});

const deviceCodeBody = z.object({
  device_code: z.string().min(1),
  user_code: z.string().min(1),
  verification_uri: z.string().min(1),
  expires_in: z.number().positive(),
  interval: z.number().positive(),
});

const tokenBody = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
  scope: z.string().default(""),
  expires_in: z.number().positive().optional(),
  refresh_token: z.string().min(1).optional(),
  refresh_token_expires_in: z.number().positive().optional(),
});

const userBody = z.object({ login: z.string().min(1) });

async function postJson(fetchImpl: FetchLike, url: string, body: Record<string, string>) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  try {
    return { status: response.status, json: JSON.parse(text) as unknown };
  } catch {
    throw new DeviceFlowError(
      "unexpected_response",
      `GitHub returned a non-JSON response (HTTP ${response.status}) from ${url}.`
    );
  }
}

function failureFor(code: string, description: string | undefined): DeviceFlowError {
  switch (code) {
    case "access_denied":
      return new DeviceFlowError("access_denied", "Authorization was denied in the browser.");
    case "expired_token":
      return new DeviceFlowError(
        "expired_token",
        "The device code expired before it was authorized. Run the login again."
      );
    case "device_flow_disabled":
      return new DeviceFlowError(
        "device_flow_disabled",
        "Device flow is not enabled for this app. Enable it in the app settings " +
          "(https://github.com/settings/developers) and retry."
      );
    case "incorrect_client_credentials":
      return new DeviceFlowError(
        "incorrect_client_credentials",
        "GitHub rejected the client id. Check GITHUB_OAUTH_CLIENT_ID (the client id, not the app id)."
      );
    default:
      return new DeviceFlowError(
        "unexpected_response",
        `GitHub returned an unexpected error: ${code}${description ? ` (${description})` : ""}.`
      );
  }
}

/** Step 1: ask GitHub for a device code and the user code to display. */
export async function requestDeviceAuthorization(
  fetchImpl: FetchLike,
  clientId: string,
  scopes: readonly string[]
): Promise<DeviceAuthorization> {
  const { json } = await postJson(fetchImpl, DEVICE_CODE_URL, {
    client_id: clientId,
    scope: scopes.join(" "),
  });
  const failure = errorBody.safeParse(json);
  if (failure.success) throw failureFor(failure.data.error, failure.data.error_description);

  const parsed = deviceCodeBody.safeParse(json);
  if (!parsed.success) {
    throw new DeviceFlowError(
      "unexpected_response",
      "GitHub's device code response was malformed."
    );
  }
  return {
    deviceCode: parsed.data.device_code,
    userCode: parsed.data.user_code,
    verificationUri: parsed.data.verification_uri,
    expiresInSeconds: parsed.data.expires_in,
    intervalSeconds: parsed.data.interval,
  };
}

/** The credential GitHub issued, before the owning login is known. */
export type IssuedToken = Omit<StoredOAuthToken, "login" | "clientId" | "createdAt">;

/**
 * Step 3: poll until the user authorizes. Honors the server's interval, adds
 * five seconds on every `slow_down`, and gives up when the device code expires.
 */
export async function pollForToken(
  fetchImpl: FetchLike,
  clock: DeviceFlowClock,
  clientId: string,
  device: DeviceAuthorization
): Promise<IssuedToken> {
  const deadline = clock.now() + device.expiresInSeconds * 1000;
  let intervalSeconds = device.intervalSeconds;

  for (;;) {
    // GitHub rate-limits polls faster than `interval`, so always wait first.
    await clock.sleep(intervalSeconds * 1000);
    if (clock.now() >= deadline) throw failureFor("expired_token", undefined);

    const { json } = await postJson(fetchImpl, ACCESS_TOKEN_URL, {
      client_id: clientId,
      device_code: device.deviceCode,
      grant_type: DEVICE_GRANT_TYPE,
    });

    const failure = errorBody.safeParse(json);
    if (failure.success) {
      if (failure.data.error === "authorization_pending") continue;
      if (failure.data.error === "slow_down") {
        intervalSeconds = failure.data.interval ?? intervalSeconds + SLOW_DOWN_STEP_SECONDS;
        continue;
      }
      throw failureFor(failure.data.error, failure.data.error_description);
    }

    const parsed = tokenBody.safeParse(json);
    if (!parsed.success) {
      throw new DeviceFlowError("unexpected_response", "GitHub's token response was malformed.");
    }
    const body = parsed.data;
    const issuedAt = clock.now();
    const expiring = body.refresh_token !== undefined && body.expires_in !== undefined;
    return {
      token: body.access_token,
      tokenType: body.token_type,
      scopes: parseScopes(body.scope),
      ...(expiring && {
        expiresAt: new Date(issuedAt + (body.expires_in ?? 0) * 1000).toISOString(),
        refreshToken: body.refresh_token,
        refreshTokenExpiresAt: new Date(
          issuedAt + (body.refresh_token_expires_in ?? 0) * 1000
        ).toISOString(),
      }),
    };
  }
}

/**
 * GitHub says to re-validate the identity behind every token it issues.
 * Returns the account login the token belongs to.
 */
export async function fetchTokenOwner(fetchImpl: FetchLike, token: string): Promise<string> {
  const response = await fetchImpl(USER_URL, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "mcp-github-project-manager",
    },
  });
  if (!response.ok) {
    throw new DeviceFlowError(
      "unexpected_response",
      `GitHub rejected the new token when fetching the user (HTTP ${response.status}).`
    );
  }
  const parsed = userBody.safeParse(await response.json());
  if (!parsed.success) {
    throw new DeviceFlowError("unexpected_response", "GitHub's /user response was malformed.");
  }
  return parsed.data.login;
}

export interface DeviceLoginOptions {
  readonly clientId: string;
  readonly scopes: readonly string[];
  readonly fetch: FetchLike;
  readonly clock: DeviceFlowClock;
  /** Called once with the code the user must enter. Must not write to stdout. */
  readonly onVerification: (device: DeviceAuthorization) => void;
}

/** Runs the whole device flow and returns the token ready to be persisted. */
export async function loginWithDeviceFlow(options: DeviceLoginOptions): Promise<StoredOAuthToken> {
  const device = await requestDeviceAuthorization(options.fetch, options.clientId, options.scopes);
  options.onVerification(device);
  const issued = await pollForToken(options.fetch, options.clock, options.clientId, device);
  const login = await fetchTokenOwner(options.fetch, issued.token);
  return {
    ...issued,
    clientId: options.clientId,
    login,
    createdAt: new Date(options.clock.now()).toISOString(),
  };
}
