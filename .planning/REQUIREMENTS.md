# Requirements: MCP GitHub Project Manager

**Defined:** 2026-01-30 · **Reconciled with code:** 2026-11-02
**Core Value:** Comprehensive AI-enabled GitHub-based project management from 0-100

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### GitHub Projects v2 API Coverage (GHAPI)

**Sub-issues:**
- [x] **GHAPI-01**: Add sub-issue to parent issue
- [x] **GHAPI-02**: List sub-issues for a parent issue
- [x] **GHAPI-03**: Get parent issue for a sub-issue
- [x] **GHAPI-04**: Reprioritize sub-issue within parent
- [x] **GHAPI-05**: Remove sub-issue from parent

**Project Status Updates:**
- [x] **GHAPI-06**: Create project status update
- [x] **GHAPI-07**: List project status updates
- [x] **GHAPI-08**: Get project status update by ID

**Project Templates:**
- [x] **GHAPI-09**: Mark project as template
- [x] **GHAPI-10**: Unmark project as template
- [x] **GHAPI-11**: Copy project from template
- [x] **GHAPI-12**: List organization project templates

**Project Linking:**
- [x] **GHAPI-13**: Link project to repository
- [x] **GHAPI-14**: Unlink project from repository
- [x] **GHAPI-15**: Link project to team
- [x] **GHAPI-16**: Unlink project from team
- [x] **GHAPI-17**: List linked repositories for project
- [x] **GHAPI-18**: List linked teams for project

**Project Lifecycle:**
- [x] **GHAPI-19**: Close project
- [x] **GHAPI-20**: Reopen closed project

**Draft Issue Operations:**
- [x] **GHAPI-21**: Convert draft issue to real issue

**Project Item Operations:**
- [x] **GHAPI-22**: Update item position (reorder within project)

**Advanced Search:**
- [x] **GHAPI-23**: Search issues with AND/OR keywords
- [x] **GHAPI-24**: Filter project items with advanced query syntax

### MCP Protocol Compliance (MCP)

**SDK Upgrade:**
- [x] **MCP-01**: Upgrade the MCP SDK off 1.12.0 (delivered on 1.25.x at v1.0; superseded by the v2 migration, MCP-16)
- [x] **MCP-02**: Update all imports for the new SDK structure
- [x] **MCP-03**: Verify every registered tool works after the upgrade (tool counts are derived from the `ToolRegistry`, see MCP-16/PROD-18)
- [x] **MCP-04**: Update protocol version negotiation

**Tool Annotations:**
- [x] **MCP-05**: Add behavior annotations to all destructive tools (create, update, delete)
- [x] **MCP-06**: Add read-only annotations to all query tools (get, list)
- [x] **MCP-07**: Add idempotent annotations where applicable

**Tool Output Schemas:**
- [x] **MCP-08**: Define output schemas for all project tools
- [x] **MCP-09**: Define output schemas for all issue tools
- [x] **MCP-10**: Define output schemas for all PR tools
- [x] **MCP-11**: Define output schemas for all AI tools
- [x] **MCP-12**: Define output schemas for all automation tools

**Error Handling:**
- [x] **MCP-13**: Implement MCP-compliant error codes (protocol faults use JSON-RPC errors; see MCP-17 for the tool-failure contract)
- [x] **MCP-14**: Add proper error data payloads (stable code in `_meta.error`)
- [x] **MCP-15**: Handle protocol version mismatches gracefully (negotiated per connection by `serveStdio`)

### Tech Debt Resolution (DEBT)

**Service Decomposition:**
- [x] **DEBT-01**: Extract SubIssueService from ProjectManagementService
- [x] **DEBT-02**: Extract ProjectStatusService from ProjectManagementService
- [x] **DEBT-03**: Extract ProjectTemplateService from ProjectManagementService
- [x] **DEBT-04**: Extract ProjectLinkingService from ProjectManagementService
- [x] **DEBT-05**: Extract SprintPlanningService from ProjectManagementService
- [x] **DEBT-06**: Extract MilestoneService from ProjectManagementService
- [x] **DEBT-07**: Reduce ProjectManagementService to coordination only
  <!-- Over-claimed at v1.0 (PMS was still 1,696 lines); completed in the 2026-07-15
       remediation by extracting IssueService/RoadmapService and delegating
       automation. Today `ProjectManagementService` is a 121-line facade of thin
       getters over the extracted services. -->

