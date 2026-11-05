import { describe, expect, it } from "vitest";
import {
  ghScopeErrorHint,
  isInsufficientScopeError,
} from "../../../../../../infrastructure/github/auth/gh/ghErrorHint";
import { ToolValidator } from "../../../../../../infrastructure/tools/ToolValidator";

const HINT = "gh auth refresh -h github.com -s project";

describe("ghScopeErrorHint", () => {
  const scopeErrors = [
    { status: 403, message: "Resource not accessible by personal access token" },
    {
      message: "Your token has not been granted the required scopes to execute this query.",
    },
    { message: "GraphQL failed", errors: [{ type: "INSUFFICIENT_SCOPES", message: "x" }] },
    {
      status: 403,
      message: "forbidden",
      response: { data: { message: "This API requires the following scopes: project" } },
    },
  ];

  it.each(scopeErrors)("recognises a missing-scope error: %j", (error) => {
    expect(isInsufficientScopeError(error)).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isInsufficientScopeError({ status: 404, message: "Not Found" })).toBe(false);
    expect(isInsufficientScopeError("boom")).toBe(false);
  });

  it("gives the hint only for a gh-cli credential", () => {
    const error = scopeErrors[0];
    expect(ghScopeErrorHint(error, () => ({ source: "gh-cli" }))).toContain(HINT);
    for (const source of ["env", "secrets-dir", "oauth-store", "github-app", undefined] as const) {
      expect(ghScopeErrorHint(error, () => ({ source }))).toBeUndefined();
    }
  });

  it("does not resolve the credential for errors that are not scope errors", () => {
    let resolved = false;
    ghScopeErrorHint({ message: "Not Found" }, () => {
      resolved = true;
      return { source: "gh-cli" };
    });
    expect(resolved).toBe(false);
  });

  it("adds the account switch for a pinned account", () => {
    expect(
      ghScopeErrorHint(scopeErrors[0], () => ({ source: "gh-cli", pinnedUser: "bob" }))
    ).toContain("gh auth switch -h github.com -u bob && gh auth refresh -h github.com -s project");
  });
});

describe("ToolValidator.mapGitHubError scope hint", () => {
  const error = { status: 403, message: "Resource not accessible by personal access token" };

  it("appends the hint to the tool error for a gh-sourced credential", () => {
    const mapped = ToolValidator.mapGitHubError(error, "t", () => ({ source: "gh-cli" }));
    expect(mapped.message).toContain("GitHub denied access");
    expect(mapped.message).toContain(HINT);
  });

  it("leaves the message unchanged for other credential sources", () => {
    const plain = ToolValidator.mapGitHubError(error, "t", () => ({ source: "env" }));
    expect(plain.message).not.toContain("gh auth");
    expect(plain.message).toBe(
      ToolValidator.mapGitHubError(error, "t", () => ({ source: "oauth-store" })).message
    );
  });

  it("covers GraphQL scope errors that carry no HTTP status", () => {
    const graphql = Object.assign(new Error("Request failed"), {
      errors: [{ type: "INSUFFICIENT_SCOPES", message: "needs read:project" }],
    });
    const mapped = ToolValidator.mapGitHubError(graphql, "t", () => ({ source: "gh-cli" }));
    expect(mapped.message).toContain(HINT);
  });
});
