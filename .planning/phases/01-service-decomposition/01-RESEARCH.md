# Phase 1: Service Decomposition - Research

**Researched:** 2026-01-30
**Domain:** TypeScript Service Architecture, God Class Refactoring
**Confidence:** HIGH

## Summary

ProjectManagementService (3,291 lines) contains methods spanning six distinct domains that need extraction: SubIssues, ProjectStatus, ProjectTemplates, ProjectLinking, SprintPlanning, and Milestones. The codebase already has established patterns for service decomposition via tsyringe DI, Repository pattern for GitHub API access, and BaseGitHubRepository for shared infrastructure.

Analysis reveals clear method clustering by domain with minimal cross-domain dependencies. The service uses GitHubRepositoryFactory for repository instantiation and mapErrorToMCPError for consistent error handling - both patterns that extracted services should follow. The existing ProjectAutomationService demonstrates the target pattern: @injectable() decorator, constructor injection, and focused single-responsibility.

**Primary recommendation:** Extract services in dependency order (SubIssue first, Milestone second) to minimize churn, with each service receiving its own repository access via factory injection rather than sharing the parent service's factory.

## Current Service Analysis

### Method Inventory by Domain

**MilestoneService (DEBT-06)** - Lines 464-572, 2537-2586
| Method | Lines | Purpose | Dependencies |
|--------|-------|---------|--------------|
| `getMilestoneMetrics` | 464-508 | Calculate completion metrics | issueRepo, milestoneRepo |
| `getOverdueMilestones` | 510-538 | Find overdue milestones | milestoneRepo, getMilestoneMetrics |
| `getUpcomingMilestones` | 540-572 | Find upcoming milestones | milestoneRepo, getMilestoneMetrics |
| `createMilestone` | 621-637 | Create new milestone | milestoneRepo |
| `listMilestones` | 639-682 | List with filtering/sorting | milestoneRepo |
| `updateMilestone` | 2538-2571 | Update milestone | milestoneRepo |
| `deleteMilestone` | 2573-2586 | Delete milestone | milestoneRepo |

**SprintPlanningService (DEBT-05)** - Lines 262-462, 944-1024
| Method | Lines | Purpose | Dependencies |
|--------|-------|---------|--------------|
| `planSprint` | 262-305 | Create sprint with issues | sprintRepo, issueRepo |
| `findSprints` | 307-313 | Find sprints by filter | sprintRepo |
| `updateSprint` | 315-362 | Update sprint | sprintRepo |
| `addIssuesToSprint` | 364-391 | Add issues to sprint | sprintRepo |
| `removeIssuesFromSprint` | 393-420 | Remove issues from sprint | sprintRepo |
| `getSprintMetrics` | 422-462 | Calculate sprint metrics | sprintRepo, issueRepo |
| `createSprint` | 945-967 | Create sprint (duplicate?) | sprintRepo |
| `listSprints` | 969-997 | List sprints | sprintRepo |
| `getCurrentSprint` | 999-1024 | Get active sprint | sprintRepo |

**ProjectStatusService (DEBT-02)** - Lines 574-618, 1026-1074
| Method | Lines | Purpose | Dependencies |
|--------|-------|---------|--------------|
| `createProject` | 575-592 | Create project | projectRepo |
| `listProjects` | 594-610 | List projects | projectRepo |
| `getProject` | 612-618 | Get single project | projectRepo |
| `updateProject` | 1027-1060 | Update project | projectRepo |
| `deleteProject` | 1062-1074 | Delete project | projectRepo |

**ProjectLinkingService (DEBT-04)** - Lines 1194-1375, 1732-1872
| Method | Lines | Purpose | Dependencies |
|--------|-------|---------|--------------|
| `addProjectItem` | 1195-1258 | Add issue/PR to project | factory.graphql |
| `removeProjectItem` | 1260-1293 | Remove item from project | factory.graphql |
| `archiveProjectItem` | 1295-1334 | Archive project item | factory.graphql |
| `unarchiveProjectItem` | 1336-1375 | Unarchive item | factory.graphql |
| `listProjectItems` | 1732-1872 | List project items | factory.graphql |

