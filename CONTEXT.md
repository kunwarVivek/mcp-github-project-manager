# Domain Glossary

## Token Provenances

- **Metered tokens** — Token usage measured by the server at the AI provider boundary (via AI-SDK middleware). The server sees the real spend as the provider reports it. Stored as `meteredTokens` on `AgentBudget`.

- **Reported tokens** — Token usage asserted by the external agent via the `record_usage` tool. Unverifiable by the server — the agent is trusted to report honestly. Stored as `reportedTokens` on `AgentBudget`.

- **Estimated tokens** — Approximate token count from a words × 1.3 heuristic (`TokenCounter.estimate`). Used for prompt-size gating and quality metrics. Never touches the agent budget.

- **Used tokens** — Derived sum: `meteredTokens + reportedTokens`. This is the single number enforcement checks against `totalTokens`. Kept for backward compatibility; not independently settable.

## Agent Hierarchy

- **Agent** — A registered autonomous actor (engineer, reviewer, PM, etc.) that can claim tasks, report heartbeats, and submit work products. Agents are registered in the agent registry (a GitHub Issue).

- **Subagent** — An agent whose `parentAgentId` points to another agent. A subagent has no budget of its own; all budget checks and debits resolve to the root ancestor. A subagent cannot check out tasks independently.

- **Budget owner** — The root agent in the hierarchy. All budget operations walk up the `parentAgentId` chain to find the budget owner.

## Budget Disambiguation

- **Agent budget** (`AgentBudget`) — Per-agent token allowance with enforcement. Has `totalTokens` (ceiling), split counters by provenance, `warningFraction` (0–1 threshold for warnings), `hardStop` (whether to block when exhausted), and optional `resetPeriod`.

- **Prompt limit** — Maximum token count for a single prompt or context window. Managed by `TokenCounter.fitsInLimit` / `truncateToLimit`. Not related to the agent budget.

- **Quality metric (estimated tokens)** — The `estimatedTokens` field on `ContextQualityMetrics`. Tracks how many estimated tokens a context-generation call used. A quality/cost signal, not an enforcement boundary.
