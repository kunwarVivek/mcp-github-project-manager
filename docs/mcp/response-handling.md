# MCP Response Handling

This document describes the Model Context Protocol (MCP) response handling implementation in the project.

## Overview

The MCP response system provides structured formatting for all responses and errors, ensuring consistency across the application. It supports multiple content types and includes proper error handling with standardized error codes.

## Response Format

All MCP responses follow this structure:

```typescript
{
  content: [{
    type: "json" | "text" | "markdown" | "html",
    text: string,
    contentType: MCPContentType
  }],
  metadata: {
    timestamp: string,
    status: number,
    requestId?: string,
    pagination?: {
      page: number,
      totalPages: number
    }
  }
}
```

### Content Types

Supported content types:
- `application/json`
- `text/plain`
- `text/markdown`
- `text/html`

## Error Contract (MCP v2)

The server runs on `@modelcontextprotocol/server` v2. Two error shapes are
distinct, and the difference matters when you write a client:

| Situation | What the client sees |
|-----------|----------------------|
| A tool that runs and fails — invalid arguments, GitHub API error (401/403/404/422/rate-limit/5xx), exhausted agent budget (`BudgetExhausted`), executor error | `{ content, isError: true, _meta: { error: { code, data? } } }` — a **successful** call with a failed result. The text names the failure and spells out the actionable detail (invalid fields, retry-after); the model can recover. |
| An unknown tool, or another protocol fault | A JSON-RPC error (`MethodNotFound`) |

Arguments are validated against each tool's declared `inputSchema` **before**
the handler runs, so a malformed call never reaches business logic — and
`ToolValidator` never sees a missing required field (it then applies parameter
coercion and the zod schema for field-level messages). Every result, success
or error, carries `_meta.schemaVersion` (the tool's contract version).

Tool failures are produced by `ToolValidator.handleToolError` /
`ToolValidator.mapGitHubError` and shaped by `ToolResultFormatter.formatError`
(`infrastructure/tools/`); `ToolDispatcher` is the single place that turns an
executor exception into an `isError` result. `MCPResponseFormatter` shapes the
content of successful results and resources; it does not decide whether a
result is an error. See [ADR-007](../adr/007-tool-error-contract.md).

## Usage Examples

### Basic Response Formatting

```typescript
import { MCPResponseFormatter, MCPContentType } from "../infrastructure/mcp";

// Format JSON data
const jsonResponse = MCPResponseFormatter.format(
  { name: "Test", value: 123 },
  MCPContentType.JSON
);

// Format text data
const textResponse = MCPResponseFormatter.format(
  "Hello World",
  MCPContentType.TEXT
);

// Format with multiple content types
const multiResponse = MCPResponseFormatter.formatMultiple([
  { data: { name: "Test" }, contentType: MCPContentType.JSON },
  { data: "Description", contentType: MCPContentType.TEXT }
]);

// Paginated response
const paginatedResponse = MCPResponseFormatter.paginated(
  items,
  currentPage,
  totalPages
);
```

### Error Handling

Throw a domain error (`ValidationError`, `ResourceNotFoundError`,
`UnauthorizedError`, … from `domain/errors.ts`) or let an Octokit error propagate:
`ToolDispatcher` catches it and returns the `isError` result described above.

```typescript
import { ValidationError } from "../domain/errors";

// Inside an executor
if (!args.projectId) {
  throw new ValidationError("projectId is required for this action");
}
```

## Error Codes

`_meta.error.code` carries the stable `MCPErrorCode` (`src/domain/mcp-types.ts`):

| Code | Meaning |
|------|---------|
| `-32602` (`INVALID_PARAMS` / `VALIDATION_ERROR`) | Parameter validation failed |
| `-32603` (`INTERNAL_ERROR`) | Server-side error |
| `-32000` (`TOOL_EXECUTION_FAILED`) | Tool execution failed |
| `-32001` (`RESOURCE_NOT_FOUND`) | Resource not found |
| `-32002` (`PERMISSION_DENIED`) | Permission denied |
| `-31001`…`-31006` | GitHub rate-limited / not found / unauthorized / forbidden / validation / server error |

An exhausted agent budget is reported with the code string `BudgetExhausted`
and the agent id, remaining tokens and limit. The legacy string codes
`MCP-001`…`MCP-006` survive only as `LegacyErrorCodeMap` aliases.

## Best Practices

1. Always use appropriate content types for responses
2. Include request IDs for error tracking
3. Use pagination for large data sets
4. Use specific error types for better error handling
5. Include detailed error messages and relevant details

## Testing

Formatter and dispatcher tests live under `src/__tests__/unit/infrastructure/`
(`mcp/` and `tools/`). Run them with:
```bash
npm test -- mcp
```

## Adding New Error Types

To add a new error type:

1. Add the code to the `MCPErrorCode` enum in `domain/mcp-types.ts`
2. Create a new error class in `domain/errors.ts`
3. Map it in `ToolValidator.handleToolError`
4. Add corresponding tests