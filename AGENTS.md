<!-- project-manual:start -->
## Toolchain

| Layer | Version | Notes |
|-------|---------|-------|
| Node | **24** (`.node-version`) | floor is `>=22.12.0` (`engines`); CI tests 22.x + 24.x, Docker uses `node:24-slim` |
| Package manager | **npm or pnpm** | both supported, both lockfiles committed and kept in sync; deliberately NOT pinned in `package.json` so nobody is forced onto one. CI runs the full build under **both** — that matrix is what catches a dep that only resolves under one of them (e.g. a package imported directly but only present as a hoisted transitive under npm) |
| TypeScript | **7.0.2** | `tsc -p tsconfig.build.json` emits; `postbuild` adds `.js` extensions |
| Vite | **8.3.5** | dev-only, pulled in as vitest's peer; pinned explicitly so the resolution is not a lottery |
| Vitest | **5.x** | test runner (not Jest) |
| Biome | **2.6.x** | lint + format; `pnpm run lint` must exit 0. Markdown/YAML formatters are off in `biome.json` (2.6 enables them by default); their linters stay on |

Stable/LTS only: no beta, alpha, rc or `next` tags anywhere in the dependency
tree. The next release of a dependency is adopted only after the full gate
(`build` → `typecheck` → `lint` → `test`) passes on it.

## Commands

Every script below is package-manager agnostic — `npm run <script>` works
exactly like `pnpm run <script>`, and `npm test` like `pnpm test`.

| Task | Command |
|------|---------|
| Build | `pnpm run build` (tsc → `fix-imports.js` → chmod) |
| Typecheck | `pnpm run typecheck` (src + examples, then src + tests) |
| Dev (watch) | `pnpm run dev` (tsx — `ts-node` cannot load under TS 7) |
| Unit tests | `pnpm test` · core only `pnpm run test:core` · AI `pnpm run test:ai` |
| E2E (mock) | `pnpm run test:e2e` · tools `pnpm run test:e2e:tools` |
| E2E (live API) | `E2E_REAL_API=true pnpm run test:e2e:tools:real` · agent orchestration tiers: `pnpm run test:e2e:smoke` (~242 GraphQL pts) · `pnpm run test:e2e:full` (~4,500 of 5,000/h) |
| E2E runner | `pnpm run e2e` — `--suite <name>`, `--real-api`, `--json <path>` (never `--testPathPattern`: Vitest 5 rejects it) |
| Action sweep | `pnpm run test:e2e:sweep` · gate `pnpm run test:e2e:coverage` — every one of the <!-- count:actions -->175<!-- /count --> actions, no credentials needed |
| Coverage | `pnpm run test:coverage` |
| Lint / format | `pnpm run lint` (Biome) · `pnpm run format` |
| Inspect MCP server | `pnpm run inspect` |

## Architecture (DDD, MCP stdio server)

- `src/index.ts` — entry; boots an `McpServer` (`@modelcontextprotocol/server`
  v2, 2026-07-28 spec) via `serveStdio`, which negotiates the protocol revision
  per connection. Each of the <!-- count:tools -->21<!-- /count --> tools is registered with `registerTool`; all of them share
  one `dispatchTool` carrying the shutdown gate and in-flight tracking, then
  delegating to `ToolDispatcher` (`infrastructure/mcp/ToolDispatcher.ts`):
  argument validation → budget gate → audited execution inside an OTel span →
  budget debit → result formatting.
- Composition root (`src/container.ts`, tsyringe): `configureContainer(auth,
  owner, repo)` registers the components `index.ts` owns — `ResourceCache`,
  `FilePersistenceAdapter`, `GitHubWebhookHandler`, `EventStore`,
  `EventSubscriptionManager`, `GracefulShutdown`, `MutationAuditLog`,
  `TelemetryConfig` — plus the services; `index.ts` resolves
  them and constructs none by hand. **Documented exception:** tool executors
  (`infrastructure/tools/**`) do NOT resolve from the container. They
  self-construct through the one shared factory (`createGitHubFactory()` in
  `tools/tool-factory.ts` / the shared-services accessor), which itself uses
  `resolveGitHubAuth()`. Do not add a second construction path.
- Tool errors: unknown tool is the only JSON-RPC error (`McpError`
  MethodNotFound). Every other failure — invalid arguments (field-level
  messages), GitHub API errors (`ToolValidator.mapGitHubError`: 401/403/404/422/
  rate-limit/5xx with actionable text), exhausted agent budget (`BudgetExhausted`
  with remaining/limit) — returns `{content, isError: true}` with the stable
  code in `_meta.error`, so the model can recover. Note v2 validates arguments
  against the declared `inputSchema` *before* the handler runs; `ToolValidator`
  additionally applies parameter coercion and the zod schema.