**ProjectTemplateService (DEBT-03)** - Lines 1076-1192, 2388-2535
| Method | Lines | Purpose | Dependencies |
|--------|-------|---------|--------------|
| `getProjectReadme` | 1077-1107 | Get project README | factory.graphql |
| `updateProjectReadme` | 1109-1148 | Update README | factory.graphql |
| `listProjectFields` | 1150-1162 | List custom fields | projectRepo |
| `updateProjectField` | 1164-1192 | Update field config | projectRepo |
| `createProjectView` | 2389-2403 | Create view | projectRepo |
| `listProjectViews` | 2405-2457 | List views | factory.graphql |
| `updateProjectView` | 2459-2519 | Update view | factory.graphql |
| `deleteProjectView` | 2521-2535 | Delete view | projectRepo |

**SubIssueService (DEBT-01)** - Lines 2684-2795
| Method | Lines | Purpose | Dependencies |
|--------|-------|---------|--------------|
| `updateIssueStatus` | 2685-2696 | Update issue status | issueRepo |
| `addIssueDependency` | 2698-2721 | Add dependency via labels | issueRepo |
| `getIssueDependencies` | 2723-2742 | Get dependencies from labels | issueRepo |
| `assignIssueToMilestone` | 2744-2760 | Assign to milestone | issueRepo, milestoneRepo |
| `getIssueHistory` | 2762-2795 | Get issue history (stub) | issueRepo |

### Shared Infrastructure Used by All

| Component | Source | Used For |
|-----------|--------|----------|
| `GitHubRepositoryFactory` | Constructor | Creates all repositories |
| `mapErrorToMCPError` | Private method | Error handling |
| `issueRepo` | factory getter | Issue operations |
| `milestoneRepo` | factory getter | Milestone operations |
| `projectRepo` | factory getter | Project operations |
| `sprintRepo` | factory getter | Sprint operations |
| `factory.graphql` | Direct GraphQL | Complex mutations |

## Standard Stack

### Core Architecture Pattern
| Pattern | Implementation | Why Standard |
|---------|----------------|--------------|
| tsyringe DI | `@injectable()`, `@inject()` | Already established in ProjectAutomationService |
| Repository Pattern | Extend BaseGitHubRepository | All GitHub repositories follow this |
| Factory Injection | GitHubRepositoryFactory in constructor | Consistent with existing services |
| Facade Pattern | Thin coordinator delegating to services | Clean architecture for god class refactoring |

### Supporting Patterns
| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| Private getter for repos | `private get milestoneRepo()` | Lazy repository instantiation |
| Zod validation schemas | Define at top of service | Input validation per service |
| mapErrorToMCPError | Error transformation | Consistent error handling |

**Installation:** No new dependencies needed - tsyringe already in package.json.

## Architecture Patterns

### Recommended Service Structure
```
src/services/
├── ProjectManagementService.ts      # Facade - 500 lines max
├── SubIssueService.ts               # DEBT-01
├── ProjectStatusService.ts          # DEBT-02
├── ProjectTemplateService.ts        # DEBT-03
├── ProjectLinkingService.ts         # DEBT-04
├── SprintPlanningService.ts         # DEBT-05
└── MilestoneService.ts              # DEBT-06
```

### Pattern 1: Service with Factory Injection
**What:** Each service receives GitHubRepositoryFactory, creates its own repository instances
**When to use:** All extracted services
**Example:**
```typescript
// Source: ProjectAutomationService.ts pattern
import { injectable, inject } from "tsyringe";
import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { ResourceNotFoundError } from "../domain/errors";
import { ResourceType } from "../domain/resource-types";

@injectable()
export class MilestoneService {
  constructor(
    @inject("GitHubRepositoryFactory") private factory: GitHubRepositoryFactory
  ) {}

  private get milestoneRepo() {
    return this.factory.createMilestoneRepository();
  }

  private get issueRepo() {
    return this.factory.createIssueRepository();
  }

  private mapErrorToMCPError(error: unknown): Error {
    // Copy from ProjectManagementService - shared utility candidate
  }

  async getMilestoneMetrics(id: string, includeIssues: boolean = false): Promise<MilestoneMetrics> {
    try {
      // Implementation moved from ProjectManagementService
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }
}
```

