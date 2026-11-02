import { describe, expect, it } from "vitest";
import { z } from "zod";
import { RateLimitError } from "../../../../domain/errors";
import { MCPErrorCode } from "../../../../domain/mcp-types";
import { ToolResultFormatter } from "../../../../infrastructure/tools/ToolResultFormatter";
import { ToolArgumentError, ToolValidator } from "../../../../infrastructure/tools/ToolValidator";

describe("ToolValidator", () => {
  const schema = z.object({ name: z.string(), count: z.number() });

  it("throws a ToolArgumentError listing every invalid field", () => {
    const attempt = () => ToolValidator.validate("t", { count: "x" }, schema);
    expect(attempt).toThrow(ToolArgumentError);
    try {
      attempt();
    } catch (error) {
      expect((error as ToolArgumentError).issues.map((i) => i.path).sort()).toEqual([
        "count",
        "name",
      ]);
    }
  });

  it("maps argument errors to VALIDATION_ERROR with field details", () => {
    const mapped = ToolValidator.mapGitHubError(
      new ToolArgumentError("t", [{ path: "name", message: "Required", code: "invalid_type" }]),
      "t"
    );
    expect(mapped.code).toBe(MCPErrorCode.VALIDATION_ERROR);
    expect(mapped.data.validation?.[0]?.path).toBe("name");
  });

  it("maps Octokit status errors and carries retry-after for rate limits", () => {
    const rate = ToolValidator.mapGitHubError(
      Object.assign(new Error("API rate limit exceeded"), {
        status: 403,
        response: { headers: { "retry-after": "30", "x-ratelimit-remaining": "0" } },
      }),
      "t"
    );
    expect(rate.code).toBe(MCPErrorCode.GITHUB_RATE_LIMITED);
    expect(rate.message).toContain("Retry after 30s");

    const notFound = ToolValidator.mapGitHubError(
      Object.assign(new Error("Not Found"), { status: 404 }),
      "t"
    );
    expect(notFound.code).toBe(MCPErrorCode.GITHUB_NOT_FOUND);
  });

  it("maps the domain RateLimitError (status 429) to a rate-limit code", () => {
    expect(ToolValidator.mapGitHubError(new RateLimitError(), "t").code).toBe(
      MCPErrorCode.GITHUB_RATE_LIMITED
    );
  });

  it("never exposes a stack trace for plain errors", () => {
    const response = ToolValidator.handleToolError(new Error("boom"), "t");
    expect(response.error.message).toBe("boom");
    expect(JSON.stringify(response)).not.toContain("stack");
  });

  it("formats an error response as an isError tool result with field lines", () => {
    const result = ToolResultFormatter.formatError(
      ToolValidator.handleToolError(
        new ToolArgumentError("t", [{ path: "name", message: "Required", code: "invalid_type" }]),
        "t"
      )
    );
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain("- name: Required");
  });
});
