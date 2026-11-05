import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { WireMessage } from "./payload";

/**
 * Shared harness for e2e suites that spawn the real `build/index.js` and talk
 * JSON-RPC over its stdio.
 *
 * Why this exists: the stdio suites each hand-rolled spawn/readiness/response
 * waiting, and the hand-rolled versions were wrong in ways that only show up
 * on a loaded host.
 *   - Fixed sleeps (`sleep 2000` "for startup") instead of waiting for the
 *     readiness banner. A server start costs ~1.3 CPU-seconds of module
 *     loading; on a contended machine that is well over any fixed sleep.
 *   - "Wait, but resolve anyway after 5 s" fallbacks that silently continued
 *     with an unready server and failed later with a misleading assertion.
 *   - Per-chunk `data.split("\n")` parsing, which treats a response split
 *     across two pipe reads as two non-JSON lines.
 *   - Per-test timeouts (10 s default) smaller than the sum of the waits.
 *
 * Every wait here is event-driven (woken by stdout/stderr/exit), rejects at
 * once if the server exits, and includes the exit state and stderr in its
 * failure message. The timeouts below are hang detectors, not tuning knobs:
 * a healthy server answers in milliseconds, so they only ever expire when the
 * server is wedged.
 */

/** Cap on waiting for the readiness banner (module load + container wiring). */
export const STDIO_STARTUP_TIMEOUT_MS = 60_000;
/** Cap on waiting for one JSON-RPC response from an already-ready server. */
export const STDIO_RESPONSE_TIMEOUT_MS = 30_000;
/**
 * Vitest per-test budget for a stdio test: startup + a handful of exchanges.
 * Must stay above STDIO_STARTUP_TIMEOUT_MS + a few STDIO_RESPONSE_TIMEOUT_MS
 * so a wait's own diagnostic fires before Vitest's bare "Test timed out".
 */
export const STDIO_TEST_TIMEOUT_MS = 120_000;

export const STDIO_READY_BANNER = "GitHub Project Manager MCP server running on stdio";

const SERVER_PATH = join(process.cwd(), "build/index.js");

export interface StdioServerOptions {
  /** Env vars layered over the defaults below (e.g. NODE_ENV, GITHUB_TOKEN). */
  env?: Record<string, string>;
}

interface ExitState {
  code: number | null;
  signal: NodeJS.Signals | null;
}

interface Waiter {
  /** Returns true when satisfied; called after every stdout/stderr/exit event. */
  check: () => boolean;
}

/** Throw a clear error when the build the suites spawn is missing. */
export function assertServerBuilt(): void {
  if (!existsSync(SERVER_PATH)) {
    throw new Error("Server build not found. Run `pnpm run build` first.");
  }
}

export class StdioServer {
  private readonly child: ChildProcess;
  private readonly waiters = new Set<Waiter>();
  private stdoutPartial = "";
  private stderrText = "";
  private stdoutText = "";
  private exitState: ExitState | null = null;
  private readonly exited: Promise<void>;

  /** Every complete (newline-terminated, non-blank) stdout line, in order. */
  readonly stdoutLines: string[] = [];
  /** Stdout lines that parsed as JSON. */
  readonly messages: WireMessage[] = [];
  /** Stdout lines that did NOT parse as JSON: protocol violations. */
  readonly nonJsonLines: string[] = [];