- Granular (per-operation) tools stay registered in `ToolRegistry` as internal
  implementation contracts; only the compound tools are listed over MCP.
- `src/domain/` — types, zod schemas, errors, and entity/value-object behavior
  (rich entities). Imports nothing from `services/` or `infrastructure/`.
- `src/services/` — business logic. `ProjectManagementService` is a thin
  facade of typed per-feature service getters (no behavior of its own);
  `services/ai/` holds AI SDK providers.
- `src/infrastructure/` — `github/` (Octokit GraphQL/REST), `tools/` (MCP tool
  defs + registry + validators), plus cache, persistence, resilience, events.
- `src/env.ts` + `src/cli.ts` — config. CLI flags override env vars.

## Environment (`.env` or CLI flags; CLI wins)

- Required: `GITHUB_OWNER`, `GITHUB_REPO`. `GITHUB_TOKEN` is NOT required.
- GitHub credential chain, first hit wins, re-resolved per tool call:
  1. GitHub App installation (`GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY` +
     `GITHUB_APP_INSTALLATION_ID`; a partial config falls through)
  2. `--token` CLI flag
  3. `$SECRETS_DIR/GITHUB_TOKEN` file
  4. `GITHUB_TOKEN` env
  5. stored OAuth token from `mcp-github-project-manager auth login`
  6. `gh auth token --hostname github.com` via `src/infrastructure/github/auth/gh/`
     (cached 60 s, re-read + one retry on a 401; `GH_CLI_USER` pins the account;
     missing `project` scope → startup warning + hint `gh auth refresh -h
     github.com -s project`; set up with `auth login --gh`; disable with
     `GH_CLI_TOKEN_FALLBACK=false`; off under `NODE_ENV=test`, so tests never
     shell out)
  None → boot fails listing all methods. Static tokens are rotation-aware.
- OAuth device flow (`build/bin.js auth login|status|logout`):
  `GITHUB_OAUTH_CLIENT_ID` (required), `GITHUB_OAUTH_CLIENT_SECRET` (only for
  revoke on logout), `GITHUB_OAUTH_SCOPES` (default `repo project read:org`),
  `GITHUB_OAUTH_TOKEN_FILE` (default
  `$XDG_CONFIG_HOME/mcp-github-project-manager/github-oauth.json`, 0600).
  Entry is `build/bin.js`; `build/index.js` has no `auth` subcommands.
- `GitHubAuth` / `resolveGitHubAuth()` (`src/infrastructure/github/auth/`) is
  the ONLY credential seam. Never pass raw token strings around and never read
  `process.env.GITHUB_TOKEN` directly; build repositories only from a
  `GitHubAuth` via `GitHubRepositoryFactory.fromAuth(auth, owner, repo)`
  (`configureContainer(auth, ...)`). `GitHubConfig` holds no token material;
  `auth.mode` is `app-installation` or a token mode. `requireToken` and the
  module-level `GITHUB_TOKEN` export are gone. Other config/secrets still go
  through `getSecret()`.
- AI (optional, unlocks AI tools): `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`,
  `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`; model overrides `AI_MAIN_MODEL`,
  `AI_PRD_MODEL`, `AI_RESEARCH_MODEL`, `AI_FALLBACK_MODEL`. Embeddings (semantic
  duplicate detection): `AI_EMBEDDING_MODEL` (default `text-embedding-3-small`),
  `AI_EMBEDDING_API_KEY` (falls back to `OPENAI_API_KEY`; resolved through the
  secret chain), `AI_EMBEDDING_BASE_URL` (OpenAI-compatible endpoint).
- Optional: `SYNC_ENABLED`, `SYNC_TIMEOUT_MS`, `CACHE_DIRECTORY`,
  `WEBHOOK_SECRET`, `WEBHOOK_PORT`, `SSE_ENABLED`.
- Inbound `/events/*` auth (bearer header only): `EVENTS_AUTH_TOKEN` (shared
  secret, read via `getSecret()` per request) and/or OAuth 2.1 resource server
  `OAUTH_ISSUER` + `OAUTH_AUDIENCE` (required together), `OAUTH_JWKS_URI`,
  `OAUTH_REQUIRED_SCOPES`, `OAUTH_RESOURCE_URL`. Nothing configured → 503
  ("Events API disabled"); bad/missing credentials when configured → 401; opt
  out with `EVENTS_ALLOW_UNAUTHENTICATED=true`. Anonymous `/health` returns
  status only.
- Vertex AI Gemini (provider `google-vertex`, Google ADC, no key in our
  config): `GOOGLE_VERTEX_PROJECT` (enables it), `GOOGLE_VERTEX_LOCATION`
  (default `us-central1`); creds via `GOOGLE_APPLICATION_CREDENTIALS` / gcloud
  ADC / workload identity.
