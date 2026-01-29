# Research Summary: MCP GitHub Project Manager

**Research Date:** 2026-01-30

## Executive Summary

This project requires updates to both the MCP protocol implementation and GitHub API coverage. The current codebase is functional but behind on both fronts.

## Key Findings

### MCP Protocol

**SDK Version Gap:** 1.12.0 → 1.25.2 (13 minor versions behind)

**Missing Capabilities:**
| Feature | Added In | Impact |
|---------|----------|--------|
| Tasks Primitive | 1.23.0 | Async long-running operations |
| Tool Annotations | 1.23.0 | Behavior metadata (destructive/read-only) |
| Tool Output Schemas | 1.23.0 | Declared return types for context efficiency |
| Elicitation | 1.23.0 | Request user input during execution |
| Streamable HTTP | 1.10.0 | Modern transport (SSE deprecated) |

**Recommendation:** Upgrade to SDK 1.25.2, add tool annotations and output schemas to all 71 tools.

### GitHub Projects v2 API

**Current Coverage:** Good for core operations (projects, issues, PRs, sprints, fields, views)

**Missing Features:**
| Feature | API | Priority |
|---------|-----|----------|
| Sub-issues | REST API (Sept 2025) | High |
| Project Status Updates | GraphQL mutation | Medium |
| Project Templates | `markProjectV2AsTemplate`, `copyProjectV2` | Medium |
| Repo/Team Linking | `link/unlinkProjectV2To*` | Low |
| Close/Reopen Project | `closeProjectV2`, `reopenProjectV2` | Low |
| Convert Draft→Issue | `convertProjectV2DraftIssueItemToIssue` | Low |
| Item Reordering | `updateProjectV2ItemPosition` | Low |

**Recommendation:** Prioritize sub-issues (frequently requested), status updates (project visibility), and templates (reusability).

### Codebase Health

**Test Results:** 192 passing, 74 failing, 20 skipped

**Tech Debt:**
1. `ProjectManagementService` is 3,291 lines (god class)
2. 30+ `as any` type assertions
3. Test coverage gap (80 source files vs 29 test files)
4. In-memory cache only (no persistence)
5. No circuit breakers for AI services

## Stack Recommendations

**Upgrade:**
- `@modelcontextprotocol/sdk`: 1.12.0 → 1.25.2
- Consider: Adding REST API client for new GitHub endpoints

**Keep:**
- `@octokit/rest` 22.0.0 (current)
- `ai` (Vercel AI SDK) 4.3.16 (current)
- `zod` 3.25.32 (compatible with MCP SDK)
- `tsyringe` 4.10.0 (DI framework)

## Architecture Recommendations

1. **Extract services** from ProjectManagementService:
   - `SubIssueService`
   - `ProjectStatusService`
   - `ProjectTemplateService`
   - `SprintPlanningService`
   - `MilestoneService`

2. **Add resilience patterns:**
   - Circuit breakers for AI services
   - Health check endpoint
   - Request tracing

3. **Improve testability:**
   - Add integration tests for new GitHub features
   - Fix existing failing tests
   - Remove skipped tests or fix them

## Pitfalls to Avoid

1. **Fine-grained PAT limitation** — GitHub GraphQL API doesn't work with fine-grained PATs, must use classic PAT
2. **View mutation limitations** — `updateProjectV2View` may have incomplete support for all properties
3. **Insights API** — Charts appear UI-only, no GraphQL API available
4. **OAuth 2.1 for MCP** — Required for remote servers, but stdio transport (our primary) doesn't need it

## Phase Implications

| Phase Focus | Key Considerations |
|-------------|-------------------|
| MCP Upgrade | Test all 71 tools after SDK upgrade |
| GitHub API | Sub-issues first (highest value), then status updates |
| Tech Debt | Break up god class early (makes subsequent work easier) |
| AI Features | Fix existing tests before enhancing |
| Production | All tests green before npm publish |

---

*Research synthesized from:*
- `MCP-PROTOCOL.md` — MCP specification analysis
- `GITHUB-PROJECTS-API.md` — GitHub Projects v2 API analysis
- `.planning/codebase/` — Existing codebase mapping
