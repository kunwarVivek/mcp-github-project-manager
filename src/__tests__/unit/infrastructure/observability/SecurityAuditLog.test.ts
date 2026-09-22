import { describe, expect, it, vi, beforeEach } from "vitest";
import { SecurityAuditLog } from "../../../../infrastructure/observability/SecurityAuditLog";
import type { ILogger } from "../../../../infrastructure/logger/index";

describe("SecurityAuditLog", () => {
  let logger: ILogger;

  beforeEach(() => {
    logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  describe("record", () => {
    it("adds an event stamped with the current time", () => {
      const log = new SecurityAuditLog(logger);
      const before = Date.now();

      log.record({
        type: "unauthorized_access",
        source: "1.2.3.4",
        details: { path: "/admin" },
        severity: "low",
      });

      const [event] = log.getRecentEvents();
      expect(event.type).toBe("unauthorized_access");
      expect(event.source).toBe("1.2.3.4");
      expect(event.details).toEqual({ path: "/admin" });
      const stamp = new Date(event.timestamp).getTime();
      expect(stamp).toBeGreaterThanOrEqual(before);
      expect(stamp).toBeLessThanOrEqual(Date.now());
    });

    it("evicts the oldest event once maxEvents is exceeded (FIFO)", () => {
      const log = new SecurityAuditLog(logger, 3);

      for (let i = 0; i < 5; i++) {
        log.record({
          type: "rate_limit_exceeded",
          source: `ip-${i}`,
          details: {},
          severity: "medium",
        });
      }

      const events = log.getRecentEvents(10);
      expect(events).toHaveLength(3);
      expect(events.map((e) => e.source)).toEqual(["ip-2", "ip-3", "ip-4"]);
    });
  });

  describe("getCounters", () => {
    it("increments a per-type counter on every record", () => {
      const log = new SecurityAuditLog(logger);
      log.record({ type: "cors_origin_rejected", source: "a", details: {}, severity: "medium" });
      log.record({ type: "cors_origin_rejected", source: "b", details: {}, severity: "medium" });
      log.record({ type: "payload_too_large", source: "c", details: {}, severity: "medium" });

      const counters = log.getCounters();
      expect(counters.cors_origin_rejected).toBe(2);
      expect(counters.payload_too_large).toBe(1);
      expect(counters.webhook_signature_invalid).toBeUndefined();
    });
  });

  describe("getRecentEvents", () => {
    it("returns only the latest N events, oldest first among them", () => {
      const log = new SecurityAuditLog(logger);
      for (let i = 0; i < 5; i++) {
        log.record({
          type: "input_sanitization_triggered",
          source: `s${i}`,
          details: {},
          severity: "low",
        });
      }

      const recent = log.getRecentEvents(2);
      expect(recent.map((e) => e.source)).toEqual(["s3", "s4"]);
    });

    it("defaults to the last 100 events when no limit is given", () => {
      const log = new SecurityAuditLog(logger);
      for (let i = 0; i < 150; i++) {
        log.record({
          type: "input_sanitization_triggered",
          source: `s${i}`,
          details: {},
          severity: "low",
        });
      }

      expect(log.getRecentEvents()).toHaveLength(100);
    });
  });

  describe("getEventsByType", () => {
    it("filters events by type, most recent last", () => {
      const log = new SecurityAuditLog(logger);
      log.record({ type: "webhook_signature_invalid", source: "a", details: {}, severity: "high" });
      log.record({ type: "cors_origin_rejected", source: "b", details: {}, severity: "medium" });
      log.record({ type: "webhook_signature_invalid", source: "c", details: {}, severity: "high" });

      const matches = log.getEventsByType("webhook_signature_invalid");
      expect(matches.map((e) => e.source)).toEqual(["a", "c"]);
    });

    it("returns an empty array when no events match", () => {
      const log = new SecurityAuditLog(logger);
      log.record({ type: "cors_origin_rejected", source: "a", details: {}, severity: "medium" });

      expect(log.getEventsByType("unauthorized_access")).toEqual([]);
    });

    it("respects the limit, keeping the most recent matches", () => {
      const log = new SecurityAuditLog(logger);
      for (let i = 0; i < 5; i++) {
        log.record({
          type: "rate_limit_exceeded",
          source: `ip-${i}`,
          details: {},
          severity: "medium",
        });
      }

      const matches = log.getEventsByType("rate_limit_exceeded", 2);
      expect(matches.map((e) => e.source)).toEqual(["ip-3", "ip-4"]);
    });
  });

  describe("reset", () => {
    it("clears events and counters", () => {
      const log = new SecurityAuditLog(logger);
      log.record({ type: "cors_origin_rejected", source: "a", details: {}, severity: "medium" });

      log.reset();

      expect(log.getRecentEvents()).toEqual([]);
      expect(log.getCounters()).toEqual({});
    });
  });

  describe("severity-based logging", () => {
    it("logs high-severity events at error level", () => {
      const log = new SecurityAuditLog(logger);
      log.record({
        type: "webhook_signature_invalid",
        source: "a",
        details: { x: 1 },
        severity: "high",
      });

      expect(logger.error).toHaveBeenCalledWith("[SECURITY] webhook_signature_invalid from a", {
        x: 1,
      });
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it("logs medium-severity events at warn level", () => {
      const log = new SecurityAuditLog(logger);
      log.record({ type: "rate_limit_exceeded", source: "b", details: {}, severity: "medium" });

      expect(logger.warn).toHaveBeenCalledWith("[SECURITY] rate_limit_exceeded from b", {});
      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it("logs low-severity events at info level", () => {
      const log = new SecurityAuditLog(logger);
      log.record({ type: "content_type_invalid", source: "c", details: {}, severity: "low" });

      expect(logger.info).toHaveBeenCalledWith("[SECURITY] content_type_invalid from c", {});
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("logs critical-severity events at error level", () => {
      const log = new SecurityAuditLog(logger);
      log.record({ type: "unauthorized_access", source: "d", details: {}, severity: "critical" });

      expect(logger.error).toHaveBeenCalledWith("[SECURITY] unauthorized_access from d", {});
    });
  });
});
