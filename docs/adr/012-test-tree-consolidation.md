# ADR-012: Test tree consolidation under `src/__tests__/`

**Status:** Accepted
**Date:** 2026-11-02
**Deciders:** Vivek

## Context

Tests lived in two trees: `src/__tests__/**` (newer) and a root `tests/**` tree left over from the Jest era (AI suites, service suites). Both were in the Vitest `include` list, so a new test could land in either, helpers and fixtures were duplicated, and docs had to describe both layouts.

## Decision

- Every test lives under `src/__tests__/` (`unit/`, `integration/`, `e2e/`, `tools/`, `infrastructure/`, `services/`, shared `helpers/`). The root `tests/` directory is removed.
- `vitest.config.ts` includes only `src/__tests__/**/*.test.ts`, `*.spec.ts` and `*.e2e.ts`; coverage excludes `src/__tests__/**` and enforces the thresholds configured there (see CI).
- `tsconfig.test.json` typechecks `src/**` and `src/__tests__/**`; `npm run typecheck` runs it.
- AI suites run with `npm run test:ai` (`unit/services/ai/`, `ai-tools`, `issue-intelligence-tools`, `ai-tasks/`); filter by positional pattern and exclude with `--exclude=` (Vitest rejects Jest-only flags such as `--testPathPattern`).

## Consequences

### Positive
- One place for tests, helpers and fixtures; docs describe one layout.
- Tests sit next to the code they cover.

### Negative
- Test files are included in the source tree (excluded from the build output by `tsconfig.build.json`).

### Trade-offs
- Colocating under `src/` needs explicit build/coverage exclusions, which are cheaper than maintaining two trees.
