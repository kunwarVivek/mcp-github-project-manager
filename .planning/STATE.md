# State: MCP GitHub Project Manager

**Project:** MCP GitHub Project Manager
**Core Value:** Comprehensive AI-enabled GitHub-based project management from 0-100

## Current Position

**Phase:** 7 of 12 (Project Templates and Linking)
**Plan:** 1 of 4 complete
**Status:** In progress
**Last activity:** 2026-01-31 - Completed 07-01-PLAN.md (Schema Definitions)

**Progress:** [██████████░░] 77% (Phase 1-6 complete, Phase 7 in progress)

## Project Progress

| Metric | Value |
|--------|-------|
| Phases Complete | 6/12 |
| Requirements Done | 53/99 |
| Current Phase Progress | Phase 7: 1/4 plans complete |

## Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Plans Executed | 32 | Phase 1-4 complete (22), Phase 5 complete (5), Phase 6 complete (4), Phase 7: 1/4 |
| Requirements Completed | 53 | DEBT-01 through DEBT-28, MCP-01 through MCP-15, GHAPI-01 to GHAPI-08 |
| Iterations | 1 | Gap closure cycle for test regressions |
| Blockers Resolved | 4 | tsyringe decorators, reflect-metadata, MCP SDK type instantiation, test isolation |

## Accumulated Context

### Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| 12-phase roadmap | Comprehensive depth setting, requirements naturally cluster into 12 delivery boundaries | 2026-01-30 |
| Tech debt first | Service decomposition enables cleaner work in subsequent phases | 2026-01-30 |
| MCP upgrade phase 2 | Foundational protocol compliance before feature development | 2026-01-30 |
| No tsyringe decorators | Matches existing pattern, avoids reflect-metadata in tests | 2026-01-30 |
| Factory injection pattern | Services receive GitHubRepositoryFactory in constructor for flexibility | 2026-01-30 |
| useFactory for non-decorated | SubIssue, Milestone, Template, Linking use plain constructors | 2026-01-30 |
| Helper for backward compat | createProjectManagementService() provides simple 3-arg API | 2026-01-30 |
| Partial facade reduction | 48% reduction (1691 lines); full 500 requires more extractions | 2026-01-30 |
| Direct mock injection for tests | Create mock factory BEFORE service instantiation; pass mockService directly | 2026-01-30 |
| Type assertion for SDK generics | MCP SDK 1.25+ has deep type issues; use `as any` with explicit types | 2026-01-30 |
| CallToolResult content format | SDK 1.25+ requires { content: [...] } not { output, tools, _meta } | 2026-01-30 |
| TOutput generic defaults to unknown | Backward compatibility for existing ToolDefinition<T> usages | 2026-01-30 |
| Mark deprecated vs remove | Keep old schema methods deprecated rather than removing | 2026-01-30 |
| $refStrategy: none | Inline JSON Schema definitions for simpler MCP client consumption | 2026-01-30 |
| Output schemas per tool | Comprehensive Zod schemas for type-safe output validation | 2026-01-30 |
| 84 tools annotated | 6 behavior patterns applied consistently across all tools | 2026-01-31 |
| Consolidated schemas | Issue/PR schemas in project-schemas.ts rather than separate files | 2026-01-30 |
| structuredContent for objects | Only include structuredContent for object results, not primitives | 2026-01-31 |
| Tool registration logging | Log MCP compliance metrics on startup for debugging | 2026-01-31 |
| Zod instanceof checks | Use instanceof ZodOptional/ZodString etc. instead of _def.typeName | 2026-01-31 |
| Helper type guards | Create hasErrorsArray, isErrorWithMessage for complex narrowing | 2026-01-31 |
| MockPRD interface | Define minimal interface for mock PRD objects in tools | 2026-01-31 |
| Union types for dependencies | TaskDependency[] | EnhancedTaskDependency[] for flexibility | 2026-01-31 |
| TaskPhaseStatus type guard | Runtime validation with isTaskPhaseStatus() | 2026-01-31 |
| SDK workaround documented | Comprehensive JSDoc for MCP SDK TS2589 limitation | 2026-01-31 |
| as any audit classification | documented exception vs out-of-scope vs unexpected | 2026-01-31 |
| Credential guard pattern | if (!utils) { console.log('Skipping...'); return; } | 2026-01-31 |
| Real credential detection | hasRealCredentials() to detect fake test tokens | 2026-01-31 |
| AI service mocking pattern | Mock AIServiceFactory and 'ai' package; set up before service instantiation | 2026-01-31 |
| Fallback-first testing | Use fallback mode for most edge case tests; more deterministic | 2026-01-31 |
| Test helper pattern | Create comprehensive helpers for complex nested test data | 2026-01-31 |
| Keyword overlap validation | Ensure test data has keyword overlap to pass relevance validation | 2026-01-31 |
| Cockatiel for circuit breaker | TypeScript-first, composable policies, cleaner API than opossum | 2026-01-31 |
| AsyncLocalStorage for tracing | Native Node.js solution, no external dependency for correlation IDs | 2026-01-31 |
| Atomic file writes | Write to .tmp file then rename to prevent corruption on crash | 2026-01-31 |
| Composed resilience policy order | fallback(retry(circuitBreaker(timeout(op)))) - outer to inner | 2026-01-31 |
| Cooperative timeout strategy | Graceful cancellation vs aggressive abort | 2026-01-31 |
| Opt-in cache persistence | enablePersistence() call required; does not change existing behavior | 2026-01-31 |
| GitHub health check placeholder | Structure in place, wiring to GitHubRepositoryFactory deferred | 2026-01-31 |
| Opt-in AI resilience | enableResilience() required before executeWithResilience() works | 2026-01-31 |
| health_check tool readOnlyHint=true | Safe to call repeatedly, no external calls (placeholder) | 2026-01-31 |
| 9 tool categories | Organize 85 tools logically (Project, Issue, PR, Sprint, Field, Automation, Events, AI, Health) | 2026-01-31 |
| API doc scope | Focus on public APIs, not internal implementation | 2026-01-31 |
| Mock factory pattern for tests | Create typed mocks for HealthService testing to avoid complex dependency setup | 2026-01-31 |
| Temp directory pattern | fs.mkdtempSync/fs.rm for CachePersistence tests to avoid polluting workspace | 2026-01-31 |
| stderr spy pattern | jest.spyOn(process.stderr, 'write').mockImplementation(() => true) for clean test output | 2026-01-31 |
| graphqlWithFeatures method | Add to BaseGitHubRepository for preview header injection (sub_issues) | 2026-01-31 |
| Node ID resolution helper | Add resolveIssueNodeId() to convert issue numbers to node IDs | 2026-01-31 |
| Sub-issues feature constant | Use static readonly SUB_ISSUES_FEATURE = ['sub_issues'] | 2026-01-31 |
| createRepositoryFactory helper | Status update tools use standalone factory; owner/repo are placeholders | 2026-01-31 |
| Standalone executor pattern for status tools | Follow AI task tool pattern for consistency | 2026-01-31 |
| GitHubConfig.create() for tests | Use factory method instead of object literal due to private fields | 2026-01-31 |
| Zod safeParse vs parse | safeParse doesn't apply defaults for optional fields; use .parse() in executors | 2026-01-31 |
| 11 tool categories | Added Sub-issue (5) and Status Update (3) tool categories for 93 total | 2026-01-31 |
| Reuse PageInfo schema pattern | PageInfo schema matches status-update-schemas for consistency | 2026-01-31 |
| TemplateListItem extends output | TemplateListItemSchema extends TemplateProjectOutputSchema for list results | 2026-01-31 |
| LinkOperationOutput for all ops | Single schema for all link/unlink success responses | 2026-01-31 |
| nullable() for optional strings | Use z.string().nullable() for optional fields that can be null from GraphQL | 2026-01-31 |

### Learnings

