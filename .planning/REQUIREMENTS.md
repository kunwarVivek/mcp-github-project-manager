# Requirements: MCP GitHub Project Manager

**Defined:** 2026-01-30
**Core Value:** Comprehensive AI-enabled GitHub-based project management from 0-100

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### GitHub Projects v2 API Coverage (GHAPI)

**Sub-issues:**
- [ ] **GHAPI-01**: Add sub-issue to parent issue
- [ ] **GHAPI-02**: List sub-issues for a parent issue
- [ ] **GHAPI-03**: Get parent issue for a sub-issue
- [ ] **GHAPI-04**: Reprioritize sub-issue within parent
- [ ] **GHAPI-05**: Remove sub-issue from parent

**Project Status Updates:**
- [ ] **GHAPI-06**: Create project status update
- [ ] **GHAPI-07**: List project status updates
- [ ] **GHAPI-08**: Get project status update by ID

**Project Templates:**
- [ ] **GHAPI-09**: Mark project as template
- [ ] **GHAPI-10**: Unmark project as template
- [ ] **GHAPI-11**: Copy project from template
- [ ] **GHAPI-12**: List organization project templates

**Project Linking:**
- [ ] **GHAPI-13**: Link project to repository
- [ ] **GHAPI-14**: Unlink project from repository
- [ ] **GHAPI-15**: Link project to team
- [ ] **GHAPI-16**: Unlink project from team
- [ ] **GHAPI-17**: List linked repositories for project
- [ ] **GHAPI-18**: List linked teams for project

**Project Lifecycle:**
- [ ] **GHAPI-19**: Close project
- [ ] **GHAPI-20**: Reopen closed project

**Draft Issue Operations:**
- [ ] **GHAPI-21**: Convert draft issue to real issue

**Project Item Operations:**
- [ ] **GHAPI-22**: Update item position (reorder within project)

**Advanced Search:**
- [ ] **GHAPI-23**: Search issues with AND/OR keywords
- [ ] **GHAPI-24**: Filter project items with advanced query syntax

### MCP Protocol Compliance (MCP)

**SDK Upgrade:**
- [ ] **MCP-01**: Upgrade SDK from 1.12.0 to 1.25.2
- [ ] **MCP-02**: Update all imports for new SDK structure
- [ ] **MCP-03**: Verify all 71 tools work after upgrade
- [ ] **MCP-04**: Update protocol version negotiation

**Tool Annotations:**
- [ ] **MCP-05**: Add behavior annotations to all destructive tools (create, update, delete)
- [ ] **MCP-06**: Add read-only annotations to all query tools (get, list)
- [ ] **MCP-07**: Add idempotent annotations where applicable

**Tool Output Schemas:**
- [ ] **MCP-08**: Define output schemas for all project tools
- [ ] **MCP-09**: Define output schemas for all issue tools
- [ ] **MCP-10**: Define output schemas for all PR tools
- [ ] **MCP-11**: Define output schemas for all AI tools
- [ ] **MCP-12**: Define output schemas for all automation tools

**Error Handling:**
- [ ] **MCP-13**: Implement MCP-compliant error codes
- [ ] **MCP-14**: Add proper error data payloads
- [ ] **MCP-15**: Handle protocol version mismatches gracefully

### Tech Debt Resolution (DEBT)

**Service Decomposition:**
- [ ] **DEBT-01**: Extract SubIssueService from ProjectManagementService
- [ ] **DEBT-02**: Extract ProjectStatusService from ProjectManagementService
- [ ] **DEBT-03**: Extract ProjectTemplateService from ProjectManagementService
- [ ] **DEBT-04**: Extract ProjectLinkingService from ProjectManagementService
- [ ] **DEBT-05**: Extract SprintPlanningService from ProjectManagementService
- [ ] **DEBT-06**: Extract MilestoneService from ProjectManagementService
- [ ] **DEBT-07**: Reduce ProjectManagementService to coordination only

**Type Safety:**
- [ ] **DEBT-08**: Define interfaces for all AI response objects
- [ ] **DEBT-09**: Replace `as any` in TaskContextGenerationService
- [ ] **DEBT-10**: Replace `as any` in PRDGenerationService
- [ ] **DEBT-11**: Replace `as any` in ProjectAutomationService
- [ ] **DEBT-12**: Replace `as any` in TaskGenerationService
- [ ] **DEBT-13**: Add type guards for unknown data validation

