# ADR-010: Observability — opt-in OpenTelemetry, audit log, one logger

**Status:** Accepted
**Date:** 2026-11-02
**Deciders:** Vivek

## Context

Operators need to see what the server did (traces), who changed what (audit), and logs they can parse. The repository carried two logger classes that nothing consumed (`StructuredLogger`, `TracingLogger`) while the live logger ignored `LOG_LEVEL` and `LOG_FORMAT`. A stdio MCP server must also never write to stdout, which is the protocol channel.

## Decision

- **One logger.** `ConsoleLogger` (`infrastructure/logger/`) writes to stderr and honors `LOG_LEVEL` and `LOG_FORMAT=json` (one JSON object per line carrying the active `correlationId`). `StructuredLogger` and `TracingLogger` are deleted. Everything logged passes through `redactSecrets()`.
- **Tracing is opt-in.** With `OTEL_EXPORTER_OTLP_ENDPOINT` set (and optionally `OTEL_SERVICE_NAME`), `ToolDispatcher` runs each call inside a `tool.<name>` span (`tool.name`, `tool.action`, `agent.id` attributes) exported over OTLP/HTTP. With it unset nothing is exported and no collector is needed.
- **Audit is separate from tracing.** The mutation audit log (ADR-009) is a local append-only file, not an OTel signal, so it works with no collector.
- **Lifecycle.** Both flush in graceful shutdown.
- **HTTP surface hardening** (same operational pass): the webhook/SSE server binds `127.0.0.1` by default (`WEBHOOK_HOST`), `/events/*` requires `EVENTS_AUTH_TOKEN` (fail closed with 503; `EVENTS_ALLOW_UNAUTHENTICATED=true` is a dev opt-out), `X-Forwarded-For` is honored only from `WEBHOOK_TRUSTED_PROXIES`, and webhook signatures fail closed.

## Consequences

### Positive
- Observability costs nothing until enabled; the same correlation id ties logs, spans and audit records together.
- Fewer logging classes; the one that exists does what the docs say.

### Negative
- Traces only — there is no metrics export.

### Trade-offs
- OTLP/HTTP only (no gRPC) keeps the dependency surface small at the price of fewer exporter options.
