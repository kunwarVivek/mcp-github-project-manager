# Testing Patterns

**Analysis Date:** 2026-11-02

**Updated:** 2026-11-02 — single test tree (`src/__tests__/`; the legacy root `tests/` tree was merged and removed), coverage thresholds described neutrally, live-API suites registered with `describe.skipIf`.

## Test Framework

**Runner:**
- Vitest ^5.0.5
- Config: `vitest.config.ts` (single config for every suite — unit, integration, E2E; `include` is `src/__tests__/**` only)

**Assertion Library:**
- Vitest built-in (`expect`), with `globals: true` so `describe`/`it`/`expect` are available without importing them

**Run Commands:**
```bash
npm test                    # Run all tests (vitest run)
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
npm run test:e2e            # E2E tests (vitest run e2e)
npm run test:e2e:tools      # Tool E2E tests (vitest run tools)
npm run test:ai             # AI service + AI tool tests only
npm run test:core           # Non-AI tests only
npm run test:all            # All test suites
```

**Filtering:** Vitest rejects the pre-migration runner's CLI flags outright — `--testPathPattern` / `--testPathIgnorePatterns` exit with `CACError: Unknown option`. Filter with a **positional pattern** (`vitest run ai-services`) and exclude with `--exclude='**/unit/services/ai/**'`. The `test:core` script uses exactly that form.

## Test File Organization

**Location — one tree:**
- `src/__tests__/` holds every unit, integration, and E2E suite. There is no root `tests/` directory
- Test counts and measured results: see CI (not recorded here)

**Naming:**
- Pattern: `*.test.ts` (also accepts `*.spec.ts` and `*.e2e.ts`)
- Match source file name: `ProjectManagementService.test.ts`

**Structure:**
```
src/__tests__/
├── e2e/                     # End-to-end suites
│   ├── setup.ts             # Global setup file (registered in vitest.config.ts)
│   ├── tools/               # *.e2e.ts tool suites
│   │   ├── github-project-tools.e2e.ts
│   │   ├── ai-task-tools.e2e.ts
│   │   ├── tool-integration-workflows.e2e.ts
│   │   ├── agent-orchestration.e2e.ts
│   │   ├── basic-validation.e2e.ts
│   │   ├── platform-validation.e2e.ts
│   │   └── full-pipeline.e2e.ts
│   ├── github-project-manager.e2e.ts
│   ├── mcp-server-integration.e2e.ts
│   ├── mcp-protocol-compliance.e2e.ts
│   ├── metrics-reporting.e2e.ts
│   ├── resource-management.e2e.ts
│   ├── resource-system.e2e.ts
│   ├── stdio-transport.e2e.ts
│   └── stdout-purity.e2e.ts
├── integration/             # Cross-component suites
├── unit/                    # Unit suites, mirroring src/ structure
├── infrastructure/          # Tool-level suites
├── services/                # Service-level suites
├── tools/                   # Tool suites
├── helpers/                 # Shared fakes (FakeGitHub, InMemoryAgentStore, aiFakes, mockTypes)
├── setup.ts                 # Shared fixture module (imported, not a setup file)
└── test-utils.ts            # Shared test utilities
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

describe('ServiceName', () => {
  let service: ServiceClass;
  let mockDependency: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup mocks and service instance
    service = new ServiceClass();
  });

  describe('methodName', () => {
    it('should do expected behavior', async () => {
      // Arrange
      const input = { ... };

      // Act
      const result = await service.methodName(input);

      // Assert
      expect(result).toEqual(expected);
    });

    it('should handle error case', async () => {
      mockDependency.method.mockRejectedValue(new Error('error'));

      await expect(service.methodName(input))
        .rejects.toThrow('error');
    });
  });
});
```

**Patterns:**
- `describe` blocks for class/method grouping
- `it` descriptions start with "should"
- AAA pattern: Arrange, Act, Assert
- One assertion focus per test (multiple expects allowed)

## Setup Files

**Global setup (from `vitest.config.ts`):**
```typescript
setupFiles: [
  "reflect-metadata",          // required by tsyringe decorator metadata
  "src/__tests__/e2e/setup.ts", // environment seeding + nock + E2E-scoped timers
],
```

**`src/__tests__/e2e/setup.ts` — the global setup file:**
```typescript
import nock from "nock";
import { afterAll, beforeAll, beforeEach, expect, vi } from "vitest";

const isRealE2ETest = process.env.E2E_REAL_API === "true";

beforeAll(() => {
  if (!isRealE2ETest) {
    nock.disableNetConnect();
  }
});

beforeEach(() => {
  if (!isRealE2ETest) {
    nock.cleanAll();
  }
  // Seed env vars (GITHUB_TOKEN/OWNER/REPO, AI keys, AI model defaults)
  if (!process.env.GITHUB_TOKEN) process.env.GITHUB_TOKEN = "test-token";
  // ...
  // Fake timers are E2E-ONLY and must not leak into unit/integration suites.
  if (isE2ETestFile()) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-01T12:00:00Z"));
  }
});

afterEach(() => {
  if (!isRealE2ETest && !nock.isDone()) {
    console.warn("⚠️  Not all nock interceptors were used:", nock.pendingMocks());
    nock.cleanAll();
  }
  vi.clearAllMocks();
  vi.useRealTimers();
});
```

> The timer scoping is deliberate. This file is a **global** `setupFiles` entry, so freezing the clock here froze it for every suite — hanging anything awaiting a real `setTimeout` (retry backoff) and skewing every `Date.now()`-based domain computation. Fake timers are now applied only inside `__tests__/e2e/` files.

**`src/__tests__/setup.ts` — shared fixture module, NOT a setup file:**
```typescript
import { vi } from "vitest";
import { ResourceStatus, ResourceType } from "../domain/resource-types";
import type { Issue, Milestone, Project } from "../domain/types";

export const mockCache = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
};

export const mockOwner = "test-owner";
export const mockRepo = "test-repo";
export const mockToken = "test-token";

// Mock domain objects
export const mockProject: Project = { ... };
export const mockMilestone: Milestone = { ... };
export const mockIssue: Issue = { ... };
```

It is imported by suites that need the shared fixtures; it is **not** wired into `setupFiles`.

## Mocking

**Framework:** Vitest built-in mocking (`vi`)

**Patterns:**

**Module Mock:**
```typescript
vi.mock('../../src/services/PRDGenerationService');

// In test
vi.mocked(PRDGenerationService).mockImplementation(() => mockService);
```

**Hoisted mock (for factories that run before imports):**
```typescript
const { mockGenerateObject } = vi.hoisted(() => ({ mockGenerateObject: vi.fn() }));
vi.mock("ai", () => ({ generateObject: mockGenerateObject }));
```

**Function Mock:**
```typescript
const mockGraphql = vi.fn();
mockGraphql.mockResolvedValueOnce({ node: { field: { ... } } });
```

**Service Mock:**
```typescript
const mockAIService = {
  modelId: 'test-model',
  provider: 'test-provider'
};

const mockFactory = {
  getMainModel: vi.fn().mockReturnValue(mockAIService),
  getFallbackModel: vi.fn().mockReturnValue(mockAIService),
};

vi.mocked(AIServiceFactory.getInstance).mockReturnValue(mockFactory as never);
```

**HTTP Mocking:** `nock` for GitHub API calls
```typescript
import nock from 'nock';

nock('https://api.github.com')
  .persist()
  .get('/repos/owner/repo')
  .reply(200, mockResponse);
```

**What to Mock:**
- External APIs (GitHub, AI providers)
- Database/cache operations
- File system operations
- Time-dependent operations (`vi.useFakeTimers()` — E2E suites only)

**What NOT to Mock:**
- Domain logic under test
- Pure functions
- Data transformations

## Mocking Traps

These bite repeatedly and are worth internalizing:

- **Use `function`, not an arrow, wherever the code under test calls `new`.** `mockImplementation(() => ({...}))` fails with "is not a constructor" — the mock must be constructible: `mockImplementation(function () { return {...} })`.
- **`beforeEach` must have a block body.** A `beforeEach(() => x.mockReset())` with an *implicit return* hands the mock back to Vitest, which treats a returned function as a teardown callback and calls it. Always write `beforeEach(() => { x.mockReset(); })`.
- **Vitest is not the pre-migration runner.** Legacy CLI flags are rejected outright (see *Filtering* above), and the global mock API is `vi.*`, not the old `mock` namespace.

## Fixtures and Factories

**Test Data:** `src/__tests__/test-utils.ts`

```typescript
export class TestFactory {
  static createProject(overrides: Partial<CreateProject> = {}): CreateProject {
    return {
      title: "Test Project",
      shortDescription: "A test project",
      owner: "test-owner",
      visibility: "private",
      views: [],
      fields: [],
      ...overrides
    };
  }

  static completeProject(data: CreateProject = this.createProject()): Project {
    return {
      id: `proj-${Date.now()}`,
      type: ResourceType.PROJECT,
      title: data.title,
      // ... complete object
    };
  }

  static futureDate(daysFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString();
  }

  static randomId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  static mockGitHubResponse<T>(data: T): Promise<{ data: T }> {
    return Promise.resolve({ data });
  }
}
```

**Location:**
- Shared fixture objects in `src/__tests__/setup.ts` (exported mock objects)
- Factory class in `src/__tests__/test-utils.ts`
- E2E test data helpers in `src/__tests__/e2e/utils/MCPToolTestUtils.ts`

## Coverage

**Requirements (from `vitest.config.ts`):**
- Provider `v8`; `include: ["src/**/*.ts"]`, excluding declaration files and `src/__tests__/**`; reporters `text`, `lcov`, `clover`
- Thresholds for lines, functions, branches and statements are enforced by `coverage.thresholds` in `vitest.config.ts`; `npm run test:coverage` fails below them. Measured coverage: see CI

