import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The auth commands must run on a machine with no GITHUB_TOKEN/OWNER/REPO.
// env.ts validates exactly those at import time, so loading it would break them.
vi.mock("../../env", () => {
  throw new Error("auth CLI must not load src/env.ts");
});

import { runAuthCli } from "../../auth-cli";
import {
  ACCESS_TOKEN_URL,
  DEVICE_CODE_URL,
  USER_URL,
} from "../../infrastructure/github/auth/oauth/deviceFlow";
import {
  OAuthTokenStore,
  type StoredOAuthToken,
} from "../../infrastructure/github/auth/oauth/OAuthTokenStore";
import {
  createFakeClock,
  createFakeFetch,
  type FakeFetch,
  type FakeReply,
} from "./infrastructure/github/auth/oauth/fakeGitHub";

const CLIENT_ID = "Iv1.client";
const SECRET_TOKEN = "gho_supersecret_token_value";

function stored(overrides: Partial<StoredOAuthToken> = {}): StoredOAuthToken {
  return {
    clientId: CLIENT_ID,
    token: SECRET_TOKEN,
    tokenType: "bearer",
    scopes: ["repo", "project"],
    login: "octocat",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function successfulGitHub(tokenReply?: FakeReply): FakeFetch {
  return createFakeFetch((request) => {
    if (request.url === DEVICE_CODE_URL) {
      return {
        json: {
          device_code: "dev-code",
          user_code: "ABCD-1234",
          verification_uri: "https://github.com/login/device",
          expires_in: 900,
          interval: 5,
        },
      };
    }
    if (request.url === ACCESS_TOKEN_URL) {
      return (
        tokenReply ?? {
          json: { access_token: SECRET_TOKEN, token_type: "bearer", scope: "repo,project" },
        }
      );
    }
    if (request.url === USER_URL) return { json: { login: "octocat" } };
    return { status: 204 };
  });
}

describe("auth CLI", () => {
  let root: string;
  let tokenFile: string;
  let out: string[];
  let err: string[];

  const run = (argv: string[], options: { fetch?: FakeFetch; env?: Record<string, string> } = {}) =>
    runAuthCli(argv, {
      io: { stdout: (text) => out.push(text), stderr: (text) => err.push(text) },
      fetch: (options.fetch ?? successfulGitHub()).fetch,
      clock: createFakeClock(),
      loadDotenv: false,
      env: {
        NODE_ENV: "test",
        GITHUB_OAUTH_CLIENT_ID: CLIENT_ID,
        GITHUB_OAUTH_TOKEN_FILE: tokenFile,
        ...options.env,
      },
    });
  const stderr = () => err.join("");
  const stdout = () => out.join("");

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "auth-cli-"));
    tokenFile = join(root, "cfg", "github-oauth.json");
    out = [];
    err = [];
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  describe("login", () => {
    it("prints the code on stderr, keeps stdout clean, and stores the token", async () => {
      const github = successfulGitHub();
      const code = await run(["login"], { fetch: github });

      expect(code).toBe(0);
      expect(stdout()).toBe("");
      expect(stderr()).toContain("https://github.com/login/device");
      expect(stderr()).toContain("ABCD-1234");
      expect(stderr()).toContain("octocat");
      expect(stderr()).not.toContain(SECRET_TOKEN);

      const saved = new OAuthTokenStore(tokenFile).read();
      expect(saved.status === "ok" && saved.token).toMatchObject({
        clientId: CLIENT_ID,
        token: SECRET_TOKEN,
        login: "octocat",
      });
      if (process.platform !== "win32") {
        expect(statSync(tokenFile).mode & 0o777).toBe(0o600);
      }
    });

    it("works with no GITHUB_TOKEN, GITHUB_OWNER or GITHUB_REPO anywhere", async () => {
      // `run` only supplies the OAuth variables; nothing server-related exists.
      await expect(run(["login"])).resolves.toBe(0);
    });

    it("requests the scopes given with --scopes and the client id given with --client-id", async () => {
      const github = successfulGitHub();
      await run(["login", "--client-id", "Iv1.flag", "--scopes", "gist,read:user"], {
        fetch: github,
        env: { GITHUB_OAUTH_CLIENT_ID: "" },
      });
      expect(github.requests[0]?.body).toEqual({
        client_id: "Iv1.flag",
        scope: "gist read:user",
      });
    });

    it("uses GITHUB_OAUTH_SCOPES, defaulting to repo project read:org", async () => {
      const defaults = successfulGitHub();
      await run(["login"], { fetch: defaults });
      expect(defaults.requests[0]?.body?.scope).toBe("repo project read:org");

      rmSync(root, { recursive: true, force: true });
      const configured = successfulGitHub();
      await run(["login"], { fetch: configured, env: { GITHUB_OAUTH_SCOPES: "repo" } });
      expect(configured.requests[0]?.body?.scope).toBe("repo");
    });

    it("fails non-zero and stores nothing without a client id", async () => {
      const code = await run(["login"], { env: { GITHUB_OAUTH_CLIENT_ID: "" } });
      expect(code).toBe(1);
      expect(stderr()).toContain("GITHUB_OAUTH_CLIENT_ID");
      expect(new OAuthTokenStore(tokenFile).read().status).toBe("absent");
    });

    it("fails non-zero and stores nothing when the user denies access", async () => {
      const code = await run(["login"], {
        fetch: successfulGitHub({ json: { error: "access_denied" } }),
      });
      expect(code).toBe(1);
      expect(stderr()).toContain("denied");
      expect(stdout()).toBe("");
      expect(new OAuthTokenStore(tokenFile).read().status).toBe("absent");
    });

    it("fails non-zero when the device code expires", async () => {
      const code = await run(["login"], {
        fetch: successfulGitHub({ json: { error: "expired_token" } }),
      });
      expect(code).toBe(1);
      expect(stderr()).toContain("expired");
    });

    it("replaces an earlier login instead of keeping the old token", async () => {
      new OAuthTokenStore(tokenFile).save(stored({ token: "gho_old", login: "previous" }));
      await run(["login"]);
      const saved = new OAuthTokenStore(tokenFile).read();
      expect(saved.status === "ok" && saved.token.token).toBe(SECRET_TOKEN);
    });
  });

  describe("status", () => {
    it("exits non-zero and points at login when nobody is logged in", async () => {
      const code = await run(["status"]);
      expect(code).toBe(1);
      expect(stdout()).toContain("not logged in");
      expect(stdout()).toContain(tokenFile);
    });

    it("reports login, scopes, expiry and store path without printing token characters", async () => {
      new OAuthTokenStore(tokenFile).save(
        stored({
          expiresAt: new Date(Date.now() + 3 * 3_600_000).toISOString(),
          refreshToken: "ghr_refresh_secret",
          refreshTokenExpiresAt: new Date(Date.now() + 100 * 86_400_000).toISOString(),
        })
      );

      const code = await run(["status"]);

      expect(code).toBe(0);
      const report = stdout();
      expect(report).toContain("octocat");
      expect(report).toContain("repo project");
      expect(report).toContain(tokenFile);
      expect(report).toContain("oauth-user");
      expect(report).toContain("expiring (refreshable)");
      expect(report).toMatch(/\(in 3h\)/);
      expect(report).not.toContain("gho_");
      expect(report).not.toContain("ghr_");
      expect(report).not.toContain("supersecret");
      expect(stderr()).toBe("");
    });

    it("says a non-expiring token never expires", async () => {
      new OAuthTokenStore(tokenFile).save(stored());
      await run(["status"]);
      expect(stdout()).toContain("non-expiring");
    });

    it("exits non-zero when the token expired and cannot be refreshed", async () => {
      new OAuthTokenStore(tokenFile).save(
        stored({
          expiresAt: new Date(Date.now() - 3_600_000).toISOString(),
          refreshToken: "ghr_x",
          refreshTokenExpiresAt: new Date(Date.now() - 1000).toISOString(),
        })
      );
      const code = await run(["status"]);
      expect(code).toBe(1);
      expect(stdout()).toContain("auth login");
    });

    it.skipIf(process.platform === "win32")(
      "flags a group/other-readable file as insecure and exits non-zero",
      async () => {
        new OAuthTokenStore(tokenFile).save(stored());
        chmodSync(tokenFile, 0o644);

        const code = await run(["status"]);

        expect(code).toBe(1);
        expect(stdout()).toContain("INSECURE");
        expect(stdout()).toContain("0644");
        expect(stdout()).not.toContain(SECRET_TOKEN);
      }
    );

    it("flags a token that belongs to a different client id", async () => {
      new OAuthTokenStore(tokenFile).save(stored({ clientId: "Iv1.other" }));
      const code = await run(["status"]);
      expect(code).toBe(1);
      expect(stdout()).toContain("different client id");
    });

    it("flags a corrupt file", async () => {
      new OAuthTokenStore(tokenFile).save(stored());
      writeFileSync(tokenFile, "{ broken", { mode: 0o600 });
      const code = await run(["status"]);
      expect(code).toBe(1);
      expect(stdout()).toContain("invalid");
    });
  });

  describe("logout", () => {
    it("deletes the file and gives the manual revocation URL when no secret is configured", async () => {
      new OAuthTokenStore(tokenFile).save(stored());
      const github = successfulGitHub();

      const code = await run(["logout"], { fetch: github });

      expect(code).toBe(0);
      expect(new OAuthTokenStore(tokenFile).read().status).toBe("absent");
      expect(stderr()).toContain(
        `https://github.com/settings/connections/applications/${CLIENT_ID}`
      );
      expect(github.requests).toEqual([]);
      expect(stdout()).toBe("");
    });

    it("revokes through the GitHub API with Basic auth when the client secret is available", async () => {
      new OAuthTokenStore(tokenFile).save(stored());
      const github = successfulGitHub();

      const code = await run(["logout"], {
        fetch: github,
        env: { GITHUB_OAUTH_CLIENT_SECRET: "s3cret" },
      });

      expect(code).toBe(0);
      const [revoke] = github.requests;
      expect(revoke?.method).toBe("DELETE");
      expect(revoke?.url).toBe(`https://api.github.com/applications/${CLIENT_ID}/token`);
      expect(revoke?.headers.authorization).toBe(
        `Basic ${Buffer.from(`${CLIENT_ID}:s3cret`).toString("base64")}`
      );
      expect(revoke?.body).toEqual({ access_token: SECRET_TOKEN });
      expect(stderr()).toContain("revoked");
      expect(new OAuthTokenStore(tokenFile).read().status).toBe("absent");
    });

    it("still deletes the local file when GitHub refuses the revocation", async () => {
      new OAuthTokenStore(tokenFile).save(stored());
      const github = createFakeFetch(() => ({ status: 401, json: { message: "Bad credentials" } }));

      const code = await run(["logout"], {
        fetch: github,
        env: { GITHUB_OAUTH_CLIENT_SECRET: "wrong" },
      });

      expect(code).toBe(0);
      expect(stderr()).toContain("Could not revoke");
      expect(stderr()).toContain("settings/connections/applications");
      expect(new OAuthTokenStore(tokenFile).read().status).toBe("absent");
    });

    it("deletes an unreadable file too, so a broken login can always be cleared", async () => {
      new OAuthTokenStore(tokenFile).save(stored());
      writeFileSync(tokenFile, "garbage", { mode: 0o600 });
      const code = await run(["logout"]);
      expect(code).toBe(0);
      expect(() => readFileSync(tokenFile)).toThrow();
    });

    it("is a no-op success when nobody is logged in", async () => {
      const code = await run(["logout"]);
      expect(code).toBe(0);
      expect(stderr()).toContain("Not logged in");
    });
  });

  describe("usage", () => {
    it("exits 2 for an unknown subcommand and writes nothing to stdout", async () => {
      const code = await run(["frobnicate"]);
      expect(code).toBe(2);
      expect(stdout()).toBe("");
    });
  });
});
