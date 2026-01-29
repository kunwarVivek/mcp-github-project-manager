# Codebase Concerns

**Analysis Date:** 2026-01-29

## Tech Debt

**Excessive `any` Type Usage:**
- Issue: Over 30 instances of `as any` type assertions scattered across services
- Files: `src/services/TaskContextGenerationService.ts`, `src/services/PRDGenerationService.ts`, `src/services/ProjectAutomationService.ts`, `src/services/TaskGenerationService.ts`
- Impact: Type safety compromised; runtime errors possible; IDE assistance degraded
- Fix approach: Define proper interfaces for AI response objects; create type guards for unknown data

**ProjectManagementService God Class:**
- Issue: 3,291 lines - single service handling too many responsibilities
- Files: `src/services/ProjectManagementService.ts`
- Impact: Hard to test, maintain, and understand; high coupling; change ripple effects
- Fix approach: Extract focused services (SprintService, MilestoneService, IssueService, FieldService)

**Documentation-Code Drift (STATUS.md):**
- Issue: STATUS.md lists "Implement MCP Resources" as high priority but resources ARE implemented
- Files: `STATUS.md`
- Impact: Misleading documentation confuses contributors; stale priorities
- Fix approach: Audit STATUS.md against actual codebase; automate status tracking

**In-Memory Cache Only:**
- Issue: ResourceCache is memory-only with no persistence across restarts
- Files: `src/infrastructure/cache/ResourceCache.ts`
- Impact: Data loss on restart; no horizontal scaling; cold start performance penalty
- Fix approach: Implement ICacheProvider interface with Redis/file backends; add cache warming

## Known Bugs

**npm Dependencies Not Installed:**
- Symptoms: `npm test` fails with "Cannot find module 'jest'"
- Files: `package.json`, `package-lock.json`
- Trigger: Clone repo and run `npm test` without `npm install`
- Workaround: Run `npm install` first

**E2E Tests Require Manual Skipping:**
- Symptoms: E2E tests fail when GitHub credentials not provided
- Files: `src/__tests__/e2e/github-project-manager.e2e.ts`, `src/__tests__/e2e/resource-management.e2e.ts`, `src/__tests__/e2e/metrics-reporting.e2e.ts`
- Trigger: Run full test suite without GITHUB_TOKEN env var
- Workaround: Tests use `describe.skip` but this requires manual management

## Security Considerations

**Webhook Secret Validation Bypass:**
- Risk: When WEBHOOK_SECRET is not configured, signature validation is skipped entirely
- Files: `src/infrastructure/events/GitHubWebhookHandler.ts` (lines 46-48)
- Current mitigation: Warning logged to console
- Recommendations: Fail closed by default; require explicit bypass flag; document security implications

**API Keys in Plain Environment Variables:**
- Risk: Multiple API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, PERPLEXITY_API_KEY, GITHUB_TOKEN) stored in env vars
- Files: `src/env.ts`, `.env.example`
- Current mitigation: `.gitignore` excludes `.env`
- Recommendations: Support secret managers (Vault, AWS Secrets Manager); add key rotation support

**No Input Sanitization on PRD Content:**
- Risk: PRD content passed directly to AI models without sanitization
- Files: `src/services/PRDGenerationService.ts`, `src/services/TaskGenerationService.ts`
- Current mitigation: None detected
- Recommendations: Implement content size limits; sanitize special characters; add rate limiting per client

## Performance Bottlenecks

**Synchronous Token Estimation:**
- Problem: Token usage estimated with hardcoded values (300, 400, 500) rather than actual counting
- Files: `src/services/TaskContextGenerationService.ts` (lines 207, 220, 229, 241, 256)
- Cause: No actual token counting implementation
- Improvement path: Use tiktoken or similar library for accurate token counting

**No Caching for AI Responses:**
- Problem: AI context generation called repeatedly for same task/PRD combinations
- Files: `src/services/TaskContextGenerationService.ts` (line 113 has `cacheHit: false` TODO)
- Cause: TODO comment indicates caching not implemented
- Improvement path: Hash task+PRD for cache key; implement TTL-based caching for AI responses