### Pattern 2: Facade Service (Post-Extraction ProjectManagementService)
**What:** Thin coordinator that delegates to domain services
**When to use:** Final state of ProjectManagementService
**Example:**
```typescript
@injectable()
export class ProjectManagementService {
  constructor(
    @inject("GitHubRepositoryFactory") private factory: GitHubRepositoryFactory,
    @inject("MilestoneService") private milestoneService: MilestoneService,
    @inject("SprintPlanningService") private sprintService: SprintPlanningService,
    @inject("SubIssueService") private subIssueService: SubIssueService,
    @inject("ProjectStatusService") private projectStatusService: ProjectStatusService,
    @inject("ProjectTemplateService") private templateService: ProjectTemplateService,
    @inject("ProjectLinkingService") private linkingService: ProjectLinkingService
  ) {}

  // Delegate methods - no business logic
  async getMilestoneMetrics(id: string, includeIssues: boolean = false) {
    return this.milestoneService.getMilestoneMetrics(id, includeIssues);
  }

  // Keep only coordination methods that span domains
  async createRoadmap(data: CreateRoadmapData) {
    // This stays here - coordinates projects, milestones, and issues
  }
}
```

### Anti-Patterns to Avoid
- **Circular Dependencies:** Don't let MilestoneService depend on SprintPlanningService if Sprint depends on Milestone. Use events or pass data explicitly.
- **Shared Mutable State:** Each service instance should be stateless, getting fresh repos from factory
- **God Service Recreation:** Don't make extracted services too large. If SprintPlanningService exceeds 300 lines, consider further decomposition.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error mapping | Custom error transformation | Copy existing `mapErrorToMCPError` | Already handles all error types, MCP codes |
| GraphQL execution | Raw octokit.graphql | `factory.graphql()` or repo methods | Includes retry, error handling |
| Repository creation | `new GitHubMilestoneRepository()` | `factory.createMilestoneRepository()` | Proper config injection |
| Status conversion | Manual string to enum | `convertGitHubStatus()` from BaseGitHubRepository | Handles all cases |

**Key insight:** The codebase already has well-tested infrastructure. Extracted services should reuse `GitHubRepositoryFactory`, `BaseGitHubRepository` patterns, and copy the error handling from ProjectManagementService (or extract to shared utility).

## Common Pitfalls

### Pitfall 1: Breaking External Consumers
**What goes wrong:** Tool handlers in index.ts call `service.getMilestoneMetrics()`. If signature changes, all calls break.
**Why it happens:** Extracting methods without maintaining facade interface.
**How to avoid:** Keep all public method signatures on ProjectManagementService (the facade), delegating to extracted services.
**Warning signs:** Tests fail after extraction; TypeScript errors in index.ts.

### Pitfall 2: Repository Instance Duplication
**What goes wrong:** Each method call creates new repository instance, causing memory issues.
**Why it happens:** Using `this.factory.createXRepository()` directly in methods.
**How to avoid:** Use private getters that return the same repository per service instance (or memoize).
**Warning signs:** High memory usage, slow performance.

### Pitfall 3: Inconsistent Error Handling
**What goes wrong:** Some services throw raw errors, others wrap in DomainError.
**Why it happens:** Each service implements error handling differently.
**How to avoid:** Extract `mapErrorToMCPError` to shared utility or include in each service identically.
**Warning signs:** Different error formats in MCP responses.

### Pitfall 4: Test Duplication Drift
**What goes wrong:** Tests for extracted methods exist in both old and new test files.
**Why it happens:** Copying tests without removing originals.
**How to avoid:** Move tests during extraction, delete from original file immediately.
**Warning signs:** Same test assertions in multiple files.

### Pitfall 5: DI Container Not Updated
**What goes wrong:** `container.resolve()` fails at runtime.
**Why it happens:** New services not registered in tsyringe container.
**How to avoid:** Register services in entry point before resolving.
**Warning signs:** Runtime DI resolution errors.

## Recommended Extraction Order

Based on dependency analysis:

| Order | Service | Why This Order | Est. Lines |
|-------|---------|----------------|------------|
| 1 | SubIssueService | Minimal dependencies, simple methods | ~120 |
| 2 | MilestoneService | Self-contained milestone logic | ~200 |
| 3 | SprintPlanningService | Uses issueRepo, but not other services | ~250 |
| 4 | ProjectStatusService | Project CRUD, standalone | ~100 |
| 5 | ProjectTemplateService | Views and fields, uses GraphQL | ~200 |
| 6 | ProjectLinkingService | Project items, GraphQL heavy | ~200 |
| 7 | Facade Refactor | Wire up facade, remove duplicates | ~100 |

**Rationale:**
- Start with leaf services (no dependencies on other extracted services)
- SubIssue methods are simple and isolated
- Milestone is used by Roadmap coordination but not by other extracted services
- Sprint depends on Issue repository but not other services
- End with facade refactoring once all services exist

