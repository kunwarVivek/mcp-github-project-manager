# Phase 1: Service Decomposition - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract focused services from ProjectManagementService (3,291 lines) into single-responsibility components. Each service handles one domain: SubIssues, ProjectStatus, ProjectTemplates, ProjectLinking, SprintPlanning, and Milestones. The original ProjectManagementService becomes a thin coordination layer.

</domain>

<decisions>
## Implementation Decisions

### Service Boundaries
- Extract by domain, not by technical function
- Each service owns its GitHub API calls for its domain
- Shared utilities (error handling, retry logic) stay in BaseGitHubRepository or shared infrastructure
- Services should be independently instantiable and testable

### Coordination Pattern
- ProjectManagementService becomes a **facade** — thin coordinator, not orchestrator
- New services are injected via constructor, not created inline
- Facade delegates to appropriate service based on operation type
- No business logic in the facade — it's routing only

### Dependency Injection
- Keep tsyringe (already established, works well with decorators)
- Register new services in container at server startup
- Use constructor injection for explicit dependencies
- Avoid service locator pattern — prefer explicit DI

### Test Strategy
- Each extracted service gets its own test file
- Migrate relevant tests from ProjectManagementService tests
- Mock dependencies at service boundary (GitHub API layer)
- Integration tests verify facade wiring works correctly

### Claude's Discretion
- Exact method signatures for extracted services
- Internal implementation details of each service
- Order of extraction (can parallelize or sequence as makes sense)
- Helper methods that emerge during extraction

</decisions>

<specifics>
## Specific Ideas

- Target: ProjectManagementService under 500 lines after extraction
- Priority: Make each service independently unit testable
- Follow existing patterns in codebase (Repository pattern, error handling conventions)
- Preserve backward compatibility — existing tool handlers should work unchanged

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-service-decomposition*
*Context gathered: 2026-01-30*
