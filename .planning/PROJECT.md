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
- [ ] Sub-issues management (add, list, reprioritize, parent lookup)
- [ ] Project status updates (createProjectV2StatusUpdate)
- [ ] Project templates (mark as template, copy from template)
- [ ] Repository/team linking (link/unlink to repos and teams)
- [ ] Project close/reopen operations
- [ ] Convert draft issue to real issue
- [ ] Item position/reordering within project
- [ ] REST API alternatives where available
- [ ] Advanced search with AND/OR keywords

**MCP Protocol Upgrade:**
- [ ] Upgrade SDK 1.12.0 → 1.25.2
- [ ] Add tool annotations (destructive, read-only behavior metadata)
- [ ] Add tool output schemas (declared return types)
- [ ] Implement proper error codes per MCP spec

**Tech Debt Resolution:**
- [ ] Break up ProjectManagementService (3,291 lines god class)
- [ ] Fix 30+ `as any` type assertions with proper interfaces
- [ ] Add missing test coverage (80 source files vs 29 test files)
- [ ] Implement circuit breakers for AI services
- [ ] Add health check endpoint
- [ ] Add request tracing/correlation IDs
- [ ] Fix STATUS.md documentation drift

**AI Feature Enhancement:**
- [ ] Improve PRD generation quality
- [ ] Enhance task complexity analysis accuracy
- [ ] Add AI-powered sprint planning suggestions
- [ ] Add AI-powered roadmap generation from requirements
- [ ] Improve requirements traceability depth

**Production Readiness:**
- [ ] All tests passing (0 failures, 0 skipped)
- [ ] Comprehensive documentation
- [ ] npm package publication
- [ ] Webhook reliability improvements

### Out of Scope

- Real-time collaboration features — focus on API/CLI usage, not live sync
- GitHub Insights/Charts API — appears UI-only, no programmatic API available
- Fine-grained PAT support — GitHub GraphQL requires classic PAT
- Multi-organization management — single org/user context per server instance
- Self-hosted GitHub Enterprise — focus on github.com initially

## Context

**Codebase State (January 2026):**
- 80 TypeScript source files, ~71 MCP tools registered
- Test suite: 192 passing, 74 failing, 20 skipped
- Layered architecture with MCP server → Services → GitHub Repositories
- Uses Vercel AI SDK for multi-provider AI access (Anthropic, OpenAI, Google, Perplexity)
- Codebase mapping available at `.planning/codebase/`

**Technical Environment:**
- Node.js >= 18.0.0
- TypeScript 5.8.3, ES2022 target
- MCP SDK @modelcontextprotocol/sdk 1.12.0 (outdated)
- Octokit @octokit/rest 22.0.0
- Zod 3.25.32 for schema validation
- tsyringe for dependency injection

**Research Findings (January 2026):**
- MCP SDK current version is 1.25.2 (13 minor versions ahead)
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
| GraphQL-first for GitHub API | REST API incomplete, GraphQL has full feature coverage | — Pending |
| Vercel AI SDK for AI abstraction | Multi-provider support, unified interface | ✓ Good |
| Zod for validation | Type-safe schemas, good DX, MCP SDK compatible | ✓ Good |
| tsyringe for DI | Lightweight, decorator-based, test-friendly | — Pending |
| In-memory cache default | Simple, works for single-instance | ⚠️ Revisit (needs persistence option) |

---
*Last updated: 2026-01-30 after initialization*
