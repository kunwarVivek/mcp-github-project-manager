import { describe, expect, it } from "vitest";
import {
  ACCESS_TOKEN_URL,
  DEVICE_CODE_URL,
  DeviceFlowError,
  loginWithDeviceFlow,
  USER_URL,
} from "../../../../../../infrastructure/github/auth/oauth/deviceFlow";
import {
  createFakeClock,
  createFakeFetch,
  type FakeClock,
  type FakeFetch,
  type FakeReply,
} from "./fakeGitHub";

const DEVICE_REPLY: FakeReply = {
  json: {
    device_code: "dev-code-123",
    user_code: "WDJB-MJHT",
    verification_uri: "https://github.com/login/device",
    expires_in: 900,
    interval: 5,
  },
};
const PENDING: FakeReply = { json: { error: "authorization_pending" } };
const TOKEN: FakeReply = {
  json: { access_token: "gho_issued", token_type: "bearer", scope: "repo,project" },
};

/** Serves the device-code endpoint, then the scripted token replies in order. */
function scriptedGitHub(
  tokenReplies: FakeReply[],
  deviceReply: FakeReply = DEVICE_REPLY
): FakeFetch {
  const queue = [...tokenReplies];
  return createFakeFetch((request) => {
    if (request.url === DEVICE_CODE_URL) return deviceReply;
    if (request.url === ACCESS_TOKEN_URL) {
      const next = queue.shift();
      if (!next) throw new Error("token endpoint polled more times than scripted");
      return next;
    }
    if (request.url === USER_URL) return { json: { login: "octocat" } };
    throw new Error(`unexpected request ${request.url}`);
  });
}

function login(github: FakeFetch, clock: FakeClock = createFakeClock()) {
  const shown: string[] = [];
  const promise = loginWithDeviceFlow({
    clientId: "Iv1.client",
    scopes: ["repo", "project"],
    fetch: github.fetch,
    clock,
    onVerification: (device) => shown.push(`${device.verificationUri} ${device.userCode}`),
  });
  return { promise, shown, clock };
}

describe("device flow login", () => {
  it("waits through authorization_pending and slow_down, then stores the token", async () => {
    const github = scriptedGitHub([PENDING, { json: { error: "slow_down", interval: 10 } }, TOKEN]);
    const { promise, clock } = login(github);

    const stored = await promise;

    // Poll after 5s, 5s, then the server-raised 10s interval.
    expect(clock.sleeps).toEqual([5000, 5000, 10000]);
    expect(stored).toMatchObject({
      clientId: "Iv1.client",
      token: "gho_issued",
      tokenType: "bearer",
      scopes: ["repo", "project"],
      login: "octocat",
    });
    expect(stored.refreshToken).toBeUndefined();
    expect(stored.expiresAt).toBeUndefined();
  });

  it("adds 5 seconds on slow_down when the server does not state a new interval", async () => {
    const github = scriptedGitHub([{ json: { error: "slow_down" } }, TOKEN]);
    const { promise, clock } = login(github);
    await promise;
    expect(clock.sleeps).toEqual([5000, 10000]);
  });

  it("shows the user code before polling begins", async () => {
    const github = scriptedGitHub([TOKEN]);
    const { promise, shown } = login(github);
    await promise;
    expect(shown).toEqual(["https://github.com/login/device WDJB-MJHT"]);
  });

  it("sends the device-flow grant without a client secret", async () => {
    const github = scriptedGitHub([TOKEN]);
    await login(github).promise;

    const [deviceRequest, pollRequest] = github.requests;
    expect(deviceRequest?.body).toEqual({ client_id: "Iv1.client", scope: "repo project" });
    expect(pollRequest?.body).toEqual({
      client_id: "Iv1.client",
      device_code: "dev-code-123",
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    });
  });

  it("derives expiry timestamps and keeps the refresh token for an expiring token", async () => {
    const github = scriptedGitHub([
      {
        json: {
          access_token: "ghu_issued",
          token_type: "bearer",
          scope: "",
          expires_in: 28800,
          refresh_token: "ghr_issued",
          refresh_token_expires_in: 15897600,
        },
      },
    ]);
    const { promise, clock } = login(github);

    const stored = await promise;

    // The token arrives after one 5s wait; expiries count from that moment.
    const issuedAt = clock.now();
    expect(stored.refreshToken).toBe("ghr_issued");
    expect(stored.expiresAt).toBe(new Date(issuedAt + 28800 * 1000).toISOString());
    expect(stored.refreshTokenExpiresAt).toBe(new Date(issuedAt + 15897600 * 1000).toISOString());
    expect(stored.scopes).toEqual([]);
  });

  it("fails with access_denied when the user cancels, and never asks for the owner", async () => {
    const github = scriptedGitHub([PENDING, { json: { error: "access_denied" } }]);
    const { promise } = login(github);

    await expect(promise).rejects.toMatchObject({ name: "DeviceFlowError", code: "access_denied" });
    expect(github.requests.some((r) => r.url === USER_URL)).toBe(false);
  });

  it("fails with expired_token when GitHub reports the device code expired", async () => {
    const github = scriptedGitHub([{ json: { error: "expired_token" } }]);
    await expect(login(github).promise).rejects.toMatchObject({ code: "expired_token" });
  });

  it("gives up locally once the device code lifetime has elapsed", async () => {
    const github = createFakeFetch((request) =>
      request.url === DEVICE_CODE_URL
        ? { json: { ...(DEVICE_REPLY.json as object), expires_in: 20, interval: 5 } }
        : PENDING
    );
    const { promise, clock } = login(github);

    await expect(promise).rejects.toMatchObject({ code: "expired_token" });
    // 5s, 10s, 15s polls, then the 20s boundary is the deadline.
    expect(clock.sleeps).toEqual([5000, 5000, 5000, 5000]);
    expect(github.requests.filter((r) => r.url === ACCESS_TOKEN_URL)).toHaveLength(3);
  });

  it("explains how to fix an app that has device flow disabled", async () => {
    const github = scriptedGitHub([], { json: { error: "device_flow_disabled" } });
    const failure = await login(github).promise.catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(DeviceFlowError);
    expect((failure as DeviceFlowError).code).toBe("device_flow_disabled");
    expect((failure as DeviceFlowError).message).toContain(
      "https://github.com/settings/developers"
    );
  });

  it("reports a rejected client id", async () => {
    const github = scriptedGitHub([], { json: { error: "incorrect_client_credentials" } });
    await expect(login(github).promise).rejects.toMatchObject({
      code: "incorrect_client_credentials",
    });
  });

  it("fails when the freshly issued token cannot read /user", async () => {
    const github = createFakeFetch((request) => {
      if (request.url === DEVICE_CODE_URL) return DEVICE_REPLY;
      if (request.url === ACCESS_TOKEN_URL) return TOKEN;
      return { status: 401, json: { message: "Bad credentials" } };
    });
    await expect(login(github).promise).rejects.toMatchObject({
      code: "unexpected_response",
    });
  });
});
