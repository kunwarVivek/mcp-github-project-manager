import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Same constraint as auth-cli.test.ts: the auth commands must not load env.ts.
vi.mock("../../env", () => {
  throw new Error("auth CLI must not load src/env.ts");
});

import { runAuthCli } from "../../auth-cli";
import { OAuthTokenStore } from "../../infrastructure/github/auth/oauth/OAuthTokenStore";
import { fakeGhRunner } from "../helpers/fakeGhRunner";

const OLD = "gho_old_token_value";
const FULL = "gho_full_token_value";
const FINE = "github_pat_fine_grained_value";
const STORED = "gho_stored_oauth_token";
const ALL_TOKENS = [OLD, FULL, FINE, STORED, "ghp_env_token_value"];

interface Account {
  login: string;
  scopes: string | null;
}

/** GET /user keyed by the token in the Authorization header. */
function githubUsers(accounts: Record<string, Account>) {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    const token = new Headers(init?.headers).get("authorization")?.replace(/^token /, "") ?? "";
    const account = accounts[token];
    if (!account) return new Response("{}", { status: 401 });
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (account.scopes !== null) headers["x-oauth-scopes"] = account.scopes;
    return new Response(JSON.stringify({ login: account.login }), { status: 200, headers });
  });
}

const FULL_SCOPES = "repo, project, read:org, gist";
const NO_PROJECT = "repo, read:org, gist";

