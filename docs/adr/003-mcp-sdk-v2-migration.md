# ADR-003: MCP SDK v2 migration

**Status:** Accepted
**Date:** 2026-08-09
**Deciders:** Vivek

## Context

`@modelcontextprotocol/server` v2 (2026-07-28 spec) supports protocol negotiation, server-side argument validation, and typed annotations. The previous v1 integration required hand-rolled protocol handling and manual version checks.

## Decision

Migrate to v2. Let `serveStdio` handle protocol negotiation. Remove hand-rolled version checks. Use v2's `inputSchema` validation (arguments are validated before the handler runs, so `ToolValidator` never sees missing required fields). Add tool annotations for capability discovery.

## Consequences

### Positive
- Protocol negotiation handled by the SDK — less hand-rolled code to maintain.
- Server-side argument validation catches malformed requests before they reach business logic.
- Tool annotations enable richer client-side capability discovery.
- The server correctly rejects un-initialized calls, improving protocol compliance.

### Negative
- v2 requires the `initialize` handshake before `tools/call` — tests that fired tool calls without initialization needed updating.

### Trade-offs
- The migration touched every test that spawned an MCP process, due to the initialization requirement. This was a one-time cost that improved the server's correctness guarantees.
