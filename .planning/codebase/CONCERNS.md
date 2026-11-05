# Codebase Concerns

**Analysis Date:** 2026-11-02

**Updated:** 2026-11-02 — re-audited against the current tree. Resolved since the last audit: residual `as any`, the dual test trees, the missing analytics surface, and the lack of any tracing export. See "Resolved Since the Last Audit" below.

## Tech Debt

**Type Assertions (no open concern):**
- State: a repo-wide search finds no real `as any` in production code under `src/`. The only textual matches are comments in `src/index.ts` and `src/domain/type-guards.ts`, and sample code inside a template string in `src/services/context/CodeExampleGenerator.ts`
- Guard: Biome (`suspicious.noExplicitAny: "warn"`, lint runs with `--error-on-warnings`)

**Two Lockfiles to Keep in Sync:**
- Issue: `package-lock.json` and `pnpm-lock.yaml` are both committed and must stay in sync; run `npm run check:lockfiles` locally to verify
- Files: `package-lock.json`, `pnpm-lock.yaml`
- Impact: a dependency added under one manager but not the other produces an install that differs between contributors and CI
- Mitigation: CI runs the full `build → typecheck → test` gate under **both** npm and pnpm, and a `check:lockfiles` job (`scripts/check-lockfiles.js`) fails when the lockfiles disagree
- Fix approach: regenerate both lockfiles in the same commit whenever a dependency changes

**Single-Threaded Tool Dispatch:**
- Issue: one `dispatchTool` handles every tool call; CPU-bound AI operations block other requests
- Files: `src/index.ts`
- Impact: no intra-request parallelism; a slow AI call stalls unrelated tool calls on the same connection
- Fix approach: request queueing; consider worker threads for AI processing

## Known Bugs

**Vitest Rejects Pre-Migration Runner CLI Flags:**
- Symptoms: `CACError: Unknown option` when passing the old `--testPathPattern` / `--testPathIgnorePatterns` flags
- Trigger: copying a command from an older runbook or chat log
- Workaround: filter with a **positional pattern** (`vitest run ai-services`) and exclude with `--exclude='**/ai-services/**'`

**Mocks That Are Not Constructible:**
- Symptoms: "is not a constructor" when the code under test calls `new` on a mocked class
- Files: test files that mock classes with `mockImplementation(() => ({...}))`
- Workaround: use `function` instead of an arrow so the mock is constructible

**`beforeEach` With an Implicit Return:**
- Symptoms: the mock is invoked as a teardown callback by the runner
- Files: test files using `beforeEach(() => x.mockReset())`
- Workaround: always use a block body — `beforeEach(() => { x.mockReset(); })`

**No Locally Enforced Type-Only Import Rule:**
- Issue: `isolatedModules` is on; a type re-exported as a value compiles under `tsc` but breaks under `tsx`/esbuild at runtime
- Files: any `src/**/*.ts` file
- Impact: the failure surfaces at runtime in dev/watch mode, not at build time
- Fix approach: always `export type` / `import type` — including for decorated constructor params, whose types `emitDecoratorMetadata` references at runtime

## Security Considerations

**Webhook Signature Validation (now fails closed):**
- Risk: accepted unsigned webhooks would allow forged events
- Files: `src/infrastructure/events/GitHubWebhookHandler.ts`, `src/env.ts`
- Current state: signature validation fails closed. With no `WEBHOOK_SECRET`, webhooks are rejected unless `WEBHOOK_ALLOW_UNSIGNED=true` is set explicitly (trusted dev only). The HTTP server also binds loopback by default (`WEBHOOK_HOST`), requires `EVENTS_AUTH_TOKEN` on `/events/*`, and trusts `X-Forwarded-For` only from `WEBHOOK_TRUSTED_PROXIES`
- Residual risk: `WEBHOOK_ALLOW_UNSIGNED=true`, `EVENTS_ALLOW_UNAUTHENTICATED=true` or `WEBHOOK_HOST=0.0.0.0` in a production environment silently widens exposure (startup warns for SSE with neither auth token nor opt-out)

**Secrets in Environment Variables (partially mitigated):**
- Risk: API keys (AI providers, GitHub token) can still be supplied as plain env vars
- Files: `src/env.ts`, `src/infrastructure/secrets/`, `.env.example`
- Current mitigation: `SECRETS_DIR` file-mounted secrets are consulted **before** env vars; `getSecret()` reads fresh so rotated files are picked up; `redactSecrets()` strips token-shaped values from logs; `GitHubConfig.token` is non-enumerable so it cannot be serialized
- Residual gap: Vault / AWS Secrets Manager are only an extension point — their SDKs are async, while the resolver contract is synchronous