## Test Migration Strategy

### For Each Extracted Service

1. **Create new test file:** `src/__tests__/unit/services/[ServiceName].test.ts`
2. **Copy relevant test blocks** from `ProjectManagementService.test.ts`
3. **Update imports** to use new service
4. **Mock new dependencies** (factory injection, not getter overrides)
5. **Run tests** to verify extraction
6. **Delete tests from original file** after verification

### Test Structure Pattern
```typescript
// Source: Existing test patterns
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MilestoneService } from '../../../services/MilestoneService';
import { GitHubRepositoryFactory } from '../../../infrastructure/github/GitHubRepositoryFactory';

describe('MilestoneService', () => {
  let service: MilestoneService;
  let mockFactory: jest.Mocked<GitHubRepositoryFactory>;
  let mockMilestoneRepo: jest.Mocked<any>;
  let mockIssueRepo: jest.Mocked<any>;

  beforeEach(() => {
    mockMilestoneRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockIssueRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
    };

    mockFactory = {
      createMilestoneRepository: jest.fn().mockReturnValue(mockMilestoneRepo),
      createIssueRepository: jest.fn().mockReturnValue(mockIssueRepo),
    } as unknown as jest.Mocked<GitHubRepositoryFactory>;

    service = new MilestoneService(mockFactory);
  });

  describe('getMilestoneMetrics', () => {
    it('should calculate metrics correctly', async () => {
      // Test implementation
    });
  });
});
```

### Integration Test for Facade
```typescript
// Verify facade wiring works
describe('ProjectManagementService (Facade)', () => {
  it('should delegate getMilestoneMetrics to MilestoneService', async () => {
    const mockMilestoneService = { getMilestoneMetrics: jest.fn() };
    const facade = new ProjectManagementService(
      mockFactory,
      mockMilestoneService,
      // ... other services
    );

    await facade.getMilestoneMetrics('123');
    expect(mockMilestoneService.getMilestoneMetrics).toHaveBeenCalledWith('123', false);
  });
});
```

## Code Examples

