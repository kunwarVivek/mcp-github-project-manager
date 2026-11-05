# ADR-005: Rich domain entities

**Status:** Accepted
**Date:** 2026-11-02
**Deciders:** Vivek

## Context

The domain layer (`src/domain/`) started as plain interfaces and zod schemas; every invariant ("a milestone cannot close below its minimum progress", "a draft pull request cannot merge", "a sprint cannot exceed its issue cap") lived in whichever service happened to need it, and was re-implemented or forgotten elsewhere. An anemic model also made the domain layer a passive type bag that the rest of the code could not rely on.

## Decision

Domain entities may carry behavior. `IssueEntity`, `MilestoneEntity`, `SprintEntity`, `ProjectEntity` and `PullRequestEntity` (`src/domain/entities/`) hold computed properties (`isOpen`, `isOverdue`, `canBeMerged`, `isBlocked`, …) and state-transition methods that enforce invariants (`close`, `merge`, `addIssue`, `moveIssueTo`, …). Conventions:

- `fromData()` builds an entity from the plain shape, `create()` builds a new one, `toData()` returns the plain shape, `clone()` copies.
- Each entity `implements` the matching plain interface (`IssueEntity implements Issue`), so an entity can be used wherever the plain shape is expected. Entity behavior is configurable through a small `*EntityConfig` (thresholds, caps) with defaults.
- The domain layer imports nothing from `services/` or `infrastructure/`; entities stay free of I/O.
- Services and tool results keep returning the plain interfaces (cheap to serialize for MCP). A service wraps data in an entity at the point where an invariant matters — for example `SprintPlanningService` wraps `SprintEntity`, and `GitHubIssueRepository` uses the issue-type and blocker helpers exported by `IssueEntity`.

## Consequences

### Positive
- Business rules have one home and are unit-tested in isolation (`src/__tests__/unit/domain/entities/`).
- The domain layer is a real model instead of a type bag, while staying dependency-free.

### Negative
- Two representations of the same concept (plain interface and entity) must be kept in step; the `implements` clause makes the compiler enforce that.
- Not every service goes through an entity yet; rules are enforced only where an entity is actually used.

### Trade-offs
- Returning plain interfaces from services keeps MCP serialization trivial, at the cost of callers having to opt into an entity (`IssueEntity.fromData(issue)`) when they want the behavior.
