# Changelog

All notable changes to the MCP GitHub Project Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Compound Tool API** — 131 granular tools consolidated into 16 compound tools with action-based routing
  - Progressive disclosure: AI agents see 16 tools instead of 131, reducing tool-selection overhead
  - `discover_tools` meta-tool for runtime exploration of available actions and parameter schemas
  - `MCP_TOOL_GROUPS` env var for capability profiles — control which tool groups are exposed
  - `CompoundExecutor` routes actions to existing internal granular executors (unchanged)
  - Compound tools: `manage_project` (22 actions), `manage_issues` (14), `manage_prs` (7), `manage_milestones` (6), `manage_sprints` (8), `manage_labels` (2), `manage_automation` (7), `manage_iterations` (5), `manage_events` (3), `manage_status_updates` (3), `ai_generate` (8), `ai_analyze` (6), `ai_plan` (6), `agent_work` (7), `agent_manage` (5), `system` (2)
- **Agent Orchestration Layer** — 13 agent operations across 2 compound tools (`agent_work`, `agent_manage`)
  - Agent registry: register, list, deregister with subagent hierarchy (`parentAgentId`, cascade delete)
  - Task lifecycle: checkout_task (4 strategies: priority, age, skills, deadline), release_task, complete_task
  - Task context: get_task_context (enriched context with issue, milestone, related issues, acceptance criteria)
  - Heartbeat monitoring with stale-agent detection (30 min timeout)
  - Work products: submit_work_product with branch, PR, commits, files, test results
  - Budget enforcement: get_budget, set_budget with warning thresholds and hard stops
  - Activity dashboard with per-agent task, progress, heartbeat, and budget status
  - Work status: check_work_status for PR review/merge tracking
- Domain types in `src/domain/agent-orchestration-types.ts` (Agent, TaskCheckoutResult, AgentHeartbeat, WorkProduct, AgentBudget, BudgetStatus, AgentTaskContext, AgentActivityEntry)
- Infrastructure stores: `AgentStore` (issue-backed registry), `WorkProductStore` (structured comments), `ProjectFieldSetup` (custom field provisioning)
- Services: `TaskCheckoutService`, `AgentContextService`, `WorkProductService`, `AgentBudgetService`
- Tool schemas in `src/infrastructure/tools/schemas/`
- GitHub-native data model: 5 custom project fields (`agent_claimed_by`, `agent_claimed_at`, `agent_status`, `agent_work_branch`, `agent_pr_number`)

### Changed
- **Tool API migrated from 131 granular tools to 16 compound tools** (131 actions) — breaking change for MCP clients referencing individual tool names
- Granular tools retained internally as dispatch targets but no longer exposed to MCP clients
- Updated all documentation (README, architecture, TOOLS.md, CONFIGURATION.md) to reflect compound tool API

## [1.0.2] - 2026-02-01

### Added
- AI-powered sprint planning with capacity analysis (AI-09 to AI-12)
- AI-powered roadmap generation with phase sequencing (AI-13 to AI-16)
- AI issue intelligence: enrichment, labels, duplicates, related issues (AI-17 to AI-20)
- PRD confidence scoring and section-level quality metrics (AI-01 to AI-04)
- Task dependency detection and effort estimation (AI-05 to AI-08)
- Sub-issue management tools (GHAPI-01 to GHAPI-05)
- Project status update tools (GHAPI-06 to GHAPI-08)
- Project template and linking tools (GHAPI-09 to GHAPI-18)
- Project lifecycle and advanced operations (GHAPI-19 to GHAPI-24)
- Circuit breaker pattern for AI service resilience (DEBT-21)
- Health check endpoint for service monitoring (DEBT-22)
- Request tracing with correlation IDs (DEBT-23)
- Cache persistence for improved performance (DEBT-24)
- Graceful degradation when AI unavailable (DEBT-25)
- Comprehensive tool documentation (119 tools across 17 categories)
- Configuration guide and troubleshooting documentation
- Publication scripts and workflows for npm

### Changed
- Upgraded MCP SDK from 1.12.0 to 1.25.3 (MCP-01 to MCP-15)
- Decomposed ProjectManagementService into 6 focused services (DEBT-01 to DEBT-07)
- All tools now have behavior annotations and output schemas
- Improved type safety throughout codebase (DEBT-08 to DEBT-13)
- Enhanced error handling with MCP-compliant error codes
- Updated package.json for npm publication
  - Added proper author information
  - Fixed repository, homepage, and bugs URLs
  - Added files field to control package contents
  - Added publishConfig for public access
  - Added funding information

### Fixed
- Test suite stabilization with proper credential guards (DEBT-14 to DEBT-20)
- Type assertion issues replaced with proper type guards
- E2E test reliability improvements (PROD-01 to PROD-03)
- Fixed E2E tool discovery to use MCP SDK properly

## [0.1.0] - 2025-05-21

### Added
- Initial implementation of MCP server for GitHub Projects
- Stdio transport support
- Core tools:
  - create_project
  - get_project
  - create_milestone
  - plan_sprint
  - get_milestone_metrics
  - create_roadmap
- Basic project structure with Clean Architecture
- GitHub API integration via Octokit
- Tools validated with Zod schemas
- Test suite with Jest
- Basic documentation

### Changed
- None (initial release)

### Fixed
- None (initial release)
