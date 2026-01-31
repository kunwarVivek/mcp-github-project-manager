# Phase 7: Project Templates and Linking - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable users to create reusable project templates and link projects to repositories and teams via MCP tools. This phase covers 10 requirements (GHAPI-09 to GHAPI-18):

**Template operations:**
- Mark/unmark project as template
- Copy project from template
- List organization templates

**Linking operations:**
- Link/unlink project to repository
- Link/unlink project to team
- List linked repos/teams

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

User deferred all implementation decisions to Claude. Follow Phase 6 patterns:

**Tool design:**
- Follow Phase 6 tool patterns (sub-issue and status update tools)
- Use existing annotation patterns (ANNOTATION_PATTERNS.create, readOnly, delete)
- Input schemas with owner/repo/projectId as needed
- Output schemas matching GraphQL response structure

**Template copying:**
- Copy what GitHub's API copies (fields, views, workflows)
- Let user specify new project title in input
- Return the created project details

**Linking behavior:**
- Use GitHub's native validation (API will reject invalid repos/teams)
- Return structured success/error responses
- Support multiple links (GitHub's natural behavior)

**Error handling:**
- Follow Phase 6 error patterns (MCPError with appropriate codes)
- Let GitHub API errors surface naturally
- Add helpful error messages where GitHub's are unclear

**Repository structure:**
- Evaluate whether new repositories needed or can extend existing
- May be able to extend GitHubProjectRepository or use factory.graphql() directly

</decisions>

<specifics>
## Specific Ideas

No specific requirements — follow established patterns from Phase 6.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-project-templates-linking*
*Context gathered: 2026-01-31*
