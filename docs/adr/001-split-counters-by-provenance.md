# ADR-001: Split budget counters by provenance

**Status:** Accepted
**Date:** 2026-08-09
**Deciders:** Vivek

## Context

A single `usedTokens` counter mixed server-metered spend with agent-reported spend. This made it impossible to audit who reported what, and created a double-count risk when `record_usage` routed through the same path as metered recording.

## Decision

Split into `meteredTokens` + `reportedTokens` with `usedTokens` as a derived sum. Enforcement stays on the sum.

## Consequences

### Positive
- Clear audit trail distinguishing server-measured usage from agent-asserted usage.
- Double-counting is structurally prevented — each provenance has its own counter.

### Negative
- Slightly more complex schema (three fields where one existed).

### Trade-offs
- The added schema complexity is mitigated by `usedTokens` being auto-derived, so callers that only care about the total still see a single number. Migration was trivial since all counters were zero at the time of the change.
