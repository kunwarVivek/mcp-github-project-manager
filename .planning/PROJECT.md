# MCP GitHub Project Manager

## What This Is

A comprehensive Model Context Protocol (MCP) server that provides AI-powered GitHub project management from idea to completion. It enables AI agents (Claude, GPT, etc.) to fully control GitHub Projects v2, generate PRDs, break down requirements into tasks, triage issues intelligently, orchestrate agent swarms, and maintain complete traceability from requirements through implementation to verification.

## Core Value

**Comprehensive AI-enabled GitHub-based project management from 0-100** — complete GitHub Projects control, intelligent task management, and full requirements traceability, all accessible to AI agents via MCP.

## Requirements

Requirement IDs (GHAPI / MCP / DEBT / AI / ANLY / PROD) are defined in `REQUIREMENTS.md`; phase mapping is in `ROADMAP.md`.

### Validated

- Basic project CRUD (create, list, get, update, delete)
- Issue management (CRUD + comments)
- Pull request management (CRUD + reviews + merge)
- Sprint/iteration management (CRUD + current + assign items)
- Project fields (create, list, update)
- Project views (CRUD for table/board/roadmap)
- Project items (add, remove, list, archive/unarchive)
- Field values (set, get, clear)
- Labels (create, list)
- Draft issues (CRUD)
- Milestones (CRUD)
- AI PRD generation from features
- AI task generation from PRDs
- AI task complexity analysis
- AI issue enrichment
- AI issue triaging (single + bulk)
- Requirements traceability matrix creation
- Iteration management (config, items, date-based assignment)
- Agent swarm orchestration (registry, checkout, heartbeat, work products, budgets, reclaim)
- GitHub Actions workflows, Releases, Branch protection
- Read-only analytics (sprint velocity/burndown, cycle time, throughput, project summary)

### Active

All Active items are delivered; the list is kept as the scope record. IDs refer to `REQUIREMENTS.md`.

**GitHub Projects v2 API Coverage:**
- [x] Sub-issues management (add, list, reprioritize, parent lookup) — GHAPI-01–05
- [x] Project status updates (createProjectV2StatusUpdate) — GHAPI-06–08
- [x] Project templates (mark as template, copy from template) — GHAPI-09–12
- [x] Repository/team linking (link/unlink to repos and teams) — GHAPI-13–18
- [x] Project close/reopen operations — GHAPI-19–20
- [x] Convert draft issue to real issue — GHAPI-21
- [x] Item position/reordering within project — GHAPI-22
- [x] Advanced search with AND/OR keywords — GHAPI-23–24
- [x] GitHub App installation auth (outranks the PAT) — GHAPI-25

**MCP Protocol:**
- [x] SDK upgraded off 1.12.0 — MCP-01–04 (delivered on SDK 1.25; superseded by the v2 migration, MCP-16)
- [x] Tool annotations (destructive, read-only, idempotent behavior metadata) — MCP-05–07
- [x] Tool output schemas (declared return types) — MCP-08–12
- [x] MCP-compliant error handling — MCP-13–15
- [x] `@modelcontextprotocol/server` v2 (`registerTool`, `serveStdio`) — MCP-16
- [x] Tool-failure contract: `isError` results, JSON-RPC errors only for protocol faults — MCP-17
- [x] Idempotency keys on create actions, additive cursor pagination, per-tool schema versions, confirm-gated sprint delete — MCP-18–21

**Tech Debt Resolution:**
- [x] Break up ProjectManagementService (god class → extracted per-feature services; `ProjectManagementService` is now a 121-line getters-only facade) — DEBT-01–07
- [x] Fix type assertions with proper interfaces (zero real `as any` in production code) — DEBT-08–13
- [x] Test coverage and stabilization — DEBT-14–20 (coverage floor enforced by thresholds in `vitest.config.ts`)
- [x] Circuit breakers for AI services, health check (live GitHub rate-limit probe), correlation-ID tracing, cache persistence, graceful AI degradation — DEBT-21–25
- [x] Documentation reconciled (STATUS.md, tool docs, API reference) — DEBT-26–28
- [x] Dead modules deleted, single test tree, rich domain entities, DI composition root — DEBT-29–31

**AI Feature Enhancement:**
- [x] PRD generation quality (confidence, templates, validation) — AI-01–04
- [x] Task generation quality (complexity, dependencies, effort, templates) — AI-05–08
- [x] AI-powered sprint planning suggestions — AI-09–12
- [x] AI-powered roadmap generation from requirements — AI-13–16
- [x] AI issue intelligence (enrichment, label suggestions, duplicate detection, related-issue linking) — AI-17–20
- [x] Versioned `PromptRegistry`, per-session `TokenBudgetManager`, agent budget hard stop, `AIResponseCache` — AI-21–24

**Analytics:**
- [x] `analytics` tool: sprint_velocity, sprint_burndown, cycle_time, throughput, project_summary — ANLY-01–05 (the original "Analytics & Reporting" scope, delivered minimally; see ROADMAP Phase 11)