- Services should follow ProjectManagementService pattern: plain constructor injection with factory parameter
- Direct `factory.graphql()` calls appropriate for complex GraphQL mutations not exposed via repositories
- Test mocking simpler without DI container setup
- Leaf services (SubIssue, Milestone) can be extracted in parallel with no inter-dependencies
- useFactory pattern needed for services without @injectable decorator
- reflect-metadata required for tsyringe DI to work properly
- For unit tests: create mock factory with graphql method BEFORE service instantiation
- For mocked classes: pass mockService directly instead of calling `new MockedClass()`
- MCP SDK 1.25+ has "Type instantiation is excessively deep" errors with complex schemas
- Use type assertion `(server.setRequestHandler as any)` with explicit CallToolRequest/CallToolResult types
- CallToolResult format: `{ content: [{ type: 'text', text: string }], structuredContent?: {...} }`
- Zod exports class constructors that work with instanceof (ZodOptional, ZodString, etc.)
- Helper type guards improve readability and enable proper type narrowing without `as any`
- MockPRD interface allows tools to create typed mock objects without full PRDDocument
- Union types (BaseType | ExtendedType) provide flexibility when a function can accept either
- Type guards that narrow types also serve as runtime validators for external input
- E2E tests need credential guards to skip gracefully when credentials are missing
- createTestSuite must always register tests (skip inside) to avoid "no tests" Jest error
- AI service mocking: mock factory BEFORE service instantiation; mock 'ai' package's generateObject
- Fallback path testing is more deterministic than AI path testing (no mock response shaping needed)
- For 100% branch coverage, test edge cases like missing IDs, non-Error thrown objects
- Validation tests: ensure test data has keyword overlap with task for relevance validation to pass
- Completeness score: all 4 optional fields needed for 100% (including dependencyContext)
- jest.resetAllMocks() needed in addition to clearAllMocks() for proper test isolation
- Fallback behavior testing: verify fallback provides useful defaults, not null returns
- CircuitBreakerService: wrap Cockatiel with state tracking and stderr logging
- CorrelationContext: startTrace() wraps operations with correlation ID propagation
- CachePersistence: JSON file persistence with atomic writes and expired entry filtering
- AIResiliencePolicy: composes fallback, retry, circuit breaker, timeout with Cockatiel
- TracingLogger: ILogger with correlationId in every JSON log entry
- ResourceCache persistence: opt-in with enablePersistence(), periodic saves every 5 minutes
- HealthService: aggregates GitHub/AI/cache health into overall status (healthy/degraded/unhealthy)
- health_check MCP tool: returns structured HealthStatus with readOnly annotation
- AIServiceFactory resilience: opt-in via enableResilience(), executeWithResilience() wraps AI calls
- Infrastructure test location: tests/infrastructure/{domain}/ for resilience, observability, cache, health
- TypeScript mock typing: Use `c[0] as string` cast when mapping mock call arrays to avoid type errors
- graphqlWithFeatures enables preview header injection for sub-issues API
- resolveIssueNodeId helper converts issue numbers to node IDs for GraphQL mutations
- Sub-issues require 'sub_issues' feature flag in GraphQL-Features header
- Status updates use 5-value enum: ON_TRACK, AT_RISK, OFF_TRACK, COMPLETE, INACTIVE
- Status update tools follow AI task pattern: standalone executors creating their own factory
- Status update output schemas use nullable() for optional status field
- Sub-issue tools resolve issue numbers to node IDs internally in executors
- Parallel Promise.all for resolving multiple issue numbers (e.g., parent + sub-issue)
- State normalization: OPEN/CLOSED to open/closed in MCP output
- Template schemas: 4 input (mark/unmark/copy/list) + 4 output (project/copied/listItem/list) schemas
- Linking schemas: 6 input (link/unlink repo/team + list repo/team) + 6 output schemas
- Schema pattern: PageInfo schema reusable for all paginated responses

### Open Todos

