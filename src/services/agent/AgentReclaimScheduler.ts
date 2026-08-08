import type { TaskCheckoutService } from './TaskCheckoutService';
import { ILogger, Logger } from '../../infrastructure/logger';

/**
 * Configuration for the auto-reclaim scheduler.
 */
export interface AgentReclaimSchedulerConfig {
  /** Master switch — when `false` the scheduler never runs. */
  enabled: boolean;
  /** Interval between sweeps in milliseconds. `<= 0` disables the loop. */
  intervalMs: number;
  /** Heartbeat age (minutes) after which a working agent is considered stale. */
  staleAfterMinutes: number;
  /**
   * Per-sweep time budget in milliseconds. A hung GitHub call must not park
   * the re-entrancy guard forever (which would turn every later sweep into a
   * permanent no-op). Defaults to 60s.
   */
  sweepTimeoutMs?: number;
}

/**
 * Server-side self-healing loop for the agent swarm.
 *
 * Every `intervalMs`, the scheduler asks {@link TaskCheckoutService} to reclaim
 * tasks held by agents whose heartbeat has gone stale (e.g. a harness process
 * crashed, the laptop closed, the context window died). Reclaimed tasks return
 * to the unclaimed pool so another agent can pick them up, and the dead agent
 * is flagged `offline`.
 *
 * This closes the gap that a pull-based `reclaim_stale` action leaves open:
 * nobody was calling it, so one crash blocked one task forever. With the
 * scheduler, the system heals itself within one interval.
 *
 * Design notes:
 * - The timer is **unref'd** so it never keeps a stdio MCP server process
 *   alive after the client disconnects — it only fires while the server is
 *   otherwise running (long-lived HTTP/SSE deployments, active stdio sessions).
 * - Sweeps are **re-entrancy guarded** (`sweeping` flag) so a slow GitHub
 *   round-trip can't stack overlapping sweeps.
 * - A failed sweep is logged and swallowed — the loop must never crash the
 *   server, and the next interval simply retries.
 */
export class AgentReclaimScheduler {
  private timer: NodeJS.Timeout | null = null;
  private sweeping = false;
  private readonly logger: ILogger;

  constructor(
    private readonly checkoutService: TaskCheckoutService,
    private readonly config: AgentReclaimSchedulerConfig,
    logger?: ILogger
  ) {
    this.logger = logger ?? Logger.getInstance();
  }

  /** Whether the background loop is currently armed. */
  get running(): boolean {
    return this.timer !== null;
  }

  /** Arm the interval. No-op if disabled, interval is non-positive, or already running. */
  start(): void {
    if (!this.config.enabled || this.config.intervalMs <= 0) {
      if (this.config.enabled) {
        this.logger.info(
          `[AgentReclaim] scheduler disabled (interval ${this.config.intervalMs}ms)`);
      }
      return;
    }
    if (this.timer) return;

    this.timer = setInterval(() => {
      void this.runSweep();
    }, this.config.intervalMs);

    // unref so the timer never keeps a stdio MCP process alive by itself.
    if (typeof (this.timer as NodeJS.Timeout & { unref?: () => void }).unref === 'function') {
      (this.timer as NodeJS.Timeout & { unref: () => void }).unref();
    }

    this.logger.info(
      `[AgentReclaim] scheduler started — sweep every ${this.config.intervalMs}ms, ` +
      `reclaim agents idle/stale after ${this.config.staleAfterMinutes}min`,
    );
  }

  /** Disarm the interval. Safe to call multiple times. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.info('[AgentReclaim] scheduler stopped');
    }
  }

  /**
   * Run a single sweep now. Public so tests (and future on-demand triggers)
   * can invoke the sweep directly without waiting for the interval.
   *
   * @returns number of tasks reclaimed
   */
  async runSweep(): Promise<{ reclaimed: number }> {
    if (!this.config.enabled) return { reclaimed: 0 };
    if (this.sweeping) return { reclaimed: 0 };

    this.sweeping = true;
    const timeoutMs = this.config.sweepTimeoutMs ?? 60_000;
    // Timer handle is cleared when the race settles so a winning sweep does not
    // leak a pending timeout (important under test timers / graceful shutdown).
    let timeout: NodeJS.Timeout | undefined;
    try {
      // Race the sweep against a time budget so a hung GitHub call cannot park
      // `sweeping` forever (every later sweep would become a no-op).
      const result = await Promise.race([
        this.checkoutService.reclaimStaleTasks(this.config.staleAfterMinutes),
        new Promise<{ reclaimed: number; details: Array<{ agentId: string; taskId: string }> }>(
          (_, reject) => {
            timeout = setTimeout(
              () => reject(new Error(`sweep timed out after ${timeoutMs}ms`)),
              timeoutMs,
            );
          },
        ),
      ]).finally(() => {
        if (timeout) clearTimeout(timeout);
      });
      if (result.reclaimed > 0) {
        this.logger.info(
          `[AgentReclaim] reclaimed ${result.reclaimed} stale task(s)`,
          result.details,
        );
      }
      return { reclaimed: result.reclaimed };
    } catch (error) {
      // Never crash the server — log and let the next interval retry.
      this.logger.warn('[AgentReclaim] sweep failed (will retry next interval)', error);
      return { reclaimed: 0 };
    } finally {
      this.sweeping = false;
    }
  }
}
