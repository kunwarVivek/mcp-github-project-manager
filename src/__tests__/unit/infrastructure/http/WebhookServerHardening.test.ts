import nock from "nock";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import type { EventStore } from "../../../../infrastructure/events/EventStore";
import type { EventSubscriptionManager } from "../../../../infrastructure/events/EventSubscriptionManager";
import type { GitHubWebhookHandler } from "../../../../infrastructure/events/GitHubWebhookHandler";
import {
  normalizeIp,
  parseTrustProxy,
  resolveClientAddress,
} from "../../../../infrastructure/http/clientAddress";
import {
  WebhookServer,
  type WebhookServerOptions,
} from "../../../../infrastructure/http/WebhookServer";
import type { ILogger } from "../../../../infrastructure/logger/index";
import type { SecurityAuditLog } from "../../../../infrastructure/observability/SecurityAuditLog";

// Small, exact rate limit so a handful of loopback requests trips the limiter.
vi.mock("../../../../env", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../../../../env");
  return {
    ...actual,
    WEBHOOK_RATE_LIMIT: 3,
    WEBHOOK_RATE_WINDOW_MS: 60000,
  };
});

describe("WebhookServer hardening", () => {
  let logger: ILogger;
  let record: Mock;
  let started: WebhookServer[];

  // The global setup blocks network I/O via nock; these tests drive real
  // loopback servers, so allow loopback only.
  beforeAll(() => {
    nock.enableNetConnect((host) => host.startsWith("127.0.0.1:") || host.startsWith("localhost:"));
  });

  afterAll(() => {
    nock.disableNetConnect();
  });

  beforeEach(() => {
    logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    record = vi.fn();
    started = [];
  });

  afterEach(async () => {
    for (const server of started) await server.stop();
  });

  function build(options: Partial<WebhookServerOptions> = {}): WebhookServer {
    const webhookHandler = {};
    const subscriptionManager = { on: vi.fn(), getStats: vi.fn(() => ({ totalSubscriptions: 0 })) };
    const eventStore = { getStats: vi.fn(async () => ({ totalEvents: 0 })) };
    return new WebhookServer(
      webhookHandler as unknown as GitHubWebhookHandler,
      subscriptionManager as unknown as EventSubscriptionManager,
      eventStore as unknown as EventStore,
      {
        port: 0,
        enableSSE: false,
        trustProxy: "",
        allowedOrigins: "",
        credentialsConfigured: false,
        ...options,
      },
      logger,
      { record } as unknown as SecurityAuditLog
    );
  }

  async function start(options: Partial<WebhookServerOptions> = {}): Promise<string> {
    const server = build(options);
    await server.start();
    started.push(server);
    return `http://127.0.0.1:${server.getStatus().port}`;
  }

  /** Issue sequential /health requests, each with its own X-Forwarded-For. */
  async function statuses(url: string, forwardedFor: Array<string | undefined>): Promise<number[]> {
    const out: number[] = [];
    for (const xff of forwardedFor) {
      const res = await fetch(`${url}/health`, {
        headers: xff === undefined ? {} : { "X-Forwarded-For": xff },
      });
      await res.arrayBuffer();
      out.push(res.status);
    }
    return out;
  }

  function rateLimitSources(): string[] {
    return record.mock.calls
      .map(([entry]) => entry as { type: string; source: string })
      .filter((entry) => entry.type === "rate_limit_exceeded")
      .map((entry) => entry.source);
  }

  describe("client address for rate limiting", () => {
    it("ignores a rotating X-Forwarded-For by default (cannot evade the throttle)", async () => {
      const url = await start();

      const result = await statuses(url, ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4", "5.5.5.5"]);

      expect(result).toEqual([200, 200, 200, 429, 429]);
      // Audit records the socket peer (IPv4-mapped form normalised), not the header.
      expect(rateLimitSources()).toEqual(["127.0.0.1", "127.0.0.1"]);
    });

    it("TRUST_PROXY=1 buckets by the right-most X-Forwarded-For entry", async () => {
      const url = await start({ trustProxy: "1" });

      // Left-most entries are client-controlled and rotate; the right-most is
      // what our single trusted proxy appended, so it is the bucket key.
      const sameProxyAppended = await statuses(url, [
        "9.9.9.1, 10.0.0.7",
        "9.9.9.2, 10.0.0.7",
        "9.9.9.3, 10.0.0.7",
        "9.9.9.4, 10.0.0.7",
      ]);
      expect(sameProxyAppended).toEqual([200, 200, 200, 429]);
      expect(rateLimitSources()).toEqual(["10.0.0.7"]);

      // A different right-most address is a different bucket.
      expect(await statuses(url, ["9.9.9.1, 10.0.0.8"])).toEqual([200]);
    });

    it("TRUST_PROXY=2 buckets by the second-from-right entry", async () => {
      const url = await start({ trustProxy: "2" });

      const result = await statuses(url, [
        "7.7.7.7, 203.0.113.5, 10.0.0.1",
        "8.8.8.8, 203.0.113.5, 10.0.0.2",
        "6.6.6.6, 203.0.113.5, 10.0.0.3",
        "5.5.5.5, 203.0.113.5, 10.0.0.4",
      ]);

      expect(result).toEqual([200, 200, 200, 429]);
      expect(rateLimitSources()).toEqual(["203.0.113.5"]);
    });

    it("falls back to the socket peer when a trusted proxy sent no header", async () => {
      const url = await start({ trustProxy: "1" });

      expect(await statuses(url, [undefined, undefined, undefined, undefined])).toEqual([
        200, 200, 200, 429,
      ]);
      expect(rateLimitSources()).toEqual(["127.0.0.1"]);
    });
  });

  describe("TRUST_PROXY validation (fail fast at startup)", () => {
    it.each(["true", "-1", "abc", "1.5", "2 hops", "TRUE"])("rejects %j", (value) => {
      expect(() => build({ trustProxy: value })).toThrow(/Invalid TRUST_PROXY/);
    });

    it.each(["", "false", "FALSE", "0", "1", "3"])("accepts %j", (value) => {
      expect(() => build({ trustProxy: value })).not.toThrow();
    });
  });

  describe("clientAddress helpers", () => {
    it("normalises IPv4-mapped IPv6 and case", () => {
      expect(normalizeIp("::ffff:1.2.3.4")).toBe("1.2.3.4");
      expect(normalizeIp("::FFFF:10.0.0.1")).toBe("10.0.0.1");
      expect(normalizeIp("2001:DB8::1")).toBe("2001:db8::1");
    });

    it("parses hop counts", () => {
      expect(parseTrustProxy(undefined)).toBe(0);
      expect(parseTrustProxy(" 2 ")).toBe(2);
    });

    it("follows Express semantics when the chain is shorter than the hop count", () => {
      expect(resolveClientAddress("10.0.0.1", "1.1.1.1", 5)).toBe("1.1.1.1");
      expect(resolveClientAddress("::ffff:10.0.0.1", "1.1.1.1, 2.2.2.2", 2)).toBe("1.1.1.1");
      expect(resolveClientAddress(undefined, undefined, 1)).toBe("unknown");
      expect(resolveClientAddress("10.0.0.1", ["1.1.1.1", "2.2.2.2"], 1)).toBe("2.2.2.2");
    });
  });

  describe("WEBHOOK_ALLOWED_ORIGINS wildcard", () => {
    it("refuses '*' when inbound auth is configured", () => {
      expect(() => build({ allowedOrigins: "*", credentialsConfigured: true })).toThrow(
        /WEBHOOK_ALLOWED_ORIGINS="\*" is not allowed/
      );
    });

    it("allows '*' without credentials (dev mode), warns, and reflects '*'", async () => {
      const url = await start({ allowedOrigins: "*", credentialsConfigured: false });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('WEBHOOK_ALLOWED_ORIGINS="*"')
      );
      const res = await fetch(`${url}/health`, { headers: { Origin: "https://anywhere.example" } });
      await res.arrayBuffer();
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
    });

    it("does not warn for an exact-origin allowlist and keeps its behaviour", async () => {
      const url = await start({
        allowedOrigins: "https://app.example, https://admin.example",
        credentialsConfigured: true,
      });
      expect(logger.warn).not.toHaveBeenCalled();

      const allowed = await fetch(`${url}/health`, {
        headers: { Origin: "https://admin.example" },
      });
      await allowed.arrayBuffer();
      expect(allowed.headers.get("access-control-allow-origin")).toBe("https://admin.example");
      expect(allowed.headers.get("vary")).toBe("Origin");

      const denied = await fetch(`${url}/health`, { headers: { Origin: "https://evil.example" } });
      await denied.arrayBuffer();
      expect(denied.headers.get("access-control-allow-origin")).toBeNull();
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "cors_origin_rejected",
          details: { origin: "https://evil.example" },
        })
      );
    });

    it("sends no CORS headers when no origins are configured", async () => {
      const url = await start({ allowedOrigins: "" });
      const res = await fetch(`${url}/health`, { headers: { Origin: "https://app.example" } });
      await res.arrayBuffer();
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });
  });
});
