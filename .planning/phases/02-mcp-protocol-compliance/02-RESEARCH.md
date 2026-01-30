# Phase 2: MCP Protocol Compliance - Research

**Researched:** 2026-01-30
**Domain:** MCP SDK upgrade, tool annotations, output schemas, error handling
**Confidence:** HIGH

## Summary

This research covers upgrading the MCP SDK from 1.12.0 to 1.25.2 and implementing full protocol compliance including tool annotations, output schemas, and standardized error handling. The codebase currently has 71+ tools defined in `ToolSchemas.ts` with a custom `ToolDefinition<T>` interface that lacks annotation and output schema support.

Key findings:
- The SDK upgrade requires import path updates and Zod v4 compatibility handling
- Tool annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint) are hints for client UX, not security guarantees
- Output schemas must use JSON Schema 2020-12 format with structuredContent in responses
- Error handling uses JSON-RPC 2.0 standard codes plus MCP-specific codes in -32000 to -32099 range

**Primary recommendation:** Upgrade SDK in a single commit, then systematically add annotations and output schemas by tool category, using the new `registerTool` API pattern.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | 1.25.2+ | MCP protocol implementation | Official TypeScript SDK, spec 2025-11-25 compliant |
| zod | ^3.25.32 (current) or v4 | Schema validation | Required peer dependency for SDK, used for inputSchema/outputSchema |
| zod-to-json-schema | ^3.23.0 | Schema conversion | Converts Zod schemas to JSON Schema for MCP output schemas |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @modelcontextprotocol/sdk/types.js | N/A | Type definitions | Import ErrorCode, McpError, CallToolRequestSchema |
| @modelcontextprotocol/sdk/server/index.js | N/A | Server class | Import Server for MCP server creation |
| @modelcontextprotocol/sdk/server/stdio.js | N/A | Transport | Import StdioServerTransport for stdio communication |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| zod-to-json-schema | Manual conversion | Current codebase has manual conversion in ToolRegistry; library is more complete |
| Custom ToolDefinition | SDK's registerTool | SDK pattern is newer, provides better type safety |

**Installation:**
```bash
npm install @modelcontextprotocol/sdk@^1.25.2 zod-to-json-schema@^3.23.0
```

## Architecture Patterns

### Current Tool Definition Structure

The codebase uses a custom `ToolDefinition<T>` interface:

```typescript
// Source: src/infrastructure/tools/ToolValidator.ts
export interface ToolDefinition<T> {
  name: string;
  description: string;
  schema: ToolSchema<T>;
  examples?: Array<{
    name: string;
    description: string;
    args: T;
  }>;
}
```

### Target Tool Definition Structure

MCP SDK 1.25.2 expects tools with annotations and outputSchema:

```typescript
// Source: MCP Specification 2025-11-25
{
  name: string;           // Unique identifier
  title?: string;         // Human-readable display name
  description?: string;   // Human-readable description
  inputSchema: {          // JSON Schema for parameters
    type: "object",
    properties: { ... }
  },
  outputSchema?: {        // JSON Schema for output (NEW)
    type: "object",
    properties: { ... }
  },
  annotations?: {         // Behavior hints (NEW)
    title?: string;
    readOnlyHint?: boolean;     // Default: false
    destructiveHint?: boolean;  // Default: true (when readOnlyHint=false)
    idempotentHint?: boolean;   // Default: false
    openWorldHint?: boolean;    // Default: true
  }
}
```

### Recommended Project Structure

```
src/infrastructure/tools/
├── ToolValidator.ts       # Extended with annotation support
├── ToolRegistry.ts        # Updated getToolsForMCP() method
├── ToolSchemas.ts         # Tool definitions with annotations + outputSchemas
├── ToolResultFormatter.ts # Extended for structuredContent
├── schemas/               # NEW: Output schema definitions
│   ├── project-schemas.ts
│   ├── issue-schemas.ts
│   ├── pr-schemas.ts
│   ├── ai-tool-schemas.ts
│   └── automation-schemas.ts
└── annotations/           # NEW: Annotation constants by category
    └── tool-annotations.ts
```

