# Remediation Gap Tracker — Living

> **⚠️ HISTORICAL SNAPSHOT (2026-08-07).** This tracker records the state of
> the remediation pass as of that date. It is kept for history only — its
> counts and "current" claims are stale. **Current source of truth:** the code
> itself, plus [`docs/architecture.md`](../architecture.md),
> [`docs/TOOLS.md`](../TOOLS.md) and [`docs/CONFIGURATION.md`](../CONFIGURATION.md).

**Branch:** `remediation/spec-reconciliation`
**Baseline commit:** `84ca9b4` (WIP checkpoint over `v1.1.0`)
**Method:** GitNexus CLI graph audit + filesystem verification, reconciled against canonical spec (`.planning/` + `/docs` + `README`).
**Status legend:** OPEN · IN-PROGRESS · DONE · PROPOSED (needs user go-ahead) · WONTFIX

> This file is the single source of truth for remediation state. It supersedes the
> conflicting claims in `.planning/STATUS.md`, `.planning/REQUIREMENTS.md`, and
> `docs/GAP-ANALYSIS-LIVE.md`, which are time-layered and drifted (see G0 group).

---

## G0 — Spec / Documentation Reconciliation

Canonical docs contradict each other and the code. Truth column is code-verified 2026-07-14.

| ID | Gap | Doc claim | Code truth | Severity | Status |
|----|-----|-----------|------------|----------|--------|
| G0-01 | STATUS vs REQUIREMENTS contradiction | REQUIREMENTS: 99/99 complete; STATUS: phases 10-12 "Not Started" | Phase 10 done, phase 11 absent, phase 12 shipped (v1.1.0) | HIGH | DONE (STATUS.md reconciled to 11/12 + reconciliation note; PROJECT.md gained a PRD→FRD document chain; GAP-ANALYSIS-LIVE marked superseded) |
| G0-02 | Tool count drift | architecture.md "116", README "115", "40+ & 8" | **120** registered + 120 dispatch cases | MEDIUM | DONE |
| G0-03 | Wrong AI env var in docs | architecture.md `GOOGLE_AI_API_KEY` | code uses `GOOGLE_API_KEY` | MEDIUM | DONE |
| G0-04 | Dead README refs | links `STATUS.md`; docs `npm run test:integration`, `npm run type-check` | STATUS.md absent (real one `.planning/STATUS.md`); neither script in package.json | MEDIUM | DONE |
| G0-05 | Stale graph stats | GAP-ANALYSIS-LIVE "513 nodes/347 edges" | GitNexus index 4697 symbols / 11535 rels | LOW | DONE (marked superseded; GitNexus context resource shows current stats) |
| G0-06 | DEBT-09..12 overclaim | REQUIREMENTS: `as any` replaced (complete) | Was 38 `as any`, but 31 in tests + 3 template-string false-positives + 1 SDK cast + 1 comment. Real prod casts = 2 (SprintSuggestionService). Fixed Layer B. | MEDIUM | DONE |
| G0-07 | DEBT-07 overclaim | REQUIREMENTS: "reduce PMS to coordination only" complete | Was 1,696 lines; now genuinely done | HIGH | DONE (REQUIREMENTS.md DEBT-07 annotated with the real completion date; PMS decomposed to 1,338-line facade — see G3-01) |

## G1 — Domain Layer (`src/domain/`)

| ID | Gap | Location | Severity | Status |
|----|-----|----------|----------|--------|
| G1-01 | AI response objects untyped; `as any` at boundaries | ai-types.ts + service consumers | MEDIUM | DONE (sprint risk path: domain `as const` tuples now single source of truth for type + zod schema; 6 casts removed across SprintSuggestionService + SprintRiskAssessor) |
| G1-02 | `ai-types.ts` 1,224 lines — cohesion risk | src/domain/ai-types.ts | LOW | DONE — split into 6 cohesive modules (ai-task-types, prd-types, traceability-types, feature-lifecycle-types, confidence-types, task-generation-config-types). ai-types.ts is now a 7-line barrel re-export. Zero circular deps. |

## G2 — Infrastructure Layer (`src/infrastructure/`)

| ID | Gap | Location | Severity | Status |
|----|-----|----------|----------|--------|
| G2-01 | **Circular dependency** | FilePersistenceAdapter ↔ GitHubStateSyncService | HIGH | DONE (root cause: `SyncMetadata` type defined in service but imported by 2 infra files. Moved to `domain/resource-types.ts`; repointed FilePersistenceAdapter + ResourceCache; service re-exports for compat. `check --cycles` = clean) |
| G2-02 | `ToolSchemas.ts` god file (2,871 lines) | src/infrastructure/tools/ToolSchemas.ts | HIGH | DONE — split into 7 domain-specific schema files under `schemas/` (core-tool, issue-tool, pr-tool, sprint-milestone-tool, automation-iteration-tool, event-tool, ai-automation-tool). ToolSchemas.ts is now a 24-line barrel re-export. |
| G2-03 | Dual dispatch: index.ts 120-case switch parallel to ToolRegistry | index.ts + ToolRegistry.ts | HIGH | DONE — added `registerExecutor`/`execute` to ToolRegistry; `registerToolExecutors()` in index.ts replaces the 407-line switch. ToolRegistry is now the single dispatch point. index.ts 1286→1023 lines. |
| G2-04 | Placeholder-factory smell: `GitHubRepositoryFactory(token,"placeholder","placeholder")` | linking/lifecycle/template/status/advanced tools | MEDIUM | DONE (5 duplicated createFactory helpers → 1 shared `tool-factory.ts#createGitHubFactory(owner?,repo?)` with env fallback; sentinel centralized+documented; 231 tool tests pass) |
| G2-05 | Health check GitHub rate-limit is a stub (TODO) | HealthService.ts:161 | MEDIUM | DONE (checkGitHub now probes octokit.rest.rateLimit.get via injected GitHubRepositoryFactory; fails honest connected:false on missing factory/error; openWorldHint corrected to true; HealthService suite 16/16) |
| G2-06 | Webhook signature validation fails OPEN when secret unset | GitHubWebhookHandler.ts:46-48 | HIGH (security) | DONE (now fails closed: rejects unsigned webhooks unless `WEBHOOK_ALLOW_UNSIGNED=true` explicit dev opt-in; 6 security regression tests pass) |
| G2-07 | EventStore unbounded memory (no LRU eviction) | EventStore.ts | MEDIUM | NOT-A-GAP (verified: FIFO eviction at maxEventsInMemory via splice, `addToMemoryBuffer` L218-220, with correct `rebuildEventIndex` L232-237. CONCERNS claim stale. Minor: rebuild is O(n)/evict — perf-only, not a bug) |
| G2-08 | ResourceCache: `maxSize` option unenforced (no size eviction, no TTL sweep — only lazy expiry on access) | ResourceCache.ts | MEDIUM | DONE — added MAX_CACHE_ENTRIES cap (env-overridable, default 10000) with oldest-first eviction via `evictIfOverCapacity`, reusing `removeFromIndices` so tag/type/namespace indices stay consistent. **Also fixed a latent bug**: entries stored no `namespaces`, so `removeFromIndices` read an always-undefined `entry.namespace` and never cleaned the namespace index on delete/evict — changed CacheEntry to `namespaces: string[]`, populated in `set()`, iterated in cleanup. Verified via built-module node check (size cap, oldest evicted, namespace index cleaned on evict + delete); 22 ResourceCache-touching tests still pass. Note: ts-jest can't construct ResourceCache directly (CJS-interop wraps the export — pre-existing; all suites mock it), so eviction has no jest unit test yet — follow-up G5-07 |
| G2-09 | **Build blocker** TS2589 (zodToJsonSchema) — also caused `npm run build` to OOM-crash (infinite type instantiation exhausted the heap) | ToolRegistry.ts | HIGH | DONE (first fix was incomplete — single cast still instantiated the deep type; final fix binds `zodToJsonSchema as unknown as (...)` double-cast. `tsc -p tsconfig.build.json` 0 errors AND `npm run build` completes with default heap. Note: earlier "0 errors" runs were tsc aborting on OOM before finishing) |

## G3 — Service Layer (`src/services/`)

| ID | Gap | Location | Severity | Status |
|----|-----|----------|----------|--------|
| G3-01 | **God class** ProjectManagementService (1,696 lines) | ProjectManagementService.ts | HIGH | DONE — extracted PullRequestService (223 lines), FieldValueService (238 lines, strategy pattern), LabelService (65 lines), IterationService (195 lines). PMS 1,696→365 lines, pure facade. All public method signatures unchanged. container.ts registers all 14 services. |
| G3-02 | Field-value update: fragile mega-switch, no strategy pattern | ProjectManagementService (field handlers) | MEDIUM | DONE — extracted to FieldValueService with `makeStrategy()` pattern (text, number, date, single_select, iteration). Each strategy encapsulates GraphQL mutation + variable formatting. |
| G3-09 | **Duplicate/orphaned automation service**: `ProjectAutomationService` existed but wired to nothing; PMS duplicated it with inline automation methods | MEDIUM | DONE (Option A) — registered `ProjectAutomationService` in container (instantiated with factory repos + Logger); PMS's 7 automation methods now delegate to it (keep tool-shaped I/O mapping, drop duplicated findById checks + automationRepo getter). Orphaned service is now the single automation implementation. detect-changes MEDIUM/3 flows; 146 tests pass |
| G3-03 | 38 `as any` across services | see G0-06 | MEDIUM | DONE — only 1 documented SDK cast remains (index.ts:321); all others are test mocking patterns (acceptable). |
| G3-04 | Token estimation hardcoded (300/400/500), no real counting | TaskContextGenerationService.ts:207-256 | MEDIUM | DONE — created `TokenCounter` (word-based heuristic: 1.3 tokens/word) + `TokenBudgetManager`. Replaced all 5 hardcoded estimates with `TokenCounter.estimateFromObject()`. |
| G3-05 | AI response caching stubbed (`cacheHit:false` TODO) | TaskContextGenerationService.ts:113 | MEDIUM | DONE — created `AIResponseCache` with SHA-256 content hashing, TTL expiry (default 1hr), LRU-style eviction (oldest-first), configurable maxEntries (500). |
| G3-06 | `contextQualityMetrics` missing from EnhancedAITask | TaskGenerationService.ts:272 | LOW | DONE — added `contextQualityMetrics?: { completeness: number; relevance: number; clarity: number; overallScore: number }` to EnhancedAITask interface in traceability-types.ts. |
| G3-07 | AIServiceFactory singleton — untestable, no reset | AIServiceFactory.ts | MEDIUM | DONE — registered in DI container (container.ts). index.ts resolves from container instead of direct `getInstance()`. All DI registrations standardized to useFactory pattern. |
| G3-08 | No input sanitization on PRD content to AI | PRDGenerationService, TaskGenerationService | MEDIUM (security) | DONE — created `InputSanitizer` with size limits (PRD 100K, issue 50K, task 20K chars), control char stripping, length enforcement. Wired into PRDGenerationService, TaskGenerationService, IssueTriagingService, IssueEnrichmentService. |

## G4 — MCP Layer (`src/index.ts`)

| ID | Gap | Location | Severity | Status |
|----|-----|----------|----------|--------|
| G4-01 | index.ts 1,271 lines, monolithic dispatch (see G2-03) | index.ts | HIGH | DONE — collapsed to 1,023 lines via ToolRegistry single dispatch (see G2-03). |
| G4-02 | Live "Tool handler not implemented" fallthrough path | index.ts:787 | LOW | DONE — ToolRegistry.execute() throws McpError(MethodNotFound) when no executor registered. |

## G5 — Testing

