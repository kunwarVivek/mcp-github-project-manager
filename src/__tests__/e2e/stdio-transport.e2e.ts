import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STDIO_TEST_TIMEOUT_MS, StdioServer } from "./utils/StdioServer";

/**
 * Tests specifically for stdio transport layer behavior
 * These tests verify that stdout/stderr separation is properly maintained
 * and that the MCP protocol is correctly implemented at the transport layer
 */
describe("Stdio Transport Layer Tests", () => {
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

  describe("Stdout/Stderr Separation", () => {
    it(
      "should never mix log messages with JSON protocol messages on stdout",
      async () => {
        server = StdioServer.start({ env: { NODE_ENV: "test" } });

        await server.initialize({ clientName: "test" });
        await server.request({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });

        // Every complete stdout line must be JSON; a log line mixed into the
        // stream is a protocol violation.
        expect(server.nonJsonLines).toEqual([]);
        expect(server.stdoutLines.length).toBeGreaterThan(0);

        // Verify stderr contains log messages
        expect(server.stderr).toContain("GitHub Project Manager MCP server running on stdio");

        // Verify no log patterns in stdout
        const stdoutContent = server.stdout;
        expect(stdoutContent).not.toMatch(/\[MCP\]/);
        expect(stdoutContent).not.toMatch(/GitHub Project Manager/);
        expect(stdoutContent).not.toMatch(/🤖 AI/);
        expect(stdoutContent).not.toMatch(/Warning:/);
        expect(stdoutContent).not.toMatch(/Error:/);
        expect(stdoutContent).not.toMatch(/INFO/);
        expect(stdoutContent).not.toMatch(/DEBUG/);
      },
      STDIO_TEST_TIMEOUT_MS
    );

    it(
      "should handle rapid message exchange without stdout corruption",
      async () => {
        server = StdioServer.start();
        await server.waitForReady();

        // Fire initialize plus several tools/list requests back to back, then
        // the initialized notification, without waiting between writes.
        const messageCount = 5;
        server.send({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "rapid-test", version: "1.0.0" },
          },
        });
        for (let id = 2; id <= messageCount; id++) {
          server.send({ jsonrpc: "2.0", id, method: "tools/list", params: {} });
        }
        server.send({ jsonrpc: "2.0", method: "notifications/initialized" });

        // One response per request, whatever order they arrive in.
        for (let id = 1; id <= messageCount; id++) {
          await server.waitForResponse(id);
        }

        expect(server.nonJsonLines).toEqual([]);
        expect(server.messages.length).toBeGreaterThanOrEqual(messageCount);
        for (const message of server.messages) {
          expect(message.jsonrpc).toBe("2.0");
          expect(message.id !== undefined || message.method !== undefined).toBe(true);
        }
      },
      STDIO_TEST_TIMEOUT_MS
    );
  });

  describe("Logger Compliance", () => {
    it(
      "should ensure all logger instances write to stderr only",
      async () => {
        // Force verbose logging to test all log paths
        server = StdioServer.start({ env: { NODE_ENV: "development" } });

        await server.initialize({ clientName: "log-test" });

        // A tool call that exercises the error/warning logging paths.
        await server.request({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "generate_prd", arguments: { requirements: "Test requirement" } },
        });

        // Verify stderr contains expected log messages
        expect(server.stderr).toContain("GitHub Project Manager MCP server running on stdio");

        // Verify stdout contains NO log-like patterns
        const logPatterns = [
          /\[\d{4}-\d{2}-\d{2}/, // Log timestamps like [2024-01-31
          /\[MCP\]/, // Specific log prefix
          /\[DEBUG\]/,
          /\[INFO\]/,
          /\[WARN\]/,
          /\[ERROR\]/,
          /INFO.*:/,
          /DEBUG.*:/,
          /WARNING.*:/,
          /ERROR.*:/,
          /🤖/, // AI emoji
          /GitHub Project Manager MCP server/,
        ];
        for (const pattern of logPatterns) {
          expect(server.stdout).not.toMatch(pattern);
        }

        // Verify stdout only contains JSON
        expect(server.nonJsonLines).toEqual([]);
      },
      STDIO_TEST_TIMEOUT_MS
    );
  });

  describe("Error Scenarios", () => {
    it(
      "should handle server errors without polluting stdout",
      async () => {
        // Invalid (empty) token should trigger warnings, not crash the transport
        server = StdioServer.start({ env: { GITHUB_TOKEN: "" } });

        await server.initialize({ clientName: "error-test" });
        await server.request({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "create_roadmap", arguments: { title: "Test Roadmap" } },
        });

        // Error messages should be in stderr, not stdout
        expect(server.stderr.length).toBeGreaterThan(0);

        // Stdout should still only contain JSON
        expect(server.nonJsonLines).toEqual([]);
      },
      STDIO_TEST_TIMEOUT_MS
    );
  });
});
