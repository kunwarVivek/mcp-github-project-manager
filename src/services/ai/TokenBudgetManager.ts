import { AI_SESSION_TOKEN_LIMIT } from "../../env";
import { getCorrelationId } from "../../infrastructure/observability/CorrelationContext";
import { TokenCounter } from "./TokenCounter";

/** Thrown by {@link TokenBudgetManager.reserve} when a call would exceed the session limit. */
export class TokenBudgetExceededError extends Error {
  readonly sessionId: string;
  readonly limit: number;
  /** Tokens already used or reserved in the session. */
  readonly consumed: number;
  /** Tokens the rejected call asked for. */
  readonly requested: number;

  constructor(sessionId: string, limit: number, consumed: number, requested: number) {
    super(
      `AI token budget exhausted for session ${sessionId}: ${consumed} of ${limit} tokens consumed, ${requested} requested`
    );
    this.name = "TokenBudgetExceededError";
    this.sessionId = sessionId;
    this.limit = limit;
    this.consumed = consumed;
    this.requested = requested;
  }
}

export interface TokenBudgetStatus {
  sessionId: string;
  /** Token limit; 0 means unlimited. */
  limit: number;
  /** Tokens committed so far. */
  used: number;
  /** Tokens held by in-flight calls that have not committed yet. */
  reserved: number;
  /** Tokens still available, or null when unlimited. */
  remaining: number | null;
}

interface Session {
  limit: number;
  used: number;
  reserved: number;
}

/** Cap on live sessions; the oldest is evicted so un-ended sessions cannot leak. */
const MAX_SESSIONS = 1000;

/**
 * Per-session token budget for the AI task pipeline (PRD parsing, task and
 * context generation).
 *
 * A session is keyed by an explicit id or, by default, the current
 * CorrelationContext correlation id, so one tool call is one budget. Callers
 * `reserve` an estimate before an AI call and `commit` the provider-reported
 * usage afterwards (or `release` the reservation if the call failed).
 *
 * Distinct from the agent budget (AgentBudgetService): that one is metered
 * server-side per registered agent and persisted. This one is an in-process,
 * ephemeral guard against a single operation fanning out into unbounded AI
 * calls. The two never read or write each other's state.
 *
 * Without an explicit session or a correlation id, or with a default limit of 0
 * (unlimited, the default), `reserve` is a no-op unless a session was started
 * explicitly.
 */
export class TokenBudgetManager {
  private readonly sessions = new Map<string, Session>();

  /** @param defaultLimit - Limit for lazily created sessions; 0 = unlimited (no tracking). */
  constructor(private readonly defaultLimit: number = AI_SESSION_TOKEN_LIMIT) {}

  /** Start (or reset) a session. `id` defaults to the current correlation id. */
  startSession(id?: string, limit: number = this.defaultLimit): TokenBudgetStatus {
    const sessionId = id ?? getCorrelationId();
    if (!sessionId) {
      throw new Error("startSession requires an id outside a correlation context");
    }
    this.sessions.delete(sessionId);
    if (this.sessions.size >= MAX_SESSIONS) {
      const oldest = this.sessions.keys().next();
      if (!oldest.done) this.sessions.delete(oldest.value);
    }
    this.sessions.set(sessionId, { limit: Math.max(0, limit), used: 0, reserved: 0 });
    return this.statusOf(sessionId, this.sessions.get(sessionId) as Session);
  }

  /**
   * Reserve `estimatedTokens` for an in-flight call.
   * @returns the session id charged, or undefined when no budget applies.
   * @throws TokenBudgetExceededError when the reservation would exceed the limit.
   */
  reserve(id: string | undefined, estimatedTokens: number): string | undefined {
    const sessionId = id ?? getCorrelationId();
    if (!sessionId) return undefined;
    let session = this.sessions.get(sessionId);
    if (!session) {
      if (this.defaultLimit <= 0) return undefined;
      this.startSession(sessionId, this.defaultLimit);
      session = this.sessions.get(sessionId);
      if (!session) return undefined;
    }
    const requested = Math.max(0, Math.ceil(estimatedTokens));
    const consumed = session.used + session.reserved;
    if (session.limit > 0 && consumed + requested > session.limit) {
      throw new TokenBudgetExceededError(sessionId, session.limit, consumed, requested);
    }
    session.reserved += requested;
    return sessionId;
  }

  /**
   * Replace a reservation with actual usage. `actualUsage` may be a number or a
   * provider usage object (ai@7: `{ inputTokens: { total }, outputTokens: { total } }`);
   * when it is absent or unreadable the reserved estimate is charged instead.
   */
  commit(id: string | undefined, actualUsage: unknown, reservedTokens = 0): void {
    const session = this.find(id);
    if (!session) return;
    const reserved = Math.max(0, Math.ceil(reservedTokens));
    session.reserved = Math.max(0, session.reserved - reserved);
    session.used += TokenCounter.fromUsage(actualUsage) ?? reserved;
  }

  /** Drop a reservation without charging it (the AI call failed). */
  release(id: string | undefined, reservedTokens: number): void {
    const session = this.find(id);
    if (!session) return;
    session.reserved = Math.max(0, session.reserved - Math.max(0, Math.ceil(reservedTokens)));
  }

  getStatus(id?: string): TokenBudgetStatus | undefined {
    const sessionId = id ?? getCorrelationId();
    const session = sessionId ? this.sessions.get(sessionId) : undefined;
    return sessionId && session ? this.statusOf(sessionId, session) : undefined;
  }

  endSession(id?: string): void {
    const sessionId = id ?? getCorrelationId();
    if (sessionId) this.sessions.delete(sessionId);
  }

  private find(id: string | undefined): Session | undefined {
    const sessionId = id ?? getCorrelationId();
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }

  private statusOf(sessionId: string, session: Session): TokenBudgetStatus {
    const consumed = session.used + session.reserved;
    return {
      sessionId,
      limit: session.limit,
      used: session.used,
      reserved: session.reserved,
      remaining: session.limit > 0 ? Math.max(0, session.limit - consumed) : null,
    };
  }
}

/** Process-wide budget shared by the AI task pipeline services. */
export const tokenBudgetManager = new TokenBudgetManager();