**Secret Resolution Performs a Disk Read Per Call:**
- Risk: `getSecret()` re-reads the mounted file on every call, so a hot path that resolves a credential per request hits the disk
- Files: `src/infrastructure/secrets/SecretProvider.ts`
- Impact: small but repeated I/O; mostly relevant for file-mounted secrets in container deployments
- Fix approach: cache with an explicit TTL, or resolve once per request scope

**Token Exposure in Serialized Config:**
- Risk: a config object leaking the PAT through `JSON.stringify` or a log line
- Current mitigation: `GitHubConfig.token` is non-enumerable and `redactSecrets()` scrubs token-shaped keys
- Recommendation: keep any new credential-bearing field non-enumerable, and add a regression test for it

## Performance Bottlenecks

**Approximate Token Counting:**
- Problem: `TokenCounter.estimate()` uses a word-count heuristic (~1.3 tokens per word), not a real tokenizer
- Files: `src/services/ai/TokenCounter.ts`
- Cause: deliberate — no tokenizer dependency was added
- Impact: estimates can be off by a meaningful margin, which matters when enforcing context limits
- Improvement path: adopt a real tokenizer (e.g. `tiktoken`) if budget accuracy becomes load-bearing

**In-Memory Event Buffer:**
- Problem: the event buffer is bounded but not persisted for analysis
- Files: `src/infrastructure/events/EventStore.ts`
- Current state: eviction at `maxEventsInMemory` **is** implemented (the buffer is spliced when it exceeds the limit), so unbounded growth is no longer a concern
- Improvement path: stream events to an external store if long-term retention is needed

**Single-Process Capacity:**
- Problem: one stdio process serves one client connection
- Files: `src/index.ts`
- Impact: no horizontal scaling within a process; CPU-bound AI work blocks the event loop
- Improvement path: worker threads for AI processing, or a queue in front of the dispatcher

## Fragile Areas

**AIServiceFactory Singleton:**
- Files: `src/services/ai/AIServiceFactory.ts`
- Why fragile: a singleton with a private constructor makes testing difficult; state (registered models, sampling provider, usage middleware) cannot easily be reset between tests
- Safe modification: accept the logger and dependencies through the constructor; expose an explicit reset for tests
- Test coverage: unit suites exist for provider resolution and API-key plumbing

**TaskContextGenerationService AI Dependency Chain:**
- Files: `src/services/TaskContextGenerationService.ts`
- Why fragile: depends on ContextualReferenceGenerator, DependencyContextGenerator, and AIServiceFactory; a failure in any cascades
- Safe modification: the resilience layer (`src/infrastructure/resilience/`) provides a circuit breaker and AI resilience policy — use them rather than adding bespoke retries
- Test coverage: unit suites exist; failure-mode coverage is partial

**Type Coercions in Field Value Updates:**
- Files: `src/services/FieldValueService.ts`
- Why fragile: complex branching over field types, each with different validation
- Safe modification: strategy pattern; extract field-type handlers into separate classes
- Test coverage: partial — not all field types have dedicated tests

**Tool Registry Size:**
- Files: `src/infrastructure/tools/ToolRegistry.ts` (~550 lines), `src/infrastructure/tools/ToolSchemas.ts` and the `*-tools.ts` family
- Why fragile: every tool's JSON Schema is generated here, so a schema bug affects every registration path
- Safe modification: keep the schema-generation path in one place and keep its regression test green (see below)

## Scaling Limits

**Single-Threaded MCP Server:**
- Current capacity: one request at a time via the stdio transport
- Limit: CPU-bound AI operations block other requests
- Scaling path: implement request queuing; consider worker threads for AI processing

**In-Memory Event Store:**
- Current capacity: bounded by `maxEventsInMemory` (default 1000), with retention days configurable
- Limit: analysis across restarts is not possible
- Scaling path: persist to disk or stream to an external store

## Dependencies at Risk

**AI SDK Surface:**
- Risk: heavy dependency on `ai`@7 and `@ai-sdk/*`@4; API changes break every AI feature
- Impact: PRD generation, task analysis, context generation, issue intelligence
- Note: `ai`@7 reports usage as **objects** (`usage.inputTokens.total`), not numbers — a silent `NaN` regression if read as scalars
- Migration plan: abstract AI calls behind a provider interface; implement an adapter pattern

