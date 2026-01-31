/**
 * Observability infrastructure - Tracing and correlation ID management.
 */

export {
  startTrace,
  getCorrelationId,
  getTraceContext,
  traceContext,
  type TraceContext,
} from './CorrelationContext.js';

export {
  TracingLogger,
  createTracingLogger,
  type LogEntry,
} from './TracingLogger.js';
