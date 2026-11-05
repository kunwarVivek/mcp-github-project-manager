import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_OAUTH_SCOPES,
  defaultTokenFilePath,
  parseScopes,
  readOAuthConfig,
} from "../../../../../../infrastructure/github/auth/oauth/oauthConfig";

describe("oauthConfig", () => {
  describe("defaultTokenFilePath", () => {
    it("uses an absolute XDG_CONFIG_HOME", () => {
      expect(defaultTokenFilePath({ XDG_CONFIG_HOME: "/xdg" }, "/home/u")).toBe(
        "/xdg/mcp-github-project-manager/github-oauth.json"
      );
    });

    it("falls back to ~/.config when XDG_CONFIG_HOME is unset", () => {
      expect(defaultTokenFilePath({}, "/home/u")).toBe(
        "/home/u/.config/mcp-github-project-manager/github-oauth.json"
      );
    });

    it("ignores a relative XDG_CONFIG_HOME, as the XDG spec requires", () => {
      expect(defaultTokenFilePath({ XDG_CONFIG_HOME: "relative/dir" }, "/home/u")).toBe(
        "/home/u/.config/mcp-github-project-manager/github-oauth.json"
      );
    });
  });

  describe("parseScopes", () => {
    it("splits on commas and whitespace and drops duplicates", () => {
      expect(parseScopes("repo, project  read:org,repo")).toEqual(["repo", "project", "read:org"]);
    });
  });

  describe("readOAuthConfig", () => {
    it("reports no client id and the documented scope default when nothing is configured", () => {
      const config = readOAuthConfig({}, { XDG_CONFIG_HOME: "/xdg" });
      expect(config.clientId).toBeUndefined();
      expect(config.clientSecret).toBeUndefined();
      expect(config.scopes).toEqual(parseScopes(DEFAULT_OAUTH_SCOPES));
      expect(config.scopes).toEqual(["repo", "project", "read:org"]);
    });

    it("prefers GITHUB_OAUTH_TOKEN_FILE over XDG_CONFIG_HOME", () => {
      const config = readOAuthConfig(
        {},
        { GITHUB_OAUTH_TOKEN_FILE: "/custom/token.json", XDG_CONFIG_HOME: "/xdg" }
      );
      expect(config.tokenFile).toBe("/custom/token.json");
    });

    it("lets command-line overrides beat the environment", () => {
      const config = readOAuthConfig(
        { clientId: "from-flag", scopes: "gist" },
        { GITHUB_OAUTH_CLIENT_ID: "from-env", GITHUB_OAUTH_SCOPES: "repo" }
      );
      expect(config.clientId).toBe("from-flag");
      expect(config.scopes).toEqual(["gist"]);
    });

    describe("with SECRETS_DIR", () => {
      let dir: string;
      beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), "oauth-secrets-"));
      });
      afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
      });

      it("reads the client id and secret from mounted secret files ahead of env vars", () => {
        writeFileSync(join(dir, "GITHUB_OAUTH_CLIENT_ID"), "file-id\n");
        writeFileSync(join(dir, "GITHUB_OAUTH_CLIENT_SECRET"), "file-secret\n");
        const config = readOAuthConfig(
          {},
          { SECRETS_DIR: dir, GITHUB_OAUTH_CLIENT_ID: "env-id", NODE_ENV: "test" }
        );
        expect(config.clientId).toBe("file-id");
        expect(config.clientSecret).toBe("file-secret");
      });
    });
  });
});