### Pattern 1: Extended ToolDefinition Interface

**What:** Extend existing ToolDefinition to include annotations and outputSchema
**When to use:** Migration path from current structure

```typescript
// Source: Proposed extension
export interface ToolDefinition<TInput, TOutput = unknown> {
  name: string;
  title?: string;
  description: string;
  schema: ToolSchema<TInput>;
  outputSchema?: z.ZodType<TOutput>;
  annotations?: ToolAnnotations;
  examples?: Array<{
    name: string;
    description: string;
    args: TInput;
  }>;
}

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}
```

### Pattern 2: Tool with Output Schema and structuredContent

**What:** Return both text content and structuredContent for backwards compatibility
**When to use:** All tools with output schemas

```typescript
// Source: MCP TypeScript SDK docs
server.registerTool(
  'get_project',
  {
    title: 'Get Project',
    description: 'Get details of a specific GitHub project',
    inputSchema: { projectId: z.string() },
    outputSchema: {
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      status: z.enum(['active', 'closed']),
      createdAt: z.string(),
      updatedAt: z.string()
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true  // Interacts with GitHub API
    }
  },
  async ({ projectId }) => {
    const project = await service.getProject(projectId);
    return {
      content: [{ type: 'text', text: JSON.stringify(project) }],
      structuredContent: project
    };
  }
);
```

### Pattern 3: Annotation Classification

**What:** Categorize tools by behavior
**When to use:** Systematic annotation assignment

```typescript
// Source: Derived from MCP specification
const ANNOTATION_PATTERNS = {
  // Read-only tools (queries)
  readOnly: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,  // Safe to retry
    openWorldHint: true    // GitHub API is external
  },

  // Create operations
  create: {
    readOnlyHint: false,
    destructiveHint: false,  // Creates, doesn't destroy
    idempotentHint: false,   // Multiple calls create multiple resources
    openWorldHint: true
  },

  // Update operations (idempotent)
  updateIdempotent: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,    // Same args = same result
    openWorldHint: true
  },

  // Update operations (non-idempotent)
  updateNonIdempotent: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true
  },

  // Delete operations
  delete: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,    // Deleting twice = same as once
    openWorldHint: true
  }
};
```

### Anti-Patterns to Avoid

- **Relying on annotations for security:** Annotations are untrusted hints. Never use them for access control.
- **Missing backwards compatibility:** When returning structuredContent, always also include serialized JSON in text content.
- **Incorrect idempotency marking:** Only mark as idempotent if repeated calls truly have no additional effect.
- **Using custom error codes without documentation:** Custom error codes must be documented for client developers.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zod to JSON Schema | Custom converter in ToolRegistry | zod-to-json-schema library | Handles edge cases (unions, optionals, defaults) |
| Error code mapping | Custom enum mapping | Standard JSON-RPC 2.0 codes | Interoperability with MCP clients |
| Schema validation | Manual type checking | Zod schema validation | Type safety and clear error messages |
| Tool registration | Custom registry pattern | SDK's registerTool API | Better type inference, built-in validation |

**Key insight:** The current ToolRegistry.convertZodToJsonSchema() is a simplified implementation that misses edge cases. Using zod-to-json-schema provides complete JSON Schema 2020-12 compliance.

## Common Pitfalls

### Pitfall 1: Import Path Changes After Upgrade

**What goes wrong:** SDK 1.25.x moved Express to separate module, changed some type exports
**Why it happens:** Framework-agnostic refactoring in v1.24.2
**How to avoid:** Review all import statements after upgrade:
```typescript
// Old (may break)
import { Server } from "@modelcontextprotocol/sdk/server";

// Current (verified working in codebase)
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
```
**Warning signs:** Build errors mentioning "Cannot find module"

### Pitfall 2: Zod Version Compatibility

