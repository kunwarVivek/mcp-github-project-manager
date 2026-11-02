/**
 * Opt-in OpenTelemetry tracing.
 *
 * Disabled unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set. When disabled nothing
 * from the SDK is loaded (the SDK/exporter are dynamically imported inside
 * `initTelemetry`) and `withSpan` is a plain call of `fn`.
 *
 * Spans carry the surrounding `CorrelationContext` correlation id as the
 * `correlation.id` attribute, so traces join up with log lines and the
 * mutation audit log.
 *
 * stdio MCP: nothing here writes to stdout. Export is OTLP/HTTP only.
 */

import type { Attributes, Span } from "@opentelemetry/api";
import { getOptionalConfigValue } from "../../env";
import { Logger } from "../logger/index";
import { getCorrelationId } from "./CorrelationContext";

export interface TelemetryConfig {
  /** OTLP/HTTP base endpoint (e.g. http://localhost:4318). Empty = disabled. */
  endpoint?: string;
  /** `service.name` resource attribute. */
  serviceName?: string;
}

export const DEFAULT_OTEL_SERVICE_NAME = "mcp-github-project-manager";
const TRACER_NAME = "mcp-github-project-manager";
const TRACES_PATH = "/v1/traces";

let shutdownProvider: (() => Promise<void>) | undefined;
let initPromise: Promise<boolean> | undefined;

/** Config from `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_SERVICE_NAME` (see env.ts). */
export function telemetryConfigFromEnv(): TelemetryConfig {
  return {
    endpoint: getOptionalConfigValue("OTEL_EXPORTER_OTLP_ENDPOINT", ""),
    serviceName: getOptionalConfigValue("OTEL_SERVICE_NAME", DEFAULT_OTEL_SERVICE_NAME),
  };
}

function tracesUrl(endpoint: string): string {
  const base = endpoint.replace(/\/+$/, "");
  return base.endsWith(TRACES_PATH) ? base : `${base}${TRACES_PATH}`;
}

/**
 * Start the tracer provider when an OTLP endpoint is configured.
 *
 * Idempotent. Never throws: an SDK/exporter failure is logged to stderr and
 * telemetry stays disabled, so observability cannot take the server down.
 *
 * @returns true when telemetry is active.
 */
export function initTelemetry(
  config: TelemetryConfig = telemetryConfigFromEnv()
): Promise<boolean> {
  if (!config.endpoint) {
    return Promise.resolve(false);
  }
  if (!initPromise) {
    initPromise = startProvider(config.endpoint, config.serviceName || DEFAULT_OTEL_SERVICE_NAME);
  }
  return initPromise;
}

async function startProvider(endpoint: string, serviceName: string): Promise<boolean> {
  try {
    const [api, sdk, hooks, exporter, resources, semconv] = await Promise.all([
      import("@opentelemetry/api"),
      import("@opentelemetry/sdk-trace"),
      import("@opentelemetry/context-async-hooks"),
      import("@opentelemetry/exporter-trace-otlp-http"),
      import("@opentelemetry/resources"),
      import("@opentelemetry/semantic-conventions"),
    ]);

    const provider = new sdk.TracerProvider({
      resource: resources.resourceFromAttributes({ [semconv.ATTR_SERVICE_NAME]: serviceName }),
      spanProcessors: [
        new sdk.BatchSpanProcessor({
          exporter: new exporter.OTLPTraceExporter({ url: tracesUrl(endpoint) }),
        }),
      ],
    });
    // AsyncLocalStorage keeps the active span across awaits, like CorrelationContext.
    api.context.setGlobalContextManager(new hooks.AsyncLocalStorageContextManager().enable());
    api.trace.setGlobalTracerProvider(provider);
    shutdownProvider = () => provider.shutdown();
    return true;
  } catch (error) {
    initPromise = undefined;
    Logger.getInstance().warn(
      "[otel] failed to start OpenTelemetry; tracing disabled",
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

/**
 * Run `fn` inside a span. A plain call of `fn` when telemetry is not active.
 * Errors are recorded on the span and rethrown unchanged.
 */
export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: (span?: Span) => Promise<T> | T
): Promise<T> {
  if (!shutdownProvider) {
    return fn(undefined);
  }
  const { trace, SpanStatusCode } = await import("@opentelemetry/api");
  const correlationId = getCorrelationId();
  return trace.getTracer(TRACER_NAME).startActiveSpan(
    name,
    {
      attributes: correlationId ? { ...attributes, "correlation.id": correlationId } : attributes,
    },
    async (span) => {
      try {
        return await fn(span);
      } catch (error) {
        span.recordException(error instanceof Error ? error : String(error));
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/** Flush pending spans and stop the provider. Never rejects. */
export async function shutdownTelemetry(): Promise<void> {
  const shutdown = shutdownProvider;
  shutdownProvider = undefined;
  initPromise = undefined;
  if (!shutdown) {
    return;
  }
  try {
    await shutdown();
  } catch (error) {
    Logger.getInstance().warn(
      "[otel] shutdown failed",
      error instanceof Error ? error.message : String(error)
    );
  }
}
