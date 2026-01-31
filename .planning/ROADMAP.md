# Roadmap: MCP GitHub Project Manager

**Milestone:** v1.0 Release
**Created:** 2026-01-30
**Depth:** Comprehensive (12 phases)

## Overview

This roadmap delivers comprehensive AI-enabled GitHub project management from 0-100. The sequence prioritizes technical foundation (service decomposition, MCP upgrade) before feature development (GitHub API, AI enhancements), ending with production readiness. Each phase delivers a coherent, verifiable capability.

## Phases

### Phase 1: Service Decomposition

**Goal:** ProjectManagementService god class is decomposed into focused, testable services.

**Dependencies:** None (foundation phase)

**Requirements:**
- DEBT-01: Extract SubIssueService from ProjectManagementService
- DEBT-02: Extract ProjectStatusService from ProjectManagementService
- DEBT-03: Extract ProjectTemplateService from ProjectManagementService
- DEBT-04: Extract ProjectLinkingService from ProjectManagementService
- DEBT-05: Extract SprintPlanningService from ProjectManagementService
- DEBT-06: Extract MilestoneService from ProjectManagementService
- DEBT-07: Reduce ProjectManagementService to coordination only

**Success Criteria:**
1. ProjectManagementService is under 500 lines
2. Each extracted service can be instantiated and tested independently
3. All existing tests pass with new service structure
4. No circular dependencies between extracted services
5. DI container correctly wires all new services

**Plans:** 5 plans
Plans:
- [x] 01-01-PLAN.md - Extract SubIssueService and MilestoneService
- [x] 01-02-PLAN.md - Extract SprintPlanningService and ProjectStatusService
- [x] 01-03-PLAN.md - Extract ProjectTemplateService and ProjectLinkingService
- [x] 01-04-PLAN.md - Refactor to facade and wire DI container
- [x] 01-05-PLAN.md - Fix test regressions from DI refactoring (gap closure)

**Status:** Complete ✓
**Completed:** 2026-01-30

---

### Phase 2: MCP Protocol Compliance

**Goal:** MCP SDK is current and all tools have proper annotations and output schemas.

**Dependencies:** Phase 1 (cleaner services make tool updates easier)

**Requirements:**
- MCP-01: Upgrade SDK from 1.12.0 to 1.25.2
- MCP-02: Update all imports for new SDK structure
- MCP-03: Verify all 84 tools work after upgrade
- MCP-04: Update protocol version negotiation
- MCP-05: Add behavior annotations to all destructive tools
- MCP-06: Add read-only annotations to all query tools
- MCP-07: Add idempotent annotations where applicable
- MCP-08: Define output schemas for all project tools
- MCP-09: Define output schemas for all issue tools
- MCP-10: Define output schemas for all PR tools
- MCP-11: Define output schemas for all AI tools
- MCP-12: Define output schemas for all automation tools
- MCP-13: Implement MCP-compliant error codes
- MCP-14: Add proper error data payloads
- MCP-15: Handle protocol version mismatches gracefully

**Success Criteria:**
1. MCP SDK version is 1.25.2 in package.json
2. All 84 tools execute successfully with new SDK
3. Every destructive tool has behavior annotation visible to clients
4. Every tool has output schema that matches actual return type
5. Error responses include proper MCP error codes and data payloads

**Plans:** 7 plans
Plans:
- [x] 02-01-PLAN.md - SDK upgrade and import fixes
- [x] 02-02-PLAN.md - Tool infrastructure extension (annotations, outputSchema)
- [x] 02-03-PLAN.md - Error handling enhancement (MCP error codes)
- [x] 02-04-PLAN.md - Project tools annotations and schemas
- [x] 02-05-PLAN.md - Issue and PR tools annotations and schemas
- [x] 02-06-PLAN.md - AI and automation tools annotations and schemas
- [x] 02-07-PLAN.md - Final verification

**Status:** Complete ✓
**Completed:** 2026-01-31

---

### Phase 3: Type Safety

**Goal:** All `as any` type assertions are replaced with proper interfaces and type guards.

**Dependencies:** Phase 1 (type fixes target extracted services)

**Requirements:**
- DEBT-08: Define interfaces for all AI response objects
- DEBT-09: Replace `as any` in TaskContextGenerationService
- DEBT-10: Replace `as any` in PRDGenerationService
- DEBT-11: Replace `as any` in ProjectAutomationService
- DEBT-12: Replace `as any` in TaskGenerationService
- DEBT-13: Add type guards for unknown data validation