describe("auth CLI: GitHub CLI (gh) support", () => {
  let root: string;
  let tokenFile: string;
  let out: string[];
  let err: string[];

  const run = (
    argv: string[],
    options: {
      runner?: ReturnType<typeof fakeGhRunner>;
      fetch?: ReturnType<typeof githubUsers>;
      env?: Record<string, string>;
    } = {}
  ) =>
    runAuthCli(argv, {
      io: { stdout: (text) => out.push(text), stderr: (text) => err.push(text) },
      fetch: (options.fetch ?? githubUsers({})) as unknown as typeof fetch,
      ghRunner: options.runner ?? fakeGhRunner({ failToken: true }),
      loadDotenv: false,
      env: {
        NODE_ENV: "production",
        HOME: root,
        XDG_CONFIG_HOME: root,
        GITHUB_OAUTH_TOKEN_FILE: tokenFile,
        ...options.env,
      },
    });
  const stdout = () => out.join("");
  const stderr = () => err.join("");

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "auth-cli-gh-"));
    tokenFile = join(root, "cfg", "github-oauth.json");
    out = [];
    err = [];
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function expectNoTokens() {
    for (const token of ALL_TOKENS) {
      expect(stdout()).not.toContain(token);
      expect(stderr()).not.toContain(token);
    }
  }

  describe("status", () => {
    it("reports the gh account, scopes, missing scope with the exact fix, and the effective credential", async () => {
      const runner = fakeGhRunner({ token: OLD });
      const code = await run(["status"], {
        runner,
        fetch: githubUsers({ [OLD]: { login: "DEVTekhsters", scopes: NO_PROJECT } }),
      });

      const text = stdout();
      expect(text).toContain("GitHub CLI (gh):");
      expect(text).toContain("Installed: yes");
      expect(text).toContain("Account: DEVTekhsters (gh's active account)");
      expect(text).toContain("Scopes: repo, read:org, gist");
      expect(text).toContain(
        "Missing required scopes: project - fix: gh auth refresh -h github.com -s project"
      );
      expect(text).toContain("Effective credential: token (gh-cli)");
      expect(text).not.toContain("shadows");
      // gh is the effective credential, so the exit code is 0 despite the missing scope.
      expect(code).toBe(0);
      expectNoTokens();
    });

    it("says so when GH_CLI_USER pins the account and passes --user to gh", async () => {
      const runner = fakeGhRunner({ token: FULL });
      await run(["status"], {
        runner,
        env: { GH_CLI_USER: "kunwarVivek" },
        fetch: githubUsers({ [FULL]: { login: "kunwarVivek", scopes: FULL_SCOPES } }),
      });
      expect(stdout()).toContain("Account: kunwarVivek (pinned by GH_CLI_USER)");
      expect(stdout()).toContain("Scope check: ok");
      expect(runner.captures).toContainEqual([
        "auth",
        "token",
        "--hostname",
        "github.com",
        "--user",
        "kunwarVivek",
      ]);
    });

    it("recommends read:org separately from the required scopes", async () => {
      await run(["status"], {
        runner: fakeGhRunner({ token: OLD }),
        fetch: githubUsers({ [OLD]: { login: "a", scopes: "repo, project" } }),
      });
      expect(stdout()).toContain("Missing recommended scopes: read:org");
      expect(stdout()).not.toContain("Missing required scopes");
    });

    it("shows unknown scopes for a fine-grained token without warning about a gap", async () => {
      await run(["status"], {
        runner: fakeGhRunner({ token: FINE }),
        fetch: githubUsers({ [FINE]: { login: "a", scopes: null } }),
      });
      expect(stdout()).toContain("Scopes: unknown (fine-grained token");
      expect(stdout()).not.toContain("Missing");
    });

    it("notes when GITHUB_TOKEN shadows gh, and how to stop it", async () => {
      await run(["status"], {
        runner: fakeGhRunner({ token: OLD }),
        env: { GITHUB_TOKEN: "ghp_env_token_value" },
        fetch: githubUsers({ [OLD]: { login: "a", scopes: FULL_SCOPES } }),
      });
      expect(stdout()).toContain("Effective credential: token (env)");
      expect(stdout()).toContain("shadows the gh credential");
      expect(stdout()).toContain("unset GITHUB_TOKEN");
      expectNoTokens();
    });

    it("notes when a stored OAuth login shadows gh and points to `auth logout`", async () => {
      new OAuthTokenStore(tokenFile).save({
        clientId: "Iv1.client",
        token: STORED,
        tokenType: "bearer",
        scopes: ["repo"],
        login: "octocat",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      const code = await run(["status"], {
        runner: fakeGhRunner({ token: OLD }),
        env: { GITHUB_OAUTH_CLIENT_ID: "Iv1.client" },
        fetch: githubUsers({ [OLD]: { login: "a", scopes: FULL_SCOPES } }),
      });
      expect(stdout()).toContain("Effective credential: oauth-user (oauth-store)");
      expect(stdout()).toContain("auth logout");
      expect(code).toBe(0);
      expectNoTokens();
    });

    describe("exit code = effective credential", () => {
      const fullGh = () => ({
        runner: fakeGhRunner({ token: FULL }),
        fetch: githubUsers({ [FULL]: { login: "a", scopes: FULL_SCOPES } }),
      });

      it("is 0 for a gh-only credential", async () => {
        expect(await run(["status"], fullGh())).toBe(0);
      });

      it("is 0 for an under-scoped gh token (the scope warning never changes it)", async () => {
        const code = await run(["status"], {
          runner: fakeGhRunner({ token: OLD }),
          fetch: githubUsers({ [OLD]: { login: "a", scopes: NO_PROJECT } }),
        });
        expect(stdout()).toContain("Missing required scopes: project");
        expect(code).toBe(0);
      });

      it("is 0 for a GITHUB_TOKEN env credential even with no gh", async () => {
        const code = await run(["status"], {
          runner: fakeGhRunner({ missing: true }),
          env: { GITHUB_TOKEN: "ghp_env_token_value" },
        });
        expect(code).toBe(0);
      });

      it("is 1 when nothing is configured", async () => {
        expect(await run(["status"], { runner: fakeGhRunner({ failToken: true }) })).toBe(1);
      });

      it("is 1 when gh works but the fallback is disabled", async () => {
        expect(
          await run(["status"], { ...fullGh(), env: { GH_CLI_TOKEN_FALLBACK: "false" } })
        ).toBe(1);
      });

      it("is 1 for an expired, unrefreshable stored login with nothing else", async () => {
        new OAuthTokenStore(tokenFile).save({
          clientId: "Iv1.client",
          token: STORED,
          tokenType: "bearer",
          scopes: ["repo"],
          login: "octocat",
          createdAt: "2020-01-01T00:00:00.000Z",
          expiresAt: "2020-01-01T08:00:00.000Z",
        });
        const code = await run(["status"], {
          runner: fakeGhRunner({ failToken: true }),
          env: { GITHUB_OAUTH_CLIENT_ID: "Iv1.client" },
        });
        expect(stdout()).toContain("expired");
        expect(code).toBe(1);
      });
    });

    it("explains a missing gh with the install link, and a logged-out gh with the login command", async () => {
      await run(["status"], { runner: fakeGhRunner({ missing: true }) });
      expect(stdout()).toContain("Installed: no (install it from https://cli.github.com)");
      expect(stdout()).toContain("Effective credential: none");

      out = [];
      await run(["status"], { runner: fakeGhRunner({ failToken: true }) });
      expect(stdout()).toContain(
        "not logged in - run `mcp-github-project-manager auth login --gh`"
      );
    });

    it("reports gh as unused when the fallback is disabled", async () => {
      await run(["status"], {
        runner: fakeGhRunner({ token: OLD }),
        env: { NODE_ENV: "test" },
        fetch: githubUsers({ [OLD]: { login: "a", scopes: FULL_SCOPES } }),
      });
      expect(stdout()).toContain("Fallback: disabled");
      expect(stdout()).toContain("Effective credential: none");
    });
  });

  describe("login --gh", () => {
    it("exits 1 with an install hint when gh is missing, running nothing interactive", async () => {
      const runner = fakeGhRunner({ missing: true });
      expect(await run(["login", "--gh"], { runner })).toBe(1);
      expect(stderr()).toContain("https://cli.github.com");
      expect(runner.interactiveCalls).toEqual([]);
    });

    it("does nothing but report when gh is logged in with every scope", async () => {
      const runner = fakeGhRunner({ token: FULL });
      const code = await run(["login", "--gh"], {
        runner,
        fetch: githubUsers({ [FULL]: { login: "kunwarVivek", scopes: FULL_SCOPES } }),
      });
      expect(code).toBe(0);
      expect(runner.interactiveCalls).toEqual([]);
      expect(stderr()).toContain("GitHub CLI account: kunwarVivek");
      expect(stderr()).toContain("Scopes: repo, project, read:org, gist");
      expect(stderr()).toContain("The server will use this gh login");
      expect(stdout()).toBe("");
      expectNoTokens();
    });

    it("refreshes interactively when project is missing, then verifies the new scopes", async () => {
      const runner = fakeGhRunner({
        token: OLD,
        interactive: () => {
          runner.token = FULL;
          return { status: "exited", code: 0 };
        },
      });
      const code = await run(["login", "--gh"], {
        runner,
        fetch: githubUsers({
          [OLD]: { login: "DEVTekhsters", scopes: NO_PROJECT },
          [FULL]: { login: "DEVTekhsters", scopes: FULL_SCOPES },
        }),
      });
      expect(runner.interactiveCalls).toEqual([
        ["auth", "refresh", "-h", "github.com", "-s", "project,read:org"],
      ]);
      expect(code).toBe(0);
      expect(stderr()).toContain("missing scopes: project");
      expect(stderr()).toContain("Scopes: repo, project, read:org, gist");
      expect(stdout()).toBe("");
      expectNoTokens();
    });

    it("fails when the refresh did not grant the scope", async () => {
      const runner = fakeGhRunner({ token: OLD });
      const code = await run(["login", "--gh"], {
        runner,
        fetch: githubUsers({ [OLD]: { login: "a", scopes: NO_PROJECT } }),
      });
      expect(code).toBe(1);
      expect(stderr()).toContain("Still missing required scopes: project");
    });

    it("fails when gh itself exits non-zero", async () => {
      const runner = fakeGhRunner({
        token: OLD,
        interactive: () => ({ status: "exited", code: 4 }),
      });
      const code = await run(["login", "--gh"], {
        runner,
        fetch: githubUsers({ [OLD]: { login: "a", scopes: NO_PROJECT } }),
      });
      expect(code).toBe(1);
      expect(stderr()).toContain("exited with code 4");
    });

    it("runs `gh auth login` with the full scope set when gh is not logged in", async () => {
      const runner = fakeGhRunner({
        failToken: true,
        interactive: () => {
          runner.failToken = false;
          runner.token = FULL;
          return { status: "exited", code: 0 };
        },
      });
      const code = await run(["login", "--gh"], {
        runner,
        fetch: githubUsers({ [FULL]: { login: "kunwarVivek", scopes: FULL_SCOPES } }),
      });
      expect(runner.interactiveCalls).toEqual([
        ["auth", "login", "-h", "github.com", "-s", "repo,project,read:org", "--web"],
      ]);
      expect(code).toBe(0);
      expect(stderr()).toContain("kunwarVivek");
      expectNoTokens();
    });

    it("refuses to refresh a pinned account that is not gh's active account", async () => {
      const runner = fakeGhRunner();
      // `--user` reads the pinned account's token; the unpinned read returns the active one.
      runner.token = () => {
        const last = runner.captures.at(-1) ?? [];
        return last.includes("--user") ? OLD : FULL;
      };
      const code = await run(["login", "--gh"], {
        runner,
        env: { GH_CLI_USER: "DEVTekhsters" },
        fetch: githubUsers({
          [OLD]: { login: "DEVTekhsters", scopes: NO_PROJECT },
          [FULL]: { login: "kunwarVivek", scopes: FULL_SCOPES },
        }),
      });
      expect(code).toBe(1);
      expect(stderr()).toContain("gh auth switch -h github.com -u DEVTekhsters");
      expect(runner.interactiveCalls).toEqual([]);
    });

    it("says when a higher-priority credential will shadow the gh login", async () => {
      const code = await run(["login", "--gh"], {
        runner: fakeGhRunner({ token: FULL }),
        env: { GITHUB_TOKEN: "ghp_env_token_value" },
        fetch: githubUsers({ [FULL]: { login: "a", scopes: FULL_SCOPES } }),
      });
      expect(code).toBe(0);
      expect(stderr()).toContain("will NOT use this gh login");
      expect(stderr()).toContain("unset GITHUB_TOKEN");
      expectNoTokens();
    });

    it.each([
      ["--client-id", ["login", "--gh", "--client-id", "Iv1.x"]],
      ["--scopes", ["login", "--gh", "--scopes", "repo"]],
    ])("rejects --gh combined with %s as a usage error (exit 2)", async (_name, argv) => {
      const runner = fakeGhRunner({ token: FULL });
      expect(await run(argv, { runner })).toBe(2);
      expect(runner.captures).toEqual([]);
      expect(runner.interactiveCalls).toEqual([]);
    });
  });
});