**Test Coverage:**
- [ ] **DEBT-14**: Fix 74 failing tests
- [ ] **DEBT-15**: Enable and fix 20 skipped tests
- [ ] **DEBT-16**: Add unit tests for ContextualReferenceGenerator
- [ ] **DEBT-17**: Add unit tests for DependencyContextGenerator
- [ ] **DEBT-18**: Add unit tests for ContextQualityValidator
- [ ] **DEBT-19**: Add integration tests for new GitHub features
- [ ] **DEBT-20**: Achieve 80%+ code coverage

**Resilience:**
- [ ] **DEBT-21**: Implement circuit breaker for AI services
- [ ] **DEBT-22**: Add health check endpoint
- [ ] **DEBT-23**: Add request tracing with correlation IDs
- [ ] **DEBT-24**: Implement cache persistence option
- [ ] **DEBT-25**: Add graceful degradation for AI service failures

**Documentation:**
- [ ] **DEBT-26**: Update STATUS.md to reflect actual codebase state
- [ ] **DEBT-27**: Document all MCP tools with examples
- [ ] **DEBT-28**: Add API reference documentation

### AI Feature Enhancement (AI)

**PRD Generation:**
- [ ] **AI-01**: Improve feature extraction accuracy
- [ ] **AI-02**: Add confidence scores to generated PRD sections
- [ ] **AI-03**: Support PRD templates customization
- [ ] **AI-04**: Add PRD validation against best practices

**Task Generation:**
- [ ] **AI-05**: Improve task complexity estimation accuracy
- [ ] **AI-06**: Better dependency detection between tasks
- [ ] **AI-07**: Add effort estimation to tasks
- [ ] **AI-08**: Support task templates

**Sprint Planning:**
- [ ] **AI-09**: AI-powered sprint capacity planning
- [ ] **AI-10**: Sprint backlog prioritization suggestions
- [ ] **AI-11**: Sprint risk assessment
- [ ] **AI-12**: Sprint scope recommendations based on velocity

**Roadmap Generation:**
- [ ] **AI-13**: Generate roadmap from requirements
- [ ] **AI-14**: Phase sequencing based on dependencies
- [ ] **AI-15**: Milestone date estimation
- [ ] **AI-16**: Roadmap visualization data generation

**Issue Intelligence:**
- [ ] **AI-17**: Improve issue enrichment quality
- [ ] **AI-18**: Better label suggestions
- [ ] **AI-19**: Duplicate issue detection
- [ ] **AI-20**: Related issue linking suggestions

### Production Readiness (PROD)

**Testing:**
- [ ] **PROD-01**: All unit tests passing
- [ ] **PROD-02**: All integration tests passing
- [ ] **PROD-03**: All E2E tests passing
- [ ] **PROD-04**: No skipped tests

**Documentation:**
- [ ] **PROD-05**: Complete README with quick start
- [ ] **PROD-06**: Tool reference documentation
- [ ] **PROD-07**: Configuration guide
- [ ] **PROD-08**: Troubleshooting guide

**Package:**
- [ ] **PROD-09**: Update package.json version
- [ ] **PROD-10**: Verify npm publish configuration
- [ ] **PROD-11**: Add changelog
- [ ] **PROD-12**: Publish to npm

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Features

- **V2-01**: Real-time project sync via webhooks
- **V2-02**: Multi-organization support
- **V2-03**: GitHub Enterprise Server support
- **V2-04**: Streamable HTTP transport for remote usage
- **V2-05**: OAuth 2.1 authorization flow
- **V2-06**: MCP Tasks primitive for long-running operations
- **V2-07**: MCP Elicitation for interactive tools
- **V2-08**: Redis cache backend option
- **V2-09**: Metrics and observability (OpenTelemetry)
- **V2-10**: Rate limit handling improvements

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| GitHub Insights/Charts API | No programmatic API available (UI-only) |
| Fine-grained PAT support | GitHub GraphQL doesn't support it |
| Self-hosted GitHub Enterprise | Focus on github.com for v1 |
| Real-time collaboration | Complex, defer to v2 |
| Mobile app | CLI/MCP focus |
| UI dashboard | MCP server is API-only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GHAPI-01 to GHAPI-24 | TBD | Pending |
| MCP-01 to MCP-15 | TBD | Pending |
| DEBT-01 to DEBT-28 | TBD | Pending |
| AI-01 to AI-20 | TBD | Pending |
| PROD-01 to PROD-12 | TBD | Pending |

**Coverage:**
- v1 requirements: 99 total
- Mapped to phases: 0
- Unmapped: 99 ⚠️

---
*Requirements defined: 2026-01-30*
*Last updated: 2026-01-30 after initial definition*
