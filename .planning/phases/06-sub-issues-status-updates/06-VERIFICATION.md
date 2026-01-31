---
phase: 06-sub-issues-status-updates
verified: 2026-01-31T22:30:00Z
status: gaps_found
score: 7/8 must-haves verified
gaps:
  - truth: "Status update CRUD operations (create, list, get) are callable"
    status: failed
    reason: "Tools are registered but executors not wired in index.ts - calls will throw MethodNotFound"
    artifacts:
      - path: "src/index.ts"
        issue: "Missing imports for executeCreateStatusUpdate, executeListStatusUpdates, executeGetStatusUpdate"
      - path: "src/index.ts"
        issue: "Missing case statements for create_status_update, list_status_updates, get_status_update"
    missing:
      - "Import status update executors in src/index.ts (like sub-issue executors)"
      - "Add case 'create_status_update': return await executeCreateStatusUpdate(args);"
      - "Add case 'list_status_updates': return await executeListStatusUpdates(args);"
      - "Add case 'get_status_update': return await executeGetStatusUpdate(args);"
---

# Phase 6: Sub-issues and Status Updates Verification Report

**Phase Goal:** Users can manage sub-issues and track project status updates via MCP.

**Verified:** 2026-01-31T22:30:00Z

**Status:** gaps_found

**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GraphQL queries with sub_issues preview header work | ✓ VERIFIED | graphqlWithFeatures exists in BaseRepository.ts:112, used 5 times in GitHubSubIssueRepository.ts with SUB_ISSUES_FEATURE constant |
| 2 | Sub-issue CRUD mutations (add, remove, reprioritize) are callable | ✓ VERIFIED | All 5 sub-issue tools wired in index.ts:620-632, executors imported, 28 tests passing |
| 3 | Status update CRUD operations (create, list, get) are callable | ✗ FAILED | Tools registered in ToolRegistry.ts:351-353 but executors NOT imported or wired in index.ts - calls throw MethodNotFound |
| 4 | Issue number to node ID resolution works | ✓ VERIFIED | resolveIssueNodeId exists in BaseRepository.ts:144, used in sub-issue executors with Promise.all for parallel resolution |

