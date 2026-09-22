import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { WebhookServer } from '../../../../infrastructure/http/WebhookServer';
import type { GitHubWebhookHandler } from '../../../../infrastructure/events/GitHubWebhookHandler';
import type { EventSubscriptionManager } from '../../../../infrastructure/events/EventSubscriptionManager';
import type { EventStore } from '../../../../infrastructure/events/EventStore';
import type { ILogger } from '../../../../infrastructure/logger/index';
import type { SecurityAuditLog } from '../../../../infrastructure/observability/SecurityAuditLog';

// The rate limiter and window are read from env at call time; pinning them to
// small values keeps the isRateLimited tests fast and exact regardless of
// what happens to be configured in the ambient environment.
vi.mock('../../../../env', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../../../env');
  return {
    ...actual,
    WEBHOOK_RATE_LIMIT: 5,
    WEBHOOK_RATE_WINDOW_MS: 1000,
  };
});

/** Minimal stand-in for `http.IncomingMessage`, covering only what WebhookServer reads. */
interface MockRequest extends EventEmitter {
  headers: Record<string, string>;
  socket: { remoteAddress: string };
  destroy: () => void;
  url: string;
  method: string;
}

/** Minimal stand-in for `http.ServerResponse`, capturing headers/status/body for assertions. */
interface MockResponse {
  headers: Record<string, string>;
  statusCode?: number;
  body?: string;
  setHeader: (name: string, value: string) => void;
  getHeader: (name: string) => string | undefined;
  writeHead: (status: number, headers?: Record<string, string>) => void;
  end: (chunk?: string) => void;
  write: (chunk: string) => void;
}

function createMockReq(headers: Record<string, string> = {}, remoteAddress = '127.0.0.1'): MockRequest {
  // EventEmitter is a genuine supertype of MockRequest, so this narrowing cast
  // is valid without an `unknown` indirection (same as `as HTMLInputElement`).
  const req = new EventEmitter() as MockRequest;
  req.headers = headers;
  req.socket = { remoteAddress };
  req.destroy = vi.fn();
  req.url = '/webhooks/github';
  req.method = 'POST';
  return req;
}

function createMockRes(): MockResponse {
  const headers: Record<string, string> = {};
  const res: MockResponse = {
    headers,
    setHeader: (name, value) => {
      headers[name] = value;
    },
    getHeader: (name) => headers[name],
    writeHead: (status, hdrs) => {
      res.statusCode = status;
      if (hdrs) Object.assign(headers, hdrs);
    },
    end: (chunk) => {
      if (chunk !== undefined) res.body = chunk;
    },
    write: () => {},
  };
  return res;
}

/** Mirrors the GitHubWebhookHandler surface WebhookServer depends on. */
interface WebhookHandlerMock {
  validateSignature: (payload: string, signature: string) => Promise<boolean>;
  validateWebhookPayload: (eventType: string, payload: unknown) => boolean;
  createWebhookEvent: (eventType: string, payload: unknown, signature: string, delivery?: string) => unknown;
  processWebhookEvent: (event: unknown) => Promise<{ success: boolean; events: unknown[] }>;
}

/** Mirrors the EventSubscriptionManager surface WebhookServer depends on. */
interface SubscriptionManagerMock {
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  subscribe: (subscription: unknown) => string;
  unsubscribe: (id: string) => boolean;
  notifySubscribers: (event: unknown) => Promise<void>;
  getStats: () => unknown;
}

/** Mirrors the EventStore surface WebhookServer depends on. */
interface EventStoreMock {
  storeEvents: (events: unknown[]) => Promise<void>;
  getEventsFromTimestamp: (timestamp: string, limit?: number) => Promise<unknown[]>;
  getRecentEvents: (limit?: number) => Promise<unknown[]>;
  getStats: () => Promise<unknown>;
}

/** Mirrors the SecurityAuditLog surface WebhookServer depends on. */
interface SecurityAuditLogMock {
  record: (event: unknown) => void;
  getCounters: () => Record<string, number>;
  getRecentEvents: (limit?: number) => unknown[];
  getEventsByType: (type: string, limit?: number) => unknown[];
  reset: () => void;
}

