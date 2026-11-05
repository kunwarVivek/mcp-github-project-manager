import { afterEach, describe, expect, it, vi } from "vitest";
import { getGitHubAppCredentials } from "../../../../../env";
import {
  type GitHubAuth,
  GitHubAuthUnavailableError,
} from "../../../../../infrastructure/github/auth/GitHubAuth";
import { GhTokenSource } from "../../../../../infrastructure/github/auth/gh/GhTokenSource";
import {
  type GitHubAuthSources,
  resolveGitHubAuth,
} from "../../../../../infrastructure/github/auth/resolveGitHubAuth";
import { fakeGhRunner } from "../../../../helpers/fakeGhRunner";
import { tokenAuth } from "../../../../helpers/githubAuth";

/** A GhTokenSource backed by a fake runner that always answers `token`. */
function ghSource(token: string): GhTokenSource {
  return new GhTokenSource({ runner: fakeGhRunner({ token }) });
}

const APP = { appId: "123", privateKey: "pem", installationId: "456" };

const storedOAuth: GitHubAuth = {
  mode: "oauth-user",
  source: "oauth-store",
  octokitAuth: () => ({ auth: "stored" }),
  getToken: async () => "stored",
};

/** Every tier populated; individual tests knock tiers out from the top. */
function sources(overrides: Partial<GitHubAuthSources> = {}): GitHubAuthSources {
  return {
    hermetic: () => false,
    appCredentials: () => APP,
    cliToken: () => "cli-token",
    configuredToken: () => ({ source: "secrets-dir", read: () => "dir-token" }),
    storedOAuth: () => storedOAuth,
    ghTokenSource: () => ghSource("gh-token"),
    ...overrides,
  };
}

const none = {
  appCredentials: () => undefined,
  cliToken: () => undefined,
  configuredToken: () => undefined,
  storedOAuth: () => undefined,
  ghTokenSource: () => undefined,
} satisfies Partial<GitHubAuthSources>;

describe("resolveGitHubAuth precedence", () => {
  it("prefers a complete GitHub App over every token source", () => {
    const auth = resolveGitHubAuth(sources());
    expect(auth).toMatchObject({ mode: "app-installation", source: "github-app" });
    expect(auth.octokitAuth().auth).toMatchObject(APP);
  });

  it("prefers the --token flag over mounted, env, stored and gh tokens", async () => {
    const auth = resolveGitHubAuth(sources({ appCredentials: () => undefined }));
    expect(auth).toMatchObject({ mode: "token", source: "cli-flag" });
    expect(await auth.getToken()).toBe("cli-token");
  });

  it("prefers a SECRETS_DIR token over the env var, reporting the true tier", async () => {
    const auth = resolveGitHubAuth(
      sources({ appCredentials: () => undefined, cliToken: () => undefined })
    );
    expect(auth).toMatchObject({ mode: "token", source: "secrets-dir" });
    expect(await auth.getToken()).toBe("dir-token");
  });

  it("reports the env tier when the env var supplied the token", () => {
    const auth = resolveGitHubAuth(
      sources({
        ...none,
        configuredToken: () => ({ source: "env", read: () => "env-token" }),
      })
    );
    expect(auth).toMatchObject({ mode: "token", source: "env" });
  });

  it("ranks a stored OAuth login above gh but below any explicit token", () => {
    expect(resolveGitHubAuth(sources({ ...none, storedOAuth: () => storedOAuth }))).toBe(
      storedOAuth
    );
    const withEnv = resolveGitHubAuth(
      sources({
        ...none,
        storedOAuth: () => storedOAuth,
        configuredToken: () => ({ source: "env", read: () => "t" }),
      })
    );
    expect(withEnv.source).toBe("env");
  });

  it("falls back to gh auth token last", async () => {
    const auth = resolveGitHubAuth(sources({ ...none, ghTokenSource: () => ghSource("gh-token") }));
    expect(auth).toMatchObject({ mode: "token", source: "gh-cli" });
    expect(await auth.getToken()).toBe("gh-token");
  });

  it("does not consult lower tiers once a higher one answers", () => {
    const touched: string[] = [];
    resolveGitHubAuth(
      sources({
        cliToken: () => {
          touched.push("cli");
          return "cli-token";
        },
        configuredToken: () => {
          touched.push("configured");
          return undefined;
        },
        storedOAuth: () => {
          touched.push("stored");
          return undefined;
        },
        ghTokenSource: () => {
          touched.push("gh");
          return undefined;
        },
        appCredentials: () => undefined,
      })
    );
    expect(touched).toEqual(["cli"]);
  });

  it("allows an App-only deployment with no token anywhere", () => {
    const auth = resolveGitHubAuth(sources({ ...none, appCredentials: () => APP }));
    expect(auth).toMatchObject({ mode: "app-installation", source: "github-app" });
  });

  it("throws GitHubAuthUnavailableError listing every method when nothing is available", () => {
    const attempt = () => resolveGitHubAuth(sources(none));
    expect(attempt).toThrow(GitHubAuthUnavailableError);
    expect(attempt).toThrow(/auth login/);
    expect(attempt).toThrow(/GITHUB_APP_ID/);
    expect(attempt).toThrow(/`gh` CLI/);
  });

  it("returns the hermetic test credential and consults nothing under test", async () => {
    const consulted: string[] = [];
    const spy = (name: string) => () => {
      consulted.push(name);
      return undefined;
    };
    const auth = resolveGitHubAuth({
      hermetic: () => true,
      appCredentials: spy("app"),
      cliToken: spy("cli"),
      configuredToken: spy("configured"),
      storedOAuth: spy("stored"),
      ghTokenSource: spy("gh"),
    });
    expect(auth).toMatchObject({ mode: "token", source: "test" });
    expect(await auth.getToken()).toBe("test-token");
    expect(consulted).toEqual([]);
  });
});

describe("resolveGitHubAuth defaults (live configuration)", () => {
  it("is hermetic under NODE_ENV=test", () => {
    expect(resolveGitHubAuth()).toMatchObject({ mode: "token", source: "test" });
  });

  it("tokenAuth helper yields the same shape the resolver produces under test", async () => {
    const auth = tokenAuth();
    expect(auth).toMatchObject({ mode: "token", source: "test" });
    expect(auth.octokitAuth().authStrategy).toBeTypeOf("function");
    expect(await auth.getToken()).toBe("test-token");
  });
});

describe("GitHub App configuration feeding the resolver", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("a partial App configuration yields no credentials, so resolution falls through", () => {
    vi.stubEnv("GITHUB_APP_ID", "123");
    vi.stubEnv("GITHUB_APP_INSTALLATION_ID", "456");
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "");
    expect(getGitHubAppCredentials()).toBeUndefined();

    const auth = resolveGitHubAuth(
      sources({ appCredentials: getGitHubAppCredentials, cliToken: () => "cli-token" })
    );
    expect(auth).toMatchObject({ mode: "token", source: "cli-flag" });
  });

  it("a complete App configuration is used, with escaped newlines in the key restored", () => {
    vi.stubEnv("GITHUB_APP_ID", "123");
    vi.stubEnv("GITHUB_APP_INSTALLATION_ID", "456");
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "line1\\nline2");

    const auth = resolveGitHubAuth(sources({ appCredentials: getGitHubAppCredentials }));
    expect(auth).toMatchObject({ mode: "app-installation", source: "github-app" });
    expect(auth.octokitAuth().auth).toMatchObject({ privateKey: "line1\nline2" });
  });
});