**Success Criteria:**
1. Zero `as any` assertions in production code (verified by grep)
2. AI response interfaces are documented in domain types
3. Type guards exist for all external data boundaries
4. TypeScript strict mode produces no errors
5. IDE autocomplete works for AI response objects

---

### Phase 4: Test Stabilization

**Goal:** All tests pass and skipped tests are either fixed or removed with justification.

**Dependencies:** Phase 1, Phase 3 (services extracted, types fixed)

**Requirements:**
- DEBT-14: Fix 74 failing tests
- DEBT-15: Enable and fix 20 skipped tests
- DEBT-16: Add unit tests for ContextualReferenceGenerator
- DEBT-17: Add unit tests for DependencyContextGenerator
- DEBT-18: Add unit tests for ContextQualityValidator
- DEBT-19: Add integration tests for new GitHub features
- DEBT-20: Achieve 80%+ code coverage

**Success Criteria:**
1. `npm test` reports 0 failing tests
2. No skipped tests without documented justification
3. Code coverage is 80% or higher
4. ContextualReferenceGenerator has 90%+ coverage
5. All AI fallback paths have test coverage

---

### Phase 5: Resilience and Observability

**Goal:** System handles failures gracefully and operators can observe system health.

**Dependencies:** Phase 4 (tests stable before adding infrastructure)

**Requirements:**
- DEBT-21: Implement circuit breaker for AI services
- DEBT-22: Add health check endpoint
- DEBT-23: Add request tracing with correlation IDs
- DEBT-24: Implement cache persistence option
- DEBT-25: Add graceful degradation for AI service failures
- DEBT-26: Update STATUS.md to reflect actual codebase state
- DEBT-27: Document all MCP tools with examples
- DEBT-28: Add API reference documentation

**Success Criteria:**
1. AI service failures trigger circuit breaker (no cascading timeouts)
2. Health check endpoint returns service status and AI availability
3. Every MCP request has traceable correlation ID in logs
4. Cache survives server restart (persistence working)
5. System returns partial results when AI is unavailable

---

### Phase 6: Sub-issues and Status Updates

**Goal:** Users can manage sub-issues and track project status updates via MCP.

**Dependencies:** Phase 2 (MCP compliance), Phase 5 (resilience)

**Requirements:**
- GHAPI-01: Add sub-issue to parent issue
- GHAPI-02: List sub-issues for a parent issue
- GHAPI-03: Get parent issue for a sub-issue
- GHAPI-04: Reprioritize sub-issue within parent
- GHAPI-05: Remove sub-issue from parent
- GHAPI-06: Create project status update
- GHAPI-07: List project status updates
- GHAPI-08: Get project status update by ID

**Success Criteria:**
1. User can create a sub-issue hierarchy 3 levels deep
2. User can list all sub-issues for any parent and see correct hierarchy
3. User can reprioritize sub-issues and see order change on GitHub
4. User can create status update and see it appear in GitHub project
5. User can retrieve status update history for a project

---

### Phase 7: Project Templates and Linking

**Goal:** Users can create reusable project templates and link projects to repos/teams.

**Dependencies:** Phase 6 (core GitHub features established)

**Requirements:**
- GHAPI-09: Mark project as template
- GHAPI-10: Unmark project as template
- GHAPI-11: Copy project from template
- GHAPI-12: List organization project templates
- GHAPI-13: Link project to repository
- GHAPI-14: Unlink project from repository
- GHAPI-15: Link project to team
- GHAPI-16: Unlink project from team
- GHAPI-17: List linked repositories for project
- GHAPI-18: List linked teams for project

**Success Criteria:**
1. User can mark a project as template and see it listed as template
2. User can create new project from template with all fields/views copied
3. User can link project to repository and see linkage in GitHub UI
4. User can link project to team and team members have access
5. User can list all linked repos/teams for a project

---

### Phase 8: Project Lifecycle and Advanced Operations

**Goal:** Users have complete control over project lifecycle and item management.

**Dependencies:** Phase 7 (foundation GitHub features complete)

**Requirements:**
- GHAPI-19: Close project
- GHAPI-20: Reopen closed project
- GHAPI-21: Convert draft issue to real issue
- GHAPI-22: Update item position (reorder within project)
- GHAPI-23: Search issues with AND/OR keywords
- GHAPI-24: Filter project items with advanced query syntax

**Success Criteria:**
1. User can close a project and it no longer appears in active projects
2. User can reopen a closed project and resume work
3. User can convert draft issue to real issue in specific repository
4. User can reorder items in project and see new order persist
5. User can search with complex queries (title:bug AND label:critical)

---

### Phase 9: AI PRD and Task Enhancement

**Goal:** PRD and task generation are more accurate and provide confidence signals.

