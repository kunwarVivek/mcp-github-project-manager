# ADR-007: Tool error contract

**Status:** Accepted
**Date:** 2026-11-02
**Deciders:** Vivek

## Context

MCP distinguishes a protocol error (JSON-RPC error response) from a tool result flagged `isError: true`. A JSON-RPC error is not shown to the model as tool output, so the model cannot recover from it; an `isError` result is. Earlier code mixed both: validation and GitHub failures sometimes surfaced as JSON-RPC errors, and an exhausted agent budget had no stable shape. With `@modelcontextprotocol/server` v2 the SDK also validates arguments against the declared `inputSchema` before the handler runs.

## Decision

- **An unknown tool is the only JSON-RPC error** (`ProtocolError` / `MethodNotFound`), plus genuine protocol faults.
- **Every other failure returns `{ content, isError: true }`** with a stable code and structured context in `_meta.error`: invalid arguments (field-level messages), GitHub API errors mapped by `ToolValidator.mapGitHubError` (401/403/404/422/rate-limit/5xx, each with actionable text), executor errors, and an exhausted agent budget (`BudgetExhausted`, with agent id, remaining and limit).
- `ToolDispatcher` (`infrastructure/mcp/ToolDispatcher.ts`) is the single place that turns an exception into an `isError` result (`ToolValidator.handleToolError` → `ToolResultFormatter.formatError`).
- Every result, success or error, is stamped with the tool's `_meta.schemaVersion`.
- **Budget gate:** an agent whose budget has `hardStop` set and is exhausted is refused before an AI tool runs, with `BudgetExhausted`.
- The removed `MCPErrorHandler` is not part of the contract; `MCPResponseFormatter` only shapes successful content.

## Consequences

### Positive
- The model sees every failure and can retry or adapt; clients can branch on `_meta.error.code`.
- One code path owns error shaping, so tests pin the contract once.

### Negative
- Clients that treated any failure as a JSON-RPC error must read `isError`.

### Trade-offs
- `ToolValidator` still applies parameter coercion and the zod schema after the SDK's own `inputSchema` check, so some validation runs twice; the second pass is what produces field-level messages.
