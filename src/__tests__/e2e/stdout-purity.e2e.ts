import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STDIO_TEST_TIMEOUT_MS, StdioServer } from "./utils/StdioServer";

/**
 * A stdio MCP server speaks JSON-RPC over stdout. ANY other stdout write —
 * a stray console.log, or a dependency's startup banner — corrupts the stream
 * and drops the client before it can handshake.
 *
 * Two real regressions this guards:
 *   - GitHubSprintRepository.delete() used console.log.
 *   - dotenv v17 prints an "injected env" banner to stdout by default.
 */
describe("stdio transport: stdout purity", () => {
  let server: StdioServer | undefined;

  // setup.ts installs fake timers in every e2e beforeEach; the harness waits
  // on real timers.
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(async () => {
    await server?.stop();
    server = undefined;
  });

  it(
    "emits only JSON-RPC on stdout",
    async () => {
      server = StdioServer.start({
        env: { NODE_ENV: "production", GITHUB_TOKEN: "ghp_probe" },
      });

      await server.initialize({ protocolVersion: "2025-03-26", clientName: "stdout-purity-probe" });

      expect(server.messages.length).toBeGreaterThan(0);
      expect(server.nonJsonLines, "non-JSON on stdout would corrupt the protocol stream").toEqual(
        []
      );
    },
    STDIO_TEST_TIMEOUT_MS
  );
});
