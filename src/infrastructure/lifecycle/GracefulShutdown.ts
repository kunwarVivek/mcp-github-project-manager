/**
 * Manages graceful server shutdown: tracks in-flight requests,
 * waits for completion on SIGTERM/SIGINT, and force-exits after timeout.
 */

/** Minimal logger interface for shutdown messages. */
interface ShutdownLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

const DRAIN_POLL_MS = 500;

export class GracefulShutdown {
  private inFlightCount = 0;
  private isShuttingDown = false;
  private readonly shutdownTimeoutMs: number;
  private readonly logger: ShutdownLogger;

  constructor(options: {
    shutdownTimeoutMs?: number;
    logger?: ShutdownLogger;
  } = {}) {
    this.shutdownTimeoutMs = options.shutdownTimeoutMs ?? 30_000;
    this.logger = options.logger ?? {
      info: console.error,
      warn: console.error,
      error: console.error,
    };
  }

  /** Whether the server is shutting down. Tools should check this. */
  get shuttingDown(): boolean {
    return this.isShuttingDown;
  }

  /** Track a request starting. */
  trackStart(): void {
    this.inFlightCount++;
  }

  /** Track a request completing. */
  trackEnd(): void {
    this.inFlightCount = Math.max(0, this.inFlightCount - 1);
  }

  /** Current in-flight count. */
  get inFlight(): number {
    return this.inFlightCount;
  }

  /**
   * Initiate graceful shutdown:
   * 1. Set shutting-down flag (new requests rejected)
   * 2. Wait for in-flight requests to complete (up to timeout)
   * 3. Run cleanup callback
   * 4. Exit
   */
  async shutdown(cleanupFn?: () => Promise<void>): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.logger.info(
      `[Shutdown] Initiating graceful shutdown (${this.inFlightCount} in-flight requests)`,
    );

    // Wait for in-flight requests to drain
    const deadline = Date.now() + this.shutdownTimeoutMs;
    while (this.inFlightCount > 0 && Date.now() < deadline) {
      this.logger.info(
        `[Shutdown] Waiting for ${this.inFlightCount} in-flight requests...`,
      );
      await new Promise<void>((resolve) => setTimeout(resolve, DRAIN_POLL_MS));
    }

    if (this.inFlightCount > 0) {
      this.logger.warn(
        `[Shutdown] Force-closing ${this.inFlightCount} in-flight requests after timeout`,
      );
    }

    // Run cleanup
    if (cleanupFn) {
      try {
        await cleanupFn();
      } catch (error) {
        this.logger.error(
          `[Shutdown] Cleanup error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.logger.info("[Shutdown] Graceful shutdown complete");
    process.exit(0);
  }

  /** Install SIGINT and SIGTERM handlers. */
  installSignalHandlers(cleanupFn?: () => Promise<void>): void {
    const handler = () => {
      void this.shutdown(cleanupFn);
    };
    process.on("SIGINT", handler);
    process.on("SIGTERM", handler);
  }
}
