import { chmodSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Octokit } from "@octokit/rest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  OAuthTokenStore,
  type StoredOAuthToken,
} from "../../../../../../infrastructure/github/auth/oauth/OAuthTokenStore";
import type { OAuthConfig } from "../../../../../../infrastructure/github/auth/oauth/oauthConfig";
import {
  loadStoredOAuthAuth,
  OAuthLoginRequiredError,
} from "../../../../../../infrastructure/github/auth/oauth/StoredOAuthAuth";
import { createFakeFetch, type FakeReply } from "./fakeGitHub";

const CLIENT_ID = "Iv1.client";
const REFRESH_URL = "https://github.com/login/oauth/access_token";

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

function oauthAppToken(overrides: Partial<StoredOAuthToken> = {}): StoredOAuthToken {
  return {
    clientId: CLIENT_ID,
    token: "gho_oauth_app",
    tokenType: "bearer",
    scopes: ["repo", "project"],
    login: "octocat",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function refreshableToken(overrides: Partial<StoredOAuthToken> = {}): StoredOAuthToken {
  return oauthAppToken({
    token: "ghu_access_v1",
    scopes: [],
    expiresAt: hoursFromNow(8),
    refreshToken: "ghr_refresh_v1",
    refreshTokenExpiresAt: hoursFromNow(24 * 180),
    ...overrides,
  });
}

const REFRESHED: FakeReply = {
  json: {
    access_token: "ghu_access_v2",
    token_type: "bearer",
    scope: "",
    expires_in: 28800,
    refresh_token: "ghr_refresh_v2",
    refresh_token_expires_in: 15897600,
  },
};

describe("loadStoredOAuthAuth", () => {
  let root: string;
  let store: OAuthTokenStore;
  let warnings: string[];

  const config = (overrides: Partial<OAuthConfig> = {}): OAuthConfig => ({
    clientId: CLIENT_ID,
    clientSecret: undefined,
    scopes: ["repo"],
    tokenFile: store.path,
    ...overrides,
  });
  const load = (fetchImpl?: typeof fetch, overrides: Partial<OAuthConfig> = {}) =>
    loadStoredOAuthAuth({
      config: config(overrides),
      store,
      fetch: fetchImpl,
      warn: (message) => warnings.push(message),
    });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "oauth-auth-"));
    store = new OAuthTokenStore(join(root, "github-oauth.json"));
    warnings = [];
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  describe("deciding whether a stored login is usable", () => {
    it("is absent when nothing was stored, without a warning", () => {
      expect(load()).toBeUndefined();
      expect(warnings).toEqual([]);
    });

    it("is absent when no client id is configured", () => {
      store.save(oauthAppToken());
      expect(load(undefined, { clientId: undefined })).toBeUndefined();
    });

    it("ignores a login made with a different client id and says why", () => {
      store.save(oauthAppToken({ clientId: "Iv1.someone-else" }));
      expect(load()).toBeUndefined();
      expect(warnings.join("\n")).toContain("different client id");
    });

    it.skipIf(process.platform === "win32")(
      "ignores a group/other-readable file and names the fix",
      () => {
        store.save(oauthAppToken());
        chmodSync(store.path, 0o644);
        expect(load()).toBeUndefined();
        expect(warnings.join("\n")).toMatch(/chmod 600/);
      }
    );

    it("never leaks token material in a warning", () => {
      store.save(oauthAppToken({ clientId: "Iv1.someone-else" }));
      load();
      expect(warnings.join("\n")).not.toContain("gho_oauth_app");
    });

    it("exposes the contract mode and source", () => {
      store.save(oauthAppToken());
      expect(load()).toMatchObject({ mode: "oauth-user", source: "oauth-store" });
    });

    it("does no network I/O at load time", () => {
      store.save(refreshableToken({ expiresAt: hoursFromNow(-1) }));
      const fake = createFakeFetch(() => REFRESHED);
      load(fake.fetch);
      expect(fake.requests).toEqual([]);
    });
  });

  describe("non-expiring OAuth App token", () => {
    it("is returned as-is and never refreshed", async () => {
      store.save(oauthAppToken());
      const fake = createFakeFetch(() => REFRESHED);
      await expect(load(fake.fetch)?.getToken()).resolves.toBe("gho_oauth_app");
      expect(fake.requests).toEqual([]);
    });
  });

  describe("refreshable GitHub App user token", () => {
    it("is used directly while comfortably inside its lifetime", async () => {
      store.save(refreshableToken());
      const fake = createFakeFetch(() => REFRESHED);
      await expect(load(fake.fetch)?.getToken()).resolves.toBe("ghu_access_v1");
      expect(fake.requests).toEqual([]);
    });

    it("refreshes an expired token WITHOUT a client secret and persists the rotation", async () => {
      store.save(refreshableToken({ expiresAt: hoursFromNow(-1) }));
      const fake = createFakeFetch(() => REFRESHED);

      const token = await load(fake.fetch)?.getToken();

      expect(token).toBe("ghu_access_v2");
      expect(fake.requests).toHaveLength(1);
      expect(fake.requests[0]?.url).toBe(REFRESH_URL);
      // Device-flow tokens refresh with no client_secret at all (not an empty one).
      expect(fake.requests[0]?.body).toEqual({
        client_id: CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: "ghr_refresh_v1",
      });
      const persisted = store.read();
      expect(persisted.status).toBe("ok");
      expect(persisted.status === "ok" && persisted.token).toMatchObject({
        token: "ghu_access_v2",
        refreshToken: "ghr_refresh_v2",
        login: "octocat",
      });
    });

    it("sends the client secret when one is configured", async () => {
      store.save(refreshableToken({ expiresAt: hoursFromNow(-1) }));
      const fake = createFakeFetch(() => REFRESHED);
      await load(fake.fetch, { clientSecret: "s3cret" })?.getToken();
      expect(fake.requests[0]?.body?.client_secret).toBe("s3cret");
    });

    it("refreshes ahead of expiry so a request never carries a lapsing token", async () => {
      store.save(refreshableToken({ expiresAt: new Date(Date.now() + 30_000).toISOString() }));
      const fake = createFakeFetch(() => REFRESHED);
      await expect(load(fake.fetch)?.getToken()).resolves.toBe("ghu_access_v2");
    });

    it("does not refresh again once the new token is in place", async () => {
      store.save(refreshableToken({ expiresAt: hoursFromNow(-1) }));
      const fake = createFakeFetch(() => REFRESHED);
      const auth = load(fake.fetch);
      await auth?.getToken();
      await auth?.getToken();
      expect(fake.requests).toHaveLength(1);
    });

    it("spends the single-use refresh token once for concurrent callers", async () => {
      store.save(refreshableToken({ expiresAt: hoursFromNow(-1) }));
      const fake = createFakeFetch(() => REFRESHED);
      const auth = load(fake.fetch);

      const tokens = await Promise.all([auth?.getToken(), auth?.getToken(), auth?.getToken()]);

      expect(tokens).toEqual(["ghu_access_v2", "ghu_access_v2", "ghu_access_v2"]);
      expect(fake.requests).toHaveLength(1);
    });

    it("adopts a token another server process already refreshed instead of refreshing again", async () => {
      store.save(refreshableToken({ expiresAt: hoursFromNow(-1) }));
      const fake = createFakeFetch(() => REFRESHED);
      const auth = load(fake.fetch);
      // Another process rotates the stored token between our load and first use.
      store.save(
        refreshableToken({
          token: "ghu_sibling",
          refreshToken: "ghr_sibling",
          expiresAt: hoursFromNow(8),
        })
      );

      await expect(auth?.getToken()).resolves.toBe("ghu_sibling");
      expect(fake.requests).toEqual([]);
    });

    it("tells the user to log in again when the refresh token has expired", async () => {
      store.save(
        refreshableToken({ expiresAt: hoursFromNow(-2), refreshTokenExpiresAt: hoursFromNow(-1) })
      );
      const fake = createFakeFetch(() => REFRESHED);

      const failure = await load(fake.fetch)
        ?.getToken()
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(OAuthLoginRequiredError);
      expect((failure as Error).message).toContain("mcp-github-project-manager auth login");
      expect(fake.requests).toEqual([]);
    });

    it("tells the user to log in again when GitHub rejects the refresh token", async () => {
      store.save(refreshableToken({ expiresAt: hoursFromNow(-1) }));
      const fake = createFakeFetch(() => ({
        json: {
          error: "bad_refresh_token",
          error_description: "The refresh token passed is incorrect or expired.",
        },
      }));

      const failure = await load(fake.fetch)
        ?.getToken()
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(OAuthLoginRequiredError);
      expect((failure as Error).message).toContain("auth login");
    });

    it("keeps the previous login on disk when a refresh fails", async () => {
      const original = refreshableToken({ expiresAt: hoursFromNow(-1) });
      store.save(original);
      const fake = createFakeFetch(() => ({ json: { error: "bad_refresh_token" } }));
      await load(fake.fetch)
        ?.getToken()
        .catch(() => undefined);
      expect(store.read()).toEqual({ status: "ok", token: original });
    });
  });

  describe("expiring token without a refresh token", () => {
    it("fails with the login instruction once expired", async () => {
      store.save(oauthAppToken({ expiresAt: hoursFromNow(-1) }));
      await expect(load()?.getToken()).rejects.toThrow(/auth login/);
    });
  });

  describe("as an Octokit auth strategy", () => {
    function apiServer() {
      return createFakeFetch((request) =>
        request.url === REFRESH_URL ? REFRESHED : { json: { login: "octocat" } }
      );
    }

    it("authorizes requests with the stored token", async () => {
      store.save(oauthAppToken());
      const fake = apiServer();
      const auth = load(fake.fetch);
      const octokit = new Octokit({ ...auth?.octokitAuth(), request: { fetch: fake.fetch } });

      await octokit.request("GET /user");

      expect(fake.requests.at(-1)?.headers.authorization).toBe("token gho_oauth_app");
    });

    it("refreshes before the request and sends the new token", async () => {
      store.save(refreshableToken({ expiresAt: hoursFromNow(-1) }));
      const fake = apiServer();
      const auth = load(fake.fetch);
      const octokit = new Octokit({ ...auth?.octokitAuth(), request: { fetch: fake.fetch } });

      await octokit.request("GET /user");

      expect(fake.requests.map((r) => r.url)).toEqual([REFRESH_URL, "https://api.github.com/user"]);
      expect(fake.requests[1]?.headers.authorization).toBe("token ghu_access_v2");
    });

    it("shares one refresh across independent Octokit clients", async () => {
      store.save(refreshableToken({ expiresAt: hoursFromNow(-1) }));
      const fake = apiServer();
      const auth = load(fake.fetch);
      const make = () => new Octokit({ ...auth?.octokitAuth(), request: { fetch: fake.fetch } });

      await Promise.all([make().request("GET /user"), make().request("GET /user")]);

      expect(fake.requests.filter((r) => r.url === REFRESH_URL)).toHaveLength(1);
    });
  });
});