**View Coverage:**
```bash
npm run test:coverage
# Output in coverage/ directory
# Reporters: text, lcov, clover
```

## Test Types

**Unit Tests:**
- Location: `src/__tests__/unit/` (plus `src/__tests__/services/` and `src/__tests__/tools/`)
- Scope: Single class/function in isolation
- Mocks: All external dependencies
- Speed: Fast

**Integration Tests:**
- Location: `src/__tests__/integration/`
- Scope: Multiple components working together
- Mocks: External services only
- Examples: `GitHubProjectManager.test.ts`, `persistence-and-events.test.ts`, `facade-wiring.test.ts`

**E2E Tests:**
- Location: `src/__tests__/e2e/`
- Scope: Full MCP server through stdio transport
- Mocks: Optional (controlled by `E2E_REAL_API` env var)
- Timeout: 10s default (`testTimeout: 10000`); pipeline scripts raise it to 120s

**AI Tests:**
- Location: `src/__tests__/unit/services/ai/`, `src/__tests__/unit/infrastructure/tools/` (AI tool suites)
- Scope: AI service integrations
- Run separately: `npm run test:ai`
- Mocks: AI providers mocked unless `E2E_REAL_API=true`

## Common Patterns

**Async Testing:**
```typescript
it('should handle async operation', async () => {
  const result = await service.asyncMethod(input);
  expect(result).toBeDefined();
});
```

