import { describe, expect, it, vi } from "vitest";
import { GhTokenSource } from "../../../../../../infrastructure/github/auth/gh/GhTokenSource";
import {
  ghRefreshCommand,
  inspectTokenScopes,
  scopeGaps,
} from "../../../../../../infrastructure/github/auth/gh/ghScopes";
import { warnOnMissingGhScopes } from "../../../../../../infrastructure/github/auth/gh/ghScopeWarning";
import { fakeGhRunner } from "../../../../../helpers/fakeGhRunner";

const TOKEN = "gho_secret_token_value";

function userResponse(scopes: string | null, login = "kunwarVivek", status = 200): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (scopes !== null) headers["x-oauth-scopes"] = scopes;
  return new Response(JSON.stringify({ login }), { status, headers });
}

describe("inspectTokenScopes", () => {
  it("reads X-OAuth-Scopes and the login from GET /user", async () => {
    const fetchMock = vi.fn().mockResolvedValue(userResponse("repo, read:org, gist"));
    const result = await inspectTokenScopes(TOKEN, fetchMock);
    expect(result).toEqual({
      status: "known",
      login: "kunwarVivek",
      scopes: ["repo", "read:org", "gist"],
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.github.com/user");
  });

  it("reports fine-grained tokens (no header) as unknown", async () => {
    const result = await inspectTokenScopes(TOKEN, async () => userResponse(null));
    expect(result).toEqual({ status: "unknown", login: "kunwarVivek" });
  });

  it("treats a classic token with an empty scope list as known-empty", async () => {
    const result = await inspectTokenScopes(TOKEN, async () => userResponse(""));
    expect(result).toMatchObject({ status: "known", scopes: [] });
  });

  it("maps 401 to rejected and failures to unreachable", async () => {
    expect(await inspectTokenScopes(TOKEN, async () => userResponse(null, "x", 401))).toEqual({
      status: "rejected",
    });
    expect(await inspectTokenScopes(TOKEN, async () => userResponse(null, "x", 500))).toEqual({
      status: "unreachable",
    });
    expect(
      await inspectTokenScopes(TOKEN, async () => {
        throw new TypeError("fetch failed");
      })
    ).toEqual({ status: "unreachable" });
  });
});

describe("scopeGaps / ghRefreshCommand", () => {
  it("requires repo and project; recommends read:org", () => {
    expect(scopeGaps(["repo", "read:org", "gist"])).toEqual({
      missingRequired: ["project"],
      missingRecommended: [],
    });
    expect(scopeGaps(["gist"])).toEqual({
      missingRequired: ["repo", "project"],
      missingRecommended: ["read:org"],
    });
  });

  it("accepts admin:org / write:org as read:org", () => {
    expect(scopeGaps(["repo", "project", "admin:org"]).missingRecommended).toEqual([]);
    expect(scopeGaps(["repo", "project", "write:org"]).missingRecommended).toEqual([]);
  });

  it("builds the exact refresh command, adding a switch for a pinned account", () => {
    expect(ghRefreshCommand(["project"])).toBe("gh auth refresh -h github.com -s project");
    expect(ghRefreshCommand(["project"], "DEVTekhsters")).toBe(
      "gh auth switch -h github.com -u DEVTekhsters && gh auth refresh -h github.com -s project"
    );
  });
});

describe("warnOnMissingGhScopes", () => {
  function setup(fetchImpl: typeof fetch, user?: string) {
    const logger = { warn: vi.fn(), debug: vi.fn() };
    const tokenSource = new GhTokenSource({
      runner: fakeGhRunner({ token: TOKEN }),
      user: () => user,
    });
    return { logger, run: () => warnOnMissingGhScopes({ tokenSource, logger, fetch: fetchImpl }) };
  }

  it("warns once, naming the account and the exact fix, when project is missing", async () => {
    const { logger, run } = setup(async () => userResponse("repo, read:org, gist", "DEVTekhsters"));
    await run();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const message = logger.warn.mock.calls[0][0] as string;
    expect(message).toContain("DEVTekhsters");
    expect(message).toContain('"project"');
    expect(message).toContain("gh auth refresh -h github.com -s project");
    expect(message).not.toContain(TOKEN);
  });

  it("is silent when the required scopes are present", async () => {
    const { logger, run } = setup(async () => userResponse("repo, project, read:org"));
    await run();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("does not warn for a fine-grained token (scopes unknown)", async () => {
    const { logger, run } = setup(async () => userResponse(null));
    await run();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });

  it("does not warn on a network failure, only logs at debug", async () => {
    const { logger, run } = setup(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(run()).resolves.toBeUndefined();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });

  it("does nothing when gh yields no token", async () => {
    const logger = { warn: vi.fn(), debug: vi.fn() };
    const fetchMock = vi.fn();
    await warnOnMissingGhScopes({
      tokenSource: new GhTokenSource({ runner: fakeGhRunner({ failToken: true }) }),
      logger,
      fetch: fetchMock,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