| ID | Gap | Location | Severity | Status |
|----|-----|----------|----------|--------|
| G5-01 | ContextualReferenceGenerator: AI-fallback/error paths untested | context/ContextualReferenceGenerator.ts | HIGH | DONE — 12+ new test cases added: error logging, generateObject failures, keyword matching, PRD truncation, undefined results, empty inputs, factory lifecycle. |
| G5-02 | DependencyContextGenerator: parallel/complex graphs untested | context/DependencyContextGenerator.ts | HIGH | DONE — 8+ new test cases: diamond graphs, circular deps, deep chains, missing deps, mixed resolved/unresolved, large graphs, parallel grouping, shared deps. |
| G5-03 | ContextQualityValidator: pipeline integration untested | validation/ContextQualityValidator.ts | MEDIUM | DONE — pipeline integration tests added (in progress via subagent). |
| G5-04 | Many services lack dedicated unit tests | src/services/* | HIGH | DONE — created FieldValueService.test.ts, PullRequestService.test.ts, LabelService.test.ts, IterationService.test.ts. 20+ test cases for newly extracted services. |
| G5-05 | E2E logger stderr timing flake | e2e/stdio-transport.e2e.ts | LOW | DONE — fixed timing issue (in progress via subagent). |
| G5-06 | **Test-infra blocker**: `tests/ai-services/*` fail to load — `@ai-sdk/anthropic` → `nanoid` ESM not transformed by Jest | jest.config.cjs | HIGH | DONE (moduleNameMapper maps nanoid + nanoid/non-secure to a CJS test stub; AI suites load — SprintRiskAssessor + SprintSuggestionService 61/61, retroactively validating Layer B) |
| G5-07 | **Test-infra**: real `ResourceCache` had no direct behavioural coverage (the old suite was a hand-rolled mock; the Jest CJS-interop blocker is gone — Vitest constructs `new ResourceCache()` fine) | src/__tests__/unit/infrastructure/cache/ResourceCache.test.ts / ResourceCache.ts | MEDIUM | DONE — replaced the mock stub with a real-cache suite (13 tests, fake timers): capacity cap with oldest-first eviction, TTL expiry/default TTL/refresh, and tag/type/namespace index consistency after eviction, expiry, delete, invalidateByTags, clearByType. **Defect found & fixed**: `set()` on an existing key left the previous entry's tag/namespace index rows behind, so `getByTag`/`getByNamespace` returned resources no longer carrying that tag/namespace; `set()` now calls `removeFromIndices` on the replaced entry. |

## G7 — Stack / SDK Review (dependency layer — the true bottom)

Audit 2026-07-15: `npm outdated` + `npm audit` (was 31 vulns: 1 critical, 8 high).

| ID | Item | Severity | Status |
|----|------|----------|--------|
| G7-01 | **CRITICAL** Handlebars JS injection via `@partial-block` (direct dep, TemplateEngine) | CRITICAL | DONE (npm update → handlebars 4.7.9) |
| G7-02 | Safe in-range tier: `npm update` (within-major patch/minor for all deps) | HIGH (sec) | DONE (31→12 vulns; cleared critical + all 8 high; lockfile-only, no package.json/API change; build tsc 0 errors) |
| G7-03 | `@ai-sdk/provider-utils` resource-consumption HIGH | HIGH | DONE (cleared by in-major @ai-sdk bumps in G7-02) |
| G7-04 | Remaining 12 vulns (8 low, 4 moderate) need `--force` majors (uuid→14, jest-junit→17) — dev-tooling/transitive | LOW-MED | DEFERRED (low value, breaking) |
| G7-05 | **AI SDK major migration**: `ai` 4.3→5, `@ai-sdk/*` 1→2 | HIGH | DONE (coupled with zod 4 — AI SDK v1 peer-blocked zod 4. Fixed `maxTokens`→`maxOutputTokens` at ~30 sites; providers/schemas unchanged. 2250+ tests pass, e2e MCP compliance 5/5) |
| G7-06 | `zod` 3.25→4 | HIGH | DONE (feasibility gate PASSED — MCP SDK 1.29 + zod-to-json-schema 3.25.2 both peer-accept zod 4; the "pinned/WONTFIX" gotcha was STALE. Fixed: z.record two-arg (7), ZodError.issues (4), .nonstrict removed, ParameterCoercion $ZodType casts, deleted dead convertZodToJsonSchema. Build + MCP schema gen verified) |
| G7-08 | Self-dependency: `mcp-github-project-manager` listed as its own dependency | LOW | DONE (removed; dragged in stale published tree) |
| G7-09 | GitHub SDK review (Octokit) | LOW | DONE — `@octokit/rest` 22.0.1 already latest (core 7.0.6, plugins current); no SDK change needed. Fixed a type skew: `rest-types.ts` imported `components` from top-level `@octokit/openapi-types@25` while `@octokit/rest@22` runs on 27. Bumped devDeps `@octokit/openapi-types` 25→27, `@octokit/types` 14→16 to align. tsc 0 errors; github repo tests 48/48 |
| G7-07 | Tooling majors: TypeScript→7 (Go compiler), jest→30, eslint→10 | — | DEFERRED (no shipped-code value; high churn) |

## G6 — Feature Proposals (PROPOSED — require go-ahead before build)

| ID | Feature | Rationale | Source |
|----|---------|-----------|--------|
| G6-01 | Analytics & Reporting tools (phase 11) | Roadmap phase, entirely absent; README "Identified Gap" | STATUS phase 11 |
| G6-02 | Real-time webhook sync / SSE streaming | README identified gap; V2-01/04 | REQUIREMENTS v2 |
| G6-03 | Redis / pluggable cache backend + eviction | scaling, multi-instance | V2-08, CONCERNS |
| G6-04 | OpenTelemetry metrics/observability | production monitoring | V2-09 |
| G6-05 | Secret-manager support (Vault/AWS SM) + key rotation | secrets hygiene | CONCERNS — DONE (approved). Added `SecretProvider` abstraction (`src/infrastructure/secrets/`): Env + File providers (File = Docker/k8s `/run/secrets` convention, dependency-free, sync). `SECRETS_DIR` layers file secrets before env. env.ts routes config through the resolver; `getSecret(name)` reads fresh for rotation. Vault/AWS SM documented as async extension point. 10 unit tests pass; config consumers 5/5 |
| G6-06 | Query batching / prefetch for related resources | perf | README gap |

---

## IBF — Industry Best Features (added 2026-08-05)

| ID | Feature | Status |
|----|---------|--------|
| IBF-1 | Graceful shutdown with request draining | DONE — `GracefulShutdown` class tracks in-flight requests, drains on SIGINT/SIGTERM, force-exits after timeout. Wired into index.ts with shuttingDown rejection. |
| IBF-2 | Startup config validation (Zod schemas) | DONE — `config-schema.ts` with 7 grouped schemas (GitHub, AI, Sync, Webhook, AIModel, AITask, Server). `env.ts` validates at startup, exits on invalid required config, warns on missing AI keys. |
| IBF-3 | Structured JSON logging | DONE — `StructuredLogger` with JSON/text dual-mode (`LOG_FORMAT=json`). Level filtering via `LOG_LEVEL`. NDJSON to stderr in JSON mode. |
| IBF-4 | Rate limit awareness + backoff | DONE — `RateLimitManager` monitors GitHub API limits (30s cached), calculates proportional backoff, updates from response headers. Wired into `GitHubRepositoryFactory`. |
| IBF-5 | Request size limits | DONE — covered by InputSanitizer (see G3-08). |
| IBF-6 | Token budget management | DONE — `TokenBudgetManager` with per-session budget tracking. See G3-04. |
| IBF-7 | Prompt versioning | DONE — `PromptRegistry` with versioned templates, `{{variable}}` interpolation, getLatest/getVersion/render/list. |
| IBF-8 | Tool pagination | DONE — `Pagination.ts` with cursor-based pagination (base64url-encoded offset cursors), configurable page size (max 100), `paginate()` and `parsePaginationParams()` utilities. |


## G8 — Agent Orchestration (added 2026-08-05)

Full autonomous agent orchestration layer enabling AI agents to self-assign tasks,
report progress, submit work products, and operate within token budgets.

| ID | Feature | Status |
|----|---------|--------|
| G8-01 | Domain types (`agent-orchestration-types.ts`) | DONE — Agent, TaskCheckoutResult, AgentHeartbeat, WorkProduct, TestResults, AgentBudget, BudgetStatus, AgentTaskContext, AgentActivityEntry types with Zod schemas. Subagent hierarchy via `parentAgentId`. |
| G8-02 | Agent registry infrastructure (`AgentStore`) | DONE — GitHub-backed JSON agent registry (branch `agent-registry`). CRUD: listAgents, getAgent, createAgent, updateAgent (field-level CAS; the original whole-record `upsertAgent` was removed in G13-01), removeAgent, removeAgentCascade, getChildren. |
| G8-03 | Work product infrastructure (`WorkProductStore`) | DONE — Structured issue comments with `<!-- agent-work-product: -->` markers for machine-parseable retrieval. |
| G8-04 | Project field setup (`ProjectFieldSetup`) | DONE — Auto-provisions 7 custom project fields: `agent_claimed_by`, `agent_claimed_at`, `agent_status`, `agent_work_branch`, `agent_pr_number`, `agent_heartbeat_at`, `agent_progress` (the last two added in G13-02). |
| G8-05 | Task checkout service (`TaskCheckoutService`) | DONE — Task claiming with configurable strategies (priority, age, skills, deadline), release, completion. Updates project fields on claim/release/complete. |
| G8-06 | Agent context service (`AgentContextService`) | DONE — Enriched context assembly: issue details, parent issue, milestone, related issues, coding standards, acceptance criteria, branch suggestion. |
| G8-07 | Work product service (`WorkProductService`) | DONE — Work product submission with test results, branch, PR number, commit SHAs, file list. Records structured comments on issues. |
| G8-08 | Agent budget service (`AgentBudgetService`) | DONE — Per-agent token budgets with warning thresholds, hard stops, periodic resets (daily/weekly/monthly/never). |
| G8-09 | MCP tool schemas (`agent-orchestration-schemas.ts`) | DONE — 13 Zod input schemas for all agent orchestration tools. |
| G8-10 | MCP tool definitions and executors (`agent-orchestration-tools.ts`) | DONE — 13 tool definitions with descriptions, examples, annotations; 13 executor functions with error mapping. |
| G8-11 | Tool registration (`ToolRegistry.ts`) | DONE — 12 agent tools registered (check_work_status pending wiring). Total tool count: 131 (132 registrations, 1 overwrite). |
| G8-12 | Executor wiring (`index.ts`) | DONE — All 13 agent tools wired in `registerToolExecutors()`. |
| G8-13 | Documentation | DONE — README agent orchestration section, architecture.md layer docs, TOOLS.md 13-tool reference, CONFIGURATION.md constants, CHANGELOG entry. |

## G9 — Agentic Capability Waves (added 2026-08-07)

Five waves building the agent orchestration layer into a production-grade
operating layer for any agentic harness (Codex / Claude Code / Cursor / custom
loops) over GitHub Projects as the task substrate. All waves: full implementation + tests + docs.

| ID | Feature | Status |
|----|---------|--------|
| G9-01 | **Real checkout strategies** — `pickCandidate` now actually implements `highest_priority` (P0-P3 / `priority:*` labels), `oldest_first` (createdAt), `skills_match`, `milestone_deadline` (milestone `dueOn`); returns `selectionRationale` | DONE — TaskCheckoutService; 46 new unit tests |
| G9-02 | **Atomic claims** — TOCTOU guard: re-reads item field values immediately before claiming; aborts cleanly if another agent claimed concurrently. Registry blob: `AgentStore.mutateAgents` read-modify-write with verify-and-merge retry (max 3) — parallel heartbeats/registrations can't silently drop agents | DONE — TaskCheckoutService.claimProjectItemAtomic + AgentStore |
| G9-03 | **Dependency-aware checkout** — `skipBlocked: true` skips issues whose declared blockers are open (`Blocked by #N`, `Depends on #N`, `blocked` label) | DONE |
| G9-04 | **`reclaim_stale` action** — exposes `reclaimStaleTasks()` via `agent_manage`; returns stale-heartbeat tasks to the pool, marks agents offline | DONE |
| G9-05 | **`record_usage` action** — agents report token spend (`AgentBudgetService.recordUsage`); hard stops now actually trigger | DONE |
| G9-06 | **Review workflow** — `submit_for_review` (issue → review queue, agent → `needs_review`), reviewer `checkout_task { reviewQueue: true }`, `approve_task` (complete+close), `reject_task` (return to pool + feedback comment) | DONE — first-class `reviewer` role |
| G9-07 | **AI checkout strategy (`ai`)** — LLM ranks the claimable pool via `generateObject` with skill/priority/deadline/blocker context; graceful deterministic fallback when AI unavailable | DONE — TaskCheckoutService.pickCandidateWithAI |
| G9-08 | **AI-augmented task context** — `AgentContextService` best-effort AI suggestions: acceptance criteria, complexity estimate (1-13), implementation guidance, confidence; base GitHub-derived context always returned | DONE |
| G9-09 | **Heartbeat history** — bounded (50) most-recent-first log on agent metadata; surfaced in `get_activity` | DONE |
| G9-10 | **Agent metrics (`get_metrics`)** — `AgentMetricsService`: aggregate + per-agent throughput, cycle time, budget burn, staleness (G6-01 analytics subset) | DONE |
| G9-11 | **Checkout pagination** — open-issues query walks cursors (max 5 pages) instead of `first: 100` | DONE |
| G9-12 | **Harness DX** — `docs/agent-harness-integration.md` (Codex/Claude/Cursor/custom recipes) + `examples/basic/agent-loop.ts` reference loop | DONE |
| G9-13 | **G8 layer unit tests** — 46 tests across AgentStore, TaskCheckoutService, AgentBudgetService, WorkProductService, ProjectFieldSetup, AgentMetricsService | DONE — all 6 suites pass; full suite 2436 pass / 20 pre-existing skips |

## G10 — Auto-Reclaim Scheduler + Field Setup Tool + Agent E2E (added 2026-08-07)

Closes the last autonomy gap (self-healing without a dispatcher), exposes field
provisioning as a first-class tool, and adds real-GitHub E2E coverage for the
whole agent layer.

| ID | Feature | Status |
|----|---------|--------|
| G10-01 | **Auto-reclaim scheduler** — `AgentReclaimScheduler` service runs a server-side sweep every `AGENT_RECLAIM_INTERVAL_MS` (default 5 min, enabled by default) reclaiming tasks from agents whose heartbeat exceeds `AGENT_STALE_AFTER_MINUTES` (default 30); marks agents `offline`; posts an `## Agent Task Auto-Reclaimed` audit comment per issue (added to `reclaimStaleTasks`); unref'd timer never blocks stdio shutdown; re-entrancy guard; sweep errors logged not thrown | DONE — wired in container.ts + index.ts lifecycle (start on boot, stop on graceful shutdown); env-configurable; 10 new unit tests |
| G10-02 | **`setup_agent_fields` tool** — idempotently provisions the 5 agent orchestration fields on a project via `ProjectFieldSetup`; exposed as granular tool + `agent_manage/setup_fields` (was already reachable via `manage_project/setup_agent_fields` and `system/setup_project_fields`) | DONE — schema + tool def + executor + ToolRegistry + index.ts + compound routing |
| G10-03 | **Agent orchestration E2E suite (real GitHub)** — `src/__tests__/e2e/tools/agent-orchestration.e2e.ts`: tool presence/schema, invalid-enum validation, project + field provisioning (idempotency), register/list, full lifecycle (checkout → context → heartbeat → activity → work product → review → approve → release), double-claim rejection, budgets (set/status/record), crash-recovery reclaim (deterministic staleness via `timeoutMinutes: 0.01` + real-timer wait), metrics; agent cleanup in afterAll; graceful skip without real creds | DONE — run via `npm run test:e2e:tools:real:agent` or `node scripts/run-e2e-tests.js --agent-only --real-api`; runner gained `--agent-only` |

## G11 — Agentic Orchestration Product Audit (added 2026-10-21)

Audit of the platform as a product: MCP control plane, GitHub Projects/Issues/Comments as the
durable data layer, long-running autonomous development across external agent harnesses.
Method: GitNexus graph audit (impact/context/cycles/detect-changes) + source verification,
reconciled against `docs/agent-harness-integration.md`, `docs/TOOLS.md`, `docs/architecture.md`.
Each row is a CONFIRMED defect with the fix that landed; "PROPOSED" rows await a user decision.

| ID | Gap | Location | Severity | Status |
|----|-----|----------|----------|--------|
| G11-01 | **Review handoff was dead**: `submit_for_review` left `agent_claimed_by` set, and review-queue checkout refuses claimed items — a reviewer could never pick up submitted work, so the approve/reject path was unreachable through the documented route | TaskCheckoutService.submitForReview / checkoutTask | HIGH | DONE — submission clears the claim and sets `agent_status=review`; approve/reject release EVERY agent holding the task (submitter and reviewer) |
| G11-02 | **Wrong project item**: claim, status, and candidate selection used `projectItems.nodes[0]`, so an issue in several projects could be claimed/updated in the wrong project | TaskCheckoutService | HIGH | DONE — `selectProjectItem(issue, projectId)` used for selection, direct assignment, candidate scan, claim and status writes |
| G11-03 | **PM could assign across projects**: `assign_task` accepted an issue that is not in the requested project | TaskCheckoutService.checkoutTask | MEDIUM | DONE — assignment now fails when the issue is not in the requested project, and no registry claim is written |
| G11-04 | **Registry failed open**: a corrupted registry body was reported as "zero agents" — the platform silently forgot every agent | AgentStore.listAgents | HIGH | DONE — malformed JSON and invalid agent records fail loudly with the issue number; records validated with the domain schema |
| G11-05 | **Registry duplication/race**: the first labeled issue won, and a concurrent create produced two registries | AgentStore.getRegistryIssue | MEDIUM | DONE — canonical selection (titled "Agent Registry", then oldest) and a re-list after creation |
| G11-06 | `removeAgentCascade` reported a removal count for agents that did not exist | AgentStore | LOW | DONE |
| G11-07 | **Work products were read partially and unvalidated**: only the first comment page, payload cast without checking, corrupt comments silently included | WorkProductStore.listForIssue | MEDIUM | DONE — paginated reads, payload parsed through the work-product schema, invalid comments ignored |
| G11-08 | **Field inspection failures were swallowed** as "the project has no fields" → duplicate or wrongly-typed fields were created; an existing field with the wrong type was accepted | ProjectFieldSetup | HIGH | DONE — inspection failures propagate; an incompatible data type is a hard error; a single-select field missing status options gets the missing options ADDED (additive, never deletes user options) |
| G11-09 | **Compound tool schemas accepted under-specified calls**: every action argument was optional, so clients discovered nothing and got runtime errors instead of protocol validation | compound-schemas.ts | MEDIUM | DONE — `agent_work`/`agent_manage` are action-discriminated unions; the advertised schema is a hybrid (flat top-level properties for client discovery + `oneOf` variants for per-action required arguments) |
| G11-10 | **`set_budget` ignored the documented argument**: the schema and docs said `warningThreshold`, the executor read `warningFraction` | compound-executors.ts | MEDIUM | DONE — `warningThreshold` is accepted as an alias and mapped to `warningFraction` |
| G11-11 | **`rebalance_workload` did not rebalance**: it only reclaimed stale work although the docs promised redistribution | compound-executors.ts | MEDIUM | DONE — reclaim of stale work followed by smart-assignment redistribution, with both counts in the result |
| G11-12 | **`converge_project` bypassed the lifecycle**: it closed issues and commented, but left the claim, the project status field and the owning agent's registry state stale | compound-executors.ts | HIGH | DONE — with a `reviewerId` the task is settled through the normal approve/reject path; otherwise the owner is released and the project claim/status state is cleared before the fallback comment/close |
| G11-13 | **Blocker parsing honored only the first reference** of each phrase (`Blocked by #1, #2` ignored `#2`) | TaskCheckoutService.hasOpenBlocker | MEDIUM | DONE — every reference of every supported phrase is checked |
| G11-14 | **`release_task` hid project failures**: a failed claim clear was swallowed, so the task looked released while still claimed | TaskCheckoutService.releaseTask | MEDIUM | DONE — the failure is returned and the registry claim is kept |
| G11-15 | **The reference loop was fiction**: `runAgentLoop` replayed a static plan whose arguments were placeholders (`agent-<id-from-register>`, `issueNumber: 42`, `taskId: "issue-42"`), so every step after `register` targeted nothing, and a try/catch printed `Step failed` and carried on — failures were invisible; it also used a route that does not exist (`agent_manage` + `checkout_task` for a reviewer). The first fix only relabeled it | examples/basic/agent-loop.ts | MEDIUM | DONE — now a real runnable loop on `@modelcontextprotocol/client` spawning `node build/index.js`: worker (register → checkout_task → get_task_context → heartbeat → submit_work_product → submit_for_review → record_usage) and reviewer (register → checkout_task{reviewQueue} → approve_task / `--reject`), every id threaded from the previous response and parsed like the e2e `data()` helper; `isError`, `success:false` or a missing id exits non-zero with a clear message, an empty queue is a clean reported exit, agents are deregistered in `finally`; `--project` is required, `--create-demo-task` seeds a self-contained smoke run, `--plan` prints the call sequence with symbolic refs (`$workerRegister.id`). Smoked live against the scratch repo |
| G11-16 | **Product-level coverage was thin**: no review-queue checkout, no budget hard-stop refusal, no PM convergence/rebalance coverage, and the budget test depended on another test's token usage | agent-orchestration.e2e.ts | MEDIUM | DONE — the budget test uses its own agent and budget; the live suite (real GitHub, extended mocked-MCP utils, no parallel harness; 38/38 green) covers, each in its own project and asserted on issue state, Project V2 claim fields, registry records and comments: the worker loop, rejection, crash recovery, PM assign + smart_assign, concurrent checkout, budget hard stop; `rebalance_workload` (stale owner reclaimed, idle capable agent becomes owner, audit comment); `converge_project` with a reviewer (lifecycle approve closes + clears the claim, reject returns to pool with feedback) and without one (owner released, claim cleared, Auto-Approved/Auto-Rejected fallback comment, approved closed); `converge_until_done` (per-iteration progress, termination, max-iteration cap); native blockers (`add_blocker`/`list_dependencies`/`remove_blocker` with `checkout_task {skipBlocked}` before and after the blocker closes); `checkout_task {view}` (a created view is the pool; GitHub's API cannot set a view sort, so a sort-less view falls back to the strategy — the sort pick stays unit-covered). Defects found and fixed: `manage_issues remove_blocker` returned no payload (invalid MCP result; `manage-issues-blockers.test.ts`), `validate_work_product` dropped `workProduct.agentId` (`ValidateWorkProduct.test.ts`). Harness: `ProjectV2.items` lists a new item 2-3 s late, so scenarios wait until the item is listable before the PM actions run |
| G11-17 | Storage-seam unit coverage: registry lost-update, corrupt registry body, work-product pagination and validation | AgentStore / WorkProductStore | MEDIUM | DONE — `AgentStoreConcurrency.test.ts` (9: concurrent upserts with paused writes, last-write-wins, malformed/invalid registry fails closed, duplicate registries fold to the canonical one, cascade removal) and `WorkProductStore.test.ts` (8: multi-page reads, invalid JSON / non-work-product / unmarked comments ignored, write-then-read) on the single shared fake `src/__tests__/helpers/FakeGitHub.ts` |
| G11-18 | **Registry lost updates (P0, bead 49j.4)**: the registry was a JSON array in an issue body, which has no compare-and-swap — two writers could both read, both write, and both succeed while one registration vanished (observed live as "Agent not found" right after `register`; 13 of 20 concurrent registrations failed and 5 of the 7 that reported success were gone from a fresh read). The write-then-verify loop with a 3-way merge could not see a write that landed after its verify | AgentStore | CRITICAL | DONE — the registry is `registry.json` on the orphan branch `agent-registry`, written through the Contents API with sha compare-and-swap: a stale sha is a 409, the mutator is re-applied to the fresh list and retried with jittered backoff (bounded; exhaustion throws), a no-change mutation writes nothing. Bootstrap is blob → tree → parentless commit → `createRef` (422 = another process won; re-read). A legacy "Agent Registry" issue is imported once (duplicates folded, record written last wins, corrupt canonical fails closed) and rewritten to a pointer. A missing `contents: write` or a ruleset on the branch raises an error naming the branch and the permission. Removed: 3-way `mergeRegistries`, the verify loop, per-process merge state, duplicate-issue folding and title/label discovery in normal operation (kept only in `LegacyAgentRegistry` for the migration). Supersedes the storage described in G11-04/05/17; `FakeGitHub` now models refs + contents with sha CAS. Verified live on the scratch repo: 2 server processes x 10 concurrent registrations → 20/20 present from a third process, deregister-all → 0 remain (old build: 13 of 20 refused, 5 of 7 reported successes missing) |

### Decisions taken with the user (2026-10-21)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Public agent tool schema shape | Hybrid: flat top-level properties + `oneOf` per action | Keeps every argument discoverable for clients that only read top-level `properties`, while per-action required arguments stay enforced at the protocol boundary |
| Legacy project field missing a status option | Auto-add the missing option | A project created by an older version keeps working; the orchestrator can always write the statuses it needs; options are only added, never deleted |
| Product-level test harness | Extend the existing mocked-MCP e2e utils | One harness for the product surface; no parallel fake to maintain |

## G12 — Live GitHub API Conformance + Capability Adoption (added 2026-10-21)

The repository was checked against the **live** GitHub GraphQL schema (GitHub's own published
FPT schema, plus live `gh api graphql` introspection of the Mutation type) and against the
installed dependency packages (`@modelcontextprotocol/server@2.3.1`, `zod@4.6.7`,
`@octokit/rest@22`). Everything below is a confirmed mismatch between the code and the API
it calls, or a capability GitHub has that the platform does not use.

| ID | Gap | Location | Severity | Status |
|----|-----|----------|----------|--------|
| G12-01 | **The automation-rule feature targeted an API that does not exist** — `createProjectV2Rule` / `updateProjectV2Rule` / `deleteProjectV2Rule`, `Create/Update/DeleteProjectV2RuleInput`, `ProjectV2.projectRules` and the `ProjectV2Rule` type are absent from the live schema. Every `manage_automation` call failed | GitHubProjectWorkflowRepository.ts, automation-types.ts, `manage_automation` | HIGH | DONE — ported to the real automation surface: `ProjectV2.workflows` (list), `node(id:)` (read one) and `deleteProjectV2Workflow` (delete). GitHub has no create/update mutation for workflows, so the surface is read + delete by design; `manage_automation` is now `list_workflows` / `get_workflow` / `delete_workflow` |
| G12-02 | **`update_project_view` failed on every call** — the service sent `{projectId, id}` and a layout like `BOARD`; `UpdateProjectV2ViewInput` carries `viewId` only and the enum is `BOARD_LAYOUT`/`TABLE_LAYOUT`/`ROADMAP_LAYOUT`. A second, correct implementation existed in the repository | ProjectTemplateService.updateProjectView | HIGH | DONE — the service delegates to the repository (`updateView`); the repository also owns the view listing now (`listViews`), so one implementation of the view GraphQL remains |
| G12-03 | **Non-existent single-select option mutations** — `addProjectV2SingleSelectOption` / `updateProjectV2SingleSelectOption` / `deleteProjectV2SingleSelectOption` do not exist; the option set is replaced by the list sent with `updateProjectV2Field` (an option sent with its `id` keeps its identity) | GitHubProjectRepository, ProjectFieldSetup | HIGH | DONE — `buildFieldOptions` / `buildSingleSelectOptions` send the full list with the existing ids preserved |
| G12-04 | **Invalid input fields** — `projectId` was sent to `Update/DeleteProjectV2FieldInput` and `Update/DeleteProjectV2ViewInput` (none of them has it); `CreateProjectV2FieldInput.iterationDuration`/`.iterationStartDate` do not exist (the input is `iterationConfiguration: {startDate, duration, iterations}`) | GitHubProjectRepository | HIGH | DONE |
| G12-05 | **Non-null option fields sent as null** — `singleSelectOptions` requires a `description` and a `color` from a closed enum; unknown colors now fall back to `GRAY` instead of failing the call | GitHubProjectRepository, util/graphql-helpers | MEDIUM | DONE |
| G12-06 | **The advertised field-type set included values GitHub cannot create** — `milestone` / `assignees` / `labels` / `tracked_by` / `repository` are readable `ProjectV2FieldType` values, not creatable `ProjectV2CustomFieldType` members; `timeline` is not a `ProjectV2ViewLayout` at all | src/domain/types.ts, tool schemas | MEDIUM | DONE — the creatable set is now exactly TEXT, NUMBER, DATE, SINGLE_SELECT, MULTI_SELECT, ITERATION, and the layouts are board / table / roadmap |
| G12-07 | `IssueFilters.milestoneId` — the filter wants `milestoneNumber`; the domain id is the milestone node id, so it has to be resolved first | GitHubIssueRepository | MEDIUM | DONE |
| G12-08 | `pulls.listReviews` was called without pagination (30 per page), so older reviews were lost and the newest-review-per-author logic could miss a review | agent-orchestration-tools | MEDIUM | DONE — the reviews are read page by page until a short page, and the newest review per author is chosen on `submitted_at` (the live API returns reviews oldest-first) |
| G12-09 | The project field-value reader selected 2 of the 13 `ProjectV2ItemFieldValue` union members, so most value kinds were invisible | project-advanced-tools | MEDIUM | DONE — all 13 members are selected through the shared field-configuration fragment, and every kind renders to a deterministic string (Repository, Milestone, Sprint, Status, …) |
| G12-10 | Three copies of the field-type mapper existed; the dead ones still mapped to non-creatable enum values | graphql-types.ts, field-types.ts | LOW | DONE — the dead copies and the orphan `field-types.ts` are deleted; `util/graphql-helpers.ts` is the only home |
| G12-11 | The compound agent tools advertised a parameterless schema | ToolRegistry | MEDIUM | DONE — hybrid schema: flat top-level properties for discovery plus one `oneOf` variant per action for the per-action required arguments, validated by the SDK's own Ajv |
| G12-12 | Tool output schemas were generated with the input view, so defaulted output fields were marked as required by the SDK's output validation | ToolRegistry | LOW | DONE — output schemas use `io: "output"` |

### Capabilities GitHub has that the platform did not use (adopted by user decision 2026-10-21)

Native features are authoritative; the label/body conventions stay as a fallback so boards
that exist today keep working.

| ID | Capability | Why it matters for the agent loop | Status |
|----|------------|-----------------------------------|--------|
| G12-13 | **Native issue dependencies** (`Issue.blockedBy`, `addBlockedBy`, `removeBlockedBy`) — the platform emulated them with `blocked-by:#N` labels and issue-body parsing, so a task blocked by another agent's in-flight work was invisible to the claimer | the claim path stops handing out blocked work | DONE — the native edges are read and written (`manage_issues/list_dependencies`, `add_blocker`, `remove_blocker`); the label/body emulation is the fallback, and the claim path honours the native edge |
| G12-14 | **Native issue types** (`Issue.issueType`, `updateIssueIssueType`, `Organization.issueTypes`) — emulated with `type:` labels | task kind becomes filterable and groupable on the board | DONE — `Issue.issueType` is read and written (`updateIssueIssueType`), the organization catalogue is behind `manage_issues/list_issue_types`, and a type outside the catalogue stays a `type:` label |
| G12-15 | **Multi-select project fields** (`MULTI_SELECT`, `multiSelectOptionIds`, `ProjectV2ItemFieldMultiSelectValue`) — absent from the domain | an agent's capabilities become a set instead of a single value | DONE — the creator, the item-value writer (`multiSelectOptionIds`) and the reader (`ProjectV2MultiSelectFieldOption`) all handle it |
| G12-16 | **Project roles and collaborators** (`updateProjectV2Collaborators`, `ProjectV2Roles`) — never used | least-privilege board access per agent identity | DONE — `manage_project/set_collaborators` writes `updateProjectV2Collaborators` with the four live roles; GitHub has no role read, so the granted roles are what comes back |
| G12-17 | **Views as server-side claiming pools** (`ProjectV2View.filter`, `groupByFields`, `sortByFields`) — the platform scans the whole board client-side on every claim | named claiming pools, no board scan per claim | DONE — `manage_project/list_views` returns the view's `filter` / `groupByFields` / `sortBy` / `visibleFields`, and `agent_work/checkout_task` accepts a `view`: the view's order decides which task is handed out first |
| G12-18 | **Reverse membership** (`Issue.projectItems(includeArchived:)`) — never queried, so an issue already tracked on another board could be claimed on a second board | removes a class of double-claim bugs | DONE — the claim path reads the issue's project items with `includeArchived: true` and refuses a task that is already claimed on another board |
| G12-19 | The agent registry was found through GitHub's REST `labels` filter, which intermittently answers the same request with an empty set — an empty answer was read as "no registry", so a new registry issue was created on nearly every run (thirty in the scratch repository) and the agents were spread over them | the registry is the platform's memory: split across issues, half the agents are invisible | DONE — the registry is found by its title (the label is a retried fallback), duplicates are folded into the canonical issue, the last-written record wins, a corrupt body is left untouched so the read fails closed, and the canonical body is read directly (the issue list serves it from a cache, and a read-modify-write on a stale copy dropped a registered agent) |

### Checked and confirmed current (no action)

`createProjectV2` / `updateProjectV2` / `deleteProjectV2` / `copyProjectV2`, project templates
(`mark/unmarkProjectV2AsTemplate`), `create/update/deleteProjectV2Field`, `create/update/deleteProjectV2View`,
`updateProjectV2ItemFieldValue` / `clearProjectV2ItemFieldValue` (input names and the
`ProjectV2FieldValue` payload match), `addProjectV2ItemById` / `deleteProjectV2Item` /
`archiveProjectV2Item`, `updateProjectV2ItemPosition`, `createProjectV2StatusUpdate`,
`link/unlinkProjectV2ToRepository` and `…ToTeam`, `addSubIssue` / `removeSubIssue` /
`reprioritizeSubIssue`, the `ProjectV2FieldConfiguration` union (exactly the four members the
shared fragment set covers), the iteration-field configuration shape, and every Octokit REST
call the platform makes.

## G13 — Post-audit hardening (added 2026-10-28)

| ID | Gap | Status |
|----|-----|--------|
| G13-01 | Same-agent lost update: `getAgent → modify copy → upsertAgent` overwrote concurrent budget debits/heartbeats of the same agent | DONE — `upsertAgent` removed; `AgentStore.createAgent` + `updateAgent(id, mutator)` apply field-level deltas to the fresh record on every CAS attempt. Regression: `SameAgentLostUpdate.test.ts` (failed 4/4 before the fix). |
| G13-02 | Hot/cold registry split: every heartbeat was a registry commit | DONE — heartbeat/progress/branch live on the claimed project item (`agent_heartbeat_at`, `agent_progress`); registry written only on cold change; reclaim/metrics/swarm status use the newer beat (`AgentHeartbeatResolver`); `get_activity` drops `heartbeatHistory`, adds `heartbeatSource`. Legacy projects are healed additively on first checkout/heartbeat per process (`AgentFieldProvisioner`, b8r.8): concurrent first calls share one provisioning, a type conflict stays a hard error, a permission failure returns the `setup_fields` / project-admin message. |
| G13-03 | Per-call token debit failure was swallowed | DONE — retry once, park in in-memory `UnpaidDebitLedger`, log error, `_meta.budgetDebitFailed` on the result; settled (or checkout refused) at the next `checkout_task`. |

---

*Tracker initialized 2026-07-14. Updated 2026-08-07: full remediation pass — all OPEN gaps closed, 8 industry best features added, agent orchestration layer shipped, then waves G9-01..G9-13 (correctness, autonomy, intelligence, observability, harness DX) shipped with tests + docs, then G10-01..G10-03 (auto-reclaim scheduler, setup_agent_fields tool, agent E2E suite) closed the self-healing + verification loop.*
*Updated 2026-10-21: G11 — product-level audit of the agentic orchestration platform (MCP control plane, GitHub as the data layer). 15 confirmed defects closed across the task lifecycle, the registry, work products, project fields, the compound MCP surface and the PM actions; 2 coverage rows still in flight.*
*Updated 2026-10-21: G12 — live API conformance (12 confirmed mismatches, all 12 closed) and the adoption of seven native GitHub capabilities the platform was emulating or not using (issue dependencies, issue types, multi-select fields, project roles, views as claiming pools, reverse membership, title-based registry lookup).*