- [x] Complete Phase 1 Service Decomposition
- [x] Plan Phase 2 MCP Protocol Compliance
- [x] Execute 02-01: MCP SDK Upgrade
- [x] Execute 02-02: Tool Annotations Infrastructure
- [x] Execute 02-03: Error Handling
- [x] Execute 02-04: Project Tool Annotations (79 tools)
- [x] Execute 02-05: Issue/PR Tool Verification (verified 18 tools)
- [x] Execute 02-06: AI Task Tool Annotations (8 tools)
- [x] Execute 02-07: Final MCP Verification
- [x] Plan Phase 3
- [x] Execute 03-01: Trivial Type Assertion Fixes (4 `as any` removed)
- [x] Execute 03-02: Type Guards (type guards for external data)
- [x] Execute 03-03: Zod and Type Guard Fixes (5 `as any` removed)
- [x] Execute 03-04: AI Types and Mock Object Typing (7 `as any` removed)
- [x] Execute 03-05: Final Type Safety Verification (16+ total `as any` removed)
- [x] Execute 04-01: Test Foundation Fixes
- [x] Execute 04-02: E2E Credential Guards
- [x] Execute 04-03: ContextualReferenceGenerator Tests (100% coverage)
- [x] Execute 04-04: DependencyContextGenerator and ContextQualityValidator Tests (92%+ and 99%+ coverage)
- [x] Execute 04-05: Final Verification (0 failing tests, 515 passed)
- [x] Plan Phase 5
- [x] Execute 05-01: Infrastructure Foundation (CircuitBreakerService, CorrelationContext, CachePersistence)
- [x] Execute 05-02: Integration Services (AIResiliencePolicy, TracingLogger, ResourceCache persistence)
- [x] Execute 05-03: Health Check Service (HealthService, health_check tool, AIServiceFactory resilience)
- [x] Execute 05-04: Documentation (STATUS.md, TOOLS.md, API.md)
- [x] Execute 05-05: Integration and Testing (75 new tests, phase verified)
- [x] Plan Phase 6
- [x] Execute 06-01: Repository Infrastructure (GitHubSubIssueRepository, GitHubStatusUpdateRepository)
- [ ] Execute 06-02: Sub-issue MCP Tools (5 tools)
- [x] Execute 06-03: Status Update MCP Tools (3 tools)
- [x] Execute 06-04: Testing and Verification
- [x] Plan Phase 7
- [x] Execute 07-01: Schema Definitions (20 Zod schemas + 7 TypeScript interfaces)
- [ ] Execute 07-02: Repository and Tool Implementation
- [ ] Execute 07-03: Testing and Integration
- [ ] Execute 07-04: Documentation and Verification
- [ ] Consider future extraction: IssueService, PullRequestService, AutomationService

### Active Blockers

*None*

## Phase 1 Completion Summary

**Phase 1: Service Decomposition** — Complete

| Deliverable | Status |
|-------------|--------|
| SubIssueService | Extracted (242 lines, 14 tests) |
| MilestoneService | Extracted (356 lines, 24 tests) |
| SprintPlanningService | Extracted (460 lines, 24 tests) |
| ProjectStatusService | Extracted (187 lines, 16 tests) |
| ProjectTemplateService | Extracted (326 lines, 19 tests) |
| ProjectLinkingService | Extracted (380 lines, 17 tests) |
| DI Container | Created (112 lines) |
| Facade Wiring Tests | Added (10 tests) |
| Test Gap Closure | Fixed (17 unit tests, 3 AI service files) |

**Key metrics:**
- ProjectManagementService: 3,291 to 1,691 lines (48% reduction)
- Extracted service tests: 114/114 passing
- Total passing tests: 342 (up from 286)

## Phase 2 Completion Summary

**Phase 2: MCP Protocol Compliance** — Complete

| Plan | Name | Status | Commits |
|------|------|--------|---------|
| 02-01 | MCP SDK Upgrade | Complete | 326d501, 33b9cd2 |
| 02-02 | Tool Annotations | Complete | 372cd21, 36b0297, c3cc0ff |
| 02-03 | Error Handling | Complete | 0775048, c3cc0ff, 03f735c |
| 02-04 | Project Tool Annotations | Complete | 57e7fa8, 0a46202, a64bc65 |
| 02-05 | Issue/PR Tool Verification | Complete | (verification only) |
| 02-06 | AI Task Tool Annotations | Complete | 952828f |
| 02-07 | Final Verification | Complete | aade26f, d3f1d6b |

**MCP Compliance Verified:**

| Requirement | Status |
|-------------|--------|
| MCP-01: SDK 1.25.x | PASS |
| MCP-02: Imports updated | PASS |
| MCP-03: All tools work | PASS |
| MCP-04: Protocol version negotiation | PASS |
| MCP-05 to MCP-07: Behavior annotations | PASS (84/84) |
| MCP-08 to MCP-12: Output schemas | PASS (84/84) |
| MCP-13: MCP error codes | PASS |
| MCP-14: Error data payloads | PASS |
| MCP-15: Protocol version handling | PASS |
| structuredContent in results | PASS |

**Key deliverables:**
- MCP SDK: 1.12.0 to 1.25.3 (upgraded)
- zod-to-json-schema: Added (3.25.1)
- CallToolResult format: Fixed for SDK 1.25+
- ToolDefinition: Extended with title, outputSchema, annotations
- ANNOTATION_PATTERNS: 6 behavior patterns for tool classification
- getToolsForMCP: Uses zod-to-json-schema, emits annotations
- 84 tools with annotations, output schemas, and titles
- 53 Zod output schemas (45 project + 8 AI)
- structuredContent in CallToolResult responses

