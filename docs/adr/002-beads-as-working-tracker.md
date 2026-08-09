# ADR-002: Beads as working tracker with GitHub Issues as external reporting

**Status:** Accepted
**Date:** 2026-08-09
**Deciders:** Vivek

## Context

GitHub Issues are the primary external interface but are slow for rapid iteration (API round-trips, rate limits). The project needed a local-first tracker that syncs to Git without depending on GitHub availability during development.

## Decision

Use Beads (`bd`) for local issue tracking during development. GitHub Issues remain the external reporting surface. Beads syncs via `refs/dolt/data` on the git remote.

## Consequences

### Positive
- Fast local iteration with no network dependency.
- No GitHub dependency during development sprints.
- Tracker state travels with the repository via git refs.

### Negative
- Two systems to keep in mind (Beads for local work, GitHub Issues for external visibility).

### Trade-offs
- Beads sync is eventually-consistent — there is a window where local and remote state can diverge. Acceptable because Beads is the working surface, not the system of record.
