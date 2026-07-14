<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **mcp-github-project-manager** (4662 symbols, 11376 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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

<!-- project-manual:start -->
## Commands

| Task | Command |
|------|---------|
| Build | `npm run build` (tsc → `fix-imports.js` → chmod) |
| Dev (watch) | `npm run dev` |
| Unit tests | `npm test` · core only `npm run test:core` · AI `npm run test:ai` |
| E2E (mock) | `npm run test:e2e` · tools `npm run test:e2e:tools` |
| E2E (live API) | `E2E_REAL_API=true npm run test:e2e:tools:real` |
| Coverage | `npm run test:coverage` |
| Lint / format | `npm run lint` · `npm run format` |
| Inspect MCP server | `npm run inspect` |

## Architecture (DDD, MCP stdio server)

- `src/index.ts` — entry; boots MCP `Server` over stdio, wires `ToolRegistry` +
  `ProjectManagementService` through `src/container.ts` (tsyringe DI).
- `src/domain/` — types, zod schemas, errors. No logic.
- `src/services/` — business logic. `ProjectManagementService` orchestrates
  per-feature services; `services/ai/` holds AI SDK providers.
- `src/infrastructure/` — `github/` (Octokit GraphQL/REST), `tools/` (MCP tool
  defs + registry + validators), plus cache, persistence, resilience, events.
- `src/env.ts` + `src/cli.ts` — config. CLI flags override env vars.

## Environment (`.env` or CLI flags; CLI wins)

- Required: `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`.
- AI (optional, unlocks AI tools): `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`,
  `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`; model overrides `AI_MAIN_MODEL`,
  `AI_PRD_MODEL`, `AI_RESEARCH_MODEL`, `AI_FALLBACK_MODEL`.
- Optional: `SYNC_ENABLED`, `SYNC_TIMEOUT_MS`, `CACHE_DIRECTORY`,
  `WEBHOOK_SECRET`, `WEBHOOK_PORT`, `SSE_ENABLED`.
- Webhook security: signature validation fails closed. With no `WEBHOOK_SECRET`,
  webhooks are rejected unless `WEBHOOK_ALLOW_UNSIGNED=true` (trusted dev only).

## Gotchas

- ESM extensions: source omits `.js` in imports; `postbuild` runs
  `scripts/fix-imports.js` to add them. Never ship raw `tsc` output — always
  `npm run build`.
- `zod` is pinned to exact `3.25` (no caret). Bumping breaks
  `zod-to-json-schema` / MCP schema generation. Don't upgrade blindly.
- Jest requires `--experimental-vm-modules` (baked into npm scripts). Run tests
  via npm scripts, not bare `jest`.
- E2E tool tests mock GitHub by default; `E2E_REAL_API=true` hits the live API
  and consumes rate limit.

> `AGENTS.md` and `CLAUDE.md` are kept identical. Edit both together.
<!-- project-manual:end -->
