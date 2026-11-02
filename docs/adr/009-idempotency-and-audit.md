# ADR-009: Idempotency keys, mutation audit log and additive pagination

**Status:** Accepted
**Date:** 2026-11-02
**Deciders:** Vivek

## Context

Agents retry. A create call whose response was lost (timeout, crash, model retry) and is repeated produces a duplicate issue, milestone or sprint. The platform also had no durable record of which state-changing calls ran on behalf of whom. List actions returned `pageInfo` but offered no way to continue from it through the compound tools.

## Decision

**Idempotency.** Create actions accept an optional `idempotencyKey` (1–128 chars). The set of actions that honour it is explicit (`IDEMPOTENT_CREATES` in `infrastructure/idempotency/IdempotencyStore.ts`): `manage_issues` `create` / `add_sub_issue` / `create_draft` / `create_comment`, `manage_milestones` `create`, `manage_project` `create_field`, `manage_sprints` `create`; the key is ignored elsewhere. `IdempotencyStore` fingerprints the request (stable stringify, excluding `idempotencyKey` and `cursor`):

- same key + same fingerprint within the TTL (default **24 h**, bounded to 5,000 entries) → the original result, flagged `replayed: true`;
- same key + different fingerprint → `IdempotencyConflictError` (a client bug);
- a result that has aged out of memory but is found in the audit log is returned as its summary.

**Audit log.** `MutationAuditLog` appends a redacted JSONL record of every state-changing call (`.mcp-audit/mutations.jsonl`, `AUDIT_LOG_ENABLED` / `AUDIT_LOG_PATH`). `ToolDispatcher` wraps mutating calls in `trackMutation`; the actor is the agent id or `token`. A call counts as mutating by annotation and action (`isMutatingCall`): read-only actions on a mixed tool are not audited. The log is flushed during graceful shutdown.

**Pagination.** Paged list actions accept `cursor` (the `after` cursor of the underlying GitHub page) and return `nextCursor` beside the existing `pageInfo` (`routePaged`); the change is additive — no existing field moves.

## Consequences

### Positive
- Retried creates are safe; the audit log doubles as the recovery source for replays.
- Pagination reaches every paged action without breaking existing clients.

### Negative
- The in-memory store does not survive a restart; only the audit log (when enabled) provides replay after one, and only as a summary.
- Only the listed creates are idempotent.

### Trade-offs
- Fingerprinting rejects a changed request under a reused key rather than guessing intent — stricter, but it surfaces client bugs instead of hiding them.
