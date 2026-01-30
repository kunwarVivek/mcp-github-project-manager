---
phase: 02-mcp-protocol-compliance
plan: 03
subsystem: error-handling
tags: [mcp, json-rpc, error-codes, github-api, rate-limiting]

dependency_graph:
  requires: ["02-01"]
  provides: ["mcp-error-codes", "github-error-mapping", "protocol-version-handling"]
  affects: ["02-04", "02-05", "02-06"]

tech_stack:
  added: []
  patterns: ["json-rpc-2.0-errors", "error-data-enrichment", "rate-limit-extraction"]

key_files:
  created: []
  modified:
    - src/domain/mcp-types.ts
    - src/infrastructure/tools/ToolValidator.ts
    - src/index.ts

decisions:
  - id: numeric-error-codes
    decision: Use numeric codes following JSON-RPC 2.0 standard
    rationale: Standard compliance enables programmatic error handling
  - id: legacy-alias-pattern
    decision: Add legacy aliases (VALIDATION_ERROR, UNAUTHORIZED) to MCPErrorCode
    rationale: Backward compatibility with existing service code
  - id: error-data-structure
    decision: Define MCPErrorData interface with tool, github, rateLimit, validation, protocol fields
    rationale: Rich error context for debugging and client handling

metrics:
  duration: 9m 26s
  completed: 2026-01-30
---

# Phase 2 Plan 3: Error Handling Summary

JSON-RPC 2.0 compliant error codes with GitHub API error mapping and rate limit extraction

## What Was Done

### Task 1: Define Comprehensive MCP Error Codes

Enhanced `MCPErrorCode` enum in `src/domain/mcp-types.ts`:

**JSON-RPC 2.0 Standard Errors (-32700 to -32600):**
- `PARSE_ERROR = -32700` - Invalid JSON
- `INVALID_REQUEST = -32600` - Malformed JSON-RPC
- `METHOD_NOT_FOUND = -32601` - Unknown method/tool
- `INVALID_PARAMS = -32602` - Parameter validation failed
- `INTERNAL_ERROR = -32603` - Server-side error

**MCP-Specific Errors (-32000 to -32099):**
- `TOOL_EXECUTION_FAILED = -32000`
- `RESOURCE_NOT_FOUND = -32001`
- `PERMISSION_DENIED = -32002`

**GitHub API Errors (-31000 to -31999):**
- `GITHUB_RATE_LIMITED = -31001`
- `GITHUB_NOT_FOUND = -31002`
- `GITHUB_UNAUTHORIZED = -31003`
- `GITHUB_FORBIDDEN = -31004`
- `GITHUB_VALIDATION_ERROR = -31005`
- `GITHUB_SERVER_ERROR = -31006`

**Protocol Errors:**
- `PROTOCOL_VERSION_MISMATCH = -31100`

**Legacy Aliases (for backward compatibility):**
- `VALIDATION_ERROR = -32602` (alias for INVALID_PARAMS)
- `UNAUTHORIZED = -31003` (alias for GITHUB_UNAUTHORIZED)
- `RATE_LIMITED = -31001` (alias for GITHUB_RATE_LIMITED)

Added `MCPErrorData` interface for rich error context:
```typescript
interface MCPErrorData {
  tool?: string;
  resource?: { type: string; id?: string };
  github?: { status?: number; message?: string; documentation_url?: string };
  rateLimit?: { limit: number; remaining: number; reset: number; retryAfter?: number };
  validation?: Array<{ path: string; message: string; code: string }>;
  protocol?: { requested: string; supported: string[] };
  stack?: string;
}
```

### Task 2: Implement GitHub Error Mapping

Added `mapGitHubError` method to `ToolValidator`:

- Handles Octokit RequestError with status extraction
- Extracts rate limit headers (`x-ratelimit-*`, `retry-after`)
- Handles secondary rate limiting (abuse detection)
- Extracts validation errors from 422 responses
- Maps HTTP status codes to appropriate MCPErrorCode
- Includes GitHub documentation URLs in error data
- Updated `handleToolError` to detect and route GitHub errors

### Task 3: Handle Protocol Version Mismatches

Added protocol version handling to `src/index.ts`:

- Defined `SUPPORTED_PROTOCOL_VERSIONS = ["2024-11-05"]`
- Defined `PREFERRED_PROTOCOL_VERSION = "2024-11-05"`
- Added version mismatch error handling in `run()` method
- Logs protocol version on successful connection
- Includes protocol info in verbose mode output

## Commits

| Hash | Message |
|------|---------|
| 0775048 | feat(02-03): define comprehensive MCP error codes |
| c3cc0ff | feat(02-03): implement GitHub error mapping with rich context |
| 03f735c | feat(02-03): handle protocol version mismatches |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. MCPErrorCode enum includes JSON-RPC 2.0 standard codes and GitHub-specific codes - VERIFIED
2. GitHub API errors produce McpError with code, message, and structured data - VERIFIED
3. Rate limit errors include retryAfter information - VERIFIED
4. Protocol version handling provides clear error message - VERIFIED
5. All unit tests pass (166/166) - VERIFIED

## Next Phase Readiness

Ready for 02-04 (Output Schemas). This plan provides:
- Error codes for output schema validation failures
- GitHub error mapping for schema-related API errors
- Protocol version context for client compatibility
