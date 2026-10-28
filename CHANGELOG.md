# Changelog

All notable changes to the MCP GitHub Project Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

No unreleased changes.

## [3.0.0] - 2026-10-28

### Breaking changes — read before upgrading from 2.x
- **The GitHub token needs `contents: write`** — the agent registry is now `registry.json` on an orphan `agent-registry` branch (sha compare-and-swap), so no branch ruleset may block that branch and the repository needs at least one commit. An existing "Agent Registry" issue is imported automatically on first use.
- **`get_activity` output** — `heartbeatHistory` is removed; the response carries `heartbeatSource` and `currentTask.progress` / `currentTask.branch`.
- **`manage_automation`** — the rule actions (`create_rule`, `update_rule`, `enable_rule`, `disable_rule`, `get_rule`, `list_rules`, `delete_rule`) and `ai_analyze`/`schedule_triaging` are gone: GitHub has no such API. Use `list_workflows`, `get_workflow` and `delete_workflow`.
- **Heartbeats fail loudly** — a heartbeat that could not be written is now an error instead of a success; the first heartbeat or checkout on an older project adds the new `agent_*` fields itself (the token needs project admin, or run `agent_manage setup_fields` once).
- **Field types and view layouts** — `create_field` accepts only the types GitHub can create (text, number, date, single_select, multi_select, iteration) and views only board, table and roadmap.
- **Node.js 22.12 or newer** is required.

