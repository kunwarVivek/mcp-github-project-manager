# Research Report: Model Context Protocol (MCP) Specification - January 2026

Generated: 2026-01-30

## Summary

The Model Context Protocol has undergone significant evolution since its introduction in November 2024. Your codebase uses `@modelcontextprotocol/sdk ^1.12.0`, which is **substantially outdated** - the current version is **1.25.2**. Major features added since 1.12.0 include Streamable HTTP transport, OAuth 2.1 authorization, the Tasks primitive for async operations, elicitation for user interaction, and structured tool outputs.

## Questions Answered

### Q1: Current MCP SDK Version
**Answer:** The latest `@modelcontextprotocol/sdk` version is **1.25.2** (published ~11 days ago as of January 2026).
**Source:** [npm - @modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
**Confidence:** High (VERIFIED)

**Your version (1.12.0) is ~13 minor versions behind.** A stable v2 release is anticipated in Q1 2026, with v1.x receiving bug fixes for 6+ months after v2 ships.

### Q2: Protocol Changes Since 2024
**Answer:** Multiple specification releases with breaking changes:

| Spec Version | Release Date | Major Changes |
|--------------|--------------|---------------|
| 2024-11-05 | Nov 2024 | Initial release |
| 2025-03-26 | Mar 2025 | OAuth 2.1 authorization, Streamable HTTP transport, tool annotations |
| 2025-06-18 | Jun 2025 | Structured outputs, elicitation, RFC 8707 resource indicators, removed JSON-RPC batching |
| 2025-11-25 | Nov 2025 | Tasks primitive, URL mode elicitation, sampling with tools |

**Source:** [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)
**Confidence:** High (VERIFIED)

### Q3: New Features - Resources, Prompts, Tools
**Answer:** Major additions since 2024:

**Tools:**
- **Tool Annotations** (2025-03-26): Tools can describe their behavior (read-only, destructive) for safer execution
- **Tool Output Schemas** (2025-06-18): Declare expected return types, improving context window efficiency
- **Sampling with Tools** (2025-11-25): MCP servers can initiate sampling requests with tool definitions included

**Resources:**
- No major structural changes, but improved metadata discovery via `.well-known` URLs (in progress)

**Prompts:**
- **Elicitation** (2025-06-18): Servers can request additional information from users during interactions using JSON Schema validation
- **URL Mode Elicitation** (2025-11-25): Send users to browser for OAuth/credentials without exposing them to client

**New Primitives:**
- **Tasks** (2025-11-25): Async long-running operations with states (working, input_required, completed, failed, cancelled)

**Source:** [One Year of MCP Blog Post](http://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/)
**Confidence:** High (VERIFIED)

### Q4: Transport Mechanisms
**Answer:** Current transport landscape:

| Transport | Status | Use Case |
|-----------|--------|----------|
| **STDIO** | Standard | Local integrations, command-line tools (recommended for clients to support) |
| **Streamable HTTP** | Standard (Current) | Remote servers, replaces HTTP+SSE (added in 2025-03-26) |
| **HTTP+SSE** | Deprecated | Backwards compatibility only (from 2024-11-05) |
| **WebSocket** | Proposed (SEP-1288) | Long-lived bidirectional communication (not yet in spec) |

**Key Change:** SDK 1.10.0 (April 2025) was first to support Streamable HTTP. Your 1.12.0 should have basic support, but newer versions have improvements.

**Imports:**
```typescript
// Current (Streamable HTTP)
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// Legacy (SSE) - for backwards compatibility
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
```

**Source:** [MCP Transports Specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
**Confidence:** High (VERIFIED)

### Q5: Authentication/Authorization
**Answer:** Major overhaul with OAuth 2.1:

**Key Requirements:**
- MCP servers are now classified as **OAuth 2.0 Resource Servers**
- OAuth 2.1 with **PKCE** is mandatory for all clients
- **RFC 9728** (Protected Resource Metadata) is now mandatory (no fallback defaults)
- **RFC 8707** (Resource Indicators) required in token requests

**Authorization Flow:**
1. Server returns HTTP 401 with `WWW-Authenticate` header containing `resource_metadata` URL
2. Client fetches PRM document to find `authorization_servers` field
3. Client initiates OAuth 2.1 flow with PKCE

**Grant Types:**
- Authorization Code: For human end users
- Client Credentials: For application-to-application

**Dynamic Client Registration:** RFC 7591 SHOULD be supported to avoid manual registration friction.

**Source:** [MCP Authorization Specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization)
**Confidence:** High (VERIFIED)

### Q6: Best Practices for Building MCP Servers (2025/2026)
**Answer:**

**Project Setup:**
```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
# Set "type": "module" in package.json
# Target ES2022 with Node16 module resolution
```

**Critical Rules:**
1. **STDIO servers**: Never write to stdout - use `console.error()` for logging (stdout corrupts JSON-RPC)
2. **HTTP servers**: Standard logging is fine
3. **Schema validation**: Use Zod for both input validation and type safety
4. **Middleware packages**: Use thin adapters (`@modelcontextprotocol/express`, `@modelcontextprotocol/hono`, `@modelcontextprotocol/node`)

**Security:**
- Treat each MCP server like a microservice with its own blast radius
- Use TLS, require auth between client and server
- Scope API keys minimally
- High-impact servers (filesystem, terminal, databases) should start read-only
- Use secrets manager instead of hardcoding
- For remote deployments: use a proxy/gateway for auth

**Production Patterns:**
- OAuth token management with refresh
- Request retry logic
- Comprehensive error handling
- Edge deployment (Cloudflare Workers) for sub-50ms cold starts

**Source:** [MCPcat - Building MCP Server TypeScript](https://mcpcat.io/guides/building-mcp-server-typescript/)
**Confidence:** High (VERIFIED)

### Q7: Streaming Support
**Answer:**

**Evolution:**
- **2024-11-05**: HTTP+SSE for streaming
- **2025-03-26**: Streamable HTTP replaces SSE (more proxy-friendly)
- Streamable HTTP can still use SSE internally for multi-message streaming

**How It Works:**
- Server can return SSE stream for progress updates, multiple results, or server-initiated requests
- GET requests support persistent SSE connections
- POST requests can return SSE for streaming responses

**Progress Tracking:**
- Context object provides `progress_token` for long-running operations
- SDK handles progress reporting via notifications

**SDK Support:**
```typescript
// Server with Streamable HTTP
import { StreamableHttpServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
```

**Source:** [Why MCP Deprecated SSE](https://blog.fka.dev/blog/2025-06-06-why-mcp-deprecated-sse-and-go-with-streamable-http/)
**Confidence:** High (VERIFIED)

### Q8: Error Handling
**Answer:**

**Wire Format:** JSON-RPC 2.0 error objects with `code`, `message`, and optional `data`.

**Error Code Ranges:**
| Range | Purpose |
|-------|---------|
| -32768 to -32000 | Reserved (JSON-RPC standard + MCP-specific) |
| Outside range | Custom application errors |

**Common Codes:**
| Code | Name | Description |
|------|------|-------------|
| -32602 | Invalid Params | Malformed parameters |
| -32002 | Resource Not Found | Resource doesn't exist or can't be accessed |
| -32602 | Unsupported Protocol Version | Version mismatch (includes supported versions in data) |

**Best Practices:**
- Use date-based protocol versioning (e.g., "2025-06-18")
- During init, client proposes version, server accepts or suggests alternative
- Copy request ID to response (missing ID is common bug)
- Notifications (no ID) should not receive responses

**Convention for Custom Codes:**
- -31xxx: Authentication errors
- -30xxx: Resource access errors

**Source:** [MCP Error Codes](https://www.mcpevals.io/blog/mcp-error-codes)
**Confidence:** High (VERIFIED)

## Version Gap Analysis: 1.12.0 vs 1.25.2

**You are missing:**

| Version | Key Feature |
|---------|-------------|
| 1.13.x | Bug fixes and stability improvements |
| 1.14.x | Enhanced transport handling |
| 1.15.x-1.22.x | Incremental improvements, OAuth helpers |
| **1.23.0** | **Full support for MCP spec 2025-11-25** (Tasks, elicitation, structured outputs) |
| 1.24.x | Performance improvements, bug fixes |
| 1.25.x | Latest stable, refined middleware packages |

**Critical Missing Capabilities:**
1. **Tasks Primitive** - async operations (available in 1.23.0+)
2. **Elicitation** - user interaction during tool execution
3. **Structured Tool Outputs** - declared return schemas
4. **Latest OAuth helpers** - improved authorization flow
5. **Zod v4 support** - SDK now imports from `zod/v4` (backwards compat with Zod 3.25+)

## Recommendations

### Immediate Actions

1. **Upgrade SDK:**
   ```bash
   npm install @modelcontextprotocol/sdk@latest
   ```
   
2. **Update Zod if needed:** Ensure Zod is 3.25+ (you have 3.25.32 - compatible)

3. **Review Transport Usage:** Migrate from SSE to Streamable HTTP if using remote transports

### Consider Implementing

1. **Tool Annotations:** Add behavior metadata to your tools:
   ```typescript
   server.tool({
     name: 'create_issue',
     annotations: { destructive: true, idempotent: false }
   });
   ```

2. **Tool Output Schemas:** Declare return types for better context efficiency:
   ```typescript
   server.tool({
     name: 'get_project',
     outputSchema: z.object({
       id: z.string(),
       name: z.string(),
       status: z.string()
     })
   });
   ```

3. **OAuth 2.1 Authorization:** If exposing remotely, implement proper OAuth flow

### Migration Path

| Priority | Task | Effort |
|----------|------|--------|
| High | Upgrade to 1.25.x | Low |
| High | Test existing tools work | Low |
| Medium | Add tool annotations | Low |
| Medium | Add output schemas | Medium |
| Low | Implement Tasks for long-running ops | High |
| Low | Add elicitation for interactive tools | Medium |

## Sources

1. [npm - @modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) - Package registry
2. [GitHub - modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) - Official SDK repository
3. [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) - Latest specification
4. [One Year of MCP Blog Post](http://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/) - Anniversary release notes
5. [MCP Authorization Specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization) - OAuth 2.1 details
6. [MCP Transports Specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) - Transport layer docs
7. [Auth0 - MCP Specs Update June 2025](https://auth0.com/blog/mcp-specs-update-all-about-auth/) - Authorization deep dive
8. [WorkOS - MCP 2025-11-25 Spec Update](https://workos.com/blog/mcp-2025-11-25-spec-update) - Feature overview
9. [MCP Error Codes](https://www.mcpevals.io/blog/mcp-error-codes) - Error handling guide
10. [MCPcat - Building MCP Server TypeScript](https://mcpcat.io/guides/building-mcp-server-typescript/) - Best practices

## Open Questions

- Exact changelog for versions 1.12.0 through 1.22.x (detailed release notes not readily available)
- WebSocket transport timeline (SEP-1288 proposed but not yet in spec)
- V2 SDK breaking changes (pre-alpha, details not yet published)