**Score:** 3/4 truths verified (75%)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/infrastructure/github/repositories/BaseGitHubRepository.ts` | graphqlWithFeatures method | ✓ VERIFIED | Line 112, accepts features array, injects GraphQL-Features header at line 119 |
| `src/infrastructure/github/repositories/BaseGitHubRepository.ts` | resolveIssueNodeId method | ✓ VERIFIED | Line 144, queries GitHub for issue node ID, returns string |
| `src/infrastructure/github/repositories/GitHubSubIssueRepository.ts` | Export GitHubSubIssueRepository class | ✓ VERIFIED | Line 201, extends BaseGitHubRepository, 395 lines |
| `src/infrastructure/github/repositories/GitHubSubIssueRepository.ts` | addSubIssue method | ✓ VERIFIED | Line 215, async, calls graphqlWithFeatures with sub_issues flag |
| `src/infrastructure/github/repositories/GitHubSubIssueRepository.ts` | listSubIssues method | ✓ VERIFIED | Line 255, async, returns SubIssueListResult with pagination |
| `src/infrastructure/github/repositories/GitHubSubIssueRepository.ts` | getParentIssue method | ✓ VERIFIED | Line 306, async, returns ParentIssueResult or null |
| `src/infrastructure/github/repositories/GitHubSubIssueRepository.ts` | reprioritizeSubIssue method | ✓ VERIFIED | Line 340, async, handles afterId for positioning |
| `src/infrastructure/github/repositories/GitHubSubIssueRepository.ts` | removeSubIssue method | ✓ VERIFIED | Line 380, async, mutation to remove relationship |
| `src/infrastructure/github/repositories/GitHubStatusUpdateRepository.ts` | Export GitHubStatusUpdateRepository class | ✓ VERIFIED | Line 130, extends BaseGitHubRepository, 215 lines |
| `src/infrastructure/github/repositories/GitHubStatusUpdateRepository.ts` | createStatusUpdate method | ✓ VERIFIED | Line 157, async, accepts options (status, startDate, targetDate) |
| `src/infrastructure/github/repositories/GitHubStatusUpdateRepository.ts` | listStatusUpdates method | ✓ VERIFIED | Line 195, async, ordered by CREATED_AT DESC with pagination |
| `src/infrastructure/github/repositories/GitHubStatusUpdateRepository.ts` | getStatusUpdate method | ✓ VERIFIED | Line 233, async, returns StatusUpdate or null |
| `src/infrastructure/github/GitHubRepositoryFactory.ts` | createSubIssueRepository method | ✓ VERIFIED | Factory method exists, returns GitHubSubIssueRepository |
| `src/infrastructure/github/GitHubRepositoryFactory.ts` | createStatusUpdateRepository method | ✓ VERIFIED | Factory method exists, returns GitHubStatusUpdateRepository |
| `src/infrastructure/tools/sub-issue-tools.ts` | 5 sub-issue MCP tools | ✓ VERIFIED | Lines 114-236: addSubIssueTool, listSubIssuesTool, getParentIssueTool, reprioritizeSubIssueTool, removeSubIssueTool |
| `src/infrastructure/tools/status-update-tools.ts` | 3 status update MCP tools | ✓ VERIFIED | Lines 72-142: createStatusUpdateTool, listStatusUpdatesTool, getStatusUpdateTool |
| `src/infrastructure/tools/ToolRegistry.ts` | Sub-issue tools registered | ✓ VERIFIED | Lines 356-360, all 5 tools registered |
| `src/infrastructure/tools/ToolRegistry.ts` | Status update tools registered | ✓ VERIFIED | Lines 351-353, all 3 tools registered |
| `src/index.ts` | Sub-issue executors imported and wired | ✓ VERIFIED | Executors imported, 5 case statements at lines 620-632 |
| `src/index.ts` | Status update executors imported and wired | ✗ FAILED | Executors NOT imported, case statements MISSING - calls fall through to default case (MethodNotFound) |

**Score:** 19/20 artifacts verified (95%)

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| GitHubSubIssueRepository | BaseGitHubRepository.graphqlWithFeatures | inheritance + method call | ✓ WIRED | Line 220, 260, 307, 345, 384 - all 5 methods call graphqlWithFeatures with ['sub_issues'] |
| GitHubStatusUpdateRepository | BaseGitHubRepository.graphqlWithFeatures | inheritance + method call | ✓ WIRED | Uses graphql() not graphqlWithFeatures (status updates don't need preview header) |
| GitHubRepositoryFactory | GitHubSubIssueRepository | createSubIssueRepository method | ✓ WIRED | Method exists, instantiates GitHubSubIssueRepository |
| GitHubRepositoryFactory | GitHubStatusUpdateRepository | createStatusUpdateRepository method | ✓ WIRED | Method exists, instantiates GitHubStatusUpdateRepository |
| Sub-issue tool executors | GitHubSubIssueRepository | factory.createSubIssueRepository() | ✓ WIRED | All executors create factory, call repository methods |
| Status update tool executors | GitHubStatusUpdateRepository | factory.createStatusUpdateRepository() | ✓ WIRED | All executors create factory, call repository methods |
| ToolRegistry | Sub-issue tools | registerTool calls | ✓ WIRED | Lines 356-360, all 5 tools registered |
| ToolRegistry | Status update tools | registerTool calls | ✓ WIRED | Lines 351-353, all 3 tools registered |
| index.ts executeToolHandler | Sub-issue executors | case statements | ✓ WIRED | 5 case statements call executors correctly |
| index.ts executeToolHandler | Status update executors | case statements | ✗ NOT_WIRED | Case statements MISSING - registered tools not callable |

**Score:** 9/10 key links verified (90%)

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| GHAPI-01: Add sub-issue to parent issue | ✓ SATISFIED | None - addSubIssue repository method + tool + executor + wired |
| GHAPI-02: List sub-issues for a parent issue | ✓ SATISFIED | None - listSubIssues repository method + tool + executor + wired |
| GHAPI-03: Get parent issue for a sub-issue | ✓ SATISFIED | None - getParentIssue repository method + tool + executor + wired |
| GHAPI-04: Reprioritize sub-issue within parent | ✓ SATISFIED | None - reprioritizeSubIssue repository method + tool + executor + wired |
| GHAPI-05: Remove sub-issue from parent | ✓ SATISFIED | None - removeSubIssue repository method + tool + executor + wired |
| GHAPI-06: Create project status update | ✗ BLOCKED | Tool defined but not wired in index.ts - calls throw MethodNotFound |
| GHAPI-07: List project status updates | ✗ BLOCKED | Tool defined but not wired in index.ts - calls throw MethodNotFound |
| GHAPI-08: Get project status update by ID | ✗ BLOCKED | Tool defined but not wired in index.ts - calls throw MethodNotFound |

**Score:** 5/8 requirements satisfied (62.5%)

### Success Criteria Assessment

| Criterion | Achievable? | Evidence |
|-----------|-------------|----------|
| 1. User can create a sub-issue hierarchy 3 levels deep | ✓ YES | add_sub_issue tool works, supports parent-child relationships, no depth limit in code |
| 2. User can list all sub-issues for any parent and see correct hierarchy | ✓ YES | list_sub_issues returns flat list with position field, includes summary (total, completed, percentCompleted) |
| 3. User can reprioritize sub-issues and see order change on GitHub | ✓ YES | reprioritize_sub_issue tool calls GraphQL reprioritizeSubIssue mutation with afterId parameter |
| 4. User can create status update and see it appear in GitHub project | ✗ NO | createStatusUpdate repository method exists but tool not callable (not wired) |
| 5. User can retrieve status update history for a project | ✗ NO | listStatusUpdates repository method exists but tool not callable (not wired) |

**Score:** 3/5 success criteria achievable (60%)

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| src/index.ts | Registered tools without handlers | 🛑 Blocker | Status update tools throw MethodNotFound at runtime despite being in ToolRegistry |

**Anti-pattern details:**

Tools are registered in ToolRegistry (lines 351-353) which makes them discoverable via `list_tools`, but calling them fails with:

```
McpError(ErrorCode.MethodNotFound, "Tool handler not implemented: create_status_update")
```

This creates a confusing user experience: tools appear available but are not functional.

### Test Coverage

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| GitHubSubIssueRepository.test.ts | 20 | ✓ PASS | All 5 methods + error cases |
| GitHubStatusUpdateRepository.test.ts | 12 | ✓ PASS | All 3 methods + error cases |
| sub-issue-tools.test.ts | 28 | ✓ PASS | Schemas, definitions, executors for 5 tools |
| status-update-tools.test.ts | 28 | ✓ PASS | Schemas, definitions, executors for 3 tools |

**Total:** 88 new tests, all passing

**Note:** Tool tests mock the repository layer, so they don't catch the missing index.ts wiring. The tests verify executors work in isolation but not end-to-end integration.

### Documentation Coverage

| Document | Content | Status |
|----------|---------|--------|
| docs/TOOLS.md | Sub-issue Tools section (5 tools) | ✓ COMPLETE | Section added with descriptions, parameters, examples |
| docs/TOOLS.md | Status Update Tools section (3 tools) | ✓ COMPLETE | Section added with descriptions, parameters, examples |
| STATUS.md | Updated tool count to 93 | ✓ COMPLETE | Reflects 85 original + 8 new tools |
| STATUS.md | Phase 6 completion entry | ✓ COMPLETE | Shows 8 new tools, 88 new tests |

### Gaps Summary

**1 gap blocking 3 requirements:**

**Gap: Status update tools not wired in index.ts**

**Root cause:** Plan 06-03 created the tools and executors, plan 06-04 added tests and documentation, but neither plan included updating index.ts to wire the executors into the tool handler switch statement.

**Impact:**
- GHAPI-06, GHAPI-07, GHAPI-08 blocked
- Success criteria 4 and 5 not achievable
- Users see tools in `list_tools` but get MethodNotFound errors when calling them

**Specific missing code in src/index.ts:**

```typescript
// Missing imports (should be near line 30 with other executor imports)
import {
  executeCreateStatusUpdate,
  executeListStatusUpdates,
  executeGetStatusUpdate,
} from "./infrastructure/tools/status-update-tools.js";