**What goes wrong:** SDK 1.23+ requires Zod 3.25+ or v4 for schema transformation support
**Why it happens:** SDK uses zod/v4 imports internally
**How to avoid:** Current codebase has zod ^3.25.32 which is compatible. Verify after upgrade:
```bash
npm ls zod
```
**Warning signs:** Runtime errors about schema transformations

### Pitfall 3: structuredContent Without Text Fallback

**What goes wrong:** Older clients that don't support structuredContent get empty responses
**Why it happens:** Assuming all clients support structured output
**How to avoid:** Always include both:
```typescript
return {
  content: [{ type: 'text', text: JSON.stringify(output) }],
  structuredContent: output
};
```
**Warning signs:** Clients receiving empty tool results

### Pitfall 4: Marking Non-Idempotent Operations as Idempotent

**What goes wrong:** Clients retry operations thinking they're safe, causing duplicates
**Why it happens:** Misunderstanding idempotency definition
**How to avoid:**
- `create_issue` is NOT idempotent (creates new issue each call)
- `update_issue` with explicit state IS idempotent (same args = same result)
- `add_issue_comment` is NOT idempotent (adds new comment each call)
- `set_field_value` IS idempotent (sets to same value)
**Warning signs:** Duplicate resources after retries

### Pitfall 5: Protocol Version Mismatch Handling

**What goes wrong:** Connection fails silently or with unclear error
**Why it happens:** Client and server disagree on protocol version
**How to avoid:** Handle version negotiation in initialize:
```typescript
// Server should check protocolVersion and respond with compatible version
// If no compatible version, return error during initialization
```
**Warning signs:** "Protocol version mismatch" errors, connection drops

## Code Examples

### Example 1: Tool with Full Annotations and Output Schema

```typescript
// Source: MCP Specification + SDK docs
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

// Define output schema with Zod
const ProjectOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  shortDescription: z.string().optional(),
  visibility: z.enum(['private', 'public']),
  status: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// Tool definition with annotations
export const getProjectTool: ToolDefinition<GetProjectArgs, z.infer<typeof ProjectOutputSchema>> = {
  name: "get_project",
  title: "Get Project Details",
  description: "Get details of a specific GitHub project by ID",
  schema: getProjectSchema,
  outputSchema: ProjectOutputSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

// Convert to MCP format
function toMCPTool(tool: ToolDefinition<any, any>) {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.schema),
    outputSchema: tool.outputSchema ? zodToJsonSchema(tool.outputSchema) : undefined,
    annotations: tool.annotations
  };
}
```

### Example 2: Error Handling with MCP Error Codes

```typescript
// Source: MCP Specification + JSON-RPC 2.0
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

// Standard JSON-RPC 2.0 error codes
const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,      // Invalid JSON
  INVALID_REQUEST: -32600,  // Malformed JSON-RPC
  METHOD_NOT_FOUND: -32601, // Unknown method
  INVALID_PARAMS: -32602,   // Parameter validation failed
  INTERNAL_ERROR: -32603    // Server-side error
};

// MCP-specific error codes (-32000 to -32099)
const MCP_ERRORS = {
  TOOL_EXECUTION_FAILED: -32000,
  RESOURCE_NOT_FOUND: -32001,
  PERMISSION_DENIED: -32002,
  RATE_LIMIT_EXCEEDED: -32003
};

// Custom application codes (outside reserved range)
const GITHUB_ERRORS = {
  RATE_LIMITED: -31001,
  NOT_FOUND: -31002,
  UNAUTHORIZED: -31003,
  FORBIDDEN: -31004
};

// Error handling in tool execution
async function executeToolWithErrorHandling(toolName: string, args: any) {
  try {
    return await executeTool(toolName, args);
  } catch (error) {
    // Tool execution errors return success with isError: true
    if (isToolExecutionError(error)) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true
      };
    }

    // Protocol errors throw McpError
    if (error instanceof McpError) {
      throw error;
    }

    // Map GitHub API errors
    if (isGitHubRateLimitError(error)) {
      throw new McpError(
        GITHUB_ERRORS.RATE_LIMITED,
        'GitHub API rate limit exceeded',
        { retryAfter: error.retryAfter }
      );
    }

    // Default to internal error
    throw new McpError(
      ErrorCode.InternalError,
      `Tool ${toolName} failed: ${error.message}`
    );
  }
}
```

