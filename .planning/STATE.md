# State: MCP GitHub Project Manager

**Project:** MCP GitHub Project Manager
**Core Value:** Comprehensive AI-enabled GitHub-based project management from 0-100

## Current Position

**Phase:** 2 of 12 (MCP Protocol Compliance)
**Plan:** 4 of 7 complete
**Status:** In progress
**Last activity:** 2026-01-30 - Completed 02-04-PLAN.md (Project Tool Annotations)

**Progress:** [████......] 20% (Phase 1 complete + Phase 2 plan 4/7)

## Project Progress

| Metric | Value |
|--------|-------|
| Phases Complete | 1/12 |
| Requirements Done | 7/99 |
| Current Phase Progress | Phase 2: 4/7 plans complete |

## Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Plans Executed | 9 | Phase 1: 01-01 through 01-05, Phase 2: 02-01 through 02-04 |
| Requirements Completed | 7 | DEBT-01 through DEBT-07 |
| Iterations | 1 | Gap closure cycle for test regressions |
| Blockers Resolved | 3 | tsyringe decorators, reflect-metadata, MCP SDK type instantiation |

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
| 79 tools annotated | 6 behavior patterns applied consistently across all tools | 2026-01-30 |

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
- CallToolResult format: `{ content: [{ type: 'text', text: string }] }`

### Open Todos

- [x] Complete Phase 1 Service Decomposition
- [x] Plan Phase 2 MCP Protocol Compliance
- [x] Execute 02-01: MCP SDK Upgrade
- [x] Execute 02-02: Tool Annotations Infrastructure
- [x] Execute 02-03: Error Handling
- [x] Execute 02-04: Project Tool Annotations (79 tools)
- [ ] Execute 02-05 through 02-07: Protocol version, response format, verification
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

## Phase 2 Progress

**Phase 2: MCP Protocol Compliance** — In Progress (1/7 plans)

| Plan | Name | Status | Commits |
|------|------|--------|---------|
| 02-01 | MCP SDK Upgrade | Complete | 326d501, 33b9cd2 |
| 02-02 | Tool Annotations | Complete | 372cd21, 36b0297, c3cc0ff |
| 02-03 | Error Handling | Complete | 0775048, c3cc0ff, 03f735c |
| 02-04 | Project Tool Annotations | Complete | 57e7fa8, 0a46202, a64bc65 |
| 02-05 | Protocol Version | Pending | - |
| 02-06 | Tool Response Format | Pending | - |
| 02-07 | Final Verification | Pending | - |

**Key deliverables:**
- MCP SDK: 1.12.0 to 1.25.3 (upgraded)
- zod-to-json-schema: Added (3.25.1)
- CallToolResult format: Fixed for SDK 1.25+
- ToolDefinition: Extended with title, outputSchema, annotations
- ANNOTATION_PATTERNS: 6 behavior patterns for tool classification
- getToolsForMCP: Uses zod-to-json-schema, emits annotations
- 79 tools with annotations and output schemas
- 45 Zod output schemas in project-schemas.ts

## Session Continuity

**Last Session:** 2026-01-30 - Completed 02-04-PLAN.md

**Context for Next Session:**
- All 79 tools now have annotations and output schemas
- Output schemas defined in src/infrastructure/tools/schemas/project-schemas.ts (45 schemas)
- Next: 02-05 will add protocol version negotiation
- Annotation breakdown: 29 readOnly, 15 create, 21 updateIdempotent, 2 updateNonIdempotent, 7 delete, 5 aiOperation

**Architecture Context:**
- DI container (src/container.ts) wires all 6 extracted services
- ProjectManagementService facade: 34 methods delegated, ~25 direct implementations
- Test suite: 341 passing (unit), pre-existing AI service test failures unchanged
- CallToolResult uses { content: [{ type: 'text', text }] } format
- All tools export title, outputSchema, annotations properties

---

*State initialized: 2026-01-30*
*Last updated: 2026-01-30*
*Phase 1 completed: 2026-01-30*
*Plan 02-04 completed: 2026-01-30*
*Plan 02-03 completed: 2026-01-30*
*Plan 02-02 completed: 2026-01-30*