**Error Testing:**
```typescript
it('should throw on invalid input', async () => {
  await expect(service.method(invalidInput))
    .rejects.toThrow(ValidationError);
});

it('should throw with specific message', async () => {
  await expect(service.method(input))
    .rejects.toThrow('Expected error message');
});
```

**Mock Return Values:**
```typescript
// Single call
mockFn.mockResolvedValueOnce(value);
mockFn.mockRejectedValueOnce(new Error('error'));

// Persistent
mockFn.mockResolvedValue(value);
mockFn.mockReturnValue(value);
```

**Verification:**
```typescript
expect(mockFn).toHaveBeenCalledTimes(2);
expect(mockFn).toHaveBeenCalledWith(expectedArg);
expect(mockFn).toHaveBeenNthCalledWith(2, secondCallArg);
```

**E2E Tool Testing:**
```typescript
it('should create a project', async () => {
  const projectData = MCPTestHelpers.createTestData.project();

  const response = await utils.callTool('manage_project', { action: 'create', ...projectData });

  MCPTestHelpers.validateToolResponse(response, ['id', 'title', 'url']);
  expect(response.title).toBe(projectData.title);
});
```

**Tool failure assertions (MCP v2):**
```typescript
// A tool that ran and failed returns a successful call with a failed result.
expect(result.isError).toBe(true);
```

**Skip Conditionally (live-API suites):**
```typescript
// Registered with describe.skipIf so Vitest reports the suite as SKIPPED,
// not PASSED, when real credentials are absent.
describe.skipIf(MCPToolTestUtils.shouldSkipTest('github'))('Suite', () => {
  // ...
});
```

## Environment Variables for Testing

**Test Setup (seeded in `src/__tests__/e2e/setup.ts`):**
```typescript
if (!process.env.GITHUB_TOKEN) process.env.GITHUB_TOKEN = "test-token";
if (!process.env.GITHUB_OWNER) process.env.GITHUB_OWNER = "test-owner";
if (!process.env.GITHUB_REPO) process.env.GITHUB_REPO = "test-repo";
if (!process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
if (!process.env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = "sk-test-openai-key";
```

Under `NODE_ENV=test` the credential chain is skipped and `src/env.ts` hardcodes safe test defaults, so unit tests never shell out to `gh`. The single exception is `E2E_REAL_API=true`, where real env vars are honored so live suites can pass real credentials.

**Real API Testing:**
```bash
# Run with real APIs
E2E_REAL_API=true npm run test:e2e:tools

# Specific provider tests
npm run test:e2e:tools:github
npm run test:e2e:tools:ai
```

---

*Testing analysis: 2026-11-02*
