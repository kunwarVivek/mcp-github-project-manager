<!-- project-manual:start -->
## Commands

| Task | Command |
|------|---------|
| Build | `npm run build` (tsc → `fix-imports.js` → chmod) |
| Dev (watch) | `npm run dev` (tsx — `ts-node` cannot load under TS 7) |
| Unit tests | `npm test` · core only `npm run test:core` · AI `npm run test:ai` |
| E2E (mock) | `npm run test:e2e` · tools `npm run test:e2e:tools` |
| E2E (live API) | `E2E_REAL_API=true npm run test:e2e:tools:real` |
| Coverage | `npm run test:coverage` |
| Lint / format | `npm run lint` (Biome) · `npm run format` |
| Inspect MCP server | `npm run inspect` |

## Architecture (DDD, MCP stdio server)

- `src/index.ts` — entry; boots an `McpServer` (`@modelcontextprotocol/server`
  v2, 2026-07-28 spec) via `serveStdio`, which negotiates the protocol revision
  per connection. Each tool is registered with `registerTool`; all of them share
  one `dispatchTool` carrying the shutdown gate, in-flight tracking and result
  formatting. Wires `ToolRegistry` + `ProjectManagementService` through
  `src/container.ts` (tsyringe DI).
- Tool errors: an execution failure returns `{content, isError: true}` so the
  model can see and recover from it. A JSON-RPC error is reserved for protocol
  faults (unknown tool). Note v2 validates arguments against the declared
  `inputSchema` *before* the handler runs, so `ToolValidator` never sees a
  missing required field.
- `src/domain/` — types, zod schemas, errors. No logic.
- `src/services/` — business logic. `ProjectManagementService` orchestrates
  per-feature services; `services/ai/` holds AI SDK providers.
- `src/infrastructure/` — `github/` (Octokit GraphQL/REST), `tools/` (MCP tool
  defs + registry + validators), plus cache, persistence, resilience, events.
- `src/env.ts` + `src/cli.ts` — config. CLI flags override env vars.

## Environment (`.env` or CLI flags; CLI wins)

- Required: `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`.
- GitHub credential chain, first hit wins:
  `--token` CLI flag → `$SECRETS_DIR/GITHUB_TOKEN` file → `GITHUB_TOKEN` env →
  `gh auth token`. The `gh` fallback means a developer with a working `gh` login
  needs no configuration at all; disable it with `GH_CLI_TOKEN_FALLBACK=false`
  (it is also off automatically under `NODE_ENV=test`, so tests never shell out).
- GitHub App installation auth (optional, outranks the PAT when all three are
  set): `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID`.
  A partial App config falls back to the PAT rather than failing, so a half-set
  environment cannot lock the server out.
- Every credential read goes through `getSecret()`/`requireToken()`. Do NOT read
  `process.env.GITHUB_TOKEN` directly — that bypasses the whole chain, which is
  exactly how `SECRETS_DIR` and `--token` were silently broken before.
- AI (optional, unlocks AI tools): `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`,
  `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`; model overrides `AI_MAIN_MODEL`,
  `AI_PRD_MODEL`, `AI_RESEARCH_MODEL`, `AI_FALLBACK_MODEL`.
- Optional: `SYNC_ENABLED`, `SYNC_TIMEOUT_MS`, `CACHE_DIRECTORY`,
  `WEBHOOK_SECRET`, `WEBHOOK_PORT`, `SSE_ENABLED`.
- Webhook security: signature validation fails closed. With no `WEBHOOK_SECRET`,
  webhooks are rejected unless `WEBHOOK_ALLOW_UNSIGNED=true` (trusted dev only).
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

## Gotchas

- ESM extensions: source omits `.js` in imports; `postbuild` runs
  `scripts/fix-imports.js` to add them. Never ship raw `tsc` output — always
  `npm run build`.
- `zod` is on v4 (`^4.4.3`), paired with `ai`@^7 / `@ai-sdk/*`@^4 (peer-accept
  `^4.1.8`) and `@modelcontextprotocol/server`@^2. Tool JSON Schema is generated
  by **zod 4's native `z.toJSONSchema({io:'input'})`** in `ToolRegistry`.
  Do NOT reintroduce `zod-to-json-schema`: it does not support zod 4 and returns
  `{type:'object'}` with no `properties` — silently, with no error — which left
  every tool advertising a parameterless schema. Guarded by
  `src/__tests__/unit/infrastructure/tools/schema-generation.test.ts`.
  zod-4 gotchas:
  `z.record` needs an explicit key schema (`z.record(z.string(), v)`);
  `ZodError.errors` → `.issues`; `.nonstrict()` removed (objects strip by default).
- Tests run on **Vitest 4** (not Jest). Vitest rejects Jest-only CLI flags
  outright — `--testPathPattern` / `--testPathIgnorePatterns` exit with
  `CACError: Unknown option`, which silently broke 17 npm scripts. Filter by
  positional pattern (`vitest run ai-services`) and exclude with
  `--exclude='**/tests/x/**'`.
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
- Agent token budgets are metered server-side: `AIServiceFactory.getModel`
  wraps every model with middleware that accumulates provider-reported usage
  into `CorrelationContext`'s AsyncLocalStorage, and `dispatchTool` debits the
  agent's budget **once per tool call** (never per AI call — `AgentStore` is
  GitHub-backed and does unlocked read-modify-write). This covers only what the
  *server* spends; an agent's own runtime spend never reaches this process, so
  `record_usage` remains the channel for that.
- `ai`@7 reports usage as `inputTokens: {total,...}` / `outputTokens: {total,...}`
  — **objects, not numbers**. Reading them as numbers yields `NaN`.

> `AGENTS.md` and `CLAUDE.md` are kept identical. Edit both together.
<!-- project-manual:end -->

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **mcp-github-project-manager** (5963 symbols, 15713 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/mcp-github-project-manager/context` | Codebase overview, check index freshness |
| `gitnexus://repo/mcp-github-project-manager/clusters` | All functional areas |
| `gitnexus://repo/mcp-github-project-manager/processes` | All execution flows |
| `gitnexus://repo/mcp-github-project-manager/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
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

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

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
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
