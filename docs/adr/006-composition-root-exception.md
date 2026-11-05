# ADR-006: Composition root with a documented exception for tool executors

**Status:** Accepted
**Date:** 2026-11-02
**Deciders:** Vivek

## Context

`src/container.ts` (tsyringe) is the composition root. Before this decision `src/index.ts` also constructed some components by hand (cache, persistence adapter, webhook handler, event store, shutdown), so there were two construction paths. Meanwhile tool executors (`infrastructure/tools/**`) — hundreds of small functions, many invoked with only a project node id — build the services they need per call. Forcing them all through container resolution would mean threading a container (or a service locator) into every executor and changing every executor signature.

## Decision

- The container registers every component `index.ts` owns — `ResourceCache`, `FilePersistenceAdapter`, `GitHubWebhookHandler`, `EventStore`, `EventSubscriptionManager`, `GracefulShutdown`, `MutationAuditLog`, `TelemetryConfig` — plus the services; `index.ts` resolves them and constructs none by hand. (`HealthService` is not registered: the health tool builds it per call like the other executors.)
- **Documented exception:** tool executors do not resolve from the container. They self-construct through the single shared factory, `createGitHubFactory()` in `infrastructure/tools/tool-factory.ts` (and the `shared-services` accessor), which itself uses `resolveGitHubAuth()` (ADR-008).
- No second construction path may be added: new executors use `createGitHubFactory()`; new long-lived components are registered in the container.

## Consequences

### Positive
- One place builds the entry-point singletons; the exception is narrow, named and documented in `AGENTS.md`, `container.ts` and `architecture.md`.
- Executors stay plain functions that are trivial to unit-test with a mocked factory.

### Negative
- Executors are not substitutable through the container; tests replace the factory/shared-services module instead.
- Two construction styles exist (container for the entry point and services, factory for executors).

### Trade-offs
- Accepting a bounded, documented exception was preferred to a service-locator refactor of every executor, which would have added coupling for no behavioral gain.
