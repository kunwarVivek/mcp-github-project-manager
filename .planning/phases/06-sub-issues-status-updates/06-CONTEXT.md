# Phase 6: Sub-issues and Status Updates - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

MCP tools for managing GitHub sub-issue hierarchies and project status updates. Users can create, list, reorder, and remove sub-issues. Users can create and retrieve project status updates. This phase delivers 8 new MCP tools for these GitHub API features.

</domain>

<decisions>
## Implementation Decisions

### Hierarchy representation
- Sub-issues returned as flat list with `parentIssueId` reference (not nested tree)
- `list_sub_issues` returns immediate children only, not full tree
- Depth information included in response (`depth: 1`, `depth: 2`, etc.)
- Maximum depth: 3 levels (GitHub API limitation)
- Position/order field included for reprioritization

### Status update content
- Status update fields: `body` (required), `status` (optional enum), `startDate` (optional), `targetDate` (optional)
- Status enum values: match GitHub's project status update types (on_track, at_risk, off_track, complete)
- Body supports GitHub-flavored markdown
- Timestamps in ISO 8601 format

### Tool response structure
- Create/update operations return the created/updated object
- List operations return array with pagination support (`first`, `after` cursor pattern)
- Get operations return full object with all fields
- All responses include `id`, `url`, and relevant timestamps
- Issue references include `number`, `title`, and `state` (not full issue body)

### Edge case handling
- Circular reference prevention: API rejects if operation would create cycle
- Orphaned sub-issues: remain linked to original parent (GitHub manages this)
- Max depth violation: clear error message with current depth info
- Permission errors: standard MCP error codes with descriptive messages
- Not found errors: consistent 404-style error handling

### Claude's Discretion
- Exact field ordering in responses
- Helper method organization
- GraphQL query optimization
- Caching strategy for hierarchy data

</decisions>

<specifics>
## Specific Ideas

- Follow existing tool patterns from Phase 2 (annotations, output schemas, structured content)
- Use SubIssueService and ProjectStatusService extracted in Phase 1
- Match GitHub's GraphQL API structure for consistency
- Include `readOnlyHint: true` for list/get tools, appropriate hints for mutating tools

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-sub-issues-status-updates*
*Context gathered: 2026-01-31*
