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
- **NEXT GATE**: Layer D opens with the CRITICAL ProjectManagementService (1,696 lines) decomposition — requires explicit user go-ahead per mandate before edits.