- Rate limits: `RATE_LIMIT_FLOOR` (default 100) — below this many remaining
  GraphQL points the client backs off proactively instead of burning the budget
  and hitting a 403.
- Observability: `AUDIT_LOG_ENABLED` / `AUDIT_LOG_PATH` write an append-only,
  redacted JSONL record of every state-changing tool call (actor = agent id or
  `token`); `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_SERVICE_NAME` enable OTLP
  tracing (`tool.<name>` spans). Both flush in graceful shutdown.
- Webhook security: signature validation fails closed. With no `WEBHOOK_SECRET`,
  webhooks are rejected unless `WEBHOOK_ALLOW_UNSIGNED=true` (trusted dev only).
  The HTTP server is hardened by default, each with an opt-out/tuning var:
  binds loopback (`WEBHOOK_HOST=0.0.0.0` to expose), `/events/*` needs
  `EVENTS_AUTH_TOKEN` (or `EVENTS_ALLOW_UNAUTHENTICATED=true`, dev only; startup
  warns when SSE is on with neither), CORS allow-list `WEBHOOK_ALLOWED_ORIGINS`,
  rate limit `WEBHOOK_RATE_LIMIT` / `WEBHOOK_RATE_WINDOW_MS`, request timeout
  `WEBHOOK_TIMEOUT_MS`, `X-Forwarded-For` only from `WEBHOOK_TRUSTED_PROXIES`.
- Secrets: set `SECRETS_DIR` (e.g. `/run/secrets`) to load any config/secret from
  a file named after it (Docker/k8s secret convention), checked before env vars.
  `getSecret(name)` in `env.ts` reads fresh (rotation-aware). Vault/AWS SM are an
  extension point via `SecretProvider` (`src/infrastructure/secrets/`).
- Startup validation runs against the *resolved* config, not raw `process.env` —
  validating the environment directly meant a token supplied by file or CLI flag
  failed the required-field check and the process exited before the resolver ran.
- Logs are redacted: `redactSecrets()` in `infrastructure/logger` strips
  token/secret/password/apiKey/authorization-shaped keys from anything the logger
  stringifies, and `GitHubConfig.token` is non-enumerable so `JSON.stringify`
  cannot emit the PAT.
  `redactSecretPatterns()` additionally scrubs credential-shaped *values* (GitHub
  `ghp_`/`github_pat_`, JWT, Bearer/Basic, `sk-`/`sk-ant-`, `AIza`, PEM keys) from
  messages, string args and Error text in every log sink and startup error write.

## Gotchas

- ESM extensions: source omits `.js` in imports; `postbuild` runs
  `scripts/fix-imports.js` to add them. Never ship raw `tsc` output — always
  `pnpm run build`.
- `zod` is on v4 (`^4.6.7`), paired with `ai`@^7.0.162 / `@ai-sdk/*`@^4
  (peer-accept `^4.1.8`) and `@modelcontextprotocol/server`@^2. Tool JSON Schema
  is generated by **zod 4's native `z.toJSONSchema({io:'input'})`** in `ToolRegistry`.
  Do NOT reintroduce `zod-to-json-schema`: it does not support zod 4 and returns
  `{type:'object'}` with no `properties` — silently, with no error — which left
  every tool advertising a parameterless schema. Guarded by
  `src/__tests__/unit/infrastructure/tools/schema-generation.test.ts`.
  zod-4 gotchas:
  `z.record` needs an explicit key schema (`z.record(z.string(), v)`);
  `ZodError.errors` → `.issues`; `.nonstrict()` removed (objects strip by default).
- `@ai-sdk/provider` is a **direct** dependency (pinned exact, `4.0.35`) even
  though only types are imported from it: `ai`@7 does not re-export
  `LanguageModelV4*`, and pnpm does not hoist transitive packages the way npm
  did. An undeclared import of it compiles under npm and fails under pnpm.
  Bump it together with `@ai-sdk/google-vertex` (also exact) to the pair whose
  `@ai-sdk/provider` matches what `ai` resolves — exactly one copy may exist
  (`pnpm why @ai-sdk/provider`).
- Tests run on **Vitest 5** (not Jest). Vitest rejects Jest-only CLI flags
  outright — `--testPathPattern` / `--testPathIgnorePatterns` exit with
  `CACError: Unknown option`, which silently broke 17 npm scripts. Filter by
  positional pattern (`vitest run ai-services`) and exclude with
  `--exclude='**/e2e/**'`.
