import { describe, expect, it } from "vitest";
import {
  DomainError,
  GitHubApiError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from "../../../../domain/errors";
import { MCPErrorCode } from "../../../../domain/mcp-types";
import { ResourceNotFoundError, ResourceType } from "../../../../domain/resource-types";
import { mapErrorToMCPError } from "../../../../services/utils/ErrorMapper";

describe("mapErrorToMCPError", () => {
  it("maps a ValidationError to the validation code", () => {
    const mapped = mapErrorToMCPError(new ValidationError("title is required"));

    expect(mapped).toBeInstanceOf(DomainError);
    expect(mapped.message).toBe(`${MCPErrorCode.VALIDATION_ERROR}: title is required`);
  });

  it("maps a ResourceNotFoundError to the not-found code", () => {
    const mapped = mapErrorToMCPError(new ResourceNotFoundError(ResourceType.ISSUE, "42"));

    expect(mapped.message).toBe(`${MCPErrorCode.RESOURCE_NOT_FOUND}: issue with ID 42 not found`);
  });

  it("maps a RateLimitError to the rate-limited code, not the generic GitHub code", () => {
    const mapped = mapErrorToMCPError(new RateLimitError("slow down", new Date(0)));

    expect(mapped.message).toBe(`${MCPErrorCode.RATE_LIMITED}: slow down`);
  });

  it("maps an UnauthorizedError to the unauthorized code", () => {
    const mapped = mapErrorToMCPError(new UnauthorizedError());

    expect(mapped.message).toBe(`${MCPErrorCode.UNAUTHORIZED}: Unauthorized access`);
  });

  it("maps a GitHubApiError to the internal-error code and labels it as a GitHub failure", () => {
    const mapped = mapErrorToMCPError(new GitHubApiError("Bad gateway", 502));

    expect(mapped.message).toBe(`${MCPErrorCode.INTERNAL_ERROR}: GitHub API Error - Bad gateway`);
  });

  it("maps any other Error to the internal-error code with its message", () => {
    const mapped = mapErrorToMCPError(new Error("disk full"));

    expect(mapped).toBeInstanceOf(DomainError);
    expect(mapped.message).toBe(`${MCPErrorCode.INTERNAL_ERROR}: disk full`);
  });

  it("stringifies a non-Error throwable", () => {
    expect(mapErrorToMCPError("plain string").message).toBe(
      `${MCPErrorCode.INTERNAL_ERROR}: plain string`
    );
  });
});
