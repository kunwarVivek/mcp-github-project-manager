# Phase 4: Test Stabilization - Research

**Researched:** 2026-01-31
**Domain:** Jest testing, TypeScript test patterns, AI service mocking, E2E test infrastructure
**Confidence:** HIGH

## Summary

This phase addresses test stabilization for the MCP GitHub Project Manager. Current state analysis reveals 44 failing tests (updated from roadmap's 74), 20 skipped tests, and 341 passing tests out of 405 total. The failures fall into distinct categories: type assertion errors in tests (not implementation bugs), incorrect test.skip() usage, E2E credential failures, and a false-positive logger compliance test.

The codebase has mature test infrastructure including jest-mock-extended, factory injection patterns for GitHub services, and established AI mocking patterns. The three context generators (ContextualReferenceGenerator, DependencyContextGenerator, ContextQualityValidator) currently have zero test coverage and require comprehensive unit tests.

**Primary recommendation:** Fix test bugs by category (type access patterns first, then skip usage, then E2E guards), then add unit tests for context generators using existing AI mocking patterns, targeting 90%+ coverage on ContextualReferenceGenerator with explicit fallback path testing.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Jest | 29.7.0 | Test framework | Already in use, well-configured |
| ts-jest | 29.3.4 | TypeScript transformer | Already in use with ESM support |
| jest-mock-extended | 3.0.7 | Deep mocking utilities | Already available in devDependencies |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nock | 14.0.4 | HTTP mocking | Already available for API mocking |
| @jest/globals | 29.7.0 | Type-safe test functions | Import describe, it, expect from here |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jest.fn() | jest-mock-extended mock() | mock() provides better TypeScript types, but jest.fn() works fine for simple cases |
| Manual mocks | nock | nock is better for HTTP but manual mocks work for services |

**Installation:**
```bash
# No new packages needed - all dependencies already installed
```

## Architecture Patterns

### Recommended Test Structure
```
src/__tests__/
  unit/
    services/           # Service unit tests (existing)
    infrastructure/     # Infrastructure unit tests (existing)
    context/            # NEW: Context generator tests
  integration/          # Integration tests
  e2e/                  # End-to-end tests
  test-utils.ts         # Test factories and helpers
  setup.ts              # Global test setup
tests/
  ai-services/          # AI service tests (existing)
  ai-tools/             # AI tool tests (existing)
```

### Pattern 1: AI Service Mocking
**What:** Mock AIServiceFactory and the 'ai' package for AI-dependent services
**When to use:** Testing any service that uses AI generation (generateObject, generateText)
**Example:**
```typescript
// Source: tests/ai-services/TaskGenerationService.test.ts
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AIServiceFactory } from '../../src/services/ai/AIServiceFactory';

// Mock the AI service factory
jest.mock('../../src/services/ai/AIServiceFactory');

// Mock the ai package
jest.mock('ai', () => ({
  generateObject: jest.fn(),
  generateText: jest.fn()
}));

describe('ServiceName', () => {
  let service: ServiceName;
  let mockAIService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock AI service model object
    mockAIService = {
      modelId: 'test-model',
      provider: 'test-provider'
    };

    // Mock AIServiceFactory
    const mockFactory = {
      getMainModel: jest.fn().mockReturnValue(mockAIService),
      getFallbackModel: jest.fn().mockReturnValue(mockAIService),
      getBestAvailableModel: jest.fn().mockReturnValue(mockAIService),
    };

    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue(mockFactory);

    service = new ServiceName();
  });

  it('should use AI when available', async () => {
    const { generateObject } = require('ai');
    generateObject.mockResolvedValue({ object: mockResult });

    const result = await service.doSomething(input);

    expect(generateObject).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should use fallback when AI unavailable', async () => {
    // Set AI as unavailable
    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue({
      getBestAvailableModel: jest.fn().mockReturnValue(null),
    });

    // Recreate service with new mock
    service = new ServiceName();

    const result = await service.doSomething(input);

    // Verify fallback result
    expect(result).toBeDefined();
    // generateObject should NOT have been called
  });
});
```

### Pattern 2: Factory Injection for GitHub Services
**What:** Inject GitHubRepositoryFactory mock in constructor
**When to use:** Testing services that use GitHub repositories
**Example:**
```typescript
// Source: src/__tests__/unit/services/SubIssueService.test.ts
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SubIssueService } from '../../../services/SubIssueService';
import { GitHubRepositoryFactory } from '../../../infrastructure/github/GitHubRepositoryFactory';

jest.mock('../../../infrastructure/github/GitHubRepositoryFactory');

describe('SubIssueService', () => {
  let service: SubIssueService;
  let mockFactory: jest.Mocked<GitHubRepositoryFactory>;
  let mockIssueRepo: {
    findById: jest.MockedFunction<any>;
    update: jest.MockedFunction<any>;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockIssueRepo = {
      findById: jest.fn(),
      update: jest.fn(),
    };

    mockFactory = {
      createIssueRepository: jest.fn().mockReturnValue(mockIssueRepo),
    } as unknown as jest.Mocked<GitHubRepositoryFactory>;

    // Inject mock factory in constructor
    service = new SubIssueService(mockFactory);
  });

  it('should update issue status', async () => {
    mockIssueRepo.findById.mockResolvedValue(mockIssue);
    mockIssueRepo.update.mockResolvedValue(updatedIssue);

    const result = await service.updateIssueStatus('issue-1', ResourceStatus.CLOSED);

    expect(mockIssueRepo.findById).toHaveBeenCalledWith('issue-1');
    expect(result.status).toBe(ResourceStatus.CLOSED);
  });
});
```

### Pattern 3: E2E Credential Guards
**What:** Skip tests that require credentials when credentials are unavailable
**When to use:** Any E2E test that calls external APIs
**Example:**
```typescript
// Source: src/__tests__/e2e/utils/MCPToolTestUtils.ts
describe('GitHub E2E Tests', () => {
  beforeAll(async () => {
    if (MCPToolTestUtils.shouldSkipTest('github')) {
      console.log('Skipping - missing credentials for github tests');
      return;
    }
    // ... setup
  });

  // For individual tests that depend on prior test state:
  it('should do something', async () => {
    if (!prerequisiteExists) {
      // Use it.skip pattern instead of test.skip() statement
      return; // Early return, let beforeEach handle skipping
    }
    // ... test logic
  });
});

// OR use conditional describe
const shouldSkip = MCPToolTestUtils.shouldSkipTest('github');
(shouldSkip ? describe.skip : describe)('GitHub E2E Tests', () => {
  // ... tests
});
```

### Anti-Patterns to Avoid
- **test.skip('message') without callback:** Jest expects `test.skip('message', () => {})` not just `test.skip('message')`
- **Accessing nested properties without path:** When return type is `{ context: { ... } }`, don't access `result.businessObjective`, use `result.context.businessObjective`
- **Mocking after service instantiation:** AIServiceFactory mock must be set up BEFORE creating the service
- **Overly broad regex patterns:** Pattern `/\[.*\]/` matches JSON brackets, not just log format

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mock data creation | Manual object literals | TestFactory from test-utils.ts | Consistent, typed test data |
| AI service mocking | Custom mock implementation | AIServiceFactory.getInstance mock pattern | Proven pattern in 6+ test files |
| GitHub repo mocking | Manual mock objects | GitHubRepositoryFactory injection | Matches production DI pattern |
| Type assertions | `as any` in tests | Proper mock typing with jest.Mocked | Type safety in tests |
| E2E server control | Custom process management | MCPToolTestUtils class | Handles start/stop/message passing |

**Key insight:** The codebase has mature test patterns. Copy from working tests like `SubIssueService.test.ts` (factory injection) and `TaskGenerationService.test.ts` (AI mocking) rather than inventing new patterns.

## Common Pitfalls

### Pitfall 1: Type Access Path Mismatch
**What goes wrong:** Tests access `result.businessObjective` but actual return is `{ context: { businessObjective } }`
**Why it happens:** Service return type changed but tests weren't updated
**How to avoid:** Always check service method signature before writing assertions
**Warning signs:** TypeScript errors like "Property 'X' does not exist on type"

### Pitfall 2: Incorrect test.skip() Syntax
**What goes wrong:** `test.skip('No milestone created')` throws "Missing second argument"
**Why it happens:** Jest's test.skip() requires callback function, not just message
**How to avoid:** Use `it.skip('message', () => {})` or early return with conditional logic
**Warning signs:** "It must be a callback function" error message

### Pitfall 3: E2E Tests Running Without Credentials
**What goes wrong:** Tests fail with "Bad credentials" instead of skipping
**Why it happens:** shouldSkipTest() check in beforeAll doesn't prevent individual tests from running
**How to avoid:** Use conditional describe.skip or add guards in each test
**Warning signs:** Multiple "Authentication failed" errors in test output

### Pitfall 4: Logger Compliance False Positives
**What goes wrong:** Test fails because JSON response contains brackets
**Why it happens:** Regex `/\[.*\]/` matches any brackets, including JSON arrays
**How to avoid:** Use more specific patterns like `/\[\d{4}-\d{2}-\d{2}/` for timestamps
**Warning signs:** Test fails but stdout clearly contains only valid JSON

### Pitfall 5: AI Mock Setup Timing
**What goes wrong:** Service uses real AIServiceFactory instead of mock
**Why it happens:** Mock set up after service is instantiated
**How to avoid:** Always set up mocks in beforeEach BEFORE creating service instance
**Warning signs:** Tests making real API calls or getBestAvailableModel returning unexpected values

## Code Examples

### Unit Test for ContextualReferenceGenerator (Template)
```typescript
// Path: src/__tests__/unit/context/ContextualReferenceGenerator.test.ts
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ContextualReferenceGenerator } from '../../../services/context/ContextualReferenceGenerator';
import { AIServiceFactory } from '../../../services/ai/AIServiceFactory';
import { AITask, PRDDocument, TaskStatus, TaskPriority } from '../../../domain/ai-types';

jest.mock('../../../services/ai/AIServiceFactory');
jest.mock('ai', () => ({
  generateObject: jest.fn()
}));

describe('ContextualReferenceGenerator', () => {
  let generator: ContextualReferenceGenerator;
  let mockFactory: any;

  const mockTask: AITask = {
    id: 'task-1',
    title: 'Implement auth',
    description: 'Create login functionality',
    status: TaskStatus.PENDING,
    priority: TaskPriority.HIGH,
    complexity: 7,
    estimatedHours: 16,
    actualHours: 0,
    aiGenerated: true,
    subtasks: [],
    dependencies: [],
    acceptanceCriteria: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: []
  };

  const mockPRD: PRDDocument = {
    id: 'prd-1',
    title: 'Auth System',
    version: '1.0',
    overview: 'Authentication system',
    objectives: ['Secure login'],
    scope: { inScope: [], outOfScope: [], assumptions: [], constraints: [] },
    targetUsers: [],
    userJourney: '',
    features: [],
    technicalRequirements: [],
    timeline: '3 months',
    milestones: [],
    successMetrics: [],
    aiGenerated: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: 'test',
    stakeholders: [],
    tags: []
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockFactory = {
      getBestAvailableModel: jest.fn().mockReturnValue({ modelId: 'test' }),
    };

    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue(mockFactory);

    generator = new ContextualReferenceGenerator();
  });

  describe('generateReferences', () => {
    it('should generate references with AI when available', async () => {
      const { generateObject } = require('ai');
      generateObject.mockResolvedValue({
        object: {
          prdSections: [],
          relatedFeatures: [],
          technicalSpecs: [],
          codeExamples: [],
          externalReferences: []
        }
      });

      const result = await generator.generateReferences(mockTask, mockPRD);

      expect(result).toBeDefined();
      expect(generateObject).toHaveBeenCalled();
    });

    it('should use fallback when AI unavailable', async () => {
      mockFactory.getBestAvailableModel.mockReturnValue(null);
      generator = new ContextualReferenceGenerator();

      const result = await generator.generateReferences(mockTask, mockPRD);

      expect(result).toBeDefined();
      expect(result?.prdSections).toBeDefined();
    });

    it('should handle AI errors gracefully', async () => {
      const { generateObject } = require('ai');
      generateObject.mockRejectedValue(new Error('AI service error'));

      const result = await generator.generateReferences(mockTask, mockPRD);

      // Should fall back to basic references
      expect(result).toBeDefined();
    });
  });
});
```

### Fixing test.skip() Usage
```typescript
// WRONG - causes "Missing second argument" error
it('should get milestone metrics', async () => {
  if (!createdMilestoneId) {
    test.skip('No milestone created to test with');
    return;
  }
  // ...
});

// CORRECT - use early return with documented skip
it('should get milestone metrics', async () => {
  if (!createdMilestoneId) {
    console.log('Skipping: No milestone created to test with');
    return; // Test passes but does nothing
  }
  // ...
});

// ALSO CORRECT - use conditional describe
const hasMilestone = !!createdMilestoneId;
(hasMilestone ? describe : describe.skip)('Milestone tests', () => {
  it('should get milestone metrics', async () => {
    // ...
  });
});
```

### Fixing Type Access in Tests
```typescript
// WRONG - accessing wrong depth
expect(result.businessObjective).toBeDefined();
expect(result.userImpact).toBeDefined();

// CORRECT - access nested context object
expect(result.context.businessObjective).toBeDefined();
expect(result.context.userImpact).toBeDefined();

// OR destructure for cleaner tests
const { context } = result;
expect(context.businessObjective).toBeDefined();
expect(context.userImpact).toBeDefined();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `test.skip('message')` | `it.skip('message', () => {})` | Jest best practice | Prevents runtime errors |
| Direct property access | Proper type paths | TypeScript strict mode | Compile-time safety |
| Mock after instantiation | Mock before service creation | DI pattern adoption | Correct mock usage |

**Deprecated/outdated:**
- Using `as any` in test code: Use proper mock typing instead
- Manual mock objects: Use jest-mock-extended's mock() for complex types

## Test Failure Categorization

Based on current test run analysis:

### Category 1: Type Access Errors (High Priority)
**Files affected:** TaskContextGenerationService.test.ts
**Count:** ~25 assertions
**Fix:** Update `result.X` to `result.context.X`

### Category 2: test.skip() Syntax Errors
**Files affected:** github-project-tools.e2e.ts (lines 217, 271, 324)
**Count:** 3-5 tests
**Fix:** Replace `test.skip('message')` with early return or proper skip

### Category 3: E2E Credential Failures
**Files affected:** All E2E tests in tools/
**Count:** ~30 tests
**Fix:** Add proper skip guards or use conditional describe.skip

### Category 4: Logger Pattern False Positive
**Files affected:** stdio-transport.e2e.ts line 319
**Count:** 1 test
**Fix:** Use more specific log pattern regex

### Category 5: AI Mock Issues
**Files affected:** ai-services/*.test.ts
**Count:** ~5 tests
**Fix:** Ensure generateObject mock returns correct structure

## Coverage Strategy

To achieve 80%+ overall coverage and 90%+ on ContextualReferenceGenerator:

1. **Fix existing tests first** - Get from 44 failing to 0 failing
2. **Add missing context generator tests:**
   - ContextualReferenceGenerator.test.ts (target 90%+)
   - DependencyContextGenerator.test.ts (target 80%+)
   - ContextQualityValidator.test.ts (target 80%+)
3. **Cover all fallback paths** - Mock AI unavailable, test fallback behavior
4. **Test edge cases:**
   - Empty PRD
   - Missing features array
   - Null/undefined inputs
   - AI service errors

## Open Questions

Things that couldn't be fully resolved:

1. **Test count discrepancy**
   - What we know: Roadmap says 74 failing, current run shows 44
   - What's unclear: Were some fixed in Phases 1-3?
   - Recommendation: Update roadmap with current count

2. **E2E test credential handling**
   - What we know: Tests fail with bad credentials
   - What's unclear: Should E2E run at all in CI without credentials?
   - Recommendation: Use describe.skip pattern for credential-gated suites

3. **Current coverage percentage**
   - What we know: Coverage command runs but output truncated
   - What's unclear: Actual current percentage
   - Recommendation: Run coverage with --coverageReporters=text-summary in isolation

## Sources

### Primary (HIGH confidence)
- Codebase analysis: src/__tests__/**/*.ts - Direct file reading
- Jest configuration: jest.config.cjs - Verified current setup
- Existing tests: SubIssueService.test.ts, TaskGenerationService.test.ts - Working patterns

### Secondary (MEDIUM confidence)
- Test run output: npm test 2>&1 - Current failure analysis
- Type errors in output - Specific line numbers identified

### Tertiary (LOW confidence)
- Coverage percentage - Needs re-verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages already in package.json
- Architecture patterns: HIGH - Copied from working tests in codebase
- Pitfalls: HIGH - Directly observed in test failures
- Coverage strategy: MEDIUM - Based on PRD requirements, not measured current state

**Research date:** 2026-01-31
**Valid until:** 2026-02-14 (stable domain, patterns won't change)
