/**
 * Observability infrastructure - Tracing and correlation ID management.
 */

export {
  getCorrelationId,
  getTraceContext,
  startTrace,
  type TraceContext,
  traceContext,
} from "./CorrelationContext";
export {
  type AuditSink,
  auditLogConfigFromEnv,
  createMutationAuditLog,
  FileAuditSink,
  type MutationAuditInput,
  MutationAuditLog,
  type MutationAuditLogConfig,
  type MutationAuditRecord,
} from "./MutationAuditLog";
export {
  initTelemetry,
  shutdownTelemetry,
  type TelemetryConfig,
  telemetryConfigFromEnv,
  withSpan,
} from "./otel";
export {
  SecurityAuditLog,
  type SecurityEvent,
  type SecurityEventType,
} from "./SecurityAuditLog";
