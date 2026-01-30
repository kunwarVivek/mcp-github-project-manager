# Phase 2: MCP Protocol Compliance - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade MCP SDK from 1.12.0 to 1.25.2 and ensure all 71 tools have proper annotations and output schemas. Protocol compliance enables better client integration and tool discoverability.

</domain>

<decisions>
## Implementation Decisions

### Migration Approach
- All-at-once upgrade — SDK version bump in single commit, then fix breaking changes
- Create compatibility layer only if breaking changes affect public API
- Run full test suite after each major fix to catch regressions early
- Document any import path changes in commit messages

### Annotation Strategy
- **Destructive tools:** Any tool that creates, updates, or deletes data (mutations)
- **Read-only tools:** Any tool that only fetches data (queries)
- **Idempotent tools:** Update operations that produce same result when called multiple times (e.g., setFieldValue)
- When in doubt, mark as destructive (safer for clients to know)
- Add behavior annotation as structured metadata, not just comments

### Output Schema Depth
- **Detailed schemas** — Full type definitions for all response fields
- Match actual TypeScript return types exactly
- Include optional fields explicitly marked as optional
- Nested objects get their own type definitions
- Use JSON Schema format as MCP spec requires

### Error Handling Design
- **Taxonomy:** Use standard MCP error codes (InvalidParams, MethodNotFound, InternalError, etc.)
- **Custom codes:** Define domain-specific codes for GitHub API errors (RateLimited, NotFound, Unauthorized)
- **Error payloads include:**
  - `code`: Standard or custom error code
  - `message`: Human-readable description
  - `data`: Structured details (affected resource, retry-after for rate limits, etc.)
- Wrap GitHub API errors with context (which tool, what operation failed)

### Claude's Discretion
- Exact grouping of tools into categories for annotation batching
- Order of tool updates (by category or alphabetically)
- Whether to add JSDoc comments alongside annotations

</decisions>

<specifics>
## Specific Ideas

- Target world-class product quality — no shortcuts on schema completeness
- Schemas should be good enough for clients to generate type-safe bindings
- Error messages should help developers debug without guessing

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-mcp-protocol-compliance*
*Context gathered: 2026-01-30*