### Example 3: Tool Result with structuredContent

```typescript
// Source: MCP TypeScript SDK docs
interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'audio' | 'resource' | 'resource_link';
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
    resource?: object;
  }>;
  structuredContent?: object;  // Must match outputSchema if defined
  isError?: boolean;
}

// Formatter that produces MCP-compliant results
function formatToolResult<T>(data: T, options?: { isError?: boolean }): ToolResult {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2)
    }],
    structuredContent: data,
    isError: options?.isError
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No tool annotations | Behavior annotations (readOnlyHint, etc.) | MCP spec 2025-06-18 | Clients can display appropriate UI/confirmations |
| Text-only tool results | structuredContent + text fallback | MCP spec 2025-06-18 | Type-safe tool outputs, better LLM parsing |
| Custom error handling | JSON-RPC 2.0 + MCP error codes | MCP spec 2025-06-18 | Standardized error handling across clients |
| JSON Schema draft-07 | JSON Schema 2020-12 | MCP spec 2025-11-25 | Better schema features, SDK compliance |
| SDK 1.12.0 | SDK 1.25.2+ | Various | Spec 2025-11-25 compliance, Tasks support |

**Deprecated/outdated:**
- **Loose/passthrough types:** Removed in SDK 1.25.0 for spec compliance
- **JSON-RPC batching:** Removed in MCP spec 2025-06-18
- **Express integration in core:** Moved to @modelcontextprotocol/express in SDK 1.24.2

## Open Questions

1. **SDK registerTool vs custom ToolDefinition**
   - What we know: SDK provides `server.registerTool()` with better type inference
   - What's unclear: Migration effort from current ToolRegistry pattern
   - Recommendation: Keep ToolRegistry but update `getToolsForMCP()` to emit annotations/outputSchema

2. **Tasks primitive support**
   - What we know: SDK 1.25.x adds experimental Tasks for long-running operations
   - What's unclear: Whether AI tools (generate_prd, etc.) should use Tasks
   - Recommendation: Defer to Phase 2 v2 requirements (V2-06)

3. **Output schema granularity**
   - What we know: Schemas should match TypeScript return types exactly
   - What's unclear: How detailed nested objects should be (e.g., full Issue vs summary)
   - Recommendation: Start with top-level fields, add nesting as needed

## Sources

### Primary (HIGH confidence)
- [MCP Specification 2025-11-25 - Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) - Tool definitions, annotations, output schemas
- [MCP Specification 2025-11-25 - Changelog](https://modelcontextprotocol.io/specification/2025-11-25/changelog) - Breaking changes, new features
- [MCP TypeScript SDK Releases](https://github.com/modelcontextprotocol/typescript-sdk/releases) - Version-specific changes
- [MCP Architecture Overview](https://modelcontextprotocol.io/docs/learn/architecture) - Protocol initialization, version negotiation
- [MCP Legacy Tools Concepts](https://modelcontextprotocol.io/legacy/concepts/tools) - Annotation details, best practices

### Secondary (MEDIUM confidence)
- [MCP Error Codes](https://www.mcpevals.io/blog/mcp-error-codes) - JSON-RPC and MCP error code reference
- [TypeScript SDK Server Docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) - registerTool patterns

### Tertiary (LOW confidence)
- Various Medium articles on MCP implementation - General patterns, cross-verified with official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified against official SDK and npm
- Architecture: HIGH - Based on MCP specification and current codebase analysis
- Pitfalls: HIGH - Derived from official docs and SDK release notes

**Research date:** 2026-01-30
**Valid until:** 2026-02-28 (SDK may have minor updates; spec 2025-11-25 is current)
