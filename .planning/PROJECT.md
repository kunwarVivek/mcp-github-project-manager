# MCP GitHub Project Manager

## What This Is

A comprehensive Model Context Protocol (MCP) server that provides AI-powered GitHub project management from idea to completion. It enables AI agents (Claude, GPT, etc.) to fully control GitHub Projects v2, generate PRDs, break down requirements into tasks, triage issues intelligently, and maintain complete traceability from requirements through implementation to verification.

## Core Value

**Comprehensive AI-enabled GitHub-based project management from 0-100** — complete GitHub Projects control, intelligent task management, and full requirements traceability, all accessible to AI agents via MCP.

## Requirements

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
- Automation rules (CRUD + enable/disable)
- Iteration management (config, items, date-based assignment)

### Active

**GitHub Projects v2 API Coverage:**
- [x] Sub-issues management (add, list, reprioritize, parent lookup) — GHAPI-01–05
- [x] Project status updates (createProjectV2StatusUpdate) — GHAPI-06–08
- [x] Project templates (mark as template, copy from template) — GHAPI-09–12
- [x] Repository/team linking (link/unlink to repos and teams) — GHAPI-13–18
- [x] Project close/reopen operations — GHAPI-19–20
- [x] Convert draft issue to real issue — GHAPI-21
- [x] Item position/reordering within project — GHAPI-22
- [x] REST API alternatives where available
- [x] Advanced search with AND/OR keywords — GHAPI-23–24

**MCP Protocol Upgrade:**
- [x] Upgrade SDK 1.12.0 → 1.29 — MCP-01–04
- [x] Add tool annotations (destructive, read-only behavior metadata) — MCP-05–07
- [x] Add tool output schemas (declared return types) — MCP-08–12
- [x] Implement proper error codes per MCP spec — MCP-13–15

**Tech Debt Resolution:**
- [x] Break up ProjectManagementService (god class → 27+ extracted services, PMS reduced to 365-line facade) — DEBT-01–07
- [x] Fix type assertions with proper interfaces — DEBT-08–13
- [x] Add missing test coverage (2,422 tests passing) — DEBT-14–20
- [x] Implement circuit breakers for AI services — DEBT-21–25
- [x] Add health check endpoint
- [x] Add request tracing/correlation IDs
- [x] Fix STATUS.md documentation drift — DEBT-26–28

**AI Feature Enhancement:**
- [x] Improve PRD generation quality — AI-01–05
- [x] Enhance task complexity analysis accuracy — AI-06–10
- [x] Add AI-powered sprint planning suggestions — AI-11–15
- [x] Add AI-powered roadmap generation from requirements — AI-16–18
- [x] Improve requirements traceability depth — AI-19–20

**Production Readiness:**
- [x] All tests passing (2,422 passing, 0 failures, 20 skipped) — PROD-01–04
- [x] Comprehensive documentation — PROD-05–08
- [x] npm package publication — PROD-09–10
- [x] Webhook reliability improvements — PROD-11–12

### Out of Scope

- Real-time collaboration features — focus on API/CLI usage, not live sync
- GitHub Insights/Charts API — appears UI-only, no programmatic API available
- Fine-grained PAT support — GitHub GraphQL requires classic PAT
- Multi-organization management — single org/user context per server instance
- Self-hosted GitHub Enterprise — focus on github.com initially

## Context

**Codebase State (August 2026):**
- 27+ TypeScript services, 16 compound tools (134 actions) exposed via MCP, 131 granular internal tools
- Test suite: 2,422 passing, 0 failures, 20 skipped
- Layered architecture with MCP server → Services → GitHub Repositories
- Uses Vercel AI SDK v5 for multi-provider AI access (Anthropic, OpenAI, Google, Perplexity)
- Codebase mapping available at `.planning/codebase/`

**Technical Environment:**
- Node.js >= 18.0.0
- TypeScript 5.8.3, ES2022 target
- MCP SDK @modelcontextprotocol/sdk 1.29
- Octokit @octokit/rest 22.0.0
- Zod v4 (4.x) for schema validation
- tsyringe for dependency injection

**Research Findings (January 2026):**
- MCP SDK current version is 1.29 (upgraded 2026-07-15)
- MCP spec 2025-11-25 adds Tasks primitive, Elicitation, Tool Output Schemas
- GitHub Projects REST API added September 2025
- Sub-issues now support 100 items, 8 nesting levels, cross-org
- Project Status Updates have GraphQL + webhook support

## Constraints

- **API Compatibility**: Must use classic PAT for GitHub GraphQL (fine-grained tokens don't work)
- **MCP Transport**: Primary transport is stdio (for Claude Desktop and similar clients)
- **AI Provider Keys**: At least one AI provider API key required for AI features

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| GraphQL-first for GitHub API | REST API incomplete, GraphQL has full feature coverage | ✓ Shipped (Octokit GraphQL/REST via GitHubRepositoryFactory) |
| Vercel AI SDK for AI abstraction | Multi-provider support, unified interface | ✓ Good — on v5 (upgraded 2026-07-15) |
| Zod for validation | Type-safe schemas, good DX, MCP SDK compatible | ✓ Good — on v4 (upgraded 2026-07-15; MCP SDK 1.29 accepts it) |
| tsyringe for DI | Lightweight, decorator-based, test-friendly | ✓ Shipped (container.ts wires the facade + extracted services) |
| In-memory cache default | Simple, works for single-instance | ✓ Good — persistence + size-bounded eviction added (G2-08); distributed cache still single-instance-only |
| Env-var secrets | Simple, 12-factor | ⚠️ Extended — file-mounted secrets (`SECRETS_DIR`) added (G6-05); Vault/AWS SM are an extension point |

## Document Chain (PRD → FRD → Delivery)

This PRD is the top of a traceable chain. Keep them in sync:

| Level | Document | Role |
|-------|----------|------|
| PRD | `PROJECT.md` (this file) | Product intent, core value, constraints, decisions |
| FRD | `REQUIREMENTS.md` | Functional requirements (GHAPI/MCP/DEBT/AI/PROD IDs) + phase traceability |
| Roadmap | `ROADMAP.md` | 12-phase delivery sequence, each mapped to FRD IDs |
| Status | `STATUS.md` | Phase completion (reconciled 2026-07-15) |
| Live remediation | `docs/remediation/GAP-TRACKER.md` + `PLAN.md` | Authoritative post-v1.1.0 gap + fix status |

Superseded: `docs/GAP-ANALYSIS-LIVE.md` (stale snapshot).

---
*Last updated: 2026-08-05 — all Active items verified complete; context updated*
