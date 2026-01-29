# Testing Patterns

**Analysis Date:** 2026-01-29

## Test Framework

**Runner:**
- Jest 29.7.0
- Config: `jest.config.cjs` (primary), `jest.config.js` (alternative)

**Assertion Library:**
- Jest built-in (`expect`)

**Run Commands:**
```bash
npm test                    # Run all unit tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
npm run test:e2e            # E2E tests
npm run test:e2e:tools      # Tool E2E tests
npm run test:ai             # AI service tests only
npm run test:core           # Non-AI tests only
npm run test:all            # All test suites
```

## Test File Organization

**Location:**
- Unit tests: `src/__tests__/unit/` (mirrors src structure)
- Integration tests: `src/__tests__/integration/`
- E2E tests: `src/__tests__/e2e/`
- AI service tests: `tests/ai-services/`
- AI tool tests: `tests/ai-tools/`

**Naming:**
- Pattern: `*.test.ts` (not `.spec.ts`)
- Match source file name: `ProjectManagementService.test.ts`

**Structure:**
```
src/__tests__/
├── e2e/
│   ├── setup.ts
│   ├── tools/
│   │   ├── github-project-tools.e2e.ts
│   │   ├── ai-task-tools.e2e.ts
│   │   └── tool-integration-workflows.e2e.ts
│   └── utils/
│       └── MCPToolTestUtils.ts
├── integration/
│   ├── GitHubProjectManager.test.ts
│   └── persistence-and-events.test.ts
├── unit/
│   ├── infrastructure/
│   │   ├── cache/
│   │   ├── github/
│   │   │   └── repositories/
│   │   ├── mcp/
│   │   └── resource/
│   └── services/
├── services/
├── tools/
├── setup.ts
└── test-utils.ts

tests/
├── ai-services/
│   ├── AIServiceFactory.test.ts
│   ├── IssueEnrichmentService.test.ts
│   ├── TaskGenerationService.test.ts
│   └── ...
└── ai-tools/
    └── GeneratePRDTool.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('ServiceName', () => {
  let service: ServiceClass;
  let mockDependency: jest.Mocked<DependencyClass>;

  beforeEach(() => {
    jest.clearAllMocks();
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

**Global Setup:** `src/__tests__/setup.ts`
```typescript
import { ResourceType, ResourceStatus } from "../domain/resource-types";
import { Project, Milestone, Issue } from "../domain/types";
import { TestFactory } from "./test-utils";

export const mockCache = {
  set: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
};

export const mockOwner = "test-owner";
export const mockRepo = "test-repo";
export const mockToken = "test-token";

// Mock domain objects
export const mockProject: Project = { ... };
export const mockMilestone: Milestone = { ... };
export const mockIssue: Issue = { ... };

// Module mocks
jest.mock("../infrastructure/cache/ResourceCache", () => ({ ... }));
jest.mock("@octokit/rest", () => ({ ... }));
```

**E2E Setup:** `src/__tests__/e2e/setup.ts`
```typescript
import { jest, beforeAll, afterAll, beforeEach } from "@jest/globals";
import nock from "nock";

const isRealE2ETest = process.env.E2E_REAL_API === 'true';

beforeAll(() => {
  if (!isRealE2ETest) {
    nock.disableNetConnect();
  }
});

beforeEach(() => {
  if (!isRealE2ETest) {
    nock.cleanAll();
  }
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2025-03-01T12:00:00Z"));
});

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});
```

## Mocking

**Framework:** Jest built-in mocking + `jest-mock-extended`

**Patterns:**

**Module Mock:**
```typescript
jest.mock('../../src/services/PRDGenerationService');

// In test
(PRDGenerationService as jest.Mock).mockImplementation(() => mockService);
```

**Function Mock:**
```typescript
const mockGraphql = jest.fn() as jest.MockedFunction<any>;
mockGraphql.mockResolvedValueOnce({ node: { field: { ... } } });
```

**Service Mock:**
```typescript
const mockAIService = {
  modelId: 'test-model',
  provider: 'test-provider'
};

const mockFactory = {
  getMainModel: jest.fn().mockReturnValue(mockAIService),
  getFallbackModel: jest.fn().mockReturnValue(mockAIService),
};

(AIServiceFactory.getInstance as jest.Mock).mockReturnValue(mockFactory);
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
- Time-dependent operations (`jest.useFakeTimers()`)

**What NOT to Mock:**
- Domain logic under test
- Pure functions
- Data transformations

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
- Fixtures in `src/__tests__/setup.ts` (exported mock objects)
- Factory class in `src/__tests__/test-utils.ts`
- E2E test data helpers in `src/__tests__/e2e/utils/MCPToolTestUtils.ts`

## Coverage

**Requirements:**
```javascript
// jest.config.js (alternative config, not actively used)
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
},
```

**View Coverage:**
```bash
npm run test:coverage
# Output in coverage/ directory
# Reporters: text, lcov, clover
```

**Coverage From:**
```javascript
collectCoverageFrom: [
  'src/**/*.ts',
  '!src/**/*.d.ts',
  '!src/**/*.test.ts',
  '!src/**/*.spec.ts',
],
```

## Test Types

**Unit Tests:**
- Location: `src/__tests__/unit/`
- Scope: Single class/function in isolation
- Mocks: All external dependencies
- Speed: Fast (< 100ms per test)

**Integration Tests:**
- Location: `src/__tests__/integration/`
- Scope: Multiple components working together
- Mocks: External services only
- Examples: `GitHubProjectManager.test.ts`, `persistence-and-events.test.ts`

**E2E Tests:**
- Location: `src/__tests__/e2e/`
- Scope: Full MCP server through stdio transport
- Mocks: Optional (controlled by `E2E_REAL_API` env var)
- Timeout: 60 seconds
- Sequential execution: `maxConcurrency: 1`

**AI Tests:**
- Location: `tests/ai-services/`, `tests/ai-tools/`
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

  const response = await utils.callTool('create_project', projectData);

  MCPTestHelpers.validateToolResponse(response, ['id', 'title', 'url']);
  expect(response.title).toBe(projectData.title);
});
```

**Skip Conditionally:**
```typescript
beforeEach(() => {
  if (MCPToolTestUtils.shouldSkipTest('github')) {
    test.skip('Skipping test - missing credentials', () => {});
  }
});
```

## Jest Configuration

**Key Settings:** `jest.config.cjs`
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  resolver: '<rootDir>/jest.resolver.cjs',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/tests/**/*.test.ts',
  ],
  testTimeout: 10000,
  maxWorkers: '50%',
  clearMocks: true,
};
```

**E2E Config:** `jest.e2e.tools.config.js`
```javascript
export default {
  preset: 'ts-jest/presets/default-esm',
  testMatch: ['**/src/__tests__/e2e/tools/**/*.e2e.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/e2e/setup.ts'],
  testTimeout: 60000,
  maxConcurrency: 1,
  forceExit: true,
  detectOpenHandles: true,
};
```

## Environment Variables for Testing

**Test Setup:**
```typescript
// Auto-set in setup files
process.env.GITHUB_TOKEN = "test-token";
process.env.GITHUB_OWNER = "test-owner";
process.env.GITHUB_REPO = "test-repo";
process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
process.env.OPENAI_API_KEY = "sk-test-openai-key";
```

**Real API Testing:**
```bash
# Run with real APIs
E2E_REAL_API=true npm run test:e2e:tools

# Specific provider tests
npm run test:e2e:tools:github
npm run test:e2e:tools:ai
```

---

*Testing analysis: 2026-01-29*