  private constructor(child: ChildProcess) {
    this.child = child;

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      this.stdoutText += chunk;
      this.ingestStdout(chunk);
      this.wake();
    });
    child.stderr?.on("data", (chunk: string) => {
      this.stderrText += chunk;
      this.wake();
    });
    // A server that dies mid-write closes stdin first; the resulting EPIPE is
    // surfaced through the exit state, not as an unhandled stream error.
    child.stdin?.on("error", () => undefined);

    this.exited = new Promise<void>((resolve) => {
      child.on("exit", (code, signal) => {
        this.exitState = { code, signal };
        this.wake();
        resolve();
      });
      child.on("error", () => {
        this.exitState ??= { code: null, signal: null };
        this.wake();
        resolve();
      });
    });
  }

  /**
   * Spawn the built server over stdio. Defaults keep the suites hermetic:
   * no webhook server (a fixed WEBHOOK_PORT would collide across parallel
   * files), fake credentials, and no `gh auth token` fallback (the host's real
   * gh login must never leak into, or slow down, a test).
   */
  static start(options: StdioServerOptions = {}): StdioServer {
    assertServerBuilt();
    const child = spawn(process.execPath, [SERVER_PATH], {
      env: {
        ...process.env,
        SSE_ENABLED: "false",
        GITHUB_TOKEN: "test-token",
        GITHUB_OWNER: "test-owner",
        GITHUB_REPO: "test-repo",
        GH_CLI_TOKEN_FALLBACK: "false",
        ...options.env,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    return new StdioServer(child);
  }

  get stderr(): string {
    return this.stderrText;
  }

  /** All raw stdout, including any unterminated trailing fragment. */
  get stdout(): string {
    return this.stdoutText;
  }

  /** Write one JSON-RPC message (newline-delimited). */
  send(message: object): void {
    this.child.stdin?.write(`${JSON.stringify(message)}\n`);
  }

  /** Resolve once the readiness banner is on stderr. */
  waitForReady(timeoutMs = STDIO_STARTUP_TIMEOUT_MS): Promise<void> {
    return this.waitUntil(
      () => this.stderrText.includes(STDIO_READY_BANNER),
      `stderr to contain "${STDIO_READY_BANNER}"`,
      timeoutMs
    );
  }

  /** Resolve with the first stdout message matching `predicate`. */
  async waitForMessage(
    predicate: (message: WireMessage) => boolean,
    description: string,
    timeoutMs = STDIO_RESPONSE_TIMEOUT_MS
  ): Promise<WireMessage> {
    let found: WireMessage | undefined;
    await this.waitUntil(
      () => {
        found = this.messages.find(predicate);
        return found !== undefined;
      },
      description,
      timeoutMs
    );
    return found as WireMessage;
  }

  /** Resolve with the JSON-RPC response (result or error) carrying `id`. */
  waitForResponse(
    id: number | string,
    timeoutMs = STDIO_RESPONSE_TIMEOUT_MS
  ): Promise<WireMessage> {
    return this.waitForMessage(
      (m) => m.id === id && (m.result !== undefined || m.error !== undefined),
      `a JSON-RPC response with id ${JSON.stringify(id)}`,
      timeoutMs
    );
  }

  /** Send a request and wait for its response. */
  request(
    message: { id: number | string } & Record<string, unknown>,
    timeoutMs?: number
  ): Promise<WireMessage> {
    this.send(message);
    return this.waitForResponse(message.id, timeoutMs);
  }

  /**
   * Wait for readiness, then perform the initialize handshake
   * (`initialize` request, wait for its response, `notifications/initialized`).
   */
  async initialize(
    options: { id?: number; protocolVersion?: string; clientName?: string } = {}
  ): Promise<WireMessage> {
    await this.waitForReady();
    const response = await this.request({
      jsonrpc: "2.0",
      id: options.id ?? 1,
      method: "initialize",
      params: {
        protocolVersion: options.protocolVersion ?? "2025-03-26",
        capabilities: {},
        clientInfo: { name: options.clientName ?? "stdio-e2e", version: "1.0.0" },
      },
    });
    this.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    return response;
  }

  /**
   * Terminate the server and wait until it has actually exited, so the next
   * test starts with no live sibling competing for CPU. Escalates to SIGKILL.
   */
  async stop(): Promise<void> {
    if (this.exitState) return;
    this.child.kill("SIGTERM");
    const escalate = setTimeout(() => this.child.kill("SIGKILL"), 5_000);
    try {
      await this.exited;
    } finally {
      clearTimeout(escalate);
    }
  }

  private ingestStdout(chunk: string): void {
    this.stdoutPartial += chunk;
    const lines = this.stdoutPartial.split("\n");
    this.stdoutPartial = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      this.stdoutLines.push(line);
      try {
        this.messages.push(JSON.parse(line) as WireMessage);
      } catch {
        this.nonJsonLines.push(line);
      }
    }
  }

  private wake(): void {
    for (const waiter of [...this.waiters]) {
      if (waiter.check()) this.waiters.delete(waiter);
    }
  }

  private describeState(): string {
    const exit = this.exitState
      ? `server exited (code=${this.exitState.code}, signal=${this.exitState.signal})`
      : "server still running";
    const stderrTail = this.stderrText.slice(-500);
    return `${exit}. stderr tail: ${JSON.stringify(stderrTail)}`;
  }

  private waitUntil(done: () => boolean, description: string, timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let timer: NodeJS.Timeout | undefined;
      const waiter: Waiter = {
        check: () => {
          if (done()) {
            clearTimeout(timer);
            resolve();
            return true;
          }
          if (this.exitState) {
            clearTimeout(timer);
            reject(new Error(`Waiting for ${description}, but ${this.describeState()}`));
            return true;
          }
          return false;
        },
      };
      timer = setTimeout(() => {
        this.waiters.delete(waiter);
        reject(
          new Error(
            `Timed out after ${timeoutMs}ms waiting for ${description}; ${this.describeState()}`
          )
        );
      }, timeoutMs);
      if (!waiter.check()) this.waiters.add(waiter);
    });
  }
}
