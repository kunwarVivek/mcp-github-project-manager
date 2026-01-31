# Phase 8: Project Lifecycle and Advanced Operations - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

6 MCP tools for project lifecycle control and advanced item operations:
- Close/reopen projects (GHAPI-19, GHAPI-20)
- Convert draft issues to real issues (GHAPI-21)
- Reorder items within projects (GHAPI-22)
- Search and filter project items (GHAPI-23, GHAPI-24)

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
User opted to skip detailed discussion. Claude has flexibility on:
- Project close/reopen: Follow GitHub's standard behavior (closed projects are hidden from default views but retain all data)
- Draft conversion: Require target repository parameter; preserve title and body from draft
- Item ordering: Follow GitHub's ProjectV2ItemPosition mutation for reordering within views
- Search/filter: Use GitHub's existing query syntax (field:value, AND/OR operators) where supported

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following GitHub API patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-project-lifecycle-advanced*
*Context gathered: 2026-01-31*