- Test mocks must use `function`, not an arrow, wherever the code under test
  calls `new` — `mockImplementation(() => ({...}))` fails with
  "is not a constructor". Likewise a `beforeEach(() => x.mockReset())` with an
  *implicit return* hands the mock back to Vitest, which treats a returned
  function as a teardown callback and calls it; always use a block body.
- E2E tool tests mock GitHub by default; `E2E_REAL_API=true` hits the live API
  and consumes rate limit.
- `isolatedModules` is ON. Every file must transpile independently, so a type
  re-exported as a value is an error. `tsc` elides those; `tsx`/esbuild/bundlers
  emit a real runtime import that then fails to resolve. Use `export type` /
  `import type` — including for **decorated constructor params**, whose types
  `emitDecoratorMetadata` references at runtime.
- Unit tests that start a loopback HTTP server (OAuth/inbound-auth/webhook
  tests) must call `nock.enableNetConnect(<loopback matcher>)` — the global
  setup `src/__tests__/e2e/setup.ts` disables net connect for every file, so
  real `127.0.0.1` requests otherwise fail.
- Agent token budgets are metered server-side: `AIServiceFactory.getModel`
  wraps every model with middleware that accumulates provider-reported usage
  into `CorrelationContext`'s AsyncLocalStorage, and `dispatchTool` debits the
  agent's budget **once per tool call** (never per AI call — `AgentStore` is
  GitHub-backed, so each debit is a compare-and-swap commit via `updateAgent`).
  A failed debit is retried once, then parked in the in-memory `UnpaidDebitLedger`,
  logged at error level and flagged on the result as `_meta.budgetDebitFailed`; the
  next `checkout_task` settles it first and refuses if the registry is still
  unreachable. The ledger is not persisted. This covers only what the
  *server* spends; an agent's own runtime spend never reaches this process, so
  `record_usage` remains the channel for that.
- `ai`@7 reports usage as `inputTokens: {total,...}` / `outputTokens: {total,...}`
  — **objects, not numbers**. Reading them as numbers yields `NaN`.
- The agent registry is **not an issue body**: it is `registry.json` on the orphan
  branch `agent-registry`, written through the GitHub Contents API with sha
  compare-and-swap (`AgentStore`). The token needs **`contents: write`** and no
  branch ruleset may block that branch; a repo with no commits cannot host it.
  Never reintroduce read-modify-write on an issue body — it is last-write-wins and
  silently drops registrations. A legacy "Agent Registry" issue is imported once
  and rewritten to a pointer (`LegacyAgentRegistry`).
- Registry writes are **field-level**: `AgentStore` exposes `createAgent` and
  `updateAgent(id, mutator)` only — the mutator runs on the *fresh* record on every
  compare-and-swap attempt, so concurrent writers to the same agent never overwrite
  each other. There is no whole-record upsert; never do `getAgent → modify copy →
  write back` (it lost budget debits and heartbeats). Budget writes are deltas.
- Heartbeat/progress/branch are **hot state on the claimed project item**
  (`agent_heartbeat_at`, `agent_progress`, `agent_work_branch`; `ItemHeartbeatStore`),
  not registry commits. The registry is touched only on cold changes (status, task) or
  an idle agent's beat older than the 30-min stale window. Staleness is the newer of
  item beat and registry beat (`AgentHeartbeatResolver`). Projects missing any `agent_*`
  field are healed additively on first checkout/heartbeat per process
  (`AgentFieldProvisioner` → `ProjectFieldSetup.ensureFields`; concurrent first calls
  share one promise; a type conflict is a hard error; a permission failure returns the
  `setup_fields` / project-admin message and is retried on the next call).

> `AGENTS.md` and `CLAUDE.md` are kept identical. Edit both together.
<!-- project-manual:end -->

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **mcp-github-project-manager** (13683 symbols, 31596 relationships, 671 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact before editing.** Use `impact({target: "symbolName", direction: "upstream"})` or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .`; report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "main"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`.
- MUST warn on HIGH/CRITICAL `risk` pre-edit; never use `riskSharedAxes` to waive a HIGH/CRITICAL `risk` warning. Compare File/symbol: MCP File omits axes; Graph-RAG expands File.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- **MUST use `query({search_query: "concept"})` for concepts/flows, `context({name: "symbolName"})` for a named symbol, or `impact` for blast radius, on read-only callers, dependencies, imports, or execution flow.** Graph first; text search only for empty/`UNKNOWN`/literals.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/mcp-github-project-manager/context` | Codebase overview, check index freshness |
| `gitnexus://repo/mcp-github-project-manager/clusters` | All functional areas |
| `gitnexus://repo/mcp-github-project-manager/processes` | All execution flows |
| `gitnexus://repo/mcp-github-project-manager/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
| --- | --- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:46cd31e7 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/skills/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->
