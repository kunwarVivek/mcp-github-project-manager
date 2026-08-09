import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';;
import { AgentReclaimScheduler, type AgentReclaimSchedulerConfig } from '../../../services/agent/AgentReclaimScheduler';
import type { TaskCheckoutService } from '../../../services/agent/TaskCheckoutService';

function makeConfig(overrides: Partial<AgentReclaimSchedulerConfig> = {}): AgentReclaimSchedulerConfig {
  return {
    enabled: true,
    intervalMs: 300000,
    staleAfterMinutes: 30,
    ...overrides,
  };
}

describe('AgentReclaimScheduler', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCheckout: { reclaimStaleTasks: Mock<any> };
  let scheduler: AgentReclaimScheduler;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockCheckout = {
      reclaimStaleTasks: vi.fn(async () => ({ reclaimed: 0, details: [] })),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function create(overrides: Partial<AgentReclaimSchedulerConfig> = {}): AgentReclaimScheduler {
    return new AgentReclaimScheduler(
      mockCheckout as unknown as TaskCheckoutService,
      makeConfig(overrides),
    );
  }

  it('does not arm the interval when disabled', () => {
    scheduler = create({ enabled: false });
    scheduler.start();

    expect(scheduler.running).toBe(false);
    vi.advanceTimersByTime(3600_000);
    expect(mockCheckout.reclaimStaleTasks).not.toHaveBeenCalled();
  });

  it('does not arm the interval when intervalMs is non-positive', () => {
    scheduler = create({ intervalMs: 0 });
    scheduler.start();

    expect(scheduler.running).toBe(false);
    vi.advanceTimersByTime(3600_000);
    expect(mockCheckout.reclaimStaleTasks).not.toHaveBeenCalled();
  });

  it('arms the interval and sweeps on each tick', async () => {
    scheduler = create({ intervalMs: 300000, staleAfterMinutes: 15 });
    scheduler.start();

    expect(scheduler.running).toBe(true);

    await vi.advanceTimersByTimeAsync(300000);
    expect(mockCheckout.reclaimStaleTasks).toHaveBeenCalledTimes(1);
    expect(mockCheckout.reclaimStaleTasks).toHaveBeenCalledWith(15);

    await vi.advanceTimersByTimeAsync(300000);
    expect(mockCheckout.reclaimStaleTasks).toHaveBeenCalledTimes(2);
  });

  it('stop() disarms the interval', async () => {
    scheduler = create({ intervalMs: 300000 });
    scheduler.start();
    scheduler.stop();

    expect(scheduler.running).toBe(false);
    await vi.advanceTimersByTimeAsync(600000);
    expect(mockCheckout.reclaimStaleTasks).not.toHaveBeenCalled();
  });

  it('start() is idempotent while already running', () => {
    scheduler = create({ intervalMs: 300000 });
    scheduler.start();
    const timer = (scheduler as unknown as { timer: NodeJS.Timeout }).timer;
    scheduler.start();
    expect((scheduler as unknown as { timer: NodeJS.Timeout }).timer).toBe(timer);
  });

  it('runSweep() calls reclaimStaleTasks and reports the count', async () => {
    mockCheckout.reclaimStaleTasks.mockResolvedValue({
      reclaimed: 3,
      details: [{ agentId: 'a1', taskId: '42' }],
    });
    scheduler = create({ staleAfterMinutes: 20 });

    const result = await scheduler.runSweep();

    expect(mockCheckout.reclaimStaleTasks).toHaveBeenCalledWith(20);
    expect(result.reclaimed).toBe(3);
  });

  it('runSweep() is re-entrancy guarded (no overlapping sweeps)', async () => {
    let resolveSweep: (v: { reclaimed: number; details: Array<{ agentId: string; taskId: string }> }) => void;
    mockCheckout.reclaimStaleTasks.mockImplementation(
      () => new Promise(res => { resolveSweep = res; }),
    );
    scheduler = create();

    const first = scheduler.runSweep();
    const second = await scheduler.runSweep(); // in-flight → no-op

    expect(second.reclaimed).toBe(0);
    expect(mockCheckout.reclaimStaleTasks).toHaveBeenCalledTimes(1);

    resolveSweep!({ reclaimed: 1, details: [{ agentId: 'a1', taskId: '7' }] });
    await expect(first).resolves.toEqual({ reclaimed: 1 });
  });

  it('runSweep() never throws — a failed sweep is logged and returns 0', async () => {
    mockCheckout.reclaimStaleTasks.mockRejectedValue(new Error('GitHub API down'));
    scheduler = create();

    await expect(scheduler.runSweep()).resolves.toEqual({ reclaimed: 0 });
  });

  it('runSweep() is a no-op when disabled', async () => {
    scheduler = create({ enabled: false });
    const result = await scheduler.runSweep();

    expect(result.reclaimed).toBe(0);
    expect(mockCheckout.reclaimStaleTasks).not.toHaveBeenCalled();
  });

  it('aborts a hung sweep via the time budget and resets the guard', async () => {
    mockCheckout.reclaimStaleTasks.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );
    scheduler = create({ sweepTimeoutMs: 1000 });

    const sweep = scheduler.runSweep();
    await vi.advanceTimersByTimeAsync(1000);

    await expect(sweep).resolves.toEqual({ reclaimed: 0 });
    // Guard reset — later sweeps are not permanently blocked.
    mockCheckout.reclaimStaleTasks.mockResolvedValue({ reclaimed: 1, details: [] });
    await expect(scheduler.runSweep()).resolves.toEqual({ reclaimed: 1 });
  });

  it('recovers after a failed sweep (next sweep still runs)', async () => {
    mockCheckout.reclaimStaleTasks
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ reclaimed: 2, details: [] });
    scheduler = create();

    await expect(scheduler.runSweep()).resolves.toEqual({ reclaimed: 0 });
    await expect(scheduler.runSweep()).resolves.toEqual({ reclaimed: 2 });
    expect(mockCheckout.reclaimStaleTasks).toHaveBeenCalledTimes(2);
  });
});
