# Testing Guide

This document provides an overview of the test suite, how to run tests, and documentation of skipped tests with their justifications.

## Test Suite Overview

The test suite contains:
- **1474+ passing tests** across unit, integration, and E2E test categories
- **20 skipped tests** (documented with justifications below)
- **0 failing tests** (required for production release)

### Test Categories

| Category | Description | Location |
|----------|-------------|----------|
| Unit Tests | Test individual components in isolation | `src/__tests__/unit/` |
| Integration Tests | Test service layer interactions | `src/__tests__/integration/` |
| E2E Tests | Test full MCP server and stdio transport | `src/__tests__/e2e/` |

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Categories
```bash
# Unit tests only
npm test -- --testPathPattern="unit"

# Integration tests only
npm test -- --testPathPattern="integration"

# E2E tests only
npm test -- --testPathPattern="e2e"

# Specific test file
npm test -- --testPathPattern="stdio-transport"
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

## Skipped Tests

The following tests are intentionally skipped due to their requirements for real external resources.

### E2E Tests Requiring GitHub Credentials

These tests require real GitHub API credentials (`GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`) because they make actual API calls to create/modify GitHub resources.

| Test Suite | Location | Tests Skipped | Reason |
|------------|----------|---------------|--------|
| GitHub Project Manager E2E | `src/__tests__/e2e/github-project-manager.e2e.ts` | 7 | Creates real roadmaps, milestones, issues, and sprints |
| Resource Management E2E | `src/__tests__/e2e/resource-management.e2e.ts` | 6 | Tests resource lifecycle with real GitHub API |
| Metrics and Reporting E2E | `src/__tests__/e2e/metrics-reporting.e2e.ts` | 5 | Creates real milestones and issues for metrics testing |

### Integration Tests with Conditional Skip

| Test Suite | Location | Tests Skipped | Reason |
|------------|----------|---------------|--------|
| GitHubProjectManager Integration | `src/__tests__/integration/GitHubProjectManager.test.ts` | 2 | Conditionally skipped when `GITHUB_TOKEN` is not set |

## Running Tests with Real Credentials

To run the normally-skipped E2E tests with real GitHub credentials:

### 1. Set Environment Variables
```bash
export GITHUB_TOKEN="your-github-token"
export GITHUB_OWNER="your-github-username-or-org"
export GITHUB_REPO="your-test-repository"
```

### 2. Enable E2E Tests

The E2E test files use `describe.skip` to skip tests by default. To run them:

1. Edit the test file and change `describe.skip` to `describe`
2. Run the tests: `npm test -- --testPathPattern="github-project-manager"`
3. Remember to revert the change after testing

**Warning:** These tests will create real resources in your GitHub repository. Use a dedicated test repository.

### 3. Integration Tests with Credentials

Integration tests automatically run when `GITHUB_TOKEN` is set:
```bash
GITHUB_TOKEN=your-token npm test -- --testPathPattern="GitHubProjectManager"
```

## Test Structure

```
src/__tests__/
├── e2e/                           # End-to-end tests
│   ├── github-project-manager.e2e.ts    # [SKIPPED] Real GitHub API
│   ├── resource-management.e2e.ts       # [SKIPPED] Real GitHub API
│   ├── metrics-reporting.e2e.ts         # [SKIPPED] Real GitHub API
│   ├── mcp-protocol-compliance.e2e.ts   # Spawns real server process
│   ├── mcp-server-integration.e2e.ts    # Spawns real server process
│   └── stdio-transport.e2e.ts           # Spawns real server process
├── integration/                   # Service integration tests
│   └── GitHubProjectManager.test.ts     # [CONDITIONAL] Needs GITHUB_TOKEN
├── unit/                          # Unit tests
│   ├── application/               # Application layer tests
│   ├── domain/                    # Domain model tests
│   ├── infrastructure/            # Infrastructure tests
│   └── services/                  # Service tests
└── test-utils/                    # Test utilities and mocks
```

## Test Requirements

### For All Tests
- Node.js 22+
- `npm install` completed
- `npm run build` completed (for E2E tests that spawn server)

### For E2E Tests (stdio transport)
The MCP server E2E tests (`stdio-transport.e2e.ts`, `mcp-protocol-compliance.e2e.ts`) spawn a real server process and communicate via stdio. They require:
- A successful build (`npm run build`)
- No port conflicts
- Sufficient test timeout (15-30 seconds)

### For GitHub API Tests
- Valid `GITHUB_TOKEN` with repo permissions
- `GITHUB_OWNER` set to your username or organization
- `GITHUB_REPO` set to a test repository

## Troubleshooting

### Tests Timeout
E2E tests have extended timeouts (10-30 seconds) because they spawn real processes. If tests still timeout:
```bash
# Increase Jest timeout globally
npm test -- --testTimeout=60000
```

### Server Build Not Found
```
Error: Server build not found. Run `npm run build` first.
```
Solution: Run `npm run build` before running E2E tests.

### Jest Doesn't Exit
```
Jest did not exit one second after the test run has completed.
```
This warning appears with E2E tests that spawn processes. Use `--forceExit` if needed:
```bash
npm test -- --forceExit
```

### Detecting Open Handles
```bash
npm test -- --detectOpenHandles
```

## Related Documentation

- [AI Features Testing Guide](./testing-guide.md) - Detailed testing guide for AI-powered features
- [E2E Testing Guide](./e2e-testing-guide.md) - Comprehensive E2E testing documentation
- [API Reference](./API.md) - API documentation for all tools

## Production Release Verification

Before each production release, verify:

1. **All tests pass**: `npm test` shows 0 failed tests
2. **Build succeeds**: `npm run build` completes without errors
3. **Type check passes**: `npm run type-check` (if available) or build includes type checking
4. **Skipped tests documented**: All skipped tests have documented justification (this file)

Current status: **Ready for release** (1474 passing, 0 failed, 20 skipped with justification)
