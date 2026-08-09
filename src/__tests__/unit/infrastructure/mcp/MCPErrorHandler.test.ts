import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { MCPErrorHandler } from "../../../../infrastructure/mcp/MCPErrorHandler";
import {
  ValidationError,
  UnauthorizedError,
  RateLimitError,
} from "../../../../domain/errors";
import { MCPErrorCode } from "../../../../domain/mcp-types";
import { ResourceNotFoundError, ResourceType } from '../../../../domain/resource-types';

describe("MCPErrorHandler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("handle", () => {
    it("should handle ValidationError correctly", () => {
      const error = new ValidationError("Invalid input");
      const response = MCPErrorHandler.handle(error);

      expect(response.status).toBe("error");
      expect(response.error.code).toBe(MCPErrorCode.VALIDATION_ERROR);
      expect(response.error.message).toBe("Invalid input");
    });

    it("should handle NotFoundError correctly", () => {
      const error = new ResourceNotFoundError(ResourceType.ISSUE, "123");
      const response = MCPErrorHandler.handle(error);

      expect(response.status).toBe("error");
      expect(response.error.code).toBe(MCPErrorCode.RESOURCE_NOT_FOUND);
      expect(response.error.message).toBe("issue with ID 123 not found");
    });

    it("should handle UnauthorizedError correctly", () => {
      const error = new UnauthorizedError("Unauthorized");
      const response = MCPErrorHandler.handle(error);

      expect(response.status).toBe("error");
      expect(response.error.code).toBe(MCPErrorCode.UNAUTHORIZED);
      expect(response.error.message).toBe("Unauthorized");
    });

    it("should handle RateLimitError correctly", () => {
      const error = new RateLimitError("Rate limited");
      const response = MCPErrorHandler.handle(error);

      expect(response.status).toBe("error");
      expect(response.error.code).toBe(MCPErrorCode.RATE_LIMITED);
      expect(response.error.message).toBe("Rate limited");
    });

    it("should handle generic Error as internal error", () => {
      const error = new Error("Something went wrong");
      const response = MCPErrorHandler.handle(error);

      expect(response.status).toBe("error");
      expect(response.error.code).toBe(MCPErrorCode.INTERNAL_ERROR);
      expect(response.error.message).toBe("Something went wrong");
    });

    it("should include request ID when provided", () => {
      const requestId = "test-123";
      const error = new Error("Something went wrong");
      const response = MCPErrorHandler.handle(error, requestId);
      
      expect(response.requestId).toBe(requestId);
    });
  });
});
