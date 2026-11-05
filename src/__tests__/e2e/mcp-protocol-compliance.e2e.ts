import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STDIO_TEST_TIMEOUT_MS, StdioServer } from "./utils/StdioServer";

/**
 * E2E tests specifically for MCP protocol compliance
 * These tests verify that the server properly adheres to the MCP protocol
 * by spawning the actual server process and testing the stdio transport layer
 */
describe("MCP Protocol Compliance E2E Tests", () => {
  let server: StdioServer | undefined;

  // setup.ts sets vi.useFakeTimers() in every e2e beforeEach, which freezes
  // the setTimeout the harness waits on. Override it after setup.ts runs.
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(async () => {
    await server?.stop();
    server = undefined;
  });

  describe("Stdio Transport Protocol Compliance", () => {
    it(
      "should only output JSON messages to stdout, logs to stderr",
      async () => {
        server = StdioServer.start();

        const initResponse = await server.initialize({
          protocolVersion: "2024-11-05",
          clientName: "test-client",
        });

        // Verify protocol compliance
        expect(server.nonJsonLines).toEqual([]);
        expect(server.stderr).toContain("GitHub Project Manager MCP server running on stdio");

        // Verify at least one valid MCP response was received
        expect(server.messages.length).toBeGreaterThan(0);
        expect(initResponse.result).toBeDefined();

        // Verify all stdout messages are valid MCP protocol messages
        for (const message of server.messages) {
          expect(message).toHaveProperty("jsonrpc");
          expect(message.jsonrpc).toBe("2.0");
          // Should have either id (for responses) or method (for notifications)
          expect(message.id !== undefined || message.method !== undefined).toBe(true);
        }
      },
      STDIO_TEST_TIMEOUT_MS
    );

    it(
      "should handle list_tools request without stdout pollution",
      async () => {
        server = StdioServer.start();

        await server.initialize({ protocolVersion: "2024-11-05", clientName: "test-client" });
        const tools = await server.request({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        });
        expect(tools.result?.tools).toBeDefined();

        // Should have received valid JSON responses, and nothing else on stdout
        expect(server.stdoutLines.length).toBeGreaterThan(0);
        expect(server.nonJsonLines).toEqual([]);

        // Stderr should contain initialization logs
        expect(server.stderr).toContain("GitHub Project Manager MCP server running on stdio");

        // Should not contain any log messages in stdout
        expect(server.stdout).not.toContain("🤖 AI");
        expect(server.stdout).not.toContain("[MCP]");
        expect(server.stdout).not.toContain("GitHub Project Manager");
      },
      STDIO_TEST_TIMEOUT_MS
    );

    it(
      "should handle tool execution without stderr pollution in JSON responses",
      async () => {
        server = StdioServer.start();

        await server.initialize({ protocolVersion: "2024-11-05", clientName: "test-client" });

        // Call a tool (this might trigger AI service warnings)
        const toolResponse = await server.request({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "get_milestone_metrics", arguments: { milestoneId: "test-milestone" } },
        });
        expect(toolResponse.jsonrpc).toBe("2.0");

        // Verify the response doesn't contain log messages
        if (toolResponse.result) {
          const resultString = JSON.stringify(toolResponse.result);
          expect(resultString).not.toContain("🤖 AI");
          expect(resultString).not.toContain("[MCP]");
          expect(resultString).not.toContain("Warning:");
        }

        // AI service warnings should be in stderr, not in the JSON response
        expect(server.stderr).toContain("GitHub Project Manager MCP server running on stdio");
      },
      STDIO_TEST_TIMEOUT_MS
    );
  });

  describe("Error Handling Protocol Compliance", () => {
    it(
      "should return proper MCP error responses for invalid requests",
      async () => {
        server = StdioServer.start();

        // MCP v2 requires the initialize handshake before any tools/* call.
        // v1 tolerated calling straight in; without this the server never answers
        // the request below.
        await server.initialize({
          id: 0,
          protocolVersion: "2025-06-18",
          clientName: "compliance-probe",
        });

        // Now an invalid request: a tool that does not exist.
        const errorResponse = await server.request({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "invalid_tool", arguments: {} },
        });

        expect(errorResponse.jsonrpc).toBe("2.0");
        expect(errorResponse.error).toBeDefined();
        expect(errorResponse.error?.code).toBeDefined();
        expect(errorResponse.error?.message).toBeDefined();
      },
      STDIO_TEST_TIMEOUT_MS
    );
  });

  describe("MCP Inspector Compatibility", () => {
    it(
      "should be compatible with MCP Inspector connection flow",
      async () => {
        server = StdioServer.start();
        await server.waitForReady();

        // Step 1: Initialize (exactly like MCP Inspector would)
        const initialize = await server.request({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: { roots: { listChanged: true }, sampling: {} },
            clientInfo: { name: "MCP Inspector", version: "1.0.0" },
          },
        });

        // Verify initialize response
        expect(initialize.jsonrpc).toBe("2.0");
        expect(initialize.result).toBeDefined();
        expect(initialize.result?.capabilities).toBeDefined();

        // Step 2: Send initialized notification
        server.send({ jsonrpc: "2.0", method: "notifications/initialized" });

        // Step 3: List tools
        const toolsList = await server.request({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        });

        // Verify tools list response
        expect(toolsList.result).toBeDefined();
        expect(Array.isArray(toolsList.result?.tools)).toBe(true);
        expect(toolsList.result?.tools?.length).toBeGreaterThan(0);

        // Verify tool structure matches MCP specification
        const firstTool = toolsList.result?.tools?.[0];
        expect(firstTool?.name).toBeDefined();
        expect(firstTool?.description).toBeDefined();
        expect(firstTool?.inputSchema).toBeDefined();
      },
      STDIO_TEST_TIMEOUT_MS
    );
  });
});