/** The private HTTP-handling surface under test, narrowed from the real instance. */
interface WebhookServerInternals {
  setCORSHeaders(req: MockRequest, res: MockResponse): void;
  resolveAllowedOrigin(req: MockRequest): string | undefined;
  isRateLimited(ip: string): boolean;
  readRequestBody(req: MockRequest): Promise<string>;
  setSecurityHeaders(res: MockResponse): void;
  handleGitHubWebhook(req: MockRequest, res: MockResponse): Promise<void>;
  trackDelivery(delivery: string): void;
}

// WebhookServer's HTTP handling is intentionally private; these tests exercise
// it directly through a narrowed view of the same instance instead of driving
// a real http.Server per scenario. The real methods only ever touch the
// members MockRequest/MockResponse implement, so the cast is safe in practice
// even though it can't be expressed as a structural subtype.
function internals(server: WebhookServer): WebhookServerInternals {
  return server as unknown as WebhookServerInternals;
}

describe('WebhookServer', () => {
  let webhookHandler: WebhookHandlerMock;
  let subscriptionManager: SubscriptionManagerMock;
  let eventStore: EventStoreMock;
  let logger: ILogger;
  let securityLog: SecurityAuditLogMock;
  let server: WebhookServer;

  beforeEach(() => {
    webhookHandler = {
      validateSignature: vi.fn(async () => true),
      validateWebhookPayload: vi.fn(() => true),
      createWebhookEvent: vi.fn(() => ({})),
      processWebhookEvent: vi.fn(async () => ({ success: true, events: [] })),
    };
    subscriptionManager = {
      on: vi.fn(),
      subscribe: vi.fn(() => 'sub-id'),
      unsubscribe: vi.fn(() => true),
      notifySubscribers: vi.fn(async () => {}),
      getStats: vi.fn(() => ({})),
    };
    eventStore = {
      storeEvents: vi.fn(async () => {}),
      getEventsFromTimestamp: vi.fn(async () => []),
      getRecentEvents: vi.fn(async () => []),
      getStats: vi.fn(async () => ({})),
    };
    logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    securityLog = {
      record: vi.fn(),
      getCounters: vi.fn(() => ({})),
      getRecentEvents: vi.fn(() => []),
      getEventsByType: vi.fn(() => []),
      reset: vi.fn(),
    };

    // Test doubles implement only the public surface WebhookServer calls; the
    // real collaborator classes carry private fields these object literals
    // structurally can't match, so the DI boundary needs an unchecked cast.
    server = new WebhookServer(
      webhookHandler as unknown as GitHubWebhookHandler,
      subscriptionManager as unknown as EventSubscriptionManager,
      eventStore as unknown as EventStore,
      undefined,
      logger,
      securityLog as unknown as SecurityAuditLog,
    );
  });

  describe('setCORSHeaders', () => {
    it('reflects an allowed origin and sets the CORS header set', () => {
      vi.spyOn(internals(server), 'resolveAllowedOrigin').mockReturnValue('https://allowed.com');
      const req = createMockReq({ origin: 'https://allowed.com' });
      const res = createMockRes();

      internals(server).setCORSHeaders(req, res);

      expect(res.headers['Access-Control-Allow-Origin']).toBe('https://allowed.com');
      expect(res.headers['Access-Control-Allow-Methods']).toBe('GET, POST, DELETE, OPTIONS');
      expect(res.headers['Vary']).toBe('Origin');
      expect(securityLog.record).not.toHaveBeenCalled();
    });

    it('omits CORS headers and logs a security event for a disallowed origin', () => {
      vi.spyOn(internals(server), 'resolveAllowedOrigin').mockReturnValue(undefined);
      const req = createMockReq({ origin: 'https://evil.com' });
      const res = createMockRes();

      internals(server).setCORSHeaders(req, res);

      expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
      expect(securityLog.record).toHaveBeenCalledWith({
        type: 'cors_origin_rejected',
        source: '127.0.0.1',
        details: { origin: 'https://evil.com' },
        severity: 'medium',
      });
    });

    it('reflects a wildcard origin when configured', () => {
      vi.spyOn(internals(server), 'resolveAllowedOrigin').mockReturnValue('*');
      const req = createMockReq({ origin: 'https://anything.example' });
      const res = createMockRes();

      internals(server).setCORSHeaders(req, res);

      expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(securityLog.record).not.toHaveBeenCalled();
    });
  });

  describe('isRateLimited', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns false while under the configured limit', () => {
      const ip = '10.0.0.1';
      // WEBHOOK_RATE_LIMIT is mocked to 5; the limiter only trips once count
      // exceeds the limit, so the first 5 calls in a window must all pass.
      const results = Array.from({ length: 5 }, () => internals(server).isRateLimited(ip));
      expect(results).toEqual([false, false, false, false, false]);
    });

    it('returns true once the limit is exceeded', () => {
      const ip = '10.0.0.2';
      const results = Array.from({ length: 6 }, () => internals(server).isRateLimited(ip));
      expect(results).toEqual([false, false, false, false, false, true]);
    });

    it('resets the window after WEBHOOK_RATE_WINDOW_MS elapses', () => {
      const ip = '10.0.0.3';
      for (let i = 0; i < 6; i++) {
        internals(server).isRateLimited(ip);
      }
      expect(internals(server).isRateLimited(ip)).toBe(true);

      vi.advanceTimersByTime(1001); // window mocked to 1000ms

      expect(internals(server).isRateLimited(ip)).toBe(false);
    });
  });

  describe('readRequestBody', () => {
    it('resolves the concatenated body when under the size limit', async () => {
      const req = createMockReq();
      const promise = internals(server).readRequestBody(req);

      req.emit('data', Buffer.from('{"hello":'));
      req.emit('data', Buffer.from('"world"}'));
      req.emit('end');

      await expect(promise).resolves.toBe('{"hello":"world"}');
    });

    it('rejects with a 413 and destroys the request when the body exceeds 1MB', async () => {
      const req = createMockReq();
      const promise = internals(server).readRequestBody(req);

      const oversized = Buffer.alloc(1_048_577);
      req.emit('data', oversized);

      await expect(promise).rejects.toMatchObject({ statusCode: 413, message: 'Payload Too Large' });
      expect(req.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('setSecurityHeaders', () => {
    it('sets nosniff, deny-framing, and disabled XSS-auditor headers', () => {
      const res = createMockRes();

      internals(server).setSecurityHeaders(res);

      expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(res.headers['X-Frame-Options']).toBe('DENY');
      expect(res.headers['X-XSS-Protection']).toBe('0');
    });
  });

  describe('handleGitHubWebhook - content-type validation', () => {
    it('rejects a non-JSON content type with 415 and logs the security event', async () => {
      const req = createMockReq({ 'content-type': 'text/plain' });
      const res = createMockRes();

      await internals(server).handleGitHubWebhook(req, res);

      expect(res.statusCode).toBe(415);
      expect(JSON.parse(res.body ?? '')).toEqual({ error: 'Unsupported Media Type: expected application/json' });
      expect(securityLog.record).toHaveBeenCalledWith({
        type: 'content_type_invalid',
        source: '127.0.0.1',
        details: { contentType: 'text/plain' },
        severity: 'low',
      });
      expect(webhookHandler.validateSignature).not.toHaveBeenCalled();
    });
  });

  describe('handleGitHubWebhook - idempotency', () => {
    it('short-circuits a duplicate delivery ID as deduplicated, without validating the signature', async () => {
      internals(server).trackDelivery('delivery-abc');

      const req = createMockReq({
        'content-type': 'application/json',
        'x-github-event': 'push',
        'x-github-delivery': 'delivery-abc',
      });
      const res = createMockRes();

      const promise = internals(server).handleGitHubWebhook(req, res);
      req.emit('end');
      await promise;

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body ?? '')).toEqual({ success: true, deduplicated: true });
      expect(webhookHandler.validateSignature).not.toHaveBeenCalled();
    });

    it('processes a fresh delivery ID normally (not deduplicated)', async () => {
      const req = createMockReq({
        'content-type': 'application/json',
        'x-github-event': 'push',
        'x-github-delivery': 'delivery-new',
      });
      const res = createMockRes();

      const promise = internals(server).handleGitHubWebhook(req, res);
      req.emit('data', Buffer.from('{}'));
      req.emit('end');
      await promise;

      expect(webhookHandler.validateSignature).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body ?? '')).toMatchObject({ success: true });
    });
  });
});