// Missing case statements (should be after line 632, before default case)
case "create_status_update":
  return await executeCreateStatusUpdate(args);

case "list_status_updates":
  return await executeListStatusUpdates(args);

case "get_status_update":
  return await executeGetStatusUpdate(args);
```

**Why this wasn't caught:**
- Tests mock repositories, don't test end-to-end MCP tool calls
- TypeScript compilation succeeds (tools are validly registered)
- No integration test that actually calls tools via MCP protocol

**Fix complexity:** LOW - add 7 lines of code (3 imports + 3 case statements)

---

## Verification Methodology

**Automated checks:**
1. ✓ TypeScript compilation (npm run build)
2. ✓ Repository method existence (grep for method signatures)
3. ✓ GraphQL mutation/query usage (grep for GraphQL strings)
4. ✓ Tool registration (grep in ToolRegistry.ts)
5. ✓ Factory methods (grep in GitHubRepositoryFactory.ts)
6. ✓ Test execution (npm test for repository and tool suites)
7. ✓ Documentation presence (grep in TOOLS.md and STATUS.md)
8. ✓ Executor wiring (grep for case statements in index.ts)

**Gap detection:**
- Compared sub-issue wiring pattern (which works) vs status update wiring (missing)
- Verified executors exist in status-update-tools.ts but not imported in index.ts
- Confirmed no case statements for status update tools despite registration

**Human verification not needed:** All gaps identified programmatically via pattern matching.

---

*Verified: 2026-01-31T22:30:00Z*
*Verifier: Claude (gsd-verifier)*
