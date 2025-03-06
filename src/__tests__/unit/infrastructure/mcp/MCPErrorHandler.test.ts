import { beforeEach, afterEach, describe, expect, it } from '@jest/globals';
import { MCPErrorHandler } from "../../../../infrastructure/mcp/MCPErrorHandler";
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  RateLimitError,
} from "../../../../domain/errors";
import { MCPErrorCode, MCPContentType } from "../../../../domain/mcp-types";

describe("MCPErrorHandler", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-03-01T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("handle", () => {
    it("should handle ValidationError correctly", () => {
      const error = new ValidationError("Invalid input");
      const response = MCPErrorHandler.handle(error);

      const content = JSON.parse(response.content[0].text);
      expect(content.code).toBe(MCPErrorCode.VALIDATION_ERROR);
      expect(response.metadata.status).toBe(400);
    });

    it("should handle NotFoundError correctly", () => {
      const error = new NotFoundError("Resource not found");
      const response = MCPErrorHandler.handle(error);

      const content = JSON.parse(response.content[0].text);
      expect(content.code).toBe(MCPErrorCode.RESOURCE_NOT_FOUND);
      expect(response.metadata.status).toBe(404);
    });

    it("should handle UnauthorizedError correctly", () => {
      const error = new UnauthorizedError("Unauthorized access");
      const response = MCPErrorHandler.handle(error);

      const content = JSON.parse(response.content[0].text);
      expect(content.code).toBe(MCPErrorCode.UNAUTHORIZED);
      expect(response.metadata.status).toBe(401);
    });

    it("should handle RateLimitError correctly", () => {
      const error = new RateLimitError("Rate limit exceeded");
      const response = MCPErrorHandler.handle(error);

      const content = JSON.parse(response.content[0].text);
      expect(content.code).toBe(MCPErrorCode.RATE_LIMITED);
      expect(response.metadata.status).toBe(429);
    });

    it("should handle unknown errors as internal errors", () => {
      const error = new Error("Unknown error");
      const response = MCPErrorHandler.handle(error);

      const content = JSON.parse(response.content[0].text);
      expect(content.code).toBe(MCPErrorCode.INTERNAL_ERROR);
      expect(response.metadata.status).toBe(500);
    });

    it("should include request ID when provided", () => {
      const error = new Error("Test error");
      const requestId = "test-123";
      const response = MCPErrorHandler.handle(error, requestId);

      expect(response.metadata.requestId).toBe(requestId);
    });
  });

  describe("helper methods", () => {
    it("should create validation error correctly", () => {
      const error = MCPErrorHandler.validationError("Invalid input", { field: "username" });
      expect(error).toEqual({
        code: MCPErrorCode.VALIDATION_ERROR,
        message: "Invalid input",
        details: { field: "username" },
      });
    });

    it("should create not found error correctly", () => {
      const error = MCPErrorHandler.notFoundError("User not found");
      expect(error).toEqual({
        code: MCPErrorCode.RESOURCE_NOT_FOUND,
        message: "User not found",
      });
    });

    it("should create unauthorized error correctly", () => {
      const error = MCPErrorHandler.unauthorizedError("Invalid token");
      expect(error).toEqual({
        code: MCPErrorCode.UNAUTHORIZED,
        message: "Invalid token",
      });
    });

    it("should create rate limit error correctly", () => {
      const error = MCPErrorHandler.rateLimitError("Too many requests");
      expect(error).toEqual({
        code: MCPErrorCode.RATE_LIMITED,
        message: "Too many requests",
      });
    });
  });
});