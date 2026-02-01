# Architecture Review: MCP GitHub Project Manager
Created: 2025-02-01
Author: architect-agent

## Executive Summary

The MCP GitHub Project Manager follows a Clean Architecture approach with domain, services, and infrastructure layers. The codebase has undergone service decomposition (ProjectManagementService -> 6 extracted services) and uses tsyringe for DI. However, several architectural issues exist that impact maintainability, testability, and adherence to Clean Architecture principles.

**Overall Architecture Health: MODERATE (6/10)**

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MCP Server (index.ts)                          │
│    - 1176 lines, giant switch statement for 119 tools                       │
│    - Mixed execution patterns (direct service calls vs standalone execute*) │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
        ┌───────────────────┐ ┌──────────────┐ ┌──────────────────────┐
        │  ToolRegistry     │ │ ToolSchemas  │ │ execute* functions   │
        │  (Singleton)      │ │ (2871 lines) │ │ (scattered in tools/)│
        └───────────────────┘ └──────────────┘ └──────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Services Layer                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ ProjectManagementService (FACADE - 1691 lines)                         │ │
│  │  - God class with 50+ methods                                          │ │
│  │  - Delegates to 6 extracted services                                   │ │
│  │  - Still contains direct implementations                               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐    │
│  │SubIssueService│ │MilestoneService│ │SprintPlanningService│ │ProjectStatusService││
│  │  (242 lines)  │ │  (356 lines) │ │  (460 lines) │ │  (184 lines)  │    │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────────┘    │
│  ┌──────────────────┐ ┌──────────────────┐                                  │
│  │ProjectTemplateService│ │ProjectLinkingService│                            │
│  │    (326 lines)    │ │   (380 lines)   │                                  │
│  └──────────────────┘ └──────────────────┘                                  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ AI Services (Standalone - NOT wired through DI)                         ││
│  │  FeatureManagementService, TaskGenerationService, AIServiceFactory...   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Infrastructure Layer                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ GitHubRepositoryFactory (Root of DI tree)                              │ │
│  │  - Creates repository instances                                        │ │
│  │  - Configured with owner/repo/token                                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ GitHub Repositories (BaseGitHubRepository)                           │   │
│  │  GitHubIssueRepository, GitHubProjectRepository, etc.                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ Singletons: ResourceCache, ToolRegistry, AIServiceFactory, Logger    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Domain Layer                                      │
│  types.ts, errors.ts, resource-types.ts, mcp-types.ts                       │
│  ✓ No infrastructure imports (VERIFIED)                                     │
│  ✓ No service imports (VERIFIED)                                            │
│  ✓ Repository interfaces defined here (IssueRepository, etc.)              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Issues by Category

### 1. Layer Violations (PRIORITY: HIGH)

#### 1.1 Services Depend Directly on Infrastructure Implementations

**Location:** All services in `src/services/`

**Evidence (VERIFIED):**
```typescript
// src/services/SubIssueService.ts:1-3
import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { GitHubIssueRepository } from "../infrastructure/github/repositories/GitHubIssueRepository";
import { GitHubMilestoneRepository } from "../infrastructure/github/repositories/GitHubMilestoneRepository";

// src/services/ProjectManagementService.ts:22-26
import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { GitHubIssueRepository } from "../infrastructure/github/repositories/GitHubIssueRepository";
import { GitHubMilestoneRepository } from "../infrastructure/github/repositories/GitHubMilestoneRepository";
import { GitHubProjectRepository } from "../infrastructure/github/repositories/GitHubProjectRepository";
import { GitHubSprintRepository } from "../infrastructure/github/repositories/GitHubSprintRepository";
```

**Impact:**
- Services are tightly coupled to GitHub implementation
- Cannot swap infrastructure (e.g., mock for testing, different provider)
- Violates Dependency Inversion Principle

**Recommended Fix:**
- Services should depend on interfaces (`IssueRepository`, `MilestoneRepository`) defined in domain
- Domain already has these interfaces (VERIFIED in `src/domain/types.ts:55-131`)
- Use DI to inject implementations

---

#### 1.2 Domain Layer Clean (VERIFIED GOOD)

**Finding:** The domain layer correctly has no imports from services or infrastructure.

```bash
# Grep results for domain importing from infrastructure/services:
# No matches found - CLEAN
```

---

### 2. Service Design Issues (PRIORITY: HIGH)

#### 2.1 ProjectManagementService is Still a God Class

**Location:** `/Users/vivek/jet/mcp-github-project-manager/src/services/ProjectManagementService.ts`

**Metrics:**
- **1691 lines** (largest service file)
- **50+ methods** (excessive responsibility)
- Contains both delegation AND direct implementation

**Evidence (VERIFIED):**
```typescript
// Lines 399-469: createRoadmap - direct implementation in facade
// Lines 471-500: createIssue - direct implementation
// Lines 502-570: listIssues, getIssue, updateIssue - direct implementations
// Lines 1100+: automation rules, iterations, labels - all direct
```

**Service Decomposition Status:**
| Extracted Service | Lines | Status |
|------------------|-------|--------|
| SubIssueService | 242 | DONE |
| MilestoneService | 356 | DONE |
| SprintPlanningService | 460 | DONE |
| ProjectStatusService | 184 | DONE |
| ProjectTemplateService | 326 | DONE |
| ProjectLinkingService | 380 | DONE |
| **IssueService** | - | MISSING |
| **AutomationRuleService** | - | MISSING |
| **IterationService** | - | MISSING |
| **LabelService** | - | MISSING |
| **PullRequestService** | - | MISSING |
| **DraftIssueService** | - | MISSING |

**Impact:**
- Hard to test individual features
- High cognitive load for maintenance
- Changes risk breaking unrelated functionality

---

#### 2.2 Duplicated Error Mapping Logic

**Location:** Every service has identical `mapErrorToMCPError` method

**Evidence (VERIFIED):** Found in 7 services:
- `ProjectManagementService.ts:177`
- `SubIssueService.ts:63`
- `MilestoneService.ts:59`
- `SprintPlanningService.ts:85`
- `ProjectStatusService.ts:39`
- `ProjectTemplateService.ts:35`
- `ProjectLinkingService.ts:31`

**Each service has ~20 lines of identical code:**
```typescript
private mapErrorToMCPError(error: unknown): Error {
  if (error instanceof ValidationError) {
    return new DomainError(`${MCPErrorCode.VALIDATION_ERROR}: ${error.message}`);
  }
  if (error instanceof ResourceNotFoundError) {
    return new DomainError(`${MCPErrorCode.RESOURCE_NOT_FOUND}: ${error.message}`);
  }
  // ... same pattern repeated
}
```

**Impact:**
- ~140 lines of duplicated code
- Error handling inconsistencies risk
- Maintenance burden

**Recommended Fix:**
Create shared `ErrorMapper` utility:
```typescript
// src/services/utils/ErrorMapper.ts
export function mapErrorToMCPError(error: unknown): Error {
  // centralized error mapping
}
```

---

### 3. MCP Tool Organization Issues (PRIORITY: MEDIUM)

#### 3.1 Giant Switch Statement in index.ts

**Location:** `/Users/vivek/jet/mcp-github-project-manager/src/index.ts:348-694`

**Metrics:**
- **346 lines** of switch cases
- **119 tools** with inconsistent execution patterns

**Execution Pattern Inconsistency:**
```typescript
// Pattern A: Via service facade (ProjectManagementService)
case "create_project":
  return await this.service.createProject(args);

// Pattern B: Via standalone execute* functions
case "add_sub_issue":
  return await executeAddSubIssue(args);

// Pattern C: Via local handler methods
case "generate_roadmap":
  return await this.handleGenerateRoadmap(args);
```

**Impact:**
- No single pattern for tool execution
- Hard to trace tool -> implementation
- Cognitive overhead when adding new tools

---

#### 3.2 ToolSchemas.ts is Too Large

**Location:** `/Users/vivek/jet/mcp-github-project-manager/src/infrastructure/tools/ToolSchemas.ts`

**Metrics:**
- **2871 lines** - single file with all schemas
- Mixed concerns: schemas, tool definitions, AND execute functions

**Evidence (VERIFIED):**
```typescript
// Lines 1-97: Import statements and createRoadmapSchema
// Lines 100-200: More schemas (planSprintSchema, etc.)
// Tool definitions scattered throughout
// Execute functions exported (executeAddFeature, executeGeneratePRD, etc.)
```

**Impact:**
- Difficult to navigate
- Changes affect entire file
- High risk of merge conflicts

**Recommended Organization:**
```
src/infrastructure/tools/
├── schemas/
│   ├── project-schemas.ts      ✓ EXISTS
│   ├── milestone-schemas.ts    MISSING
│   ├── sprint-schemas.ts       MISSING
│   ├── issue-schemas.ts        MISSING
│   └── ai-schemas.ts           ✓ EXISTS
├── definitions/
│   ├── project-tools.ts
│   ├── sprint-tools.ts
│   └── ai-tools.ts
└── ToolRegistry.ts             ✓ EXISTS
```

---

### 4. DI Container Issues (PRIORITY: MEDIUM)

#### 4.1 Inconsistent Registration Patterns

**Location:** `/Users/vivek/jet/mcp-github-project-manager/src/container.ts`

**Evidence (VERIFIED):**
```typescript
// Pattern A: useFactory (manual wiring)
container.register("SubIssueService", {
  useFactory: (c) => new SubIssueService(c.resolve("GitHubRepositoryFactory"))
});

// Pattern B: useClass (decorator-based)
container.register("SprintPlanningService", { useClass: SprintPlanningService });
container.register("ProjectStatusService", { useClass: ProjectStatusService });
```

**Why Two Patterns:**
- SprintPlanningService uses `@injectable()` and `@inject()` decorators
- SubIssueService does not use decorators

**Impact:**
- Inconsistent service authoring
- Confusion about which pattern to use
- Some services can be tested with mocks, others cannot

---

#### 4.2 Many Services Not Registered

**Services Missing from DI:**
- AIServiceFactory (uses singleton pattern instead)
- RoadmapPlanningService
- IssueEnrichmentService
- IssueTriagingService
- FeatureManagementService
- TaskGenerationService
- All AI services in `src/services/ai/`

**Evidence:** These are instantiated directly in index.ts:
```typescript
// src/index.ts:143-150
this.aiFactory = AIServiceFactory.getInstance();
this.roadmapService = new RoadmapPlanningService(this.aiFactory, this.service);
this.enrichmentService = new IssueEnrichmentService(this.aiFactory, this.service);
this.triagingService = new IssueTriagingService(
  this.aiFactory,
  this.service,
  this.enrichmentService
);
```

**Impact:**
- Can't inject mocks for testing
- Can't control service lifecycles
- Inconsistent construction patterns

---

#### 4.3 Excessive Singleton Usage

**Singletons Found (11 total):**
| Class | Location |
|-------|----------|
| Logger | `infrastructure/logger/index.ts:93` |
| ResourceCache | `infrastructure/cache/ResourceCache.ts:51` |
| ToolRegistry | `infrastructure/tools/ToolRegistry.ts:221` |
| AIServiceFactory | `services/ai/AIServiceFactory.ts:60` |
| ResourceFactory | `infrastructure/resource/ResourceFactory.ts:25` |
| OptimisticLockManager | `infrastructure/resource/OptimisticLockManager.ts:15` |
| GitHubApiUtil | `infrastructure/github/util/GitHubApiUtil.ts:26` |

**Issues with Singletons:**
- Testing difficulty (global state)
- Hidden dependencies
- Order of initialization can be problematic
- Comments in tests mention "singleton pattern issues"

---

### 5. Configuration Management Issues (PRIORITY: LOW)

#### 5.1 Configuration Spread (VERIFIED GOOD)

**Location:** `/Users/vivek/jet/mcp-github-project-manager/src/env.ts`

**Positive Finding:** Configuration is centralized in env.ts with:
- Required values (throw if missing)
- Optional values with defaults
- Boolean and numeric helpers
- CLI argument support

**Minor Issues:**
- No schema validation (e.g., AI_MAIN_MODEL should validate against known models)
- No configuration grouping/namespacing

---

## Recommendations (Prioritized)

### Phase 1: Critical Fixes (Week 1-2)

#### 1.1 Extract Shared Error Mapping
```typescript
// src/services/utils/ErrorMapper.ts
export class ErrorMapper {
  static toMCPError(error: unknown): Error {
    // centralized logic
  }
}
```
**Effort:** 2-4 hours
**Impact:** Removes ~140 lines duplication

---

#### 1.2 Extract Remaining Services from ProjectManagementService

Create these services:
- `IssueService` (create, list, get, update issue methods)
- `AutomationRuleService` (automation rule CRUD)
- `IterationService` (iteration management)
- `LabelService` (label operations)
- `PullRequestService` (PR operations)
- `DraftIssueService` (draft issue operations)

**Effort:** 2-3 days
**Impact:** Reduces ProjectManagementService to ~300 lines

---

### Phase 2: Architecture Improvements (Week 3-4)

#### 2.1 Introduce Domain Interfaces for Infrastructure

```typescript
// Use existing domain interfaces
// src/domain/types.ts already has:
export interface IssueRepository { ... }
export interface MilestoneRepository { ... }
export interface SprintRepository { ... }

// Services should import from domain, not infrastructure
import { IssueRepository } from "../domain/types";
```

**Effort:** 2-3 days
**Impact:** Proper dependency inversion

---

#### 2.2 Standardize DI Registration

Choose one pattern for all services:
```typescript
// Option A: All use decorators
@injectable()
export class SubIssueService {
  constructor(@inject("IssueRepository") private issueRepo: IssueRepository) {}
}

// Option B: All use factory registration (current for some)
container.register("SubIssueService", {
  useFactory: (c) => new SubIssueService(c.resolve("IssueRepository"))
});
```

**Effort:** 1-2 days
**Impact:** Consistent service pattern

---

### Phase 3: Tool Organization (Week 5-6)

#### 3.1 Split ToolSchemas.ts

Organize by domain:
```
schemas/
├── project-schemas.ts
├── milestone-schemas.ts
├── sprint-schemas.ts
├── issue-schemas.ts
├── pr-schemas.ts
└── ai-schemas.ts
```

**Effort:** 1 day
**Impact:** Better navigation and maintenance

---

#### 3.2 Create Tool Execution Registry

Replace switch statement with registry:
```typescript
// src/infrastructure/tools/ToolExecutor.ts
class ToolExecutor {
  private executors = new Map<string, ToolHandler>();
  
  register(name: string, handler: ToolHandler) {
    this.executors.set(name, handler);
  }
  
  execute(name: string, args: unknown) {
    return this.executors.get(name)!(args);
  }
}
```

**Effort:** 2-3 days
**Impact:** Eliminates 346-line switch statement

---

## Success Criteria

1. **ProjectManagementService** reduced to < 500 lines
2. **No duplicated error mapping** - single utility used everywhere
3. **Services depend on domain interfaces**, not infrastructure implementations
4. **All services registered in DI container** with consistent pattern
5. **ToolSchemas.ts split** into domain-specific files
6. **Switch statement eliminated** via tool execution registry

---

## Open Questions

- [ ] Should AI services be migrated to DI or keep singleton pattern?
- [ ] Should tool execution functions be class methods or standalone?
- [ ] Is tsyringe the right DI library, or should we consider alternatives?

---

## Appendix: File Sizes

| File | Lines | Status |
|------|-------|--------|
| ToolSchemas.ts | 2871 | TOO LARGE |
| ProjectManagementService.ts | 1691 | TOO LARGE |
| index.ts | 1176 | LARGE |
| TaskGenerationService.ts | 832 | ACCEPTABLE |
| FeatureManagementService.ts | 637 | ACCEPTABLE |
| TaskContextGenerationService.ts | 524 | ACCEPTABLE |
| RequirementsTraceabilityService.ts | 481 | ACCEPTABLE |
| SprintPlanningService.ts | 460 | ACCEPTABLE |