**Unbounded Memory in EventStore:**
- Problem: Events accumulate in memoryBuffer without LRU eviction
- Files: `src/infrastructure/events/EventStore.ts`
- Cause: Only `maxEventsInMemory` config exists but eviction not implemented
- Improvement path: Implement ring buffer or LRU cache for event buffer

## Fragile Areas

**AI Service Singleton Pattern:**
- Files: `src/services/ai/AIServiceFactory.ts`
- Why fragile: Singleton with private constructor makes testing difficult; no way to reset state between tests
- Safe modification: Use dependency injection instead; provide test doubles
- Test coverage: Limited mocking capability

**TaskContextGenerationService AI Dependency Chain:**
- Files: `src/services/TaskContextGenerationService.ts`
- Why fragile: Depends on ContextualReferenceGenerator, DependencyContextGenerator, and AIServiceFactory; failure in any cascades
- Safe modification: Add circuit breakers; implement graceful degradation per component
- Test coverage: Test file exists but mocks may not cover all failure modes

**Type Coercions in Field Value Updates:**
- Files: `src/services/ProjectManagementService.ts` (lines 1945-2133)
- Why fragile: Complex switch statement with many field types; each type has different validation
- Safe modification: Use strategy pattern; extract field type handlers to separate classes
- Test coverage: Partial - not all field types have dedicated tests

## Scaling Limits

**Single-Threaded MCP Server:**
- Current capacity: One request at a time via stdio transport
- Limit: CPU-bound AI operations block other requests
- Scaling path: Implement request queuing; consider worker threads for AI processing

**In-Memory Event Store:**
- Current capacity: Configured maxEventsInMemory (default varies)
- Limit: Memory exhaustion with high event volume
- Scaling path: Persist to disk; implement EventStore with proper eviction; consider streaming to external store

## Dependencies at Risk

**Vercel AI SDK Version Lock:**
- Risk: Heavy dependency on @ai-sdk/* packages; API changes could break AI features
- Impact: All AI functionality (PRD generation, task analysis, context generation)
- Migration plan: Abstract AI calls behind provider interface; implement adapter pattern

**GitHub GraphQL API Changes:**
- Risk: Projects v2 API is relatively new; schema changes could break queries
- Impact: All project management features
- Migration plan: Pin API version where possible; add schema validation tests

## Missing Critical Features

**No Health Check Endpoint:**
- Problem: No way to verify server health or AI service availability
- Blocks: Production monitoring; container orchestration health probes

**No Request Tracing:**
- Problem: No correlation IDs or distributed tracing
- Blocks: Debugging production issues; performance analysis

**No Circuit Breaker for AI Services:**
- Problem: AI service failures cause cascading timeouts
- Blocks: Resilient operation when AI providers are degraded

**Quality Metrics Collection Not Active:**
- Problem: ContextQualityValidator exists but metrics not collected/exposed
- Blocks: PRD compliance validation; quality dashboards; continuous improvement

## Test Coverage Gaps

**ContextualReferenceGenerator:**
- What's not tested: AI fallback behavior; error handling paths; cache interaction
- Files: `src/services/context/ContextualReferenceGenerator.ts`
- Risk: Silent failures in reference generation
- Priority: High - core PRD feature

**DependencyContextGenerator:**
- What's not tested: Parallel work opportunity detection; complex dependency graphs
- Files: `src/services/context/DependencyContextGenerator.ts`
- Risk: Incorrect dependency context in edge cases
- Priority: High - core PRD feature

**ContextQualityValidator:**
- What's not tested: Integration with context generation pipeline; performance metrics
- Files: `src/services/validation/ContextQualityValidator.ts`
- Risk: Quality gates not enforced
- Priority: Medium - validation feature

**E2E Test Reliability:**
- What's not tested: Full workflow with real GitHub API consistently
- Files: `src/__tests__/e2e/*.ts`
- Risk: Integration issues discovered in production
- Priority: Medium - many tests are skipped by default

**Source/Test File Ratio:**
- What's not tested: 80 source files vs 29 test files (including E2E utilities)
- Files: Multiple services lack dedicated test files
- Risk: Regressions in untested code
- Priority: High - many services have no unit tests

---

*Concerns audit: 2026-01-29*
