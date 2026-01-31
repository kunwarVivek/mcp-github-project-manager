---
phase: 04-test-stabilization
plan: 02
subsystem: testing
tags: [e2e, credentials, test-guards, graceful-skip]
requires:
  - 04-01 (test foundation fixes)
provides:
  - credential-guarded E2E tests
  - graceful test skipping
affects:
  - all future E2E test runs
tech-stack:
  patterns:
    - credential guard pattern (if (!utils) return)
    - real credential detection (hasRealCredentials)
key-files:
  modified:
    - src/__tests__/e2e/tools/ai-task-tools.e2e.ts
    - src/__tests__/e2e/tools/github-project-tools.e2e.ts
    - src/__tests__/e2e/utils/MCPToolTestUtils.ts
decisions:
  - Guard pattern: "if (!utils) { console.log('Skipping...'); return; }"
  - Real credential detection vs fake test tokens
  - createTestSuite always registers tests (skip inside)
metrics:
  duration: ~10 minutes
  completed: 2026-01-31
---

# Phase 4 Plan 2: E2E Credential Guards Summary

**One-liner:** Added credential guards to 41 E2E tests so they skip gracefully when GitHub/AI credentials are missing.

## What Was Done

### Task 1: ai-task-tools.e2e.ts Credential Guards

Added `if (!utils)` guard to all 15 tests in the AI task tools E2E file:
- AI Tool Registration (2 tests)
- PRD Generation Tools (3 tests)
- Task Generation and Parsing Tools (4 tests)
- Feature Management Tools (2 tests)
- Traceability and Requirements Tools (1 test)
- AI Tool Error Handling (2 tests)
- AI Tool Integration (1 test)

Updated type signature to accept `MCPToolTestUtils | undefined`.

### Task 2: github-project-tools.e2e.ts Credential Guards

Added `if (!utils)` guard to all 26 tests:
- Project Tools (6 tests)
- Milestone Tools (4 tests)
- Issue Tools (5 tests)
- Sprint Tools (4 tests)
- Roadmap and Planning Tools (4 tests)
- Label Tools (3 tests)

Added `hasRealCredentials()` function to detect fake test tokens.

### MCPToolTestUtils Updates

1. **New `hasRealCredentials()` method:**
   - Checks for real vs fake credentials
   - Detects test tokens from setup.ts (test-token, sk-ant-test-key, etc.)
   - Returns true only for real API credentials

2. **Updated `shouldSkipTest()` method:**
   - Now returns `!hasRealCredentials(testType)`
   - Previously delegated to testConfig which always returned false in mock mode

3. **Updated `createTestSuite()` wrapper:**
   - Always registers tests (prevents "no tests" Jest error)
   - Tests skip inside via `if (!utils)` guard
   - Updated type signature to `utils: MCPToolTestUtils | undefined`

## Guard Pattern

Every test that uses `utils` now has this guard:
```typescript
it('should do something', async () => {
  if (!utils) {
    console.log('Skipping: utils not initialized (missing credentials)');
    return;
  }
  // ... actual test code
});
```

## Verification Results

**Without credentials (GITHUB_TOKEN=):**
```
Test Suites: 2 passed, 2 total
Tests:       41 passed, 41 total
```

**No authentication errors:**
- No "Bad credentials" errors
- No "TypeError: Cannot read property of undefined"
- No authentication failures

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | f2c189a | Add credential guards to ai-task-tools.e2e.ts |
| 2 | 2ecc7b7 | Add credential guards to github-project-tools.e2e.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] MCPToolTestUtils shouldSkipTest logic**
- **Found during:** Task 2
- **Issue:** `shouldSkipTest` delegated to testConfig which always returned false in mock mode
- **Fix:** Added `hasRealCredentials()` to properly detect real vs fake credentials
- **Files modified:** src/__tests__/e2e/utils/MCPToolTestUtils.ts
- **Commit:** 2ecc7b7

**2. [Rule 3 - Blocking] createTestSuite type signature**
- **Found during:** Task 2
- **Issue:** `tests(utils as MCPToolTestUtils)` cast failed when utils was undefined
- **Fix:** Updated type to `utils: MCPToolTestUtils | undefined`, always register tests
- **Files modified:** src/__tests__/e2e/utils/MCPToolTestUtils.ts
- **Commit:** 2ecc7b7

## Next Phase Readiness

All E2E tests in scope now skip gracefully when credentials are missing:
- CI environments without secrets will pass
- Fresh clones will not fail on E2E tests
- Developers without GitHub tokens can run unit tests

Note: Other E2E test files (tool-integration-workflows.e2e.ts, etc.) may still need similar treatment in future plans.