**MCP SDK v2:**
- Risk: `@modelcontextprotocol/server` v2 (2026-07-28 spec) is a major version; argument validation, error semantics, and resource/prompt APIs can shift
- Impact: every tool registration and the whole result-shaping path
- Note: v2 validates arguments against the declared `inputSchema` **before** the handler runs, so `ToolValidator` never sees a missing required field
- Migration plan: the v2 migration is recorded in `docs/adr/003-mcp-sdk-v2-migration.md`; keep the compatibility aliases in `src/index.ts` until the last throw site is migrated

**`@ai-sdk/provider` Must Remain a Direct Dependency:**
- Risk: it is imported for types only, but `ai`@7 does not re-export `LanguageModelV4*` and pnpm does not hoist transitive packages the way npm did
- Impact: removing it from `package.json` compiles under npm and fails under pnpm
- Fix approach: keep the exact pin (`4.0.31`) and the direct declaration

**GitHub GraphQL API Changes:**
- Risk: Projects v2 API is relatively new; schema changes could break queries
- Impact: All project management features
- Migration plan: Pin API version where possible; add schema validation tests

**Dual Package Manager Support:**
- Risk: a dependency that resolves under npm but not pnpm (or vice versa)
- Impact: contributor installs and CI diverge
- Mitigation: the CI matrix (npm + pnpm) runs build, typecheck, and tests under both

## Missing Critical Features

**Analytics Surface Is Minimal:**
- State: the original phase-11 scope ("Analytics & Reporting") is delivered as the read-only `analytics` tool: `sprint_velocity`, `sprint_burndown`, `cycle_time`, `throughput`, `project_summary` (ANLY-01–05)
- Limit: only those five reports exist; anything beyond them (e.g. cross-project or agent-performance dashboards) is not built

**Tracing Is Per Tool Call:**
- State: `CorrelationContext` correlates within a process, and OpenTelemetry (`OTEL_EXPORTER_OTLP_ENDPOINT`, opt-in) exports one `tool.<name>` span per tool call
- Limit: no trace-context propagation into GitHub's API or across the MCP client boundary

**No Secret Manager Integration:**
- Problem: Vault / AWS Secrets Manager are documented as an extension point but not implemented
- Blocks: managed secret rotation in hosted deployments
- Note: the `SecretProvider` contract is synchronous, which is the actual constraint

## Test Coverage Gaps

**Coverage Thresholds:**
- State: `vitest.config.ts` enforces coverage thresholds (lines, functions, branches, statements); measured results: see CI
- Risk: a low floor lets regressions slip through in the least-covered paths of a server that mutates production repositories
- Priority: Medium — raise the floor as coverage improves, rather than lowering it

**E2E Test Reliability:**
- What's not tested: full workflows against the real GitHub API are only exercised when `E2E_REAL_API=true`; by default `nock` intercepts every call
- Files: `src/__tests__/e2e/**`
- Risk: integration issues discovered only in production
- Priority: Medium — most live suites are skipped by default

**Field-Value Type Coverage:**
- What's not tested: not every field type in `FieldValueService` has a dedicated unit test
- Risk: silent coercion regressions on the project-field write path
- Priority: Medium

## Resolved Since the Last Audit

- Residual `as any` in production code — gone (see Type Assertions)
- Dual test trees — the legacy root `tests/` tree was merged into `src/__tests__/` and removed; `vitest.config.ts` includes only `src/__tests__/**`
- Missing analytics surface — the `analytics` tool
- GitHub rate-limit exhaustion — one `GitHubRequestExecutor` plus `RateLimitManager` backs off below `RATE_LIMIT_FLOOR`
- Webhook/SSE exposure — loopback bind, bearer-token-protected `/events/*`, fail-closed signatures
- Dead modules (`infrastructure/validation`, `infrastructure/resource`, `StructuredLogger`/`TracingLogger`, `project-types.ts`, `MCPErrorHandler`) — deleted
- No audit trail for mutations — opt-in `MutationAuditLog`

## Watch Items (Regression Guards, Not Open Bugs)

**Tool JSON Schema Generation:**
- Guard: `src/__tests__/unit/infrastructure/tools/schema-generation.test.ts`
- Why it matters: an incompatible schema converter silently emits `{type:'object'}` with no `properties` — every tool then advertises a parameterless schema, with no error anywhere. Keep this test green and never reintroduce the incompatible converter.

**Fake Timer Leakage:**
- Guard: the global setup file applies fake timers only inside E2E files
- Why it matters: when the clock was frozen globally, anything awaiting a real `setTimeout` hung to the test timeout and every `Date.now()`-based assertion was measured from the frozen date

---

*Concerns audit: 2026-11-02*