**Type Safety:**
- [x] **DEBT-08**: Define interfaces for all AI response objects
- [x] **DEBT-09**: Replace `as any` in TaskContextGenerationService
- [x] **DEBT-10**: Replace `as any` in PRDGenerationService
- [x] **DEBT-11**: Replace `as any` in ProjectAutomationService
- [x] **DEBT-12**: Replace `as any` in TaskGenerationService
- [x] **DEBT-13**: Add type guards for unknown data validation

**Test Coverage:**
- [x] **DEBT-14**: Fix 74 failing tests
- [x] **DEBT-15**: Enable and fix 20 skipped tests
- [x] **DEBT-16**: Add unit tests for ContextualReferenceGenerator
- [x] **DEBT-17**: Add unit tests for DependencyContextGenerator
- [x] **DEBT-18**: Add unit tests for ContextQualityValidator
- [x] **DEBT-19**: Add integration tests for new GitHub features
- [x] **DEBT-20**: Enforce a coverage floor (thresholds in `vitest.config.ts`; the original "80%+" target is not what the config enforces — see CI for measured results)

**Resilience:**
- [x] **DEBT-21**: Implement circuit breaker for AI services
- [x] **DEBT-22**: Add health check endpoint (`/health` on the webhook server and the `system` tool's health action, backed by `HealthService`, which probes GitHub live via `rateLimit.get()` and reports `connected: false` on failure)
- [x] **DEBT-23**: Add request tracing with correlation IDs (`CorrelationContext`, AsyncLocalStorage; logger emits the id in `LOG_FORMAT=json`)
- [x] **DEBT-24**: Implement cache persistence option (`CachePersistence`: versioned JSON snapshot `cache-snapshot.json` in `CACHE_DIRECTORY`, atomic temp-file + rename, expired entries dropped on restore)
- [x] **DEBT-25**: Add graceful degradation for AI service failures

**Documentation:**
- [x] **DEBT-26**: Update STATUS.md to reflect actual codebase state
- [x] **DEBT-27**: Document all MCP tools with examples
- [x] **DEBT-28**: Add API reference documentation

### AI Feature Enhancement (AI)

**PRD Generation:**
- [x] **AI-01**: Improve feature extraction accuracy
- [x] **AI-02**: Add confidence scores to generated PRD sections
- [x] **AI-03**: Support PRD templates customization
- [x] **AI-04**: Add PRD validation against best practices

**Task Generation:**
- [x] **AI-05**: Improve task complexity estimation accuracy
- [x] **AI-06**: Better dependency detection between tasks
- [x] **AI-07**: Add effort estimation to tasks
- [x] **AI-08**: Support task templates

**Sprint Planning:**
- [x] **AI-09**: AI-powered sprint capacity planning
- [x] **AI-10**: Sprint backlog prioritization suggestions
- [x] **AI-11**: Sprint risk assessment
- [x] **AI-12**: Sprint scope recommendations based on velocity

**Roadmap Generation:**
- [x] **AI-13**: Generate roadmap from requirements
- [x] **AI-14**: Phase sequencing based on dependencies
- [x] **AI-15**: Milestone date estimation
- [x] **AI-16**: Roadmap visualization data generation

**Issue Intelligence:**
- [x] **AI-17**: Improve issue enrichment quality
- [x] **AI-18**: Better label suggestions
- [x] **AI-19**: Duplicate issue detection
- [x] **AI-20**: Related issue linking suggestions

### Production Readiness (PROD)

**Testing:**
- [x] **PROD-01**: All unit tests passing
- [x] **PROD-02**: All integration tests passing
- [x] **PROD-03**: All E2E tests passing
- [x] **PROD-04**: No unconditionally skipped tests (live-API suites are registered with `describe.skipIf` on missing credentials and are reported as skipped by Vitest; `E2E_REAL_API=true` runs them)

**Documentation:**
- [x] **PROD-05**: Complete README with quick start
- [x] **PROD-06**: Tool reference documentation
- [x] **PROD-07**: Configuration guide
- [x] **PROD-08**: Troubleshooting guide

**Package:**
- [x] **PROD-09**: Update package.json version
- [x] **PROD-10**: Verify npm publish configuration
- [x] **PROD-11**: Add changelog (`CHANGELOG.md`, Keep a Changelog format)
- [x] **PROD-12**: Publish to npm

### Post-v1.0 Requirements (remediation and platform hardening)

Added after the v1.0 milestone; every item below was verified against code on 2026-11-02. IDs continue the existing scheme; analytics gets its own `ANLY` prefix because it is not AI-specific.

**GitHub API:**
- [x] **GHAPI-25**: GitHub App installation auth outranks the PAT when `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID` are all set; a partial config falls through to the next credential tier (`resolveGitHubAuth()` + `GitHubRepositoryFactory.fromAuth()`)

**MCP Protocol:**
- [x] **MCP-16**: Run on `@modelcontextprotocol/server` v2 (`McpServer.registerTool`, `serveStdio`), every tool sharing one `dispatchTool`
- [x] **MCP-17**: Tool-failure contract — every tool failure returns `{content, isError: true}` with the code in `_meta.error`; JSON-RPC errors only for an unknown tool or protocol faults
- [x] **MCP-18**: Optional `idempotencyKey` on create actions: same key + same arguments within 24h replays the first result (`IdempotencyStore`, audit-log replay); same key with different arguments is a conflict
- [x] **MCP-19**: Additive cursor pagination on list actions (`cursor` in, `nextCursor` out, alongside `pageInfo`)
- [x] **MCP-20**: Per-tool `_meta.schemaVersion` on every result (all tools at 1.0.0), pinned by a schema snapshot test
- [x] **MCP-21**: Destructive `manage_sprints` delete requires `confirm: true`

**Analytics (delivered minimally as the `analytics` tool):**
- [x] **ANLY-01**: `sprint_velocity` report
- [x] **ANLY-02**: `sprint_burndown` report
- [x] **ANLY-03**: `cycle_time` report
- [x] **ANLY-04**: `throughput` report
- [x] **ANLY-05**: `project_summary` report

**AI:**
- [x] **AI-21**: All AI prompts served through the versioned `PromptRegistry` (`{{var}}` templates)
- [x] **AI-22**: Per-session `TokenBudgetManager` (`AI_SESSION_TOKEN_LIMIT`, 0 = unlimited), distinct from the agent budget
- [x] **AI-23**: Agent budget `hardStop` gates AI tools (`BudgetExhausted`, `isError`)
- [x] **AI-24**: `AIResponseCache` wired into `TaskContextGenerationService`

**Tech debt:**
- [x] **DEBT-29**: Dead modules deleted (`infrastructure/validation`, `infrastructure/resource`, `StructuredLogger`/`TracingLogger`, `project-types.ts`, `MCPErrorHandler`)
- [x] **DEBT-30**: Single test tree under `src/__tests__/` (the legacy root `tests/` tree is gone)
- [x] **DEBT-31**: Domain entities carry behavior (rich entities, domain imports nothing from services/infrastructure); composition root registers the services and the `index.ts`-owned components, with tool executors self-constructing through `createGitHubFactory()` as the documented exception

**Production readiness:**
- [x] **PROD-13**: Proactive rate-limit budgeting — one `GitHubRequestExecutor` (retry + `RateLimitManager`) backs off below `RATE_LIMIT_FLOOR` (default 100) instead of burning the budget and hitting a 403
- [x] **PROD-14**: Append-only, redacted mutation audit log (`AUDIT_LOG_ENABLED`, `AUDIT_LOG_PATH`, default `.mcp-audit/mutations.jsonl`)
- [x] **PROD-15**: Opt-in OpenTelemetry tracing (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`; `tool.<name>` spans)
- [x] **PROD-16**: Webhook/SSE hardening — loopback bind by default (`WEBHOOK_HOST`), `/events/*` bearer auth (`EVENTS_AUTH_TOKEN`), signature validation fails closed, CORS allow-list, rate limit, `WEBHOOK_TRUSTED_PROXIES` for `X-Forwarded-For`
- [x] **PROD-17**: Supply-chain CI gates — lockfile sync check (`check:lockfiles`), `npm audit --audit-level=high`, CodeQL workflow, Dependabot (weekly npm + github-actions), CycloneDX SBOM attached to releases
- [x] **PROD-18**: Doc-count CI check (`check:docs`) fails when published tool/action counts differ from the `ToolRegistry`

## v2 Requirements

Deferred to a future release. Tracked but not in the current roadmap.

### Advanced Features

- **V2-01**: Real-time project sync via webhooks
- **V2-02**: Multi-organization support
- **V2-03**: GitHub Enterprise Server support
- **V2-04**: Streamable HTTP transport for remote usage
- **V2-05**: OAuth 2.1 authorization flow
- **V2-06**: MCP Tasks primitive for long-running operations
- **V2-07**: MCP Elicitation for interactive tools
- **V2-08**: Redis cache backend option
- **V2-09**: Metrics and observability (Prometheus-style metrics; OTLP tracing is delivered as PROD-15)
- **V2-10**: Further rate-limit handling (proactive budgeting is delivered as PROD-13)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| GitHub Insights/Charts API | No programmatic API available (UI-only); the `analytics` tool computes its own reports |
| Fine-grained PAT support | GitHub GraphQL doesn't support it (use a classic PAT or a GitHub App) |
| Self-hosted GitHub Enterprise | Focus on github.com |
| Real-time collaboration | Complex, defer to v2 |
| Mobile app | CLI/MCP focus |
| UI dashboard | MCP server is API-only |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEBT-01 | Phase 1 | Complete |
| DEBT-02 | Phase 1 | Complete |
| DEBT-03 | Phase 1 | Complete |
| DEBT-04 | Phase 1 | Complete |
| DEBT-05 | Phase 1 | Complete |
| DEBT-06 | Phase 1 | Complete |
| DEBT-07 | Phase 1 | Complete |
| MCP-01 | Phase 2 | Complete |
| MCP-02 | Phase 2 | Complete |
| MCP-03 | Phase 2 | Complete |
| MCP-04 | Phase 2 | Complete |
| MCP-05 | Phase 2 | Complete |
| MCP-06 | Phase 2 | Complete |
| MCP-07 | Phase 2 | Complete |
| MCP-08 | Phase 2 | Complete |
| MCP-09 | Phase 2 | Complete |
| MCP-10 | Phase 2 | Complete |
| MCP-11 | Phase 2 | Complete |
| MCP-12 | Phase 2 | Complete |
| MCP-13 | Phase 2 | Complete |
| MCP-14 | Phase 2 | Complete |
| MCP-15 | Phase 2 | Complete |
| DEBT-08 | Phase 3 | Complete |
| DEBT-09 | Phase 3 | Complete |
| DEBT-10 | Phase 3 | Complete |
| DEBT-11 | Phase 3 | Complete |
| DEBT-12 | Phase 3 | Complete |
| DEBT-13 | Phase 3 | Complete |
| DEBT-14 | Phase 4 | Complete |
| DEBT-15 | Phase 4 | Complete |
| DEBT-16 | Phase 4 | Complete |
| DEBT-17 | Phase 4 | Complete |
| DEBT-18 | Phase 4 | Complete |
| DEBT-19 | Phase 4 | Complete |
| DEBT-20 | Phase 4 | Complete |
| DEBT-21 | Phase 5 | Complete |
| DEBT-22 | Phase 5 | Complete |
| DEBT-23 | Phase 5 | Complete |
| DEBT-24 | Phase 5 | Complete |
| DEBT-25 | Phase 5 | Complete |
| DEBT-26 | Phase 5 | Complete |
| DEBT-27 | Phase 5 | Complete |
| DEBT-28 | Phase 5 | Complete |
| GHAPI-01 | Phase 6 | Complete |
| GHAPI-02 | Phase 6 | Complete |
| GHAPI-03 | Phase 6 | Complete |
| GHAPI-04 | Phase 6 | Complete |
| GHAPI-05 | Phase 6 | Complete |
| GHAPI-06 | Phase 6 | Complete |
| GHAPI-07 | Phase 6 | Complete |
| GHAPI-08 | Phase 6 | Complete |
| GHAPI-09 | Phase 7 | Complete |
| GHAPI-10 | Phase 7 | Complete |
| GHAPI-11 | Phase 7 | Complete |
| GHAPI-12 | Phase 7 | Complete |
| GHAPI-13 | Phase 7 | Complete |
| GHAPI-14 | Phase 7 | Complete |
| GHAPI-15 | Phase 7 | Complete |
| GHAPI-16 | Phase 7 | Complete |
| GHAPI-17 | Phase 7 | Complete |
| GHAPI-18 | Phase 7 | Complete |
| GHAPI-19 | Phase 8 | Complete |
| GHAPI-20 | Phase 8 | Complete |
| GHAPI-21 | Phase 8 | Complete |
| GHAPI-22 | Phase 8 | Complete |
| GHAPI-23 | Phase 8 | Complete |
| GHAPI-24 | Phase 8 | Complete |
| AI-01 | Phase 9 | Complete |
| AI-02 | Phase 9 | Complete |
| AI-03 | Phase 9 | Complete |
| AI-04 | Phase 9 | Complete |
| AI-05 | Phase 9 | Complete |
| AI-06 | Phase 9 | Complete |
| AI-07 | Phase 9 | Complete |
| AI-08 | Phase 9 | Complete |
| AI-09 | Phase 10 | Complete |
| AI-10 | Phase 10 | Complete |
| AI-11 | Phase 10 | Complete |
| AI-12 | Phase 10 | Complete |
| AI-13 | Phase 10 | Complete |
| AI-14 | Phase 10 | Complete |
| AI-15 | Phase 10 | Complete |
| AI-16 | Phase 10 | Complete |
| AI-17 | Phase 11 | Complete |
| AI-18 | Phase 11 | Complete |
| AI-19 | Phase 11 | Complete |
| AI-20 | Phase 11 | Complete |
| PROD-01 | Phase 12 | Complete |
| PROD-02 | Phase 12 | Complete |
| PROD-03 | Phase 12 | Complete |
| PROD-04 | Phase 12 | Complete |
| PROD-05 | Phase 12 | Complete |
| PROD-06 | Phase 12 | Complete |
| PROD-07 | Phase 12 | Complete |
| PROD-08 | Phase 12 | Complete |
| PROD-09 | Phase 12 | Complete |
| PROD-10 | Phase 12 | Complete |
| PROD-11 | Phase 12 | Complete |
| PROD-12 | Phase 12 | Complete |
| GHAPI-25 | Remediation | Complete |
| MCP-16 | Remediation | Complete |
| MCP-17 | Remediation | Complete |
| MCP-18 | Remediation | Complete |
| MCP-19 | Remediation | Complete |
| MCP-20 | Remediation | Complete |
| MCP-21 | Remediation | Complete |
| ANLY-01 | Phase 11 (original scope; delivered post-v1.0 as the `analytics` tool) | Complete |
| ANLY-02 | Phase 11 (original scope; delivered post-v1.0) | Complete |
| ANLY-03 | Phase 11 (original scope; delivered post-v1.0) | Complete |
| ANLY-04 | Phase 11 (original scope; delivered post-v1.0) | Complete |
| ANLY-05 | Phase 11 (original scope; delivered post-v1.0) | Complete |
| AI-21 | Remediation | Complete |
| AI-22 | Remediation | Complete |
| AI-23 | Remediation | Complete |
| AI-24 | Remediation | Complete |
| DEBT-29 | Remediation | Complete |
| DEBT-30 | Remediation | Complete |
| DEBT-31 | Remediation | Complete |
| PROD-13 | Remediation | Complete |
| PROD-14 | Remediation | Complete |
| PROD-15 | Remediation | Complete |
| PROD-16 | Remediation | Complete |
| PROD-17 | Remediation | Complete |
| PROD-18 | Remediation | Complete |

**Coverage:**
- v1 requirements: 99 total, all mapped to phases 1-12
- Post-v1.0 requirements: 25 (GHAPI-25, MCP-16–21, ANLY-01–05, AI-21–24, DEBT-29–31, PROD-13–18), all mapped to the remediation work
- Unmapped: 0

---
*Requirements defined: 2026-01-30*
*Last updated: 2026-11-02 — reconciled with code; post-v1.0 requirements added*

<!-- Reconciliation history:
     - 2026-07-15: "99/99 complete" was partly aspirational at v1.0. DEBT-07 (PMS
       decomposition) was not done at v1.0 and was completed then; DEBT-09..12
       (replace `as any`) were over-claimed (real production casts were 2, fixed).
     - 2026-11-02: Phase 11's original "Analytics & Reporting" scope is now delivered
       minimally as the `analytics` tool (ANLY-01..05); Phase 11 keeps AI Issue
       Intelligence (AI-17..20). Production code contains no real `as any`.
     Live status: docs/remediation/GAP-TRACKER.md. -->

