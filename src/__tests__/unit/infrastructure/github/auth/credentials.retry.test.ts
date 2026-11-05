import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTokenAuth } from "../../../../../infrastructure/github/auth/credentials";
import { GhTokenSource } from "../../../../../infrastructure/github/auth/gh/GhTokenSource";
import { selectGitHubAuth } from "../../../../../infrastructure/github/auth/selectGitHubAuth";
import { GitHubRepositoryFactory } from "../../../../../infrastructure/github/GitHubRepositoryFactory";
import { fakeGhRunner } from "../../../../helpers/fakeGhRunner";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("token auth: refresh on 401", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const authorizations = () =>
    fetchMock.mock.calls.map(([, init]) => new Headers(init?.headers).get("authorization"));
  const call = (auth: ReturnType<typeof createTokenAuth>) =>
    GitHubRepositoryFactory.fromAuth(auth, "o", "r").getOctokit().rest.users.getAuthenticated();

  it("retries once with the re-read token when GitHub answers 401 and the token changed", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ message: "Bad credentials" }, 401))
      .mockResolvedValueOnce(json({ login: "octocat" }));
    let token = "gho_old";
    const refresh = vi.fn(() => {
      token = "gho_new";
      return token;
    });

    const response = await call(createTokenAuth(() => token, "gh-cli", { refresh }));

    expect(response.data.login).toBe("octocat");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(authorizations()).toEqual(["token gho_old", "token gho_new"]);
  });

  it("does not retry when the re-read token is unchanged", async () => {
    fetchMock.mockResolvedValue(json({ message: "Bad credentials" }, 401));
    const refresh = vi.fn(() => "gho_same");

    await expect(
      call(createTokenAuth(() => "gho_same", "gh-cli", { refresh }))
    ).rejects.toMatchObject({
      status: 401,
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry when no token is available after the re-read", async () => {
    fetchMock.mockResolvedValue(json({ message: "Bad credentials" }, 401));
    await expect(
      call(createTokenAuth(() => "gho_x", "gh-cli", { refresh: () => undefined }))
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries at most once even if the new token is rejected too", async () => {
    fetchMock.mockResolvedValue(json({ message: "Bad credentials" }, 401));
    const refresh = vi.fn(() => "gho_new");

    await expect(
      call(createTokenAuth(() => "gho_old", "gh-cli", { refresh }))
    ).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not refresh for non-401 errors", async () => {
    fetchMock.mockResolvedValue(json({ message: "Forbidden" }, 403));
    const refresh = vi.fn(() => "gho_new");
    await expect(
      call(createTokenAuth(() => "gho_old", "gh-cli", { refresh }))
    ).rejects.toMatchObject({
      status: 403,
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("leaves tiers without a refresh option untouched (no retry on 401)", async () => {
    fetchMock.mockResolvedValue(json({ message: "Bad credentials" }, 401));
    await expect(call(createTokenAuth(() => "ghp_env", "env"))).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gh tier end to end: a token rotated in gh is used after a 401, without a restart", async () => {
    let now = 0;
    const runner = fakeGhRunner({ token: "gho_old" });
    const source = new GhTokenSource({ runner, now: () => now });
    const auth = selectGitHubAuth({
      hermetic: () => false,
      appCredentials: () => undefined,
      cliToken: () => undefined,
      configuredToken: () => undefined,
      storedOAuth: () => undefined,
      ghTokenSource: () => source,
    });
    expect(auth.source).toBe("gh-cli");

    // `gh auth refresh` / re-login happened, but the 60 s cache still holds the old token.
    runner.token = "gho_rotated";
    now += 5_000;
    fetchMock
      .mockResolvedValueOnce(json({ message: "Bad credentials" }, 401))
      .mockResolvedValueOnce(json({ login: "octocat" }));

    await call(auth);

    expect(authorizations()).toEqual(["token gho_old", "token gho_rotated"]);
    expect(runner.captures.filter((args) => args[0] === "auth")).toHaveLength(2);
  });
});