## Phase 3 Completion Summary

**Phase 3: Type Safety** - Complete

| Plan | Name | Status | Key Results |
|------|------|--------|-------------|
| 03-01 | Trivial Type Assertion Fixes | Complete | 4 `as any` removed |
| 03-02 | Type Guards | Complete | type-guards.ts created |
| 03-03 | Zod and Type Guard Fixes | Complete | 5 `as any` removed |
| 03-04 | AI Types and Mock Object Typing | Complete | 7 `as any` removed |
| 03-05 | Final Verification | Complete | SDK workaround documented |

**Type Safety Verified:**

| Criterion | Status |
|-----------|--------|
| Zero `as any` in production (except documented) | PASS |
| AI response interfaces documented | PASS |
| Type guards for external data | PASS |
| TypeScript strict mode no errors | PASS |
| IDE autocomplete works | PASS |

**Key deliverables:**
- 16+ `as any` assertions eliminated from production code
- 1 documented SDK exception (MCP SDK 1.25+ TS2589)
- Type guards in src/domain/type-guards.ts
- MockPRD interface for typed mock objects
- Comprehensive JSDoc for SDK limitation

## Phase 4 Completion Summary

**Phase 4: Test Stabilization** - Complete

| Plan | Name | Status | Key Results |
|------|------|--------|-------------|
| 04-01 | Test Foundation Fixes | Complete | Fixed 3 test files |
| 04-02 | E2E Credential Guards | Complete | 41 tests with credential guards |
| 04-03 | ContextualReferenceGenerator Tests | Complete | 45 tests, 100% coverage |
| 04-04 | Context and Validation Service Tests | Complete | 77 tests (34+43), 92%+ and 99%+ coverage |
| 04-05 | Final Verification | Complete | 0 failing tests, 515 passed |

**Test Stabilization Verified:**

| Criterion | Status |
|-----------|--------|
| npm test: 0 failing tests | PASS |
| E2E tests skip gracefully without credentials | PASS |
| No "Bad credentials" errors | PASS |
| No TypeError about undefined utils | PASS |
| ContextualReferenceGenerator coverage | 100% |
| DependencyContextGenerator coverage | 92%+ |
| ContextQualityValidator coverage | 99%+ |
| All skipped tests documented | PASS |

**Key deliverables:**
- Test suite: 515 passed, 20 skipped (all justified), 0 failed
- Context services: 94%+ combined coverage
- Test isolation: jest.resetAllMocks() pattern established
- Credential guards: All E2E tests skip gracefully
- Verification report: 04-VERIFICATION.md confirms phase complete

## Phase 5 Completion Summary

**Phase 5: Resilience and Observability** - Complete

| Plan | Name | Status | Key Results |
|------|------|--------|-------------|
| 05-01 | Infrastructure Foundation | Complete | CircuitBreakerService, CorrelationContext, CachePersistence |
| 05-02 | Integration Services | Complete | AIResiliencePolicy, TracingLogger, ResourceCache persistence |
| 05-03 | Health Check Service | Complete | HealthService, health_check tool, AIServiceFactory resilience |
| 05-04 | Documentation | Complete | STATUS.md, docs/TOOLS.md, docs/API.md |
| 05-05 | Integration and Testing | Complete | 75 tests, phase verification |

**Phase 5 Verified:**

| Requirement | Status |
|-------------|--------|
| DEBT-21: Circuit breaker for AI | PASS |
| DEBT-22: Health check endpoint | PASS |
| DEBT-23: Correlation ID tracing | PASS |
| DEBT-24: Cache persistence | PASS |
| DEBT-25: Graceful degradation | PASS |
| DEBT-26: Update STATUS.md | PASS |
| DEBT-27: Document MCP tools | PASS |
| DEBT-28: API reference | PASS |

