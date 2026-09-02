import type { ILogger } from '../logger/index.js';
import { Logger } from '../logger/index.js';

export type SecurityEventType =
  | 'webhook_signature_invalid'
  | 'webhook_signature_missing'
  | 'cors_origin_rejected'
  | 'rate_limit_exceeded'
  | 'payload_too_large'
  | 'content_type_invalid'
  | 'unauthorized_access'
  | 'input_sanitization_triggered';

export interface SecurityEvent {
  timestamp: string;
  type: SecurityEventType;
  source: string;
  details: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const SEVERITY_LOG_LEVEL: Record<SecurityEvent['severity'], 'info' | 'warn' | 'error'> = {
  low: 'info',
  medium: 'warn',
  high: 'error',
  critical: 'error',
};

export class SecurityAuditLog {
  private events: SecurityEvent[] = [];
  private readonly maxEvents: number;
  private counters = new Map<SecurityEventType, number>();
  private readonly logger: ILogger;

  constructor(logger?: ILogger, maxEvents = 10_000) {
    this.logger = logger ?? Logger.getInstance();
    this.maxEvents = maxEvents;
  }

  record(event: Omit<SecurityEvent, 'timestamp'>): void {
    const full: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    this.events.push(full);

    // FIFO eviction
    while (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    this.counters.set(event.type, (this.counters.get(event.type) ?? 0) + 1);

    const level = SEVERITY_LOG_LEVEL[event.severity];
    this.logger[level](
      `[SECURITY] ${event.type} from ${event.source}`,
      full.details,
    );
  }

  getCounters(): Record<SecurityEventType, number> {
    const result = {} as Record<SecurityEventType, number>;
    for (const [type, count] of this.counters) {
      result[type] = count;
    }
    return result;
  }

  getRecentEvents(limit = 100): SecurityEvent[] {
    return this.events.slice(-limit);
  }

  getEventsByType(type: SecurityEventType, limit = 100): SecurityEvent[] {
    const matches: SecurityEvent[] = [];
    // Walk backward for recency
    for (let i = this.events.length - 1; i >= 0 && matches.length < limit; i--) {
      if (this.events[i].type === type) {
        matches.push(this.events[i]);
      }
    }
    return matches.reverse();
  }

  reset(): void {
    this.events = [];
    this.counters.clear();
  }
}
