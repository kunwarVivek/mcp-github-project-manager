# Agentic Harness Integration

This guide explains how to drive the **agent orchestration layer** from any
agentic harness — Claude Code, Codex, Cursor, or a custom agent loop — with
**GitHub Projects as the task substrate**.

## Mental model

```
┌─────────────────────────────────────────────────────────────────────┐
│  Agentic Harnesses (Codex · Claude Code · Cursor · custom loops)    │
│  ── any client that speaks MCP                                      │
├─────────────────────────────────────────────────────────────────────┤
│  THIS MCP SERVER  = the operating layer                             │
│  · task discovery + claiming  · state transitions  · work intake    │
│  · budget enforcement        · liveness (heartbeats)  · subagents   │
│  · review workflow           · dependency awareness  · metrics      │
│  · PM coordination (assign, swarm status, rebalance)                │
├─────────────────────────────────────────────────────────────────────┤
│  GitHub = the task substrate (source of truth, human-visible)       │
│  · issues = tasks   · project v2 custom fields = claim state        │
│  · pinned issue = agent registry   · comments = work products       │
└─────────────────────────────────────────────────────────────────────┘
```

Everything the server writes round-trips through GitHub artifacts, so humans,
agents, and the GitHub UI always see identical state. No external database is
required.

## The agent loop

A worker agent cycles through these steps (see
[`examples/basic/agent-loop.ts`](../examples/basic/agent-loop.ts) for a runnable
reference):

1. **`agent_work/register`** — join the registry (name, role, runtime, capabilities).
2. **`agent_work/checkout_task`** — claim the next task using a strategy:
   - `highest_priority` — priority labels (`P0`–`P3` or `priority:critical|high|medium|low`) then skill match
   - `oldest_first` — longest-created first
   - `skills_match` — best capability/label match
   - `milestone_deadline` — soonest milestone `dueOn` first
   - `ai` — LLM-ranked selection (falls back to deterministic ranking when AI is unavailable)
   - `reviewQueue: true` — for reviewer agents; claims from the review queue instead
   - `skipBlocked: true` — skips tasks whose declared blockers (`Blocked by #N`, `Depends on #N`, `blocked` label) are still open
3. **`agent_work/get_task_context`** — pull enriched context (issue, parent, milestone, related issues, coding standards from `CLAUDE.md`/`AGENTS.md`, acceptance criteria, and — when AI is configured — suggested criteria, complexity estimate, and implementation guidance).
4. **`agent_work/heartbeat`** — report liveness/progress. History is retained (last 50, most recent first) and surfaced in `get_activity`.
5. **`agent_work/submit_for_review`** — move the task into the review queue.
6. **Reviewer agents** claim from the queue with `checkout_task { reviewQueue: true }` and either **`approve_task`** (completes + closes) or **`reject_task`** (returns to the pool with feedback recorded on the issue).
7. **`agent_manage/record_usage`** — report token spend so budgets stay accurate and hard stops trigger.
8. **`agent_manage/get_metrics`** — observe swarm health (throughput, cycle time, budget burn, staleness).


## PM coordination

A project-manager agent (or a human using MCP tools) can orchestrate the swarm
without relying on self-service checkout:

### Task materialization

The `ai_generate/materialize_tasks` action bridges PRD→GitHub:

1. **`ai_generate/generate_prd`** — produce a PRD from a project idea.
2. **`ai_generate/parse_prd`** — break the PRD into tasks with dependencies.
3. **`ai_generate/materialize_tasks`** — create milestones, sprints, and issues
   on the target project, sequenced bottom-up by the dependency graph.

Each phase gets its own milestone and sprint (GitHub Projects V2 iteration).
Issues are added to the project and assigned to their phase's sprint.

### Direct task assignment

Instead of letting agents self-select, a PM can assign a specific issue:

```json
{"tool": "agent_manage", "arguments": {
  "action": "assign_task",
  "agentId": "agent-abc123",
  "projectId": "PVT_...",
  "issueNumber": 42
}}
```

This bypasses checkout strategies and atomically claims the issue for the agent.

### Swarm monitoring

```json
{"tool": "agent_manage", "arguments": {"action": "get_swarm_status"}}
```

Returns every agent's current task, heartbeat age, budget status, and
blocked/stale flags.

### Workload rebalancing

```json
{"tool": "agent_manage", "arguments": {"action": "rebalance_workload"}}
```

Redistributes tasks from overloaded agents to idle ones.

### Convergence loop

Drive the project toward completion in one call:

```json
{"tool": "agent_manage", "arguments": {"action": "converge_project", "projectId": "PVT_..."}}
```

Iterates all open issues in the project: validates work products, auto-approves
passing work, auto-rejects failing, auto-decomposes fix subtasks.

