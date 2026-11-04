import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  OAuthTokenStore,
  type StoredOAuthToken,
} from "../../../../../../infrastructure/github/auth/oauth/OAuthTokenStore";

const posixOnly = it.skipIf(process.platform === "win32");

function sampleToken(overrides: Partial<StoredOAuthToken> = {}): StoredOAuthToken {
  return {
    clientId: "Iv1.client",
    token: "gho_secret_value",
    tokenType: "bearer",
    scopes: ["repo", "project"],
    login: "octocat",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("OAuthTokenStore", () => {
  let root: string;
  let path: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "oauth-store-"));
    path = join(root, "nested", "config", "github-oauth.json");
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("reports absent when there is no file", () => {
    expect(new OAuthTokenStore(path).read()).toEqual({ status: "absent" });
  });

  it("round-trips every field, including refresh expiry", () => {
    const store = new OAuthTokenStore(path);
    const token = sampleToken({
      expiresAt: "2026-01-01T08:00:00.000Z",
      refreshToken: "ghr_refresh",
      refreshTokenExpiresAt: "2026-07-01T00:00:00.000Z",
    });
    store.save(token);
    expect(store.read()).toEqual({ status: "ok", token });
  });

  posixOnly("creates the directory 0700 and the file 0600", () => {
    new OAuthTokenStore(path).save(sampleToken());
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(statSync(join(root, "nested", "config")).mode & 0o777).toBe(0o700);
  });

  posixOnly("keeps the file 0600 when overwriting", () => {
    const store = new OAuthTokenStore(path);
    store.save(sampleToken());
    store.save(sampleToken({ token: "gho_rotated" }));
    expect(statSync(path).mode & 0o777).toBe(0o600);
    const read = store.read();
    expect(read.status === "ok" && read.token.token).toBe("gho_rotated");
  });

  it("leaves no temp file behind after a successful write", () => {
    new OAuthTokenStore(path).save(sampleToken());
    expect(readdirSync(join(root, "nested", "config"))).toEqual(["github-oauth.json"]);
  });

  it("cleans up its temp file when the final rename fails", () => {
    // Renaming a file over a non-empty directory fails after the temp file exists.
    const blocked = join(root, "blocked");
    mkdirSync(blocked);
    writeFileSync(join(blocked, "occupied"), "x");

    expect(() => new OAuthTokenStore(blocked).save(sampleToken())).toThrow();
    expect(readdirSync(root).sort()).toEqual(["blocked"]);
    expect(readdirSync(blocked)).toEqual(["occupied"]);
  });

  posixOnly.each([0o644, 0o640, 0o604])("refuses a file with mode %o", (mode) => {
    const store = new OAuthTokenStore(path);
    store.save(sampleToken());
    chmodSync(path, mode);
    expect(store.read()).toEqual({ status: "insecure-permissions", mode });
  });

  it("treats non-JSON content as corrupt without echoing it", () => {
    mkdirSync(join(root, "nested", "config"), { recursive: true });
    writeFileSync(path, "gho_leaked {not json", { mode: 0o600 });
    const result = new OAuthTokenStore(path).read();
    expect(result.status).toBe("corrupt");
    expect(JSON.stringify(result)).not.toContain("gho_leaked");
  });

  it.each([
    ["missing login", { login: undefined }],
    ["empty token", { token: "" }],
    ["non-ISO createdAt", { createdAt: "yesterday" }],
    ["refresh token without expiries", { refreshToken: "ghr_x" }],
  ])("rejects a file with %s", (_name, override) => {
    mkdirSync(join(root, "nested", "config"), { recursive: true });
    writeFileSync(path, JSON.stringify({ ...sampleToken(), ...override }), { mode: 0o600 });
    expect(new OAuthTokenStore(path).read().status).toBe("corrupt");
  });

  it("refuses to save a malformed token rather than persisting it", () => {
    const store = new OAuthTokenStore(path);
    expect(() => store.save(sampleToken({ token: "" }))).toThrow();
    expect(store.read()).toEqual({ status: "absent" });
  });

  it("clear() removes the file and tolerates a missing one", () => {
    const store = new OAuthTokenStore(path);
    store.save(sampleToken());
    store.clear();
    expect(store.read()).toEqual({ status: "absent" });
    expect(() => store.clear()).not.toThrow();
  });
});