**Dependencies:** Phase 5 (AI resilience), Phase 4 (tests stable)

**Requirements:**
- AI-01: Improve feature extraction accuracy
- AI-02: Add confidence scores to generated PRD sections
- AI-03: Support PRD templates customization
- AI-04: Add PRD validation against best practices
- AI-05: Improve task complexity estimation accuracy
- AI-06: Better dependency detection between tasks
- AI-07: Add effort estimation to tasks
- AI-08: Support task templates

**Success Criteria:**
1. Generated PRDs include confidence score per section (0-100%)
2. User can provide custom PRD template and output follows it
3. PRD validation flags missing sections with specific feedback
4. Task complexity estimates have 80%+ accuracy against actuals
5. Generated tasks include effort estimates in story points

---

### Phase 10: AI Sprint and Roadmap Planning

**Goal:** AI can suggest sprint composition and generate roadmaps from requirements.

**Dependencies:** Phase 9 (PRD/task AI improved)

**Requirements:**
- AI-09: AI-powered sprint capacity planning
- AI-10: Sprint backlog prioritization suggestions
- AI-11: Sprint risk assessment
- AI-12: Sprint scope recommendations based on velocity
- AI-13: Generate roadmap from requirements
- AI-14: Phase sequencing based on dependencies
- AI-15: Milestone date estimation
- AI-16: Roadmap visualization data generation

**Success Criteria:**
1. AI suggests sprint composition that fits team capacity
2. AI ranks backlog items with explanation of prioritization rationale
3. AI identifies sprint risks with probability and mitigation suggestions
4. AI generates roadmap with logical phase sequence from requirements
5. Roadmap includes milestone dates based on velocity data

---

### Phase 11: AI Issue Intelligence

**Goal:** AI provides intelligent assistance for issue management.

**Dependencies:** Phase 9 (AI foundation improved)

**Requirements:**
- AI-17: Improve issue enrichment quality
- AI-18: Better label suggestions
- AI-19: Duplicate issue detection
- AI-20: Related issue linking suggestions

**Success Criteria:**
1. Issue enrichment adds meaningful description, acceptance criteria
2. Label suggestions have 90%+ relevance rate
3. Duplicate detection catches 80%+ of actual duplicates
4. Related issue suggestions link genuinely connected issues

---

### Phase 12: Production Release

**Goal:** Package is published to npm and production-ready.

**Dependencies:** All previous phases

**Requirements:**
- PROD-01: All unit tests passing
- PROD-02: All integration tests passing
- PROD-03: All E2E tests passing
- PROD-04: No skipped tests
- PROD-05: Complete README with quick start
- PROD-06: Tool reference documentation
- PROD-07: Configuration guide
- PROD-08: Troubleshooting guide
- PROD-09: Update package.json version
- PROD-10: Verify npm publish configuration
- PROD-11: Add changelog
- PROD-12: Publish to npm

**Success Criteria:**
1. `npm test` reports 100% pass rate with 0 skipped
2. README has working quick start that completes in under 5 minutes
3. Every MCP tool has documentation with example usage
4. Package publishes successfully to npm registry
5. Fresh install via npm works end-to-end

---

## Progress

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 1 | Service Decomposition | 7 | Complete ✓ |
| 2 | MCP Protocol Compliance | 15 | Complete ✓ |
| 3 | Type Safety | 6 | Pending |
| 4 | Test Stabilization | 7 | Pending |
| 5 | Resilience and Observability | 8 | Pending |
| 6 | Sub-issues and Status Updates | 8 | Pending |
| 7 | Project Templates and Linking | 10 | Pending |
| 8 | Project Lifecycle and Advanced Operations | 6 | Pending |
| 9 | AI PRD and Task Enhancement | 8 | Pending |
| 10 | AI Sprint and Roadmap Planning | 8 | Pending |
| 11 | AI Issue Intelligence | 4 | Pending |
| 12 | Production Release | 12 | Pending |

**Total:** 99 requirements across 12 phases

---

## Requirement Coverage

| Category | Requirements | Phases | Coverage |
|----------|--------------|--------|----------|
| DEBT | 28 | 1, 3, 4, 5 | 28/28 |
| MCP | 15 | 2 | 15/15 |
| GHAPI | 24 | 6, 7, 8 | 24/24 |
| AI | 20 | 9, 10, 11 | 20/20 |
| PROD | 12 | 12 | 12/12 |

**Total Coverage:** 99/99 (100%)

---

*Roadmap created: 2026-01-30*
*Last updated: 2026-01-31*
*Phase 1 completed: 2026-01-30*
*Phase 2 completed: 2026-01-31*