For multi-iteration convergence:

```json
{"tool": "agent_manage", "arguments": {"action": "converge_until_done", "projectId": "PVT_...", "iteration": 1}}
```

Returns progress report + suggested next actions. Call in a loop, incrementing
`iteration`, until `done: true`.

## Harness setup

The server is a plain MCP server — any harness that speaks MCP works. Install it
per [README](../README.md#installing-in-ai-assistants). Example for Claude Code CLI:

```bash
claude mcp add github-project-manager -- npx -y mcp-github-project-manager
```

With env vars:

```json
{
  "mcpServers": {
    "github-project-manager": {
      "command": "npx",
      "args": ["-y", "mcp-github-project-manager"],
      "env": {
        "GITHUB_TOKEN": "your_token",
        "GITHUB_OWNER": "your_org",
        "GITHUB_REPO": "your_repo"
      }
    }
  }
}
```

### One-time project setup

Before agents can claim tasks, the project needs the agent custom fields
(`agent_claimed_by`, `agent_claimed_at`, `agent_status`, `agent_work_branch`,
`agent_pr_number`). Provision them idempotently:

```json
{"tool": "manage_project", "arguments": {"action": "setup_agent_fields", "projectId": "PVT_..."}}
```

### Review workflow roles

The `reviewer` role is first-class: register reviewers, have them claim from the
review queue (`checkout_task { reviewQueue: true }`), then `approve_task` /
`reject_task`. Reviewers can enforce quality gates before work reaches
`completed`.

## Multi-harness safety

The layer is safe under concurrent use by multiple harnesses:

- **Atomic claims** — checkout re-verifies the claim is still free immediately
  before writing (`agent_claimed_by` TOCTOU guard); concurrent claims lose
  cleanly instead of double-assigning.
- **Registry concurrency** — `AgentStore` uses read-modify-write with a
  verify-and-merge retry, so parallel heartbeats/registrations never silently
  drop a registered agent.
- **Stale recovery** — `agent_manage/reclaim_stale` returns tasks from agents
  whose heartbeats have lapsed (default timeout 30 min) to the unclaimed pool
  and marks those agents offline.
- **Automatic self-healing** — the server also runs the **auto-reclaim
  scheduler** in the background (every `AGENT_RECLAIM_INTERVAL_MS`, default 5
  min): it detects agents whose heartbeat is older than `AGENT_STALE_AFTER_MINUTES`
  (default 30), reclaims their tasks, flags them `offline`, and posts an audit
  comment on each reclaimed issue. A crashed harness no longer blocks a task
  forever — the swarm heals itself without a human dispatcher.

## Self-healing in practice

When a harness dies mid-task (laptop closed, process killed, context window
hit), its heartbeats stop. Within one reclaim interval the scheduler:

1. Detects the stale agent (no heartbeat for > `AGENT_STALE_AFTER_MINUTES`).
2. Clears the issue's `agent_claimed_by` / `agent_claimed_at` fields and sets
   `agent_status` back to `unclaimed` — the task returns to the pool.
3. Posts an `## Agent Task Auto-Reclaimed` comment on the issue so humans and
   other agents see why it was released.
4. Marks the agent `offline` in the registry (visible in `get_activity`).

The task is then claimable by the next agent. Tune the loop via
`AGENT_RECLAIM_ENABLED` / `AGENT_RECLAIM_INTERVAL_MS` / `AGENT_STALE_AFTER_MINUTES`
(see [docs/CONFIGURATION.md](CONFIGURATION.md#agent-orchestration)).

## Subagents

Agents can register children with `parentAgentId`. Children inherit the parent's
task context and budget; deregistering a parent cascades to all descendants.

## Budget enforcement

Budgets live on the agent record. Agents report spend via `record_usage`;
`get_budget` returns remaining tokens and warning/exhaustion flags. Hard stops
flip the agent to `budget_exhausted` and block further draws.

## E2E verification

A real-GitHub E2E suite exercises the whole lifecycle end-to-end through the MCP
interface — tool presence, field provisioning, register → checkout → context →
heartbeat → work product → review → approve, budgets, crash-recovery reclaim,
and metrics:

```bash
npm run build
npm run test:e2e:tools:real:agent
```

It auto-skips when `GITHUB_TOKEN` / `GITHUB_OWNER` / `GITHUB_REPO` are missing or
fake. See [docs/e2e-testing-guide.md](e2e-testing-guide.md) for the broader suite.

## Reference

- Tool reference: [docs/TOOLS.md](TOOLS.md#agent-orchestration-tools)
- Architecture: [docs/architecture.md](architecture.md)
- Example loop: [`examples/basic/agent-loop.ts`](../examples/basic/agent-loop.ts)