**Key deliverables:**
- cockatiel ^3.2.1 installed for circuit breaker patterns
- CircuitBreakerService: Cockatiel wrapper with state tracking (12 tests)
- CorrelationContext: AsyncLocalStorage-based request tracing (16 tests)
- CachePersistence: JSON file persistence with atomic writes (18 tests)
- AIResiliencePolicy: composed fallback/retry/circuit-breaker/timeout (14 tests)
- TracingLogger: ILogger with correlationId in JSON output
- ResourceCache: opt-in persistence with enablePersistence()
- HealthService: check() returns HealthStatus with overall status (15 tests)
- health_check MCP tool: registered in ToolRegistry (tool #85)
- AIServiceFactory: enableResilience(), getCircuitState(), executeWithResilience()
- STATUS.md: updated with Phase 5 status, 85 tools
- docs/TOOLS.md: comprehensive documentation for all 85 MCP tools (1810 lines)
- docs/API.md: API reference for services and infrastructure (894 lines)
- Test suite: 590 passed (up from 515), 20 skipped, 0 failed

## Session Continuity

**Last Session:** 2026-01-31 - Completed 07-01-PLAN.md (Schema Definitions)

**Context for Next Session:**
- Phase 7 (Project Templates and Linking) in progress: 1/4 plans done
- Schema definitions complete: 20 Zod schemas + 7 TypeScript interfaces
- Total MCP tools: 93 (ready for 10 more in Phase 7)
- Test suite: 678 passing tests
- Next: 07-02 Repository and Tool Implementation

**Architecture Context:**
- DI container (src/container.ts) wires all 6 extracted services
- ProjectManagementService facade: 34 methods delegated, ~25 direct implementations
- ToolRegistry uses proper ZodTypeAny typing with instanceof checks
- 11 tool categories organized in docs/TOOLS.md
- Test isolation: jest.resetAllMocks() in beforeEach for proper mock reset
- src/infrastructure/tools/schemas/project-template-linking-schemas.ts - 20 Zod schemas for Phase 7 tools
- src/infrastructure/github/repositories/types.ts - 7 new TypeScript interfaces for template/linking
- Follows existing patterns from sub-issue-schemas.ts and status-update-schemas.ts
- PageInfo schema reusable across all paginated responses

## Phase 6 Completion Summary

**Phase 6: Sub-issues and Status Updates** - Complete

| Plan | Name | Status | Key Results |
|------|------|--------|-------------|
| 06-01 | Repository Infrastructure | Complete | GitHubSubIssueRepository (5 methods), GitHubStatusUpdateRepository (3 methods), graphqlWithFeatures |
| 06-02 | Sub-issue MCP Tools | Complete | 5 tools (add_sub_issue, list_sub_issues, get_parent_issue, reprioritize_sub_issue, remove_sub_issue) |
| 06-03 | Status Update MCP Tools | Complete | 3 tools (create_status_update, list_status_updates, get_status_update) |
| 06-04 | Testing and Verification | Complete | 88 tests across 4 files, TOOLS.md and STATUS.md updated |

**Phase 6 Verified:**

| Requirement | Status |
|-------------|--------|
| GHAPI-01: add_sub_issue | PASS |
| GHAPI-02: list_sub_issues | PASS |
| GHAPI-03: get_parent_issue | PASS |
| GHAPI-04: reprioritize_sub_issue | PASS |
| GHAPI-05: remove_sub_issue | PASS |
| GHAPI-06: create_status_update | PASS |
| GHAPI-07: list_status_updates | PASS |
| GHAPI-08: get_status_update | PASS |

**Key deliverables:**
- GitHubSubIssueRepository: 5 methods with graphqlWithFeatures for sub_issues preview header
- GitHubStatusUpdateRepository: 3 methods for project status updates
- 5 sub-issue MCP tools with input/output schemas and annotations
- 3 status update MCP tools with input/output schemas and annotations
- 32 repository unit tests covering all methods and edge cases
- 56 tool tests covering schemas, definitions, and executors
- docs/TOOLS.md: Updated with 8 new tools, 93 total (was 85)
- STATUS.md: Updated to Phase 6 complete
- Test suite: 677+ passed (up from 590), 20 skipped, 1 flaky E2E (pre-existing)

---

*State initialized: 2026-01-30*
*Last updated: 2026-01-31*
*Phase 1 completed: 2026-01-30*
*Phase 2 completed: 2026-01-31*
*Phase 3 completed: 2026-01-31*
*Phase 4 completed: 2026-01-31*
*Phase 5 completed: 2026-01-31*
*Phase 6 completed: 2026-01-31*
