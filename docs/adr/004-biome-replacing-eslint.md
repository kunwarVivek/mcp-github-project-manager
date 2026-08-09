# ADR-004: Biome replacing ESLint

**Status:** Accepted
**Date:** 2026-08-09
**Deciders:** Vivek

## Context

ESLint + Prettier configuration was complex and slow. Biome provides linting and formatting in one tool, is significantly faster, and handles the project's needs.

## Decision

Replace ESLint + Prettier with Biome. Disable `useArrowFunction` autofix (it broke approximately 90 tests by converting constructible `function` mocks to arrows). The rule is OFF with rationale documented in `biome.json`.

## Consequences

### Positive
- Single tool for linting and formatting — simpler configuration and faster execution.
- Fewer dev dependencies to maintain.

### Negative
- Biome cannot parse tsyringe `@inject(...) private x: T` decorated constructor parameter properties and false-positives unused params. This is an upstream tool limitation (tracked as hb8.23), not a configuration issue.

### Trade-offs
- The tsyringe parsing limitation is acceptable because it only affects DI constructor parameters, which are a small and well-understood surface. Suppression comments mark the affected sites.
