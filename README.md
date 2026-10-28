# MCP GitHub Project Manager

<!-- Keywords: mcp server, model context protocol, github project management, ai agent orchestration, multi-agent coordination, autonomous coding agents, prd generator, sprint planning ai, issue triage automation, github projects v2 api, claude mcp, codex mcp, cursor mcp, llm tools, agentic task management, ai project manager, swarm coordination, github actions, github releases, branch protection, mcp resources, mcp prompts -->

[![npm version](https://img.shields.io/npm/v/mcp-github-project-manager.svg)](https://www.npmjs.com/package/mcp-github-project-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**The task substrate for AI coding agents.** An [MCP](https://modelcontextprotocol.io) server that turns GitHub Projects v2 into an agentic project-management layer: agents register, self-assign work, heartbeat, submit work products for review, and spend against token budgets — through **20 compound tools exposing 169 actions**, backed entirely by GitHub-native storage. No database, no Redis, no external infra.

You bring the agents (Claude Code, Codex, Cursor, Windsurf, Roo, OpenCode, any MCP client). This is the backbone that tells them what to work on and keeps them from colliding.

| Surface | Detail |
|---|---|
| Tools | 20 compound tools, 169 actions, `action`-routed |
| Resources | 6 read-only GitHub-backed views |
| Prompts | 6 reusable AI templates |
| Transport | MCP v2 over stdio (webhook/SSE optional) |
| Storage | GitHub issues, project fields, comments — no external infra |
| Runtime | Node >= 22.12.0 · MIT license |

## Why this exists

- **Agents need a work queue, not a chat window.** `agent_work` / `agent_manage` give agents atomic task checkout, heartbeats, and a review loop instead of "go figure it out."
- **Budgets must be enforced somewhere the agent cannot skip.** Each agent has a token budget with warning thresholds and a hard stop; the server debits itself, and `record_usage` covers the agent's own runtime spend.
- **AI plans are worthless if they never become issues.** `ai_generate` runs idea → PRD → tasks → materialized GitHub issues, grouped into milestones and sprints.
- **Tool lists are a context tax.** 20 tools instead of 169 keeps the schema small; `discover_tools` expands any domain or action on demand.
- **State should live where the work already is.** The agent registry is a file on a dedicated branch (compare-and-swap writes), task claims are project fields, work products are issue comments — no new infrastructure to operate.

## Quick start

Requires Node.js **>= 22.12.0** (Node 24 recommended).

```bash
# 1. Install (global, or use npx / pnpm dlx / docker compose — see below)
npm install -g mcp-github-project-manager

# 2. Configure (a working `gh auth login` means you can skip GITHUB_TOKEN)
export GITHUB_TOKEN="ghp_..."
export GITHUB_OWNER="your-org-or-user"
export GITHUB_REPO="your-repo"

# 3. Run the MCP stdio server
mcp-github-project-manager
```

Register it with an MCP client:

```json
{
  "mcpServers": {
    "github-project-manager": {
      "command": "npx",
      "args": ["-y", "mcp-github-project-manager"],
      "env": {
        "GITHUB_TOKEN": "ghp_...",
        "GITHUB_OWNER": "your-org-or-user",
        "GITHUB_REPO": "your-repo"
      }
    }
  }
}
```

```bash
# Claude Code CLI
claude mcp add github-project-manager -- npx -y mcp-github-project-manager

# Docker
docker compose up --build
```

Install paths: `npm install -g mcp-github-project-manager`, `npx -y mcp-github-project-manager`, `pnpm dlx mcp-github-project-manager`, or `docker compose up --build`.

A GitHub token needs `repo`, `project`, and `write:org` scopes. Full setup options live in the [Deployment Guide](docs/deployment.md) and the [Getting Started tutorial](docs/tutorials/getting-started.md).

Works with any stdio MCP client — Claude Desktop, Claude Code, Codex, Cursor, Windsurf, Roo Code, VS Code + Copilot, OpenCode, and custom harnesses.

## The tool surface

Every tool takes an `action` string that routes to the underlying operation, so clients see 20 schemas instead of 169.

| Tool | Group | Actions | Covers |
|---|---|---|---|
| `manage_project` | core | 37 | Projects v2: CRUD, fields, views, items, templates, repo/team linking |
| `manage_issues` | core | 18 | Issue CRUD, comments, drafts, advanced search, sub-issues |
| `manage_prs` | core | 7 | Create, list, update, merge, reviews |
| `manage_milestones` | core | 7 | CRUD, metrics, overdue and upcoming |
| `manage_sprints` | core | 8 | Create, update, plan, add/remove issues, metrics |
| `manage_labels` | core | 2 | Create and list repository labels |
| `manage_automation` | core | 7 | Automation rules: create, update, delete, enable, disable |
| `manage_iterations` | core | 5 | Iteration config, current iteration, items, by-date, assign |
| `manage_status_updates` | core | 3 | Project status updates: create, list, get |
| `manage_branches` | core | 4 | Branch protection rules and branch listing |
| `manage_releases` | core | 6 | Releases: create, list, get, update, delete, latest |
| `manage_workflows` | core | 6 | GitHub Actions: list, dispatch, run status/logs, cancel |
| `manage_events` | events | 3 | Subscribe, recent events, replay |
| `ai_generate` | ai | 9 | PRD generate/enhance/parse, features, next task, complexity, expand, traceability, materialize |
| `ai_analyze` | ai | 9 | Issue enrichment, triage, label suggestion, duplicate and related detection |
| `ai_plan` | ai | 6 | Capacity, backlog priority, risk, sprint composition, roadmap, visualization |
| `agent_work` | agents | 12 | Register, checkout, release, complete, heartbeat, review, task context |
| `agent_manage` | agents | 18 | Registry, activity, work products, budgets, usage, PM coordination, convergence |
| `system` | system | 2 | Health check (live GitHub rate-limit probe), project field setup |
| `discover_tools` | system | meta | Runtime discovery of tools, actions, and parameters |

Call shape — one discriminator, action-specific parameters:

```json
{ "tool": "manage_project", "arguments": { "action": "create", "title": "Q3 Roadmap", "owner": "myorg" } }
{ "tool": "manage_issues", "arguments": { "action": "create", "title": "Add login form", "body": "..." } }
{ "tool": "agent_work", "arguments": { "action": "checkout_task", "agentId": "agent-abc123", "strategy": "highest_priority" } }
{ "tool": "discover_tools", "arguments": { "domain": "sprints" } }
```

`discover_tools` takes an optional `domain` (projects, issues, pull_requests, milestones, sprints, labels, automation, iterations, events, status_updates, ai_generation, ai_analysis, ai_planning, agents, system) or a free-text `query`. It stays exposed even when tool groups are filtered.

Alongside the tools the server exposes **6 read-only resources** (`github://config`, `github://projects`, `github://sprints/current`, `github://milestones`, `github://agents`, `github://tools`) and **6 prompts** (`review-prd`, `explain-task-complexity`, `suggest-issue-labels`, `analyze-sprint-risk`, `generate-release-notes`, `triage-issue`).

Full parameter reference: [docs/TOOLS.md](docs/TOOLS.md).

## What it can do

**AI generation** (`ai_generate`) — generate a PRD from an idea, enhance an existing one, parse a PRD into tasks, add a feature with impact analysis, recommend the next task, analyze complexity and risk, expand a task into subtasks, build a traceability matrix, and materialize tasks into real GitHub issues.

**AI analysis** (`ai_analyze`) — enrich one or many issues, triage (single, bulk, or scheduled), suggest labels, detect duplicates, find related issues.

**AI planning** (`ai_plan`) — calculate sprint capacity, prioritize a backlog, assess risk, suggest sprint composition, generate a roadmap or visualization. Given a `projectId` the roadmap is planned from that project's own issues; with `autoCreate` the milestones are created and assigned to them.

**Agent swarm** (`agent_work` / `agent_manage`) — agents register with role, runtime, and capabilities; claim tasks by priority, age, skills, or deadline; heartbeat with progress and blockers; submit work products (branch, PR, files, test results) for review; approve, reject, or decompose. PM-side actions add budgets, usage accounting, stale-agent reclaim, workload rebalancing, smart assignment, and one-call project convergence.

**Deterministic GitHub surface** — projects, issues, pull requests, milestones, sprints, labels, branches, releases, workflows, automation rules, events, and status updates, all with plain `action` routing and no model in the loop.

The AI tools are optional. Without a provider key, everything else works unchanged.

### The agent loop, end to end

```json
{ "tool": "agent_work", "arguments": { "action": "register", "name": "claude-eng-1", "role": "engineer", "runtime": "claude-code", "capabilities": ["typescript", "testing"] } }
{ "tool": "agent_work", "arguments": { "action": "checkout_task", "agentId": "agent-abc123", "strategy": "highest_priority" } }
{ "tool": "agent_work", "arguments": { "action": "get_task_context", "issueNumber": 42 } }
{ "tool": "agent_work", "arguments": { "action": "heartbeat", "agentId": "agent-abc123", "status": "working", "taskId": "issue-42", "progress": 60, "currentBranch": "feat/42-add-login-form" } }
{ "tool": "agent_manage", "arguments": { "action": "submit_work_product", "agentId": "agent-abc123", "taskId": "issue-42", "issueNumber": 42, "branch": "feat/42-add-login-form", "prNumber": 99, "summary": "Added login form with validation" } }
{ "tool": "agent_work", "arguments": { "action": "complete_task", "agentId": "agent-abc123", "taskId": "issue-42", "summary": "Implemented and tested" } }
```

A runnable version of this loop (worker + reviewer, every id threaded from the previous response, non-zero exit on any failure) lives in [`examples/basic/agent-loop.ts`](examples/basic/agent-loop.ts); `--plan` prints the call sequence with symbolic references.

Checkout strategies: `highest_priority`, `oldest_first`, `skills_match`, `milestone_deadline`, `ai`. Budgets are set with `agent_manage` and `action: "set_budget"`; reset periods are `daily`, `weekly`, `monthly`, or `never`.

Where the state lives — no external database:

| Data | GitHub-native storage |
|---|---|
| Agent registry | `registry.json` on the `agent-registry` branch (Contents API, sha compare-and-swap) |
| Task claims | Project custom fields (`agent_claimed_by`, `agent_status`, `agent_pr_number`, …) |
| Work products | Structured issue comments |
| Budgets and heartbeats | Agent records in the registry |

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | yes\* | GitHub PAT with `repo`, `project`, `write:org` |
| `GITHUB_OWNER` | yes | Owner (user or org) of the target repository |
| `GITHUB_REPO` | yes | Target repository name |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID` | no | GitHub App auth; outranks the PAT when all three are set |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `PERPLEXITY_API_KEY` | no | Unlocks the `ai_*` tools |
| `AI_{MAIN,PRD,RESEARCH,FALLBACK}_{PROVIDER,MODEL,API_KEY,BASE_URL}` | no | Per-role provider, model, key, endpoint |
| `MCP_TOOL_GROUPS` | no | Expose only some groups: `core`, `ai`, `agents`, `events`, `system` (default `all`) |
| `SECRETS_DIR` | no | Read secrets from files named after the variable (Docker/k8s convention) |
| `WEBHOOK_SECRET`, `WEBHOOK_PORT`, `SSE_ENABLED` | no | Webhook/SSE transport; signature validation fails closed |
| `SYNC_ENABLED`, `CACHE_DIRECTORY`, `MAX_CACHE_ENTRIES` | no | Bidirectional sync and cache tuning |
| `LOG_LEVEL`, `LOG_FORMAT` | no | `debug\|info\|warn\|error`, `text` or `json` |

\* **Credential chain** (first hit wins): `--token` CLI flag → `$SECRETS_DIR/GITHUB_TOKEN` file → `GITHUB_TOKEN` env var → `gh auth token`. If you are already logged in with `gh`, you need no token configuration at all. Disable the fallback with `GH_CLI_TOKEN_FALLBACK=false`. CLI flags override env vars everywhere.

Narrow the exposed surface with group filters (group names, not tool names):

```bash
MCP_TOOL_GROUPS=core        # project management only
MCP_TOOL_GROUPS=core,ai     # add the AI tools
MCP_TOOL_GROUPS=all         # default — everything
```

**AI providers**: `anthropic`, `openai`, `google`, `perplexity`, and `openai-compatible` (OpenRouter, Together, Groq, Ollama, LM Studio, Azure OpenAI, …). There are **no default models** — you configure the models you use, per role, so you can run OpenRouter for cheap daily work and a frontier model for PRD generation. A partially configured GitHub App falls back to the PAT rather than locking you out.

Full list: [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## Running it

Every script is package-manager agnostic — `npm run X` and `pnpm run X` are identical, and both lockfiles are committed.

| Task | Command |
|---|---|
| Build (tsc → `fix-imports.js` → chmod) | `npm run build` |
| Typecheck (src + examples, src + tests) | `npm run typecheck` |
| Lint | `npm run lint` |
| Format | `npm run format` |
| Unit tests | `npm test` |
| Dev (watch) | `npm run dev` |
| Coverage | `npm run test:coverage` |
| E2E, mocked GitHub/AI | `npm run test:e2e:tools` |
| E2E, live API (uses rate limit) | `E2E_REAL_API=true npm run test:e2e:tools:real` |
| AI suites | `npm run test:ai` |
| Inspect the server | `npm run inspect` |

Point an MCP client at a local build with `{"command": "node", "args": ["build/index.js"]}`.

Deployment and MCP-client setup: [docs/deployment.md](docs/deployment.md). When something misbehaves: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## Architecture at a glance

Four layers, dependencies pointing inward:

1. **Domain** (`src/domain/`) — types, Zod schemas, errors. No logic.
2. **Services** (`src/services/`) — business logic; `ProjectManagementService` orchestrates per-feature services, `src/services/ai/` holds the AI SDK providers.
3. **Infrastructure** (`src/infrastructure/`) — `github/` (Octokit GraphQL/REST), `tools/` (tool definitions, registry, validators, `compound/`), plus cache, persistence, resilience, events, secrets, logger, MCP resources and prompts.
4. **MCP** (`src/index.ts`) — boots `McpServer` (MCP v2) over stdio; every tool is registered with `registerTool` and shares one `dispatchTool` carrying the shutdown gate, in-flight tracking, and result formatting.

`src/container.ts` wires everything with tyringe DI; `src/env.ts` and `src/cli.ts` resolve configuration (CLI flags beat env vars). AI providers plug in behind `AIServiceFactory`: it returns a model per role, wraps it in usage-reporting middleware, and the shared dispatcher debits the calling agent's budget once per tool call.

A tool that runs and fails returns `{ content, isError: true }` so the model can recover; a JSON-RPC error is reserved for protocol faults.

Design details: [docs/architecture.md](docs/architecture.md).

## Contributing

Task tracking uses **[bd](https://github.com/gastownhall/beads)** (beads) — `bd ready`, `bd show <id>`, `bd update <id> --claim`, `bd close <id>`. Code traversal and audits use **GitNexus**: run impact analysis before editing a symbol and change analysis before committing. Refresh the index with `node .gitnexus/run.cjs analyze --index-only` when that runner exists in your checkout; otherwise bootstrap the CLI with `npx`/`bunx`/`pnpm dlx gitnexus@latest analyze`. Per-task recipes live in `.agents/skills/gitnexus-*/SKILL.md`.

The quality gate, in order: `npm run build` → `npm run typecheck` → `npm run lint` → `npm test`.

Traps that bite contributors:

- **Source imports omit `.js`.** The `postbuild` step adds the extension. Never ship raw `tsc` output — always run the full build.
- **`isolatedModules` is on.** A type re-exported as a value is a compile error; use `export type` / `import type`, including for decorated constructor parameters.
- **Vitest rejects foreign test-runner CLI flags.** `--testPathPattern` fails with `CACError: Unknown option`; filter with a positional pattern and exclude with `--exclude='**/tests/x/**'`.
- **Mocks must use `function`, not an arrow,** wherever the code under test calls `new`. A `beforeEach` with an implicit return is treated as a teardown callback — use a block body.

Start with [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/contributing/index.md](docs/contributing/index.md).

## License

[MIT](LICENSE) — see [CHANGELOG.md](CHANGELOG.md) for the release history.

## Documentation

| Guide | What it covers |
|---|---|
| [Tool Reference](docs/TOOLS.md) | 20 compound tools, 169 actions, per-action parameters |
| [Configuration](docs/CONFIGURATION.md) | Every environment variable and per-role AI setup |
| [Deployment](docs/deployment.md) | Install paths, Docker, MCP client configuration |
| [Architecture](docs/architecture.md) | Layers, patterns, data flow, agent orchestration |
| [User Guide](docs/user-guide.md) | Day-to-day usage |
| [Tutorials](docs/tutorials/getting-started.md) | Step-by-step walkthroughs |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Common failures and fixes |
| [Contributing](docs/contributing/index.md) | Development workflow and standards |
