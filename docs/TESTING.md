# Testing Guide

This document covers the test suite layout, how to run tests, and the tests that
are intentionally skipped (with their justifications).

The project uses **Vitest 5**. There is no `jest.config.*` and no `ts-jest` in the
tree any more — do not reintroduce them. See
[ADR-004](adr/004-biome-replacing-eslint.md) for the toolchain migration, and
[testing-guide.md](testing-guide.md) for the AI-feature-specific guide.

## Test Suite Overview

| Category | Description | Location |
|----------|-------------|----------|
| Unit tests | Individual components in isolation | `src/__tests__/unit/` |
| Integration tests | Service-layer interactions and wiring | `src/__tests__/integration/` |
| E2E tests | Full MCP server over stdio, tool suites | `src/__tests__/e2e/` |
| Legacy suite | Older service/infrastructure suites | `tests/` |

Test files live in **both** `src/__tests__/**` and the legacy root `tests/**` tree.
Vitest picks up both (see `vitest.config.ts`, `test.include`):

```ts
include: [
  "src/__tests__/**/*.test.ts",
  "src/__tests__/**/*.spec.ts",
  "src/__tests__/**/*.e2e.ts",
  "tests/**/*.test.ts",
  "tests/**/*.spec.ts",
]
```

> New tests belong under `src/__tests__/`. The root `tests/` tree is kept working
> but is not where new files go.

For the current pass/fail/skip totals, run the suite — the numbers change with
every commit and a stale count in a doc is worse than no count:

```bash
npm test        # or: pnpm test
```

## Running Tests

Every script works with **both** npm and pnpm (`npm run X` ≡ `pnpm run X`).

### Run All Tests

```bash
npm test
# or
pnpm test
```

### Run a Subset

Vitest filters by **positional path pattern**, not by a `--testPathPattern` flag
(Vitest rejects Jest-only CLI options outright with `CACError: Unknown option`):

```bash
# Everything under src/__tests__/unit/
npm test -- unit

# Everything under src/__tests__/integration/
npm test -- integration

# Everything under src/__tests__/e2e/
npm test -- e2e

# One file, by name fragment
npm test -- stdio-transport

# Exclude a subtree
npm test -- --exclude='**/tests/ai-services/**'
```

### Watch Mode

```bash
npm run test:watch
```

### Coverage

```bash
npm run test:coverage
```

Coverage thresholds are enforced in `vitest.config.ts` (v8 provider, over
`src/**`): lines 55, functions 57, branches 45, statements 54.

### E2E

```bash
npm run test:e2e        # vitest run e2e
npm run test:e2e:tools  # vitest run tools
```

### Live-API E2E (consumes GitHub rate limit)

```bash
E2E_REAL_API=true npm run test:e2e:tools:real
```

Use a dedicated scratch repository: the live suites create a test project,
issues, milestones and sprints, and they do NOT clean up afterwards.

### The E2E runner

```bash
npm run e2e                          # every e2e suite
npm run e2e -- --suite github        # one suite (github, ai, workflows,
                                     # agents, platform, pipeline, basic,
                                     # protocol, stdio, resources, metrics, server)
npm run e2e -- --real-api            # against the real GitHub API
npm run e2e -- --json /tmp/e2e.json  # machine-readable summary
```

The runner uses the project's own Vitest binary and filters suites by
POSITIONAL pattern. Vitest 5 rejects Jest-only flags, so `--testPathPattern`
is not an option here (it dies with `CACError: Unknown option`).

### The action sweep - every action, no credentials

```bash
npm run test:e2e:sweep     # drives all 20 tools / 169 actions
npm run test:e2e:coverage  # renders the matrix and gates on it
```

The tool e2e suites need live GitHub credentials and skip without them, so
without the sweep most of the MCP surface is never executed. The sweep calls
every action of every public tool through the real dispatch path with the
GitHub API stubbed, and fails when an action is advertised but not routed, or
crashes on a missing argument instead of reporting one. CI runs it.

### AI-only Tests

```bash
npm run test:ai          # vitest run ai-services ai-tools
npm run test:ai:watch
npm run test:ai:coverage
```

### Core Tests (everything except the AI suites)

```bash
npm run test:core
```

## Skipped Tests

The following tests are intentionally skipped because they need real external
resources. The skip is by design, not a broken suite.

### E2E Tests Requiring GitHub Credentials

These make real API calls that create/modify resources in the target repository.

| Test suite | Location | Reason |
|------------|----------|--------|
| GitHub Project Manager E2E | `src/__tests__/e2e/github-project-manager.e2e.ts` | Creates real roadmaps, milestones, issues, sprints |
| Resource Management E2E | `src/__tests__/e2e/resource-management.e2e.ts` | Exercises the resource lifecycle against the real GitHub API |
| Metrics and Reporting E2E | `src/__tests__/e2e/metrics-reporting.e2e.ts` | Creates real milestones and issues for metrics testing |

### Integration Tests with Conditional Skip

| Test suite | Location | Reason |
|------------|----------|--------|
| GitHubProjectManager integration | `src/__tests__/integration/GitHubProjectManager.test.ts` | Skipped when `GITHUB_TOKEN` is not set |

## Running Tests with Real Credentials

### 1. Set Environment Variables

