import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getConfiguredGitHubToken } from "../../../../../env";
import {
  createAppInstallationAuth,
  createTokenAuth,
} from "../../../../../infrastructure/github/auth/credentials";
import { GitHubAuthUnavailableError } from "../../../../../infrastructure/github/auth/GitHubAuth";
import { resolveGitHubAuth } from "../../../../../infrastructure/github/auth/resolveGitHubAuth";
import { GitHubRepositoryFactory } from "../../../../../infrastructure/github/GitHubRepositoryFactory";
import { readSecretFromTier } from "../../../../../infrastructure/secrets/SecretProvider";
import { tokenAuth } from "../../../../helpers/githubAuth";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function recordedRequests(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    method: (init?.method ?? "GET") as string,
    authorization: new Headers(init?.headers).get("authorization"),
  }));
}

describe("GitHubRepositoryFactory authentication", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("authenticates requests with the token the auth object supplies", async () => {
    fetchMock.mockResolvedValue(json({ login: "octocat" }));
    const factory = GitHubRepositoryFactory.fromAuth(tokenAuth("ghp_static123"), "o", "r");

    await factory.getOctokit().rest.users.getAuthenticated();

    const [request] = recordedRequests(fetchMock);
    expect(request.url).toBe("https://api.github.com/user");
    expect(request.authorization).toMatch(/^(token|bearer) ghp_static123$/);
  });

  it("uses an App installation strategy: signs a JWT, mints an installation token, then calls the API with it", async () => {
    fetchMock.mockImplementation(async (url: string | URL) => {
      if (String(url).endsWith("/app/installations/456/access_tokens")) {
        return json(
          {
            token: "ghs_minted",
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            permissions: {},
            repository_selection: "all",
          },
          201
        );
      }
      return json({ login: "app-bot" });
    });
    const auth = createAppInstallationAuth({ appId: "123", privateKey, installationId: "456" });
    const factory = GitHubRepositoryFactory.fromAuth(auth, "o", "r");

    await factory.getOctokit().rest.users.getAuthenticated();

    const requests = recordedRequests(fetchMock);
    const mint = requests.find((r) => r.url.endsWith("/app/installations/456/access_tokens"));
    const apiCall = requests.find((r) => r.url === "https://api.github.com/user");

    // The mint call is authenticated as the App itself with a signed JWT whose
    // issuer is the App id...
    expect(mint?.method).toBe("POST");
    const jwt = mint?.authorization?.replace(/^bearer /i, "") ?? "";
    expect(jwt.split(".")).toHaveLength(3);
    const claims = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    expect(String(claims.iss)).toBe("123");
    // ...and the actual API call carries the minted installation token, not the JWT.
    expect(apiCall?.authorization).toMatch(/^(token|bearer) ghs_minted$/);
  });

  it("App auth's getToken() returns a currently valid installation token for raw HTTP callers", async () => {
    fetchMock.mockResolvedValue(
      json(
        {
          token: "ghs_for_raw_http",
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          permissions: {},
          repository_selection: "all",
        },
        201
      )
    );
    const auth = createAppInstallationAuth({ appId: "123", privateKey, installationId: "456" });

    await expect(auth.getToken()).resolves.toBe("ghs_for_raw_http");
  });

  describe("token rotation", () => {
    let dir: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), "gh-secrets-"));
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
      vi.unstubAllEnvs();
    });

    it("a factory built once sends the rewritten SECRETS_DIR token on the next request", async () => {
      vi.stubEnv("SECRETS_DIR", dir);
      vi.stubEnv("GITHUB_TOKEN", "");
      writeFileSync(join(dir, "GITHUB_TOKEN"), "ghp_before\n");
      fetchMock.mockImplementation(async () => json({ login: "octocat" }));

      const auth = resolveGitHubAuth({
        hermetic: () => false,
        appCredentials: () => undefined,
        cliToken: () => undefined,
        configuredToken: getConfiguredGitHubToken,
        storedOAuth: () => undefined,
        ghTokenSource: () => undefined,
      });
      expect(auth.source).toBe("secrets-dir");
      const factory = GitHubRepositoryFactory.fromAuth(auth, "o", "r");

      await factory.getOctokit().rest.users.getAuthenticated();
      writeFileSync(join(dir, "GITHUB_TOKEN"), "ghp_after\n");
      await factory.getOctokit().rest.users.getAuthenticated();
      await expect(auth.getToken()).resolves.toBe("ghp_after");

      const [first, second] = recordedRequests(fetchMock);
      expect(first.authorization).toBe("token ghp_before");
      expect(second.authorization).toBe("token ghp_after");
    });

    it("fails the request with GitHubAuthUnavailableError once the tier loses its token", async () => {
      writeFileSync(join(dir, "GITHUB_TOKEN"), "ghp_gone");
      fetchMock.mockImplementation(async () => json({ login: "octocat" }));
      const auth = createTokenAuth(
        () => readSecretFromTier("GITHUB_TOKEN", "secrets-dir", { SECRETS_DIR: dir }),
        "secrets-dir"
      );
      const factory = GitHubRepositoryFactory.fromAuth(auth, "o", "r");

      await factory.getOctokit().rest.users.getAuthenticated();
      rmSync(join(dir, "GITHUB_TOKEN"));

      await expect(factory.getOctokit().rest.users.getAuthenticated()).rejects.toThrow(
        GitHubAuthUnavailableError
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("keeps a cli-flag token constant", async () => {
      fetchMock.mockImplementation(async () => json({ login: "octocat" }));
      const auth = createTokenAuth(() => "ghp_flag", "cli-flag");
      const factory = GitHubRepositoryFactory.fromAuth(auth, "o", "r");

      await factory.getOctokit().rest.users.getAuthenticated();
      await factory.getOctokit().rest.users.getAuthenticated();

      expect(recordedRequests(fetchMock).map((r) => r.authorization)).toEqual([
        "token ghp_flag",
        "token ghp_flag",
      ]);
    });
  });

  it("applies the default and overridden base URL", async () => {
    fetchMock.mockResolvedValue(json({ login: "octocat" }));
    const factory = GitHubRepositoryFactory.fromAuth(tokenAuth(), "o", "r", {
      baseUrl: "https://ghe.example.com/api/v3",
    });

    await factory.getOctokit().rest.users.getAuthenticated();

    expect(recordedRequests(fetchMock)[0].url).toBe("https://ghe.example.com/api/v3/user");
  });

  it("GitHubRepositoryFactory.fromAuth rejects a missing owner or repo", () => {
    expect(() => GitHubRepositoryFactory.fromAuth(tokenAuth(), "", "r")).toThrow(
      "Owner is required"
    );
    expect(() => GitHubRepositoryFactory.fromAuth(tokenAuth(), "o", "")).toThrow(
      "Repository is required"
    );
    expect(GitHubRepositoryFactory.fromAuth(tokenAuth(), "o", "r").getConfig()).toMatchObject({
      owner: "o",
      repo: "r",
    });
  });
});
