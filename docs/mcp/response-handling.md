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

## Error Semantics (MCP v2)

The server runs on `@modelcontextprotocol/server` v2. Two error shapes are
distinct, and the difference matters when you write a client:

| Situation | What the client sees |
|-----------|----------------------|
| A tool that runs and fails | `{ content, isError: true }` — a **successful** call with a failed result. The model sees the failure and can recover. |
| A protocol fault (e.g. calling a tool that does not exist) | A JSON-RPC error |

Arguments are validated against each tool's declared `inputSchema` **before**
the handler runs, so a malformed call never reaches business logic — and
`ToolValidator` never sees a missing required field.

`MCPResponseFormatter` and `MCPErrorHandler` shape the content of a tool
result; they do not decide whether the result is an error.

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

```typescript
import { MCPErrorHandler } from "../infrastructure/mcp";
import { ValidationError } from "../domain/errors";

// Handle specific error types
try {
  // Some operation
} catch (error) {
  const errorResponse = MCPErrorHandler.handle(error);
}

// Create specific error types
const validationError = MCPErrorHandler.validationError(
  "Invalid input",
  { field: "username" }
);

const notFoundError = MCPErrorHandler.notFoundError(
  "Resource not found"
);
```

## Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| MCP-001 | Internal Error | 500 |
| MCP-002 | Validation Error | 400 |
| MCP-003 | Resource Not Found | 404 |
| MCP-004 | Invalid Request | 400 |
| MCP-005 | Unauthorized | 401 |
| MCP-006 | Rate Limited | 429 |

## Best Practices

1. Always use appropriate content types for responses
2. Include request IDs for error tracking
3. Use pagination for large data sets
4. Use specific error types for better error handling
5. Include detailed error messages and relevant details

## Testing

The response handling system includes comprehensive unit tests:
- `MCPResponseFormatter.test.ts`: Tests for response formatting
- `MCPErrorHandler.test.ts`: Tests for error handling

Run tests using:
```bash
npm test
```

## Adding New Error Types

To add a new error type:

1. Add the error code to `MCPErrorCode` enum in `mcp-types.ts`
2. Create a new error class in `domain/errors.ts`
3. Update the error handler to handle the new error type
4. Add corresponding tests