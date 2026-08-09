# Handoff — dependency upgrade branch

Written at the end of a long session. Read this first, then `bd list --status=open`.

## Where things stand

- Branch `chore/dependency-upgrade-mcp-v2`, commit `d711c2a`, **working tree clean**.
- `npm run build` → 0 errors. Suite → **2977 passing / 0 failing / 20 skipped** (119 files).
- Live MCP probe: stdout pure JSON-RPC, protocol `2025-06-18`, version `1.1.0`,
  17 tools / 0 empty schemas / 17 annotated, `tools/call` round-trips.

`d711c2a` contains the whole upgrade: Biome, tsx, isolatedModules, secrets/auth
hardening, `gh` + GitHub App auth, AI provider plumbing, MCP v2 migration, the agent
budget gate, server-side metering, and ~1400 test/lint fixes. Its commit message is the
detailed record — read it before changing any of those areas.

## Known issues, read before trusting a green run

1. **The e2e suite is intermittently flaky.** Three consecutive full runs gave 2977 pass,
   8 fail, 2977 pass. Failures are confined to the four spawn-based e2e files
   (`stdio-transport`, `stdout-purity`, `mcp-protocol-compliance`, and anything via
   `MCPToolTestUtils`). Root cause partially fixed — all four spawned servers used to
   bind `WEBHOOK_PORT` 3001 and collide under Vitest's parallel file execution; they now
   set `SSE_ENABLED: 'false'` so no port is bound. Residual flakiness is server *startup
   timing* under parallel load, not a port clash. `--no-file-parallelism` is reliably
   green. **Do not treat a single red run as a regression — re-run before investigating.**

2. **GitNexus index is stale** (last indexed `7c7d188`, HEAD is now `d711c2a`). Run
   `node .gitnexus/run.cjs analyze` before relying on `impact`/`context`, or the blast
   radius numbers will describe pre-upgrade code.

3. **Live-API E2E has never run** (`hb8.25`). Everything is verified against mocks.
   `E2E_REAL_API=true npm run test:e2e:tools:real` consumes GitHub rate limit. Given
   Octokit 22, the GraphQL node-id resolution change in `GitHubProjectRepository.create`,
   and the MCP v2 migration, this is the only thing that proves the real API surface —
   and `hb8.18` is exactly the class of bug mocks hide.

## Agreed design for the next commit

A `/grilling` + `/domain-modeling` session settled 19 decisions. **All of this is agreed
and confirmed — implement it, don't re-litigate it.**

### Budget model (the core change)

`AgentBudget` splits its counter by provenance:

- `meteredTokens` — measured by us at the provider boundary (ai-SDK middleware).
- `reportedTokens` — asserted by the agent via `record_usage`. Unverifiable.
- `usedTokens` — derived sum, kept for compatibility.
- `estimatedTokens` — the third provenance (words×1.3 heuristic). Never touches budget.

Enforcement stays on the **derived sum** against one `totalTokens`. Splitting the counters
also makes the `record_usage` double-count structurally impossible (it currently routes
through the metering dispatcher and only escapes by accident) — pin that with a test.

**Migration: reset all counters to zero.** Verified safe — the agent registry holds one
agent, zero budgets, zero non-zero `usedTokens`. No lazy-read branch needed.

### The four inert dials — implement all properly

Currently: `hardStop` is validated then silently dropped (de-facto constant `true`);
`resetBudgetIfDue` has zero callers and holds the ONLY `budget_exhausted → idle` recovery,
so **an exhausted agent can never recover**; `canAfford` has zero callers;
`isWarning`/`usagePercent` are display-only.

- Make `hardStop` genuinely settable through `setBudget`.
- Call `resetBudgetIfDue` **lazily on every budget read** (not from the scheduler — that
  would put GitHub writes on a timer).
- `canAfford` becomes a public advisory query. Enforcement stays at task **checkout** —
  not per-AI-call, which would mean a GitHub round trip per call on an unlocked
  read-modify-write store.
- Crossing `warningFraction` **appends a warning to the tool result** (the model reads
  tool results; it is the only actor that can slow down).

### Renames — all collisions, names already chosen

- `AgentReclaimScheduler`: `sweepBudgetMs` → `sweepTimeoutMs` (it's milliseconds).
- `TokenCounter`: `fitsInBudget`/`truncateToFit` → prompt-**limit** language.
- `ContextQualityMetrics.tokenUsage` → `estimatedTokens`.
- `warningThreshold` → `warningFraction` (budget, 0–1) **and** `warningScore`
  (ConfidenceConfig, 0–100). Both renamed to encode units.
- Delete `src/domain/value-objects/AgentMetrics.ts` — imported by nothing, and it carries
  a third parallel budget-exhaustion implementation.
- `get_agent_activity` must call `getBudgetStatus` instead of hand-rolling the arithmetic;
  it currently skips parent resolution, so reporting disagrees with enforcement for
  subagents.

### Docs to write

- `CONTEXT.md` — glossary only, no implementation detail. The three token provenances;
  agent vs subagent (a subagent has no budget of its own and cannot check out a task); the
  now-disambiguated senses of "budget".
- Four ADRs under `docs/adr/`: split counters by provenance; beads as working tracker with
  GitHub Issues as external reporting; MCP SDK v2 migration; Biome replacing ESLint.
  (The last two were judged below the skill's bar on one criterion each but were
  explicitly requested — lean them on the trade-off rather than the decision.)

### Also in scope for the next commit

The 8 bugs found this session, `hb8.15`–`hb8.22`. Four are P1 silent-breakage:

- `hb8.15` `forceSync` is a no-op across all four sync methods.
- `hb8.16` The issue body never reaches the AI triage model (prompt uses title only).
- `hb8.17` Caller-supplied confidence/enrichment config dropped at 3 sites.
- `hb8.18` Sprint issue assignments never written to GitHub — `update()` returns a
  fabricated object.

None are regressions from this session; all pre-date it and were found because dead-code
removal exposed them.

### Sequencing

One commit for all of the above, on this branch. No PR.

## Deferred, tracked, not in scope

- `hb8.24` — 421 `noExplicitAny` + 161 `noNonNullAssertion`. A typing project, not lint.
  `noExplicitAny` is `warn` **on purpose** for MCP boundary adapters. Mechanically
  swapping `any`→`unknown` provably does not compile here.
- `hb8.12` — duplicated Beads block in AGENTS.md. Fix via `bd setup codex --remove`; it is
  the user's deliberate integration, so it is their call.
- `hb8.23` — Biome cannot parse tsyringe `@inject(...) private x: T` parameter properties
  and false-positives unused params. Upstream tool limitation.

## Traps this session hit — do not repeat them

- **`biome lint --write` is a code change, not an inspection.** Its `useArrowFunction`
  autofix (classified "safe") rewrote constructible `function` mocks to arrows and broke
  ~90 tests. The rule is now OFF with rationale in `biome.json`. Apply lint autofixes
  **one rule at a time with a full test run after each**.
- **Arrow functions are not constructible.** Test mocks invoked with `new` must stay
  `function`. This bit twice, in two different shapes.
- **`beforeEach(() => x.mockReset())` with an implicit return** hands the mock back to
  Vitest, which treats a returned function as a teardown callback and calls it. Use a
  block body.
- **`ai`@7 reports usage as `inputTokens: {total,...}` objects, not numbers.** Reading
  them as numbers yields `NaN` and silently poisons the budget.
