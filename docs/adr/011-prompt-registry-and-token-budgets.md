# ADR-011: PromptRegistry, and TokenBudgetManager versus the agent budget

**Status:** Accepted
**Date:** 2026-11-02
**Deciders:** Vivek

## Context

AI prompts were string constants scattered across services, with no versioning and ad-hoc interpolation. `PromptRegistry`, `TokenBudgetManager` and `AIResponseCache` existed but were not consumed by production code. Separately, an agent's token budget (`agent_manage set_budget`) already existed and is a different concept from the cost of one AI pipeline run.

## Decision

- **`PromptRegistry`** (`services/ai/prompts/`) holds every AI prompt as a versioned template with `{{var}}` placeholders. Each prompt module (PRD, tasks, context, features, issue intelligence, sprints, roadmap, confidence) registers its templates at version `1.0.0` into `defaultPromptRegistry`; services call `defaultPromptRegistry.render(id, vars)`. Re-registering an id/version throws; `getLatest` / `getVersion` select a version.
- **`AIResponseCache`** is wired into `TaskContextGenerationService` (injected, process-wide default): AI generation results are cached by content hash with a TTL, and `metrics.cacheHit` reports a fully cached build.
- **`TokenBudgetManager`** is a **per-session** budget — session = the correlation id of one operation — limited by `AI_SESSION_TOKEN_LIMIT` (0 = unlimited). `TaskGenerationService` and `TaskContextGenerationService` reserve against it; when exhausted, optional AI steps fall back (traceability-only context) instead of throwing.
- **The agent budget is separate.** It is per agent, persisted in the registry, metered server-side (`AIServiceFactory.getModel` middleware accumulates provider-reported usage), debited **once per tool call** by `ToolDispatcher`, and with `hardStop` it gates AI tools with `BudgetExhausted` (ADR-007). It bounds what an agent may spend over a period; the session budget bounds what one pipeline run may spend.

## Consequences

### Positive
- Prompts are versioned, testable and changed in one place; the two budgets answer different questions and cannot be confused in code.

### Negative
- The registry holds only in-memory templates; there is no per-environment prompt override.
- The session budget and cache are per-process.

### Trade-offs
- Two budget mechanisms are more to document than one, but merging them would couple a cheap in-memory guard to a GitHub-backed compare-and-swap registry write.
