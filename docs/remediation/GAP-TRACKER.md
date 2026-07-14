# Remediation Gap Tracker — Living

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
| G0-01 | STATUS vs REQUIREMENTS contradiction | REQUIREMENTS: 99/99 complete; STATUS: phases 10-12 "Not Started" | Phase 10 partial (ProjectAutomationService exists), phase 11 absent, phase 12 shipped (v1.1.0) | HIGH | OPEN |
| G0-02 | Tool count drift | architecture.md "116", README "115", "40+ & 8" | **120** registered + 120 dispatch cases | MEDIUM | DONE |
| G0-03 | Wrong AI env var in docs | architecture.md `GOOGLE_AI_API_KEY` | code uses `GOOGLE_API_KEY` | MEDIUM | DONE |
| G0-04 | Dead README refs | links `STATUS.md`; docs `npm run test:integration`, `npm run type-check` | STATUS.md absent (real one `.planning/STATUS.md`); neither script in package.json | MEDIUM | DONE |
| G0-05 | Stale graph stats | GAP-ANALYSIS-LIVE "513 nodes/347 edges" | GitNexus index 4632 symbols / 11344 rels | LOW | OPEN |
| G0-06 | DEBT-09..12 overclaim | REQUIREMENTS: `as any` replaced (complete) | Was 38 `as any`, but 31 in tests + 3 template-string false-positives + 1 SDK cast + 1 comment. Real prod casts = 2 (SprintSuggestionService). Fixed Layer B. | MEDIUM | DONE |
| G0-07 | DEBT-07 overclaim | REQUIREMENTS: "reduce PMS to coordination only" complete | ProjectManagementService still 1,696 lines | HIGH | OPEN |

## G1 — Domain Layer (`src/domain/`)

| ID | Gap | Location | Severity | Status |
|----|-----|----------|----------|--------|
| G1-01 | AI response objects untyped; `as any` at boundaries | ai-types.ts + service consumers | MEDIUM | DONE (sprint risk path: domain `as const` tuples now single source of truth for type + zod schema; 6 casts removed across SprintSuggestionService + SprintRiskAssessor) |
| G1-02 | `ai-types.ts` 1,224 lines — cohesion risk | src/domain/ai-types.ts | LOW | OPEN |

## G2 — Infrastructure Layer (`src/infrastructure/`)

| ID | Gap | Location | Severity | Status |
|----|-----|----------|----------|--------|
| G2-01 | **Circular dependency** | FilePersistenceAdapter ↔ GitHubStateSyncService | HIGH | DONE (root cause: `SyncMetadata` type defined in service but imported by 2 infra files. Moved to `domain/resource-types.ts`; repointed FilePersistenceAdapter + ResourceCache; service re-exports for compat. `check --cycles` = clean) |
| G2-02 | `ToolSchemas.ts` god file (2,871 lines) | src/infrastructure/tools/ToolSchemas.ts | HIGH | OPEN |
| G2-03 | Dual dispatch: index.ts 120-case switch parallel to ToolRegistry | index.ts + ToolRegistry.ts | HIGH | OPEN |
| G2-04 | Placeholder-factory smell: `GitHubRepositoryFactory(token,"placeholder","placeholder")` | linking/lifecycle/template/status/advanced tools | MEDIUM | DONE (5 duplicated createFactory helpers → 1 shared `tool-factory.ts#createGitHubFactory(owner?,repo?)` with env fallback; sentinel centralized+documented; 231 tool tests pass) |
| G2-05 | Health check GitHub rate-limit is a stub (TODO) | HealthService.ts:161 | MEDIUM | DONE (checkGitHub now probes octokit.rest.rateLimit.get via injected GitHubRepositoryFactory; fails honest connected:false on missing factory/error; openWorldHint corrected to true; HealthService suite 16/16) |
| G2-06 | Webhook signature validation fails OPEN when secret unset | GitHubWebhookHandler.ts:46-48 | HIGH (security) | DONE (now fails closed: rejects unsigned webhooks unless `WEBHOOK_ALLOW_UNSIGNED=true` explicit dev opt-in; 6 security regression tests pass) |
| G2-07 | EventStore unbounded memory (no LRU eviction) | EventStore.ts | MEDIUM | OPEN |
| G2-08 | ResourceCache: no persistence/eviction policy | ResourceCache.ts (808 lines) | MEDIUM | OPEN |
| G2-09 | **Build blocker** TS2589 "excessively deep type instantiation" (zodToJsonSchema) — pre-existing in WIP checkpoint; breaks `tsc`/`build` | ToolRegistry.ts:277 | HIGH | DONE (bound zodToJsonSchema to concrete `(ZodTypeAny) => Record<string,unknown>` via `toJsonSchema` helper; tsc now 0 errors) |

## G3 — Service Layer (`src/services/`)

| ID | Gap | Location | Severity | Status |
|----|-----|----------|----------|--------|
| G3-01 | **God class** ProjectManagementService (1,696 lines) | ProjectManagementService.ts | HIGH | OPEN |
| G3-02 | Field-value update: fragile mega-switch, no strategy pattern | ProjectManagementService (field handlers) | MEDIUM | OPEN |
| G3-03 | 38 `as any` across services | see G0-06 | MEDIUM | OPEN |
| G3-04 | Token estimation hardcoded (300/400/500), no real counting | TaskContextGenerationService.ts:207-256 | MEDIUM | OPEN |
| G3-05 | AI response caching stubbed (`cacheHit:false` TODO) | TaskContextGenerationService.ts:113 | MEDIUM | OPEN |
| G3-06 | `contextQualityMetrics` missing from EnhancedAITask | TaskGenerationService.ts:272 | LOW | OPEN |
| G3-07 | AIServiceFactory singleton — untestable, no reset | AIServiceFactory.ts | MEDIUM | OPEN |
| G3-08 | No input sanitization on PRD content to AI | PRDGenerationService, TaskGenerationService | MEDIUM (security) | OPEN |

## G4 — MCP Layer (`src/index.ts`)

| ID | Gap | Location | Severity | Status |
|----|-----|----------|----------|--------|
| G4-01 | index.ts 1,271 lines, monolithic dispatch (see G2-03) | index.ts | HIGH | OPEN |
| G4-02 | Live "Tool handler not implemented" fallthrough path | index.ts:787 | LOW | OPEN |

## G5 — Testing

| ID | Gap | Location | Severity | Status |
|----|-----|----------|----------|--------|
| G5-01 | ContextualReferenceGenerator: AI-fallback/error paths untested | context/ContextualReferenceGenerator.ts | HIGH | OPEN |
| G5-02 | DependencyContextGenerator: parallel/complex graphs untested | context/DependencyContextGenerator.ts | HIGH | OPEN |
| G5-03 | ContextQualityValidator: pipeline integration untested | validation/ContextQualityValidator.ts | MEDIUM | OPEN |
| G5-04 | Many services lack dedicated unit tests | src/services/* | HIGH | OPEN |
| G5-05 | E2E logger stderr timing flake | e2e/stdio-transport.e2e.ts | LOW | OPEN |
| G5-06 | **Test-infra blocker**: `tests/ai-services/*` fail to load — `@ai-sdk/anthropic` → `nanoid` ESM not transformed by Jest | jest.config.cjs | HIGH | DONE (moduleNameMapper maps nanoid + nanoid/non-secure to a CJS test stub; AI suites load — SprintRiskAssessor + SprintSuggestionService 61/61, retroactively validating Layer B) |

## G6 — Feature Proposals (PROPOSED — require go-ahead before build)

| ID | Feature | Rationale | Source |
|----|---------|-----------|--------|
| G6-01 | Analytics & Reporting tools (phase 11) | Roadmap phase, entirely absent; README "Identified Gap" | STATUS phase 11 |
| G6-02 | Real-time webhook sync / SSE streaming | README identified gap; V2-01/04 | REQUIREMENTS v2 |
| G6-03 | Redis / pluggable cache backend + eviction | scaling, multi-instance | V2-08, CONCERNS |
| G6-04 | OpenTelemetry metrics/observability | production monitoring | V2-09 |
| G6-05 | Secret-manager support (Vault/AWS SM) + key rotation | secrets hygiene | CONCERNS |
| G6-06 | Query batching / prefetch for related resources | perf | README gap |

---

*Tracker initialized 2026-07-14. Update status column as each gap closes; link commits.*