```bash
export GITHUB_TOKEN="your-github-token"
export GITHUB_OWNER="your-github-username-or-org"
export GITHUB_REPO="your-test-repository"
```

### 2. Enable the E2E Tests

The credentialed E2E files use `describe.skip` to skip by default. To run them:

1. Change `describe.skip` to `describe` in the test file.
2. Run the file:
   ```bash
   npm test -- github-project-manager
   ```
3. Revert the change afterwards.

**Warning:** these tests create real resources in your GitHub repository. Use a
dedicated test repository.

### 3. Integration Tests with Credentials

Integration tests run automatically when `GITHUB_TOKEN` is set:

```bash
GITHUB_TOKEN=your-token npm test -- GitHubProjectManager
```

## Test Structure

```
src/__tests__/
├── e2e/                           # End-to-end tests
│   ├── github-project-manager.e2e.ts    # [SKIPPED] Real GitHub API
│   ├── resource-management.e2e.ts       # [SKIPPED] Real GitHub API
│   ├── metrics-reporting.e2e.ts         # [SKIPPED] Real GitHub API
│   ├── mcp-protocol-compliance.e2e.ts   # Spawns a real server process
│   ├── mcp-server-integration.e2e.ts    # Spawns a real server process
│   ├── stdio-transport.e2e.ts           # Spawns a real server process
│   ├── stdout-purity.e2e.ts             # Asserts stdout carries no stray output
│   └── tools/                           # Tool-level E2E suites
│       ├── github-project-tools.e2e.ts
│       ├── ai-task-tools.e2e.ts
│       ├── tool-integration-workflows.e2e.ts
│       ├── platform-validation.e2e.ts
│       ├── agent-orchestration.e2e.ts
│       ├── basic-validation.e2e.ts
│       └── full-pipeline.e2e.ts
├── integration/                   # Service integration tests
│   ├── GitHubProjectManager.test.ts     # [CONDITIONAL] Needs GITHUB_TOKEN
│   ├── facade-wiring.test.ts
│   ├── facade-domain-entities.integration.test.ts
│   ├── domain-entities.integration.test.ts
│   └── persistence-and-events.test.ts
├── unit/                          # Unit tests
│   ├── agent/                     # Agent orchestration
│   ├── context/                   # Context generator tests
│   ├── domain/                    # Domain model tests
│   ├── infrastructure/            # Infrastructure tests
│   ├── services/                  # Service tests
│   └── validation/                # Validator tests
├── services/                      # Service-level tests
├── tools/                         # Tool-level tests
├── setup.ts                       # Global setup
├── test-utils.ts                  # Shared helpers
└── test-utils/                    # Test utilities and mocks

tests/                             # Legacy suite (still in the Vitest include list)
├── ai-services/
├── ai-tools/
├── services/
├── infrastructure/
└── cache/
```

## Test Requirements

### For All Tests

- Node.js 22.12+ (24 is the supported target)
- Dependencies installed (`npm install` or `pnpm install`)
- A successful build for the E2E suites that spawn a server process
  (`npm run build`)

### For E2E Tests (stdio transport)

`stdio-transport.e2e.ts` and `mcp-protocol-compliance.e2e.ts` spawn a real
server process and talk to it over stdio. They require:

- A successful build (`npm run build`)
- No port conflicts
- A generous timeout — the default is 10 s, raised per-suite where needed

### For GitHub API Tests

- A valid `GITHUB_TOKEN` with repo permissions
- `GITHUB_OWNER` set to your username or organization
- `GITHUB_REPO` set to a test repository

## Troubleshooting

### Tests Time Out

E2E tests have extended timeouts because they spawn real processes. To raise the
global timeout:

```bash
npm test -- --testTimeout=60000
```

### Server Build Not Found

```
Error: Server build not found. Run `npm run build` first.
```

Solution: run `npm run build` before the E2E tests.

### The Run Never Ends

E2E suites that spawn processes can leave handles open. Force the run to end:

```bash
npm test -- --forceExit
```

### Detecting Open Handles

```bash
npm test -- --detectOpenHandles
```

### Mocking Traps (Vitest 5)

- A mock that the code under test calls with `new` must be a `function`, not an
  arrow — `mockImplementation(() => ({}))` fails with "is not a constructor".
- A `beforeEach(() => x.mockReset())` with an *implicit* return hands the mock
  back to Vitest, which treats a returned function as a teardown callback and
  calls it. Always use a block body: `beforeEach(() => { x.mockReset(); })`.

## Related Documentation

- [testing-guide.md](testing-guide.md) — testing guide for AI-powered features
- [e2e-testing-guide.md](e2e-testing-guide.md) — E2E tool testing
- [API.md](API.md) — service and infrastructure API reference
- [CONTRIBUTING.md](../CONTRIBUTING.md) — the full quality gate

## Production Release Verification

Before a production release, verify:

1. **Build succeeds**: `npm run build`
2. **Typecheck passes**: `npm run typecheck`
3. **Lint passes**: `npm run lint` (Biome — must exit 0)
4. **Tests pass**: `npm test` reports 0 failures
5. **Skipped tests documented**: every skipped suite has a justification (this file)

The gate runs in that order, and CI runs it on Node 22.x and 24.x under **both**
npm and pnpm.