### Added
- **Project roles and views as claiming pools** — the platform could neither read nor set who may see a board, and it scanned the whole board client-side on every claim. `manage_project`/`set_collaborators` now sets the role of a user or a team on a project through GitHub's native `updateProjectV2Collaborators` mutation, with the four roles of its `ProjectV2Roles` enum (`ADMIN`, `WRITER`, `READER`, `NONE`), and `manage_project`/`list_views` now answers with the configuration GitHub stores for a view: the server-side `filter` it selects its items with, the fields it groups and sorts by, and the fields it shows. A named view is therefore a pool the server selects from, instead of a filter the platform re-implements on every claim. GitHub has no read path for collaborator roles — `ProjectV2` has no `collaborators` field — so the roles that come back are the ones the call granted, and a role it did not touch is reported as unknown rather than guessed.
- **Native issue dependencies, issue types and reverse membership** — the platform emulated "issue A is blocked by issue B" with a `blocked-by:#N` label plus body parsing, the issue kind with a `type:` label, and never asked which boards a task was on. GitHub has all three: `Issue.blockedBy` / `Issue.blocking` edges (written with `addBlockedBy` / `removeBlockedBy`), `Issue.issueType` (written with `updateIssueIssueType`, with the organization's type catalogue) and `Issue.projectItems(includeArchived: true)`. They are reachable through `manage_issues/list_dependencies`, `add_blocker`, `remove_blocker` and `list_issue_types`; the label emulation is still honoured, so a board wired up before the native edge keeps working. In the claim path the native edge decides whether a task is blocked, and a task that is already claimed on **another** board is no longer handed out a second time.
- **Product-level coverage of the agent lifecycle** — the live-API suite now drives the whole loop the platform promises: register → checkout → context → heartbeat → work product → submit for review → a reviewer claims it from the review queue → approve, plus the rejection path, crash recovery through stale reclaim, the budget hard stop, the PM flow (`assign_task`, `smart_assign`, `get_swarm_status`, `rebalance_workload`, `converge_project` with and without a reviewer, `converge_until_done`), native blockers with `skipBlocked`, view-scoped checkout pools, two agents racing for one task, and work-product validation. Each scenario asserts the resulting state in GitHub (issue status, project field values, registry records, comments), not just the tool's answer. The suite reads that state back through new helpers on the existing MCP test client; one full run costs about 4,500 GraphQL points.
- **Storage-seam unit suites** — a shared fake GitHub (`src/__tests__/helpers/FakeGitHub.ts`) models refs, commits and file contents with sha compare-and-swap (409 on a stale sha, 422 on an existing ref) and can hold writes back and release them one at a time, which makes registry races deterministic: the exact lost-update interleaving, many concurrent writers, two writers of the same agent, the bootstrap race, contention exhaustion and the one-time legacy migration. The work-product store's pagination and payload validation are pinned as well.
- **Roadmaps can now be persisted into an existing project** — the `ai_plan` / `generate_roadmap` action accepts `projectId` (plus optional `projectTitle`, `projectDescription`, `sprintDurationWeeks`, `targetMilestones`) and plans from the issues already in that project. With `autoCreate: true` the milestones are created and assigned to those issues. Previously the compound surface could only *propose* a roadmap; the persisting path was unreachable and ignored its `projectId`.
- **`MCP_TOOL_GROUPS` is documented correctly** — the variable filters by group name (`core`, `ai`, `agents`, `events`, `system`), not by tool name. The old `.env.example` comment listed tool names, which would have exposed nothing.
- **Multi-select project fields** — `multi_select` is one of the field types GitHub can create, so it is now offered: the field is created with its options (`multiSelectOptions`), a later update keeps the options that already exist (an option sent with its id keeps its identity, and the item values pointing at it), and a value can be set on an item (`multiSelectOptionIds`) and read back.
- **Tiered live E2E** — `pnpm run test:e2e:smoke` runs the product spine (register → checkout → heartbeat → submit → reviewer checkout from the review queue → approve → issue closed and claim cleared → deregister) in about 80 s for about 200–250 GraphQL points; `pnpm run test:e2e:full` runs every scenario for about 4,500 of the 5,000 points per hour. `E2E_TIER=smoke|full` selects the tier and the e2e runner accepts `--tier`.

### Changed
- **Heartbeats live on the claimed project item, not in the registry** — every heartbeat used to be a commit on the `agent-registry` branch. A heartbeat now writes `agent_heartbeat_at` (ISO text), `agent_progress` and `agent_work_branch` on the task's project item, and the registry is written only when the agent's status or task changes, or when an idle agent's last beat is older than the 30-minute stale threshold. Reclaim, metrics and swarm status take the newer of the item beat and the registry beat. A project created before this change needs no manual step: the first `checkout_task` or heartbeat per server process creates any missing `agent_*` field additively (concurrent first calls share one provisioning; a field of the wrong type is a hard error; a token that cannot create fields gets a message to run `agent_manage setup_fields` with a project-admin token). **Breaking:** `get_activity` no longer returns `heartbeatHistory`; it returns `heartbeatSource` (`project_item` or `registry`) and `currentTask.progress` / `currentTask.branch`. `progressSummary`, `estimatedCompletionMinutes` and `blockerDescription` travel only on the heartbeat event. The heartbeat tool now fails loudly instead of reporting success when the write did not happen.
- **A failed token debit can no longer bypass a hard stop** — the per-call debit after a tool ran was best-effort and only logged a warning. It is now retried once; if it still fails, the tool result carries `_meta.budgetDebitFailed`, the failure is logged as an error, and the debit is parked in an in-memory ledger that the agent's next `checkout_task` settles first — the checkout is refused while it cannot be settled.
- **Lint and typecheck are hard gates** — `pnpm run lint` runs `biome check --error-on-warnings`, and `noExplicitAny` / `noNonNullAssertion` are errors. The 814 warnings that had accumulated were fixed with real types (no suppressions, no `as any`), which surfaced the defects listed under Fixed.

### Fixed
- **A registered agent could vanish from the registry** — the registry was a JSON array in an issue body, rewritten on every register, checkout, heartbeat, review, reclaim, budget change and metered tool call. GitHub issue writes have no compare-and-swap, so a write-then-verify loop could not see a writer that landed after its check: agent A registered, got success, and was dropped when a writer holding an older copy landed. With two server processes registering ten agents each, five of seven reported registrations were missing afterwards. The registry is now `registry.json` on an orphan `agent-registry` branch, written through the Contents API with the sha that was read: a stale write is rejected with 409, the mutation is re-applied to the fresh list and retried with jittered backoff, and sustained contention raises an error instead of warning and continuing. The same two-process run now keeps 20 of 20. On first use an existing "Agent Registry" issue — including the duplicate registries an intermittently empty REST `labels` filter used to create — is imported once (the record written last wins; a corrupt canonical body fails closed) and rewritten to a pointer. The token now needs `contents: write`, no branch ruleset may block `agent-registry`, and the repository needs at least one commit.
- **The tool schemas advertised field types and view layouts GitHub does not have** — `create_field` offered `milestone`, `assignees` and `labels`, and `create_view`/`update_view` offered a `timeline` layout. GitHub's `ProjectV2CustomFieldType` knows only TEXT, NUMBER, DATE, SINGLE_SELECT, MULTI_SELECT and ITERATION, and `ProjectV2ViewLayout` only BOARD, TABLE and ROADMAP, so every such call ended in a GraphQL schema error. The public schemas now advertise exactly the creatable types and the three layouts, and a value that bypassed the schema (a stored or hand-built argument) is refused with a message that names the supported set instead of being silently turned into a text field.
- **The review queue was unreachable** — `submit_for_review` left `agent_claimed_by` set, and the review queue only hands out unclaimed items, so a reviewer could never pick up submitted work and the approve/reject path was dead. Submitting now clears the claim and moves the item to `agent_status=review`; approving or rejecting releases every agent that still holds the task (the submitter and the reviewer).
- **Claims could land in the wrong project** — claim, status and candidate selection used the issue's *first* project item, so an issue in several projects could be claimed or updated in the wrong one. The item matching the requested project is now used everywhere, and a PM assignment for an issue that is not in the requested project is refused instead of claimed.
- **A corrupted agent registry was reported as "no agents"** — a malformed registry silently looked like an empty one, so the platform forgot every agent. Malformed JSON and invalid agent records now fail loudly, naming where the registry lives.
- **Work products were read partially and unvalidated** — only the first 100 comments of an issue were read and each payload was cast without checking, so malformed work products were returned as valid. Comments are now read across pages and every payload is validated against the work-product schema.
- **Project field inspection failures were swallowed** — a failed field query looked like "this project has no fields", so duplicate or wrongly-typed fields were created, and a field with the wrong type was accepted. Inspection failures now propagate, an incompatible field type is a hard error with an actionable message, and a single-select field that is missing a status option gets the missing option *added* (a project created by an older version keeps working; options are never deleted).
- **The compound agent tools accepted under-specified calls** — every argument of `agent_work`/`agent_manage` was optional, so clients discovered nothing and got runtime errors instead of a protocol validation error. The schemas are action-discriminated now, and the advertised schema keeps a flat top-level property list (so clients that only read `properties` still see every argument) plus a `oneOf` variant per action that carries its required arguments.
- **`set_budget` ignored the documented argument** — the schema and the docs said `warningThreshold`, the executor read `warningFraction`, so the warning threshold was silently dropped. `warningThreshold` is now accepted as an alias.
- **`rebalance_workload` did not rebalance** — it only reclaimed stale work although the documentation promised redistribution. It now reclaims stale tasks and hands the freed work to eligible idle agents through the same capability- and budget-aware assignment path `smart_assign` uses.
- **`converge_project` bypassed the lifecycle** — it closed issues and left a comment, but the claim, the project status field and the owning agent's registry record stayed stale. With a `reviewerId` the task is settled through the normal approve/reject path; otherwise the owner is released and the project state is cleared before the fallback comment and close.
- **Blocker references were partially ignored** — `Blocked by #1, #2` only blocked on `#1`. Every reference of every supported phrase is now checked.
- **`release_task` hid a failed release** — a failed claim clear was swallowed, so the task looked released while it was still claimed. The failure is now reported and the registry claim is kept.
- **The reference agent loop was fiction** — `examples/basic/agent-loop.ts` replayed a static plan with placeholder ids (`agent-<id-from-register>`, `issueNumber: 42`) and swallowed every step failure, so it never worked and always exited 0. It is now a runnable worker + reviewer cycle over `@modelcontextprotocol/client` stdio against `node build/index.js`: every id is threaded from the previous response, a tool error, `success:false` or missing id exits non-zero, an unknown project fails at preflight, an empty queue is a clean exit, and the agents it registered are deregistered in a `finally` block. `--project` is required; `--create-demo-task`, `--reject` and `--plan` (symbolic references, no credentials) are available.
- **`ResourceCache.set()` left stale index rows** — re-setting a key with different tags or namespaces kept the old tag and namespace index entries, so `getByTag` / `getByNamespace` returned a resource that no longer carried them. The replaced entry is now removed from every index first, and the real cache has direct coverage for the capacity cap, oldest-first eviction, TTL expiry and index consistency.
- **`manage_issues/remove_blocker` returned an empty, protocol-invalid result** — the edge was removed but the MCP result carried no content block, so clients rejected the call. It now returns `{success, issueId, blockingIssueId, message}`.
- **`agent_work/validate_work_product` dropped `workProduct.agentId`** — the validated work product now reports the agent that submitted it.
- **Two writes to the same agent could revert each other** — every registry writer read the agent, changed a copy and wrote the whole copy back; on a compare-and-swap retry that stale copy was written again, so a heartbeat racing a token debit (or `set_budget`, or reclaim) silently undid the other write, and debits vanished. `upsertAgent` is replaced by `createAgent` (fails if the id exists) and `updateAgent(id, mutator)`, whose mutator runs on the freshly read record on every attempt; counters are applied as deltas. Live: 20 heartbeats and 20 `record_usage` calls fired concurrently from two server processes end with exactly the summed usage.
- **The typecheck gate never checked a test file** — `tsconfig.test.json` inherited `exclude: ["**/*.test.ts"]` from `tsconfig.json`, so `pnpm run typecheck` skipped every test. About 200 type errors had accumulated behind it (stale fixtures, mocks typed against APIs that had changed, a `ConfidenceScorer` config key the scorer never read); all are fixed and the gate now covers `src/**`, `src/__tests__/**` and `tests/**`.
- **Generated code examples were thrown away** — `TaskContextGenerationService` generated code examples and merged them into a field the guidance object never has. They now land in `contextualReferences.codeExamples`, merged with the references generator's and de-duplicated.
- **Roadmap generation saw every issue as "Untitled"** — it read `title` and `type` from project items that did not carry them. Items now carry the title the query already fetched, and the type comes from `contentType`.
- **`pnpm run docs:api` emitted an empty, wrong OpenAPI document** — it walked zod 3 internals (every schema degraded to an empty object under zod 4), listed 134 internal granular tools instead of the 20 public ones, and could not run without GitHub credentials. It now uses the same definitions the server advertises (`compound/compound-tool-definitions.ts`), emits OpenAPI 3.1 with the hybrid agent schemas, and runs with no configuration.
- **Latent crashes in response mapping now fail with a clear error** — a missing iteration field id, a non-string GitHub error payload (`isRateLimitError` called `.includes` on it) and a traceability task without `implementsFeatures`.
- **`setup_agent_fields` failed on every real project** — the field query selected GraphQL types that do not exist (`ProjectV2DateField`, `ProjectV2TrackerField`, …), so GitHub rejected it, the code treated the project as having no fields and tried to create them again. A single-select field id (`PVTSSF_…`) was also passed to `field(name:)` as if it were a name. The union's four members are now selected everywhere, through one shared fragment set, and any field node id is resolved to a name first.
- **Creating a sprint failed against the real GitHub API** — GitHub keeps one iteration per start date and drops an iteration that overlaps an existing one or starts in the past; the mutation succeeds, the response simply does not contain the new iteration, and the call failed with `Iteration "…" was not found after creation`. A new sprint now starts when the last one ends (and never in the past), existing iterations are re-sent with their ids, and the duration is rounded instead of ceiled (a 14-day sprint no longer becomes 15 days). Found by running the live-API E2E suite, which had never run before.
- **9 compound AI actions crashed on a missing argument** — `ai_analyze`/`suggest_labels`, `detect_duplicates`, `find_related` and `ai_plan`/`calculate_capacity`, `prioritize_backlog`, `assess_risk`, `suggest_composition`, `generate_roadmap`, `generate_visualization` dereferenced an argument the compound schema never required, and died with `TypeError: Cannot read properties of undefined (reading 'map')`. They now fail with a message that names the parameter (`teamMembers is required for calculate_capacity`).
- **The compound schema and the implementation disagreed on field names** — `ai_plan`/`calculate_capacity` advertised `teamMembers[].availabilityPercent` while the analyzer wanted an `availability` fraction (so availability was silently dropped), and `historicalSprints[].name` where the analyzer wanted `sprintName`. `ai_analyze`/`find_related` advertised `relationConfig` while the executor read `config`, so relation settings were ignored. Both are mapped now.
- **`createRoadmapInGitHub` honored its `projectId`** — milestones are now assigned to the project's own issues (the plan references project items, the milestone is set on the issue), instead of being created on the repository and attached to nothing.
- **`createRoadmapInGitHub` reports failures** — per-item errors were logged and swallowed; they are now returned in a `failures` array, and `updatedIssues` counts the issues that were really updated instead of being hardcoded to `0`.
- **`.env.example` / `.npmignore` / `.gitignore` / `.dockerignore` match the repo** — stale Jest, ESLint and Prettier entries removed, test sources kept out of the Docker build context, `MCP_TOOL_GROUPS` corrected.

### Removed
- **The automation rules were a fiction** — `manage_automation` offered `create_rule`, `update_rule`, `enable_rule`, `disable_rule`, `get_rule`, `list_rules` and `delete_rule` over a `ProjectV2Rule` model, and `ai_analyze` offered `schedule_triaging`. GitHub's Projects API has no such types and no such mutations: live introspection shows a `ProjectV2Workflow` type (id, name, number, enabled, project) with exactly one mutation, `deleteProjectV2Workflow`, and no `createProjectV2Workflow` at all — so every rule call failed with a GraphQL error ("Field 'createProjectV2Rule' doesn't exist on type 'Mutation'"). `manage_automation` now speaks the API that exists — `list_workflows`, `get_workflow`, `delete_workflow` over `ProjectV2Workflow` — and the rule model, the rule repository and `ai_analyze/schedule_triaging` are gone (there is no way to schedule a job through the Projects API). The published surface drops from 169 to 164 actions; the action names changed, so this is a breaking change for clients that called the rule actions.
- **82 unreachable granular executor registrations** — `dispatchTool` resolves an executor by the name the MCP client called, and a client can only call one of the 20 compound tools, so an executor registered under a granular name could never run. `src/index.ts` shrank from 1313 to 740 lines; a test now pins the invariant (every registered executor is a public tool, every public tool has an executor).
- **The test-only `issueIntelligenceExecutors` / `roadmapAIExecutors` maps** — dead in production, kept alive only by tautological tests.
- **Stale artifacts** — `bun.lock` (bun is not a supported package manager), `jest.resolver.cjs` (the runner is Vitest), `src/__tests__/test-utils.ts.new`.

### Documentation
- **README rewritten** — shorter, hook-first, with the depth moved into `docs/` (progressive disclosure).
- **`docs/` and `.planning/codebase/` refreshed** — the stack moved to Vitest 5, Biome 2.5, TypeScript 7, MCP SDK v2 and npm+pnpm; the old snapshots still described Jest, ESLint and Prettier.

## [2.1.0] - 2026-08-10

### Added
- **Per-role AI provider configuration** — each model role (main, research, fallback, prd) independently configurable with provider, API key, model, and base URL. `openai-compatible` provider type works with OpenRouter, Together, Groq, Ollama, LM Studio, Azure OpenAI, or any OpenAI-protocol endpoint. No hardcoded vendor defaults.
- **MCP sampling as zero-config AI fallback** — when no AI keys configured and client supports sampling, the server routes completions back to the calling agent (Claude, Codex, Pi). The client IS the model.
- **`validate_work_product`** (agent_work action) — reviewer inspects work product against acceptance criteria: checks test results, files changed, summary quality. Returns findings + recommendation (approve/reject/needs_work). Replaces rubber-stamp approval.
- **`decompose_task`** (agent_manage action) — PM splits a rejected task into subtasks linked as GitHub sub-issues. Enables the reject→decompose→re-assign failure recovery loop.
- **`smart_assign`** (agent_manage action) — capability-matched, budget-aware task routing. Scores agents by capability overlap with issue labels/title, role bonuses, skips stale/exhausted agents. Optional `agentIds[]` and `roleFilter` params.
- **`converge_project`** (agent_manage action) — PM drives project toward completion: iterates open issues, auto-approves passing work, auto-rejects failing, auto-decomposes fix subtasks. Project-scoped (only touches issues in the target project).
- **`converge_until_done`** (agent_manage action) — multi-iteration convergence: reports progress + next actions per iteration, returns done when all issues closed or max iterations reached.
- **`get_handoff_context`** (agent_work action) — cross-agent context for subtasks: parent issue, prior work product, rejection feedback, acceptance criteria.
- **`cleanup_registry`** (agent_manage action) — removes stale agents (no heartbeat in N minutes). Working agents never removed.
- **Human-readable work product comments** — issue comments now include agent, branch, PR, files changed list, test results table, and summary above the machine-readable JSON.

### Fixed
- **`smart_assign` stale agent scoring** — skips agents with no heartbeat in 60min, requires capability match score > 0.
- **`converge_project` scoping** — queries project items via GraphQL `node(id:)` instead of `listForRepo`, preventing unrelated issues from being closed.
- **Sprint create requires `projectId`** — fails fast with clear error instead of guessing via `projectsV2(first:1)` which targeted the wrong project.
- **AI error messages** — when provider key exists but no model configured, error now says "set AI_MAIN_MODEL" instead of misleading "set API key".

## [2.0.0] - 2026-08-09

### Added
- **PRD-to-Issues pipeline (`materialize_tasks`)** — converts AI-generated tasks into real GitHub project hierarchies:
  - Creates milestones, sprints (GitHub Projects V2 iterations), and issues per phase
  - Bottom-up dependency sequencing via `DependencyGraph.analyze()` — tasks with no dependencies execute first
  - Issues automatically added to project and assigned to their phase's sprint
  - Label prefixing for traceability (`ai-generated`, `phase:N`, `priority:*`)
  - Acceptance criteria and dependency context embedded in issue bodies
- **PM coordination actions** — three new `agent_manage` actions for project-manager-role orchestration:
  - `assign_task` — PM explicitly assigns a specific issue (by number) to a specific agent, bypassing self-service checkout
  - `get_swarm_status` — dashboard of all agents with tasks, heartbeats, budgets, blocked/stale detection
  - `rebalance_workload` — redistributes tasks across idle agents when workload is uneven
- **Full pipeline E2E test** — 10-stage test covering PRD generation → task parsing → materialize → agent registration → PM assign_task → heartbeat + submit_work_product → submit_for_review + approve_task → get_swarm_status → summary assertions
- **Pipeline npm scripts** — `test:pipeline`, `test:pipeline:openai`, `test:pipeline:google`

### Fixed
- **Sprint-issue assignment (`addIssuesToSprint`)** — three bugs fixed:
  - `itemId` was garbage string `Issue_${id}` — now resolves to `PVTI_...` (ProjectV2Item node ID) via `resolveProjectItemIds`
  - `fieldId` passed iteration instance ID — now uses iteration FIELD ID (`PVTIF_...`) from `ensureIterationField`
  - `value` was string `"ITERATION"` — now `{ iterationId: instanceId }`
- **`ensureIterationField` project targeting** — now accepts `targetProjectId` and queries that specific project via `node(id:)`, instead of always getting the oldest project via `projectsV2(first:1)`
- **`projectId` threading** — `materialize_tasks` → `PMS.createSprint` → `SprintPlanningService` → `SprintRepo.create` → `ensureIterationField(projectId)` now correctly targets the operating project
- **Sprint create on GitHub Projects V2** — wired to real iteration field API (`updateProjectV2Field` with `iterationConfiguration`), replacing the fabricated no-op
- **`findAll` ordering** — issues, milestones return newest first (matching GitHub default), fixing the "created is NOT in the first 100" bug
- **`findById` dual format** — accepts both numeric IDs and GraphQL node IDs (`I_kwDO...`)

## [Unreleased]

### Added
- **Agentic capability waves (G9)** — five waves hardening the agent orchestration layer for any agentic harness:
  - **Real checkout strategies** — `highest_priority` (P0-P3 / `priority:*` labels), `oldest_first`, `skills_match`, `milestone_deadline` (milestone dueOn) now actually implemented; results include a `selectionRationale`
  - **Atomic claims** — TOCTOU guard re-verifies the claim is free immediately before writing; `AgentStore` registry writes use read-modify-write with verify-and-merge retry so concurrent heartbeats/registrations never drop agents
  - **Dependency-aware checkout** — `skipBlocked: true` skips tasks whose blockers (`Blocked by #N`, `Depends on #N`, `blocked` label) are still open
  - **`agent_manage/reclaim_stale`** — returns tasks from stale-heartbeat agents to the pool
  - **`agent_manage/record_usage`** — agents report token spend; budget hard stops now trigger
  - **Review workflow** — `submit_for_review` (task → review queue), reviewer `checkout_task { reviewQueue: true }`, `approve_task`, `reject_task` (pool + feedback); first-class `reviewer` role
  - **AI checkout strategy (`ai`)** — LLM-ranked task selection with graceful deterministic fallback
  - **AI-augmented task context** — `get_task_context` includes best-effort AI acceptance criteria, complexity estimate, implementation guidance, confidence
  - **Heartbeat history** — bounded (50) most-recent-first log surfaced in `get_activity`
  - **`agent_manage/get_metrics`** — aggregate + per-agent throughput, cycle time, budget burn, staleness
  - **Checkout pagination** — open-issues scan walks cursors (up to 5 pages)
  - **Harness DX** — `docs/agent-harness-integration.md` + `examples/basic/agent-loop.ts` reference loop
  - **46 new unit tests** for the agent orchestration layer (AgentStore, TaskCheckoutService, AgentBudgetService, WorkProductService, ProjectFieldSetup, AgentMetricsService)
- **Auto-reclaim scheduler (self-healing)** — the server now runs a background sweep (every `AGENT_RECLAIM_INTERVAL_MS`, default 5 min) that reclaims tasks from agents whose heartbeat exceeds `AGENT_STALE_AFTER_MINUTES` (default 30), marks them `offline`, and posts an `## Agent Task Auto-Reclaimed` audit comment on each issue. A crashed harness no longer blocks a task forever; disable with `AGENT_RECLAIM_ENABLED=false`. New `AgentReclaimScheduler` service wired through the DI container and started/stopped with the server lifecycle; 10 new unit tests.
- **`setup_agent_fields` tool** — idempotently provisions the agent orchestration project fields (`agent_claimed_by`, `agent_claimed_at`, `agent_status`, `agent_work_branch`, `agent_pr_number`); exposed as a granular tool and as `agent_manage/setup_fields` (already available via `manage_project/setup_agent_fields` and `system/setup_project_fields`).
- **Agent orchestration E2E suite (real GitHub)** — `src/__tests__/e2e/tools/agent-orchestration.e2e.ts` exercises the full lifecycle through the MCP interface (tool presence, field setup, register → checkout → context → heartbeat → work product → review → approve, double-claim rejection, budgets, crash-recovery reclaim, metrics) with graceful skip when credentials are absent. Run with `npm run test:e2e:tools:real:agent` or `node scripts/run-e2e-tests.js --agent-only --real-api`.
- **Compound Tool API** — 131 granular tools consolidated into 16 compound tools with action-based routing
  - Progressive disclosure: AI agents see 16 tools instead of 131, reducing tool-selection overhead
  - `discover_tools` meta-tool for runtime exploration of available actions and parameter schemas
  - `MCP_TOOL_GROUPS` env var for capability profiles — control which tool groups are exposed
  - `CompoundExecutor` routes actions to existing internal granular executors (unchanged)
  - Compound tools: `manage_project` (37 actions), `manage_issues` (18), `manage_prs` (7), `manage_milestones` (7), `manage_sprints` (8), `manage_labels` (2), `manage_automation` (7), `manage_iterations` (5), `manage_events` (3), `manage_status_updates` (3), `ai_generate` (8), `ai_analyze` (8), `ai_plan` (6), `agent_work` (7), `agent_manage` (6), `system` (2)
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
- **Tool API migrated from 131 granular tools to 16 compound tools** (134 actions) — breaking change for MCP clients referencing individual tool names
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