### Extracted Service Template
```typescript
// Source: Pattern from ProjectAutomationService + ProjectManagementService
import { injectable, inject } from "tsyringe";
import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { GitHubMilestoneRepository } from "../infrastructure/github/repositories/GitHubMilestoneRepository";
import { GitHubIssueRepository } from "../infrastructure/github/repositories/GitHubIssueRepository";
import { ResourceStatus, ResourceType } from "../domain/resource-types";
import { Milestone, Issue } from "../domain/types";
import {
  DomainError,
  ResourceNotFoundError,
  ValidationError,
  RateLimitError,
  UnauthorizedError,
  GitHubAPIError
} from "../domain/errors";
import { MCPErrorCode } from "../domain/mcp-types";

export interface MilestoneMetrics {
  id: string;
  title: string;
  dueDate?: string | null;
  openIssues: number;
  closedIssues: number;
  totalIssues: number;
  completionPercentage: number;
  status: ResourceStatus;
  issues?: Issue[];
  isOverdue: boolean;
  daysRemaining?: number;
}

@injectable()
export class MilestoneService {
  constructor(
    @inject("GitHubRepositoryFactory") private factory: GitHubRepositoryFactory
  ) {}

  private get milestoneRepo(): GitHubMilestoneRepository {
    return this.factory.createMilestoneRepository();
  }

  private get issueRepo(): GitHubIssueRepository {
    return this.factory.createIssueRepository();
  }

  private mapErrorToMCPError(error: unknown): Error {
    if (error instanceof ValidationError) {
      return new DomainError(`${MCPErrorCode.VALIDATION_ERROR}: ${error.message}`);
    }
    if (error instanceof ResourceNotFoundError) {
      return new DomainError(`${MCPErrorCode.RESOURCE_NOT_FOUND}: ${error.message}`);
    }
    if (error instanceof RateLimitError) {
      return new DomainError(`${MCPErrorCode.RATE_LIMITED}: ${error.message}`);
    }
    if (error instanceof UnauthorizedError) {
      return new DomainError(`${MCPErrorCode.UNAUTHORIZED}: ${error.message}`);
    }
    if (error instanceof GitHubAPIError) {
      return new DomainError(`${MCPErrorCode.INTERNAL_ERROR}: GitHub API Error - ${error.message}`);
    }
    return new DomainError(`${MCPErrorCode.INTERNAL_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
  }

  async getMilestoneMetrics(id: string, includeIssues: boolean = false): Promise<MilestoneMetrics> {
    try {
      const milestone = await this.milestoneRepo.findById(id);
      if (!milestone) {
        throw new ResourceNotFoundError(ResourceType.MILESTONE, id);
      }

      const allIssues = await this.issueRepo.findAll();
      const issues = allIssues.filter(issue => issue.milestoneId === milestone.id);

      const totalIssues = issues.length;
      const closedIssues = issues.filter(
        issue => issue.status === ResourceStatus.CLOSED || issue.status === ResourceStatus.COMPLETED
      ).length;
      const openIssues = totalIssues - closedIssues;
      const completionPercentage = totalIssues > 0 ? Math.round((closedIssues / totalIssues) * 100) : 0;

      const now = new Date();
      let isOverdue = false;
      let daysRemaining: number | undefined = undefined;

      if (milestone.dueDate) {
        const dueDate = new Date(milestone.dueDate);
        isOverdue = now > dueDate;
        daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        id: milestone.id,
        title: milestone.title,
        dueDate: milestone.dueDate,
        openIssues,
        closedIssues,
        totalIssues,
        completionPercentage,
        status: milestone.status,
        issues: includeIssues ? issues : undefined,
        isOverdue,
        daysRemaining: daysRemaining && daysRemaining > 0 ? daysRemaining : undefined
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  // ... additional milestone methods
}
```

### DI Container Registration
```typescript
// Source: Entry point pattern
import { container } from "tsyringe";
import { GitHubRepositoryFactory } from "./infrastructure/github/GitHubRepositoryFactory";
import { MilestoneService } from "./services/MilestoneService";
import { SprintPlanningService } from "./services/SprintPlanningService";
// ... other imports

// Register factory
const factory = new GitHubRepositoryFactory(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO);
container.registerInstance("GitHubRepositoryFactory", factory);

// Register services (order doesn't matter for non-circular deps)
container.register("MilestoneService", { useClass: MilestoneService });
container.register("SprintPlanningService", { useClass: SprintPlanningService });
// ... other services

// Resolve facade
const service = container.resolve(ProjectManagementService);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual instantiation | tsyringe DI | Already in codebase | Use decorators |
| Getter-based repos | Factory injection | Already in codebase | Cleaner testing |
| Monolithic service | Domain-focused services | This phase | Better testability |

**Deprecated/outdated:**
- Direct repository instantiation without factory (use GitHubRepositoryFactory)
- Passing services to services (use DI container)

## Open Questions

1. **Error handling extraction**
   - What we know: `mapErrorToMCPError` is duplicated in pattern
   - What's unclear: Should it be a shared utility or per-service method?
   - Recommendation: Extract to shared utility after first service works

2. **DI container location**
   - What we know: tsyringe used, but container setup not centralized
   - What's unclear: Where should container registration live?
   - Recommendation: Add `src/container.ts` for all registrations, import in index.ts

3. **Duplicate methods (createSprint vs planSprint)**
   - What we know: Both exist with overlapping functionality
   - What's unclear: Which is the canonical method?
   - Recommendation: Consolidate during SprintPlanningService extraction

## Sources

### Primary (HIGH confidence)
- `src/services/ProjectManagementService.ts` - Analyzed full 3,291 lines
- `src/services/ProjectAutomationService.ts` - DI pattern reference
- `src/infrastructure/github/repositories/BaseGitHubRepository.ts` - Base patterns
- `src/infrastructure/github/GitHubRepositoryFactory.ts` - Factory pattern
- `.planning/codebase/ARCHITECTURE.md` - Architecture decisions
- `.planning/codebase/CONVENTIONS.md` - Coding standards

### Secondary (MEDIUM confidence)
- `src/__tests__/unit/services/ProjectManagementService.test.ts` - Test patterns
- `.planning/codebase/TESTING.md` - Test strategy

### Tertiary (LOW confidence)
- None - all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified against existing codebase patterns
- Architecture: HIGH - Follows established patterns in ProjectAutomationService
- Pitfalls: HIGH - Based on actual code analysis
- Method groupings: HIGH - Verified line-by-line in source

**Research date:** 2026-01-30
**Valid until:** 2026-03-01 (patterns stable, no external dependencies changing)
