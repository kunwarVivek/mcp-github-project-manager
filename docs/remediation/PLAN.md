# Remediation Plan — Layered, Bottom-Up

**Branch:** `remediation/spec-reconciliation`
**Strategy:** Option A (structural). Durable architectural alignment over patching.
**Tracker:** [GAP-TRACKER.md](./GAP-TRACKER.md)

## Operating rules (per project CLAUDE.md + user mandate)

1. Run GitNexus `impact` before editing any symbol; report blast radius.
2. **WARN and pause** on HIGH/CRITICAL impact before proceeding.
3. `detect-changes` before each domain commit; verify scope matches intent.
4. Rename via GitNexus `rename`, never find-replace.
5. Tests run **only** at domain-stable checkpoints and once globally at end — not during active edits.
6. One domain in focus at a time; isolated remediation loop; commit per domain.

## Execution order (bottom-up layers)

Each layer stabilizes before the next starts. Layer = domain = isolated loop.

### Layer A — Spec/Doc Reconciliation  (G0)  ·  risk: LOW
No code symbols. Mechanical + truth-alignment.
- A1: architecture.md tool count 116→120; `GOOGLE_AI_API_KEY`→`GOOGLE_API_KEY`. *(mechanical — this session)*
- A2: README tool count →120; fix dead `STATUS.md` link; fix nonexistent `test:integration`/`type-check` script refs. *(mechanical — this session)*
- A3: Reconcile `.planning/STATUS.md` ↔ `REQUIREMENTS.md` to code-verified truth (phase 10 partial, 11 absent, 12 shipped; DEBT-07/09-12 reopened). *(after domain verification confirms extent)*
- A4: Refresh GAP-ANALYSIS-LIVE graph stats or mark superseded by GAP-TRACKER.
- **Gate:** `npm run lint` (docs don't compile; no test run).

### Layer B — Domain types  (G1)  ·  risk: MEDIUM
- B1: Define typed interfaces for AI response payloads; add type guards (foundation for `as any` removal upstream).
- B2: Assess `ai-types.ts` split (1,224 lines) — only if cohesion clearly improves.
- **Gate:** `npm run test:core` once at layer-stable.

### Layer C — Infrastructure  (G2)  ·  risk: HIGH
- C1: Break cycle FilePersistenceAdapter ↔ GitHubStateSyncService (extract interface / invert dependency). **impact first.**
- C2: Fail-closed webhook signature validation (G2-06, security). **impact first.**
- C3: Split `ToolSchemas.ts` (2,871) into per-domain schema modules. **impact first (widely imported).**
- C4: Remove placeholder-factory smell — factory variant that doesn't demand owner/repo for project-id paths.
- C5: Wire real GitHub rate-limit into HealthService (G2-05).
- C6: EventStore LRU eviction (G2-07); ResourceCache eviction policy (G2-08).
- **Gate:** `npm run test:core` + `npm run test:e2e:tools` at layer-stable.

### Layer D — Services  (G3)  ·  risk: CRITICAL
- D1: Decompose ProjectManagementService (1,696) — extract field-value strategy handlers + any residual domain services. **impact CRITICAL — explicit go-ahead required.**
- D2: Remove 38 `as any` using Layer-B types.
- D3: Real token counting (tiktoken) in TaskContextGenerationService (G3-04).
- D4: Implement AI-response caching (G3-05).
- D5: AIServiceFactory singleton → DI (G3-07).
- D6: PRD input sanitization + size limits (G3-08, security).
- **Gate:** `npm run test` + `npm run test:ai` at layer-stable.

### Layer E — MCP entry  (G4)  ·  risk: HIGH
- E1: Collapse dual dispatch — index.ts delegates to ToolRegistry; delete 120-case switch. **impact first.**
- E2: Thin index.ts to bootstrap only.
- **Gate:** `npm run test:e2e` (MCP protocol compliance) at layer-stable.

### Layer F — Testing  (G5)  ·  risk: LOW
- F1-F4: Fill coverage gaps (context generators, quality validator, untested services) toward 80%.
- F5: Fix E2E logger stderr flake.
- **Gate:** full `npm run test:all`.

### Global validation (end)
- `npm run test:all` once; `npm run lint`; `npm run build`; GitNexus `detect-changes --scope compare --base_ref main`; refresh GAP-TRACKER to DONE.

### Feature proposals (G6)
Presented for go/no-go **before** any build. Not scheduled until approved.

## Progress log
- 2026-07-14: Branch cut, WIP checkpoint `84ca9b4`, GitNexus reindexed, audit complete, tracker+plan created. Starting Layer A.
- 2026-07-14: **Layer A DONE** (`bc40190`) — doc drift reconciled (tool count 120, GOOGLE_API_KEY, dead refs). Tracker+plan committed.
- 2026-07-14: **Layer B DONE** (`96c5f97`) — domain `as const` tuples single source of truth for sprint risk enums; 6 casts removed; SprintPlanningService 52/52 (later AI suites 61/61).
- 2026-07-14: **Layer C in progress**:
  - `c8cf736` G2-09 build blocker (TS2589 zodToJsonSchema) — tsc now 0 errors.
  - `0df799f` G2-01 circular dependency broken (SyncMetadata → domain).
  - `d499d27` G2-06 webhook signature fails closed (security) + 6 regression tests.
  - `6802a32` G2-05 health check wired to real GitHub rate-limit probe; 16/16.
  - `f2a2c21` G5-06 nanoid ESM test blocker fixed — AI suites unblocked (61/61).
  - **Remaining Layer C**: C3 (ToolSchemas 2,871-line split), C4 (placeholder-factory consolidation — RCA done, 7+ call sites mapped), C6 (EventStore/ResourceCache eviction). Then Layer C gate (`test:core` + `test:e2e:tools`).
  - `c0bb28f` G2-04 placeholder-factory consolidated into shared `createGitHubFactory`; 231 tool tests pass.
  - `d4a1175` G2-09 **completion** — TS2589 fully fixed (double-cast); this also fixed `npm run build` OOM-crashing. Build now succeeds with default heap.
  - `9f31620` G7 **stack/SDK safe tier** — `npm update` cleared critical Handlebars + all 8 HIGH vulns (31→12); reflect-metadata jest setupFile fixed a load-order regression the dep dedup exposed.
  - G2-07 verified NOT-A-GAP (EventStore eviction already correct). G2-08 DEFERRED (needs namespace-in-entry data-model change).
  - **Remaining Layer C**: C3 (ToolSchemas 2,871-line split).
- **BUILD NOTE**: `tsc`/`npm run build` need adequate heap for the full type graph; default works now that TS2589 is gone. Prior "0 errors" runs during the session were sometimes tsc aborting on OOM before finishing — always confirm exit code, not just error count.
- **GATES AHEAD (need user go-ahead)**:
  - Layer D1: ProjectManagementService (1,696 lines) decomposition — CRITICAL blast radius.
  - G7-05: AI SDK major migration (`ai` 4→7, `@ai-sdk/*` 1→4) — rewrites `services/ai/`.
- **Layer C gate status**: `test:core` = 1745 pass (the 15 "failures" were missing `build/`; green after `npm run build`; AI suites 61/61; e2e green with build).
- 2026-07-15: **AI SDK v5 + zod v4 coupled migration DONE** (`afd27a1`, G7-05/06/08). Feasibility gate passed (MCP SDK 1.29 + zod-to-json-schema accept zod 4; the pin was stale). Fixed zod-4 breaks (z.record two-arg, ZodError.issues, .nonstrict, ParameterCoercion casts, deleted dead converter) + AI SDK v5 (maxTokens→maxOutputTokens ~30 sites). Removed self-dep. Verified: build OK, 2250+ tests, e2e MCP compliance 5/5.

## D1 — ProjectManagementService decomposition (NEXT, planned)

**Impact (GitNexus):** HIGH — 22 impacted, 17 direct callers (index.ts tool handlers, container, tests), 3 flows.
**Safe approach — extract-and-delegate:** keep every PMS public method signature identical so the 17 callers are untouched; move implementations into new focused services; PMS delegates (same pattern as existing milestoneService/subIssueService). Neutralizes the HIGH rating (zero API-surface change).
**PMS today:** 1,696 lines, 89 methods — 40 already thin delegators; ~49 have inline logic via repo getters.
**Extraction targets (by cohesive cluster):**
1. `IssueService` — createIssue, listIssues (sort logic), getIssue, updateIssue, comment ops (4), draft-issue GraphQL (2). Largest cluster; do first.
2. `ProjectFieldService` — listProjectFields, createProjectField, updateProjectField.
3. `ProjectViewService` — create/list/update/delete view.
4. `RoadmapService` — createRoadmap (~73-line inline builder).
Each: new service takes (issueRepo/projectRepo + factory), move bodies, wire in `container.ts`, PMS delegates, update tests, verify per extraction with GitNexus impact + `test:core`.

## Remaining doc reconciliation (user-requested)
- `.planning/STATUS.md` says phases 10-12 "Not Started" — reality: phase 10 partial (ProjectAutomationService exists), 11 absent, 12 shipped (v1.1.0). Reconcile.
- `.planning/REQUIREMENTS.md` "99/99 complete" over-claims (DEBT-07 god-class not done until D1 lands). Reconcile.
- Ensure PRD→FRD linkage is comprehensive across `.planning`.