**Production Readiness:**
- [x] Tests, E2E suites with credential-gated live-API variants — PROD-01–04
- [x] Comprehensive documentation — PROD-05–08
- [x] npm package versioning, changelog, publication — PROD-09–12
- [x] Proactive rate-limit budgeting through one `GitHubRequestExecutor` — PROD-13
- [x] Mutation audit log — PROD-14
- [x] Opt-in OpenTelemetry tracing — PROD-15
- [x] Webhook/SSE server hardening — PROD-16
- [x] Supply-chain CI gates (lockfile sync, CodeQL, Dependabot, SBOM) — PROD-17
- [x] Doc-count CI check — PROD-18

### Out of Scope

- Real-time collaboration features — focus on API/CLI usage, not live sync
- GitHub Insights/Charts API — appears UI-only, no programmatic API available (the `analytics` tool computes its own reports from project data)
- Multi-organization management — single org/user context per server instance
- Self-hosted GitHub Enterprise — focus on github.com initially

## Context

**Codebase state (derive current numbers from code, not from this file):**
- Version 3.0.0 (`package.json`); 21 MCP tools / 175 actions exposed (counts enforced by `npm run check:docs` against the `ToolRegistry`); the granular per-operation tools remain registered in `ToolRegistry` as internal implementation contracts and are not listed over MCP
- Layered architecture: MCP server (`src/index.ts`) → `ToolDispatcher` → tool executors → services → GitHub repositories (Octokit GraphQL/REST, all calls through one `GitHubRequestExecutor`)
- Test suite: Vitest 5, single tree under `src/__tests__/`; results and coverage: see CI
- Uses Vercel AI SDK v7 (`ai` ^7, `@ai-sdk/*` ^4/^5) for multi-provider AI access (Anthropic, OpenAI, Google, Perplexity, OpenAI-compatible endpoints)
- Codebase mapping available at `.planning/codebase/`

**Technical Environment (from `package.json`, `.node-version`):**
- Node.js >= 22.12.0 (`engines`); `.node-version` pins 24; CI tests 22.x and 24.x
- TypeScript ^7.0.2, ES2022 target
- MCP SDK `@modelcontextprotocol/server` ^2.3.1 (v2, 2026-07-28 spec); `@modelcontextprotocol/client` ^2.3.1 is dev-only
- Octokit `@octokit/rest` ^22.0.1, `@octokit/auth-app` ^8.3.1
- Zod ^4.6.7 for schema validation and native JSON Schema generation
- tsyringe + reflect-metadata for the composition root (`src/container.ts`)
- Vitest ^5.0.5, Biome ^2.5.15, npm and pnpm both supported

## Constraints

- **API Compatibility**: PAT auth needs a classic PAT for GitHub GraphQL Projects v2 (fine-grained tokens don't work); GitHub App installation auth is the alternative and outranks the PAT when fully configured
- **MCP Transport**: Primary transport is stdio (for Claude Desktop and similar clients)
- **AI Provider Keys**: At least one AI provider API key required for hosted AI features (or an MCP client with sampling)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| GraphQL-first for GitHub API | REST API incomplete, GraphQL has full feature coverage | ✓ Shipped (Octokit GraphQL/REST via GitHubRepositoryFactory, one GitHubRequestExecutor) |
| Vercel AI SDK for AI abstraction | Multi-provider support, unified interface | ✓ Good — on `ai` v7 |
| Zod for validation | Type-safe schemas, native `z.toJSONSchema` for tool schemas | ✓ Good — on zod v4 |
| MCP SDK v2 (`@modelcontextprotocol/server`) | Per-tool `registerTool`, `serveStdio` protocol negotiation, spec 2026-07-28 | ✓ Shipped (see `docs/adr/003-mcp-sdk-v2-migration.md`) |
| tsyringe for DI | Lightweight, decorator-based, test-friendly | ✓ Shipped — `container.ts` registers services and the components `index.ts` owns; **documented exception**: tool executors self-construct via `createGitHubFactory()` / shared-services, not the container |
| Vitest over Jest | Native ESM/TS, Vite-based | ✓ Vitest 5; Jest-only CLI flags are rejected |
| In-memory cache default | Simple, works for single-instance | ✓ Good — persistence + size-bounded eviction; distributed cache still single-instance-only |
| Env-var secrets | Simple, 12-factor | ⚠️ Extended — file-mounted secrets (`SECRETS_DIR`) and `gh auth token` fallback; Vault/AWS SM are an extension point |
| Rich domain entities | Entities/value objects carry behavior; domain imports nothing from services/infrastructure | ✓ Shipped (`src/domain/entities/`) |

## Document Chain (PRD → FRD → Delivery)

This PRD is the top of a traceable chain. Keep them in sync:

| Level | Document | Role |
|-------|----------|------|
| PRD | `PROJECT.md` (this file) | Product intent, core value, constraints, decisions |
| FRD | `REQUIREMENTS.md` | Functional requirements (GHAPI/MCP/DEBT/AI/ANLY/PROD IDs) + phase traceability |
| Roadmap | `ROADMAP.md` | 12-phase delivery sequence, each mapped to FRD IDs |
| Status | `STATUS.md` | Phase completion and current release state |
| Live remediation | `docs/remediation/GAP-TRACKER.md` + `PLAN.md` | Post-v1.1.0 gap + fix status |

Superseded: `docs/GAP-ANALYSIS-LIVE.md` (stale snapshot).

---
*Last updated: 2026-11-02 — reconciled against code (package.json 3.0.0, 21 tools / 175 actions)*
