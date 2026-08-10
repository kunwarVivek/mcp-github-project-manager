# Configuration Guide

This document provides complete configuration reference for the MCP GitHub Project Manager.

## Overview

The MCP GitHub Project Manager can be configured through:
1. Environment variables (recommended for production)
2. `.env` file (for local development)
3. MCP client configuration (Claude, Cursor, VS Code, etc.)
4. Command-line arguments

Configuration sources are applied in this order of precedence:
1. Command-line arguments (highest priority)
2. Environment variables
3. `.env` file (lowest priority)

---

## Required Environment Variables

### GitHub Configuration

These variables are **required** for the MCP server to function:

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub personal access token | `ghp_xxxxxxxxxxxxxxxxxxxx` |
| `GITHUB_OWNER` | GitHub username or organization | `your-username` |
| `GITHUB_REPO` | Repository name | `my-project` |

#### GITHUB_TOKEN

A GitHub personal access token with the following scopes:

| Scope | Purpose |
|-------|---------|
| `repo` | Full repository access (issues, projects, code) |
| `project` | Project board access (read/write) |
| `write:org` | Organization project access (if using org projects) |
| `admin:org` | Required for some organization operations |
| `workflow` | Required for workflow-related operations |

**How to create a GitHub token:**

1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Click "Generate new token (classic)" or use Fine-grained tokens
3. Select the required scopes listed above
4. Copy the token and set it as `GITHUB_TOKEN`

**Security Note:** Never commit your token to version control. Use environment variables or a `.env` file (added to `.gitignore`).

---

## Optional Environment Variables

### AI Provider Configuration

At least one AI API key is required for AI-powered features (PRD generation, task analysis, etc.).

| Variable | Provider | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Anthropic | Claude models for complex reasoning |
| `OPENAI_API_KEY` | OpenAI | GPT models for general AI tasks |
| `GOOGLE_API_KEY` | Google | Gemini models |
| `PERPLEXITY_API_KEY` | Perplexity | Research and analysis tasks |

**Provider Priority:** The system uses automatic fallback if a provider is unavailable:
1. Anthropic Claude (primary)
2. OpenAI GPT (fallback)
3. Google Gemini (secondary fallback)
4. Perplexity (for research tasks)

### AI Model Configuration

No models are configured by default — set the ones you want to use. If a
role has an API key but no model configured, the server warns instead of
silently picking a default model.

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_MAIN_MODEL` | _(none)_ | Primary model for complex tasks |
| `AI_RESEARCH_MODEL` | _(none)_ | Model for research tasks |
| `AI_FALLBACK_MODEL` | _(none)_ | Fallback when primary unavailable |
| `AI_PRD_MODEL` | _(none)_ | Model for PRD generation |

### Per-Role AI Provider Configuration

Beyond the global `*_API_KEY` variables and `AI_*_MODEL` names above, each AI
model role can be configured **independently** — its own provider, API key,
base URL, and model. This lets you mix providers per task: e.g. a cheap
OpenRouter model for everyday work, direct Anthropic for PRD generation, and
a local Ollama instance as an offline fallback.

The pattern is `AI_<ROLE>_<SETTING>`, where `<ROLE>` is one of `MAIN`,
`RESEARCH`, `FALLBACK`, or `PRD`:

| Variable | Description |
|----------|-------------|
| `AI_MAIN_PROVIDER` / `AI_RESEARCH_PROVIDER` / `AI_FALLBACK_PROVIDER` / `AI_PRD_PROVIDER` | Provider for this role: `anthropic`, `openai`, `google`, `perplexity`, or `openai-compatible` |
| `AI_MAIN_API_KEY` / `AI_RESEARCH_API_KEY` / `AI_FALLBACK_API_KEY` / `AI_PRD_API_KEY` | API key for this role, overrides the global `*_API_KEY` |
| `AI_MAIN_BASE_URL` / `AI_RESEARCH_BASE_URL` / `AI_FALLBACK_BASE_URL` / `AI_PRD_BASE_URL` | Custom endpoint for this role (required for `openai-compatible`) |
| `AI_MAIN_MODEL` / `AI_RESEARCH_MODEL` / `AI_FALLBACK_MODEL` / `AI_PRD_MODEL` | Model name for this role |

**Resolution order** for each role:
1. **API key:** the role-specific `AI_<ROLE>_API_KEY` if set, otherwise the
   global key for that provider (e.g. `ANTHROPIC_API_KEY`).
2. **Provider:** the role-specific `AI_<ROLE>_PROVIDER` if set, otherwise
   inferred from the role's model name prefix (e.g. a model starting with
   `claude-` resolves to `anthropic`, `gpt-`/`o1-` to `openai`, `gemini-` to
   `google`, `sonar-` to `perplexity`).
3. If neither a role-specific nor a matching global key is configured, that
   role is left unconfigured — AI features for it degrade gracefully instead
   of falling back to a hardcoded default model.

**The `openai-compatible` provider** uses the OpenAI wire protocol against a
custom `AI_<ROLE>_BASE_URL`, so it works with any OpenAI-protocol endpoint:
OpenRouter, Together AI, Groq, Ollama, LM Studio, Azure OpenAI, and others.

**Example 1 — OpenRouter for daily tasks, direct Anthropic for PRDs:**

```env
AI_MAIN_PROVIDER=openai-compatible
AI_MAIN_BASE_URL=https://openrouter.ai/api/v1
AI_MAIN_API_KEY=sk-or-v1-your-openrouter-key
AI_MAIN_MODEL=deepseek/deepseek-chat

AI_PRD_PROVIDER=anthropic
AI_PRD_API_KEY=sk-ant-your-anthropic-key
AI_PRD_MODEL=claude-opus-5
```

**Example 2 — Local Ollama as an offline fallback:**

```env
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
AI_MAIN_MODEL=claude-sonnet-4-20250514

AI_FALLBACK_PROVIDER=openai-compatible
AI_FALLBACK_BASE_URL=http://localhost:11434/v1
AI_FALLBACK_API_KEY=ollama
AI_FALLBACK_MODEL=llama3.1
```

**Example 3 — Single provider (minimal, backward-compatible):**

```env
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
AI_MAIN_MODEL=claude-opus-5
```

No per-role variables are required — every role that has no `AI_<ROLE>_*`
overrides falls back to the global key and its model-prefix-detected provider.

### AI Task Generation Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_TASKS_PER_PRD` | `50` | Maximum tasks generated per PRD |
| `DEFAULT_COMPLEXITY_THRESHOLD` | `7` | Complexity threshold for task expansion |
| `MAX_SUBTASK_DEPTH` | `3` | Maximum depth for subtask generation |
| `AUTO_DEPENDENCY_DETECTION` | `true` | Automatically detect task dependencies |
| `AUTO_EFFORT_ESTIMATION` | `true` | Automatically estimate effort |

### Enhanced Task Context Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ENHANCED_TASK_GENERATION` | `true` | Enable enhanced task context |
| `AUTO_CREATE_TRACEABILITY` | `true` | Auto-create traceability links |
| `AUTO_GENERATE_USE_CASES` | `true` | Auto-generate use cases |
| `AUTO_CREATE_LIFECYCLE` | `true` | Create task lifecycle tracking |
| `ENHANCED_CONTEXT_LEVEL` | `standard` | Context depth: `minimal`, `standard`, `full` |
| `INCLUDE_BUSINESS_CONTEXT` | `false` | Include business context in tasks |
| `INCLUDE_TECHNICAL_CONTEXT` | `false` | Include technical context in tasks |
| `INCLUDE_IMPLEMENTATION_GUIDANCE` | `false` | Include implementation guidance |

### GitHub AI Integration

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTO_CREATE_PROJECT_FIELDS` | `true` | Auto-create project fields |
| `AI_BATCH_SIZE` | `10` | Batch size for AI operations |

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment: `development`, `test`, `production` |
| `LOG_LEVEL` | `info` | Logging level: `debug`, `info`, `warn`, `error` |
| `LOG_FORMAT` | `text` | Log output format: `text` (human-readable) or `json` (structured JSON to stderr) |

### Tool Exposure

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TOOL_GROUPS` | `all` | Comma-separated list of group tags to expose to MCP clients. Set to `all` to expose all 16 tools. Available tags: `core`, `ai`, `agents`, `events`, `system`. `discover_tools` and `system` are always available regardless of this setting. |

**Available groups:**

| Group | Tools included |
|-------|---------------|
| `core` | `manage_project`, `manage_issues`, `manage_prs`, `manage_milestones`, `manage_sprints`, `manage_labels`, `manage_automation`, `manage_iterations`, `manage_status_updates` |
| `ai` | `ai_generate`, `ai_analyze`, `ai_plan` |
| `agents` | `agent_work`, `agent_manage` |
| `events` | `manage_events` |
| `system` | `system`, `discover_tools` (always enabled) |

**Example profiles:**
```bash
# Full access (default)
MCP_TOOL_GROUPS=all

# Project management only
MCP_TOOL_GROUPS=core

# AI-powered planning
MCP_TOOL_GROUPS=core,ai

# Autonomous agents only
MCP_TOOL_GROUPS=agents

# Everything except agents
MCP_TOOL_GROUPS=core,ai,events
```

### Secrets

Any config/secret can be supplied via a mounted file instead of an environment
variable — the Docker secrets / Kubernetes mounted-secret convention.

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRETS_DIR` | _(unset)_ | Directory of secret files named after each variable (e.g. `/run/secrets`). When set, a file `SECRETS_DIR/<NAME>` takes precedence over the `<NAME>` env var. Files are re-read on access, so rotating the mounted file is picked up. |

To integrate HashiCorp Vault or AWS Secrets Manager, implement `SecretProvider`
in `src/infrastructure/secrets/` and add it to the resolver chain.

### Events, Webhooks & Sync

| Variable | Default | Description |
|----------|---------|-------------|
| `SYNC_ENABLED` | `true` | Enable bidirectional GitHub state sync |
| `SYNC_TIMEOUT_MS` | _(impl default)_ | Sync operation timeout |
| `CACHE_DIRECTORY` | `.mcp-cache` | Directory for cache persistence |
| `WEBHOOK_SECRET` | _(unset)_ | HMAC secret for GitHub webhook signature validation |
| `WEBHOOK_ALLOW_UNSIGNED` | `false` | **Security:** when no `WEBHOOK_SECRET` is set, webhooks are rejected (fail closed). Set `true` only in trusted dev to accept unsigned webhooks. |
| `WEBHOOK_PORT` | `3001` | Port for the webhook HTTP listener |
| `SSE_ENABLED` | `true` | Enable server-sent events streaming |

### Cache

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_CACHE_ENTRIES` | `10000` | Maximum in-memory resource-cache entries before oldest-first eviction |

### Agent Orchestration

The **auto-reclaim scheduler** is the server-side self-healing loop: it periodically
sweeps the agent registry, returns tasks held by agents whose heartbeat has gone stale
(crashed/disconnected harnesses) to the unclaimed pool, marks those agents `offline`, and
posts an audit comment on each reclaimed issue. One crash no longer blocks a task forever.

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_RECLAIM_ENABLED` | `true` | Master switch for the auto-reclaim scheduler |
| `AGENT_RECLAIM_INTERVAL_MS` | `300000` (5 min) | How often the reclaim sweep runs. `0` disables the loop. |
| `AGENT_STALE_AFTER_MINUTES` | `30` | Heartbeat age after which a working agent is considered stale and its task reclaimed |

> **Note:** the first sweep may create the `agent-registry` issue + label in the repo
> (the registry's documented bootstrap mechanism), the same side effect as any
> `register_agent` / `list_agents` call. Set `AGENT_RECLAIM_ENABLED=false` if you never
> use the agent layer.

The remaining agent constants are compile-time (defined in
`src/domain/agent-orchestration-types.ts`) and can be overridden by forking the source:

| Constant | Default | Description |
|----------|---------|-------------|
| `DEFAULT_HEARTBEAT_TIMEOUT_MINUTES` | `30` | Minutes before an agent is considered stale (no heartbeat) |
| `DEFAULT_AGENT_BUDGET_TOKENS` | `500,000` | Default token budget per agent |
| `AGENT_REGISTRY_LABEL` | `agent-registry` | GitHub issue label used for the agent registry |

Agent orchestration custom fields (`agent_claimed_by`, `agent_claimed_at`, `agent_status`,
`agent_work_branch`, `agent_pr_number`) are auto-provisioned in your GitHub Project by
`ProjectFieldSetup` when `AUTO_CREATE_PROJECT_FIELDS=true` (the default), or on demand via
the `manage_project/setup_agent_fields` (or `agent_manage/setup_fields`) action.

---

## Configuration Methods

### Method 1: Environment Variables (Recommended)

Set environment variables directly in your shell:

```bash
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
export GITHUB_OWNER="your-username"
export GITHUB_REPO="your-repository"
export ANTHROPIC_API_KEY="sk-ant-xxxx"

mcp-github-project-manager
```

### Method 2: .env File (Local Development)

Create a `.env` file in your project root:

```env
# GitHub Configuration (Required)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=your-username
GITHUB_REPO=your-repository

# AI Provider Configuration (At least one required for AI features)
ANTHROPIC_API_KEY=sk-ant-xxxx
OPENAI_API_KEY=sk-xxxx
GOOGLE_API_KEY=xxxx
PERPLEXITY_API_KEY=pplx-xxxx

# AI Model Configuration (Optional)
AI_MAIN_MODEL=claude-3-5-sonnet-20241022
AI_FALLBACK_MODEL=gpt-4o

# Server Configuration (Optional)
NODE_ENV=development
LOG_LEVEL=info
```

**Important:** Add `.env` to your `.gitignore` file to avoid committing secrets.

### Method 3: Command-Line Arguments

Pass configuration via command line:

```bash
mcp-github-project-manager \
  --token ghp_xxxxxxxxxxxxxxxxxxxx \
  --owner your-username \
  --repo your-repository \
  --verbose
```

| Argument | Short | Description |
|----------|-------|-------------|
| `--token <token>` | `-t` | GitHub personal access token |
| `--owner <owner>` | `-o` | GitHub repository owner |
| `--repo <repo>` | `-r` | GitHub repository name |
| `--env-file <path>` | `-e` | Path to .env file |
| `--verbose` | `-v` | Enable verbose logging |
| `--help` | `-h` | Display help information |
| `--version` | | Display version information |

---

## MCP Client Configuration Examples

### Claude Desktop

Add to your Claude Desktop configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "github-project-manager": {
      "command": "npx",
      "args": ["-y", "mcp-github-project-manager"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx",
        "GITHUB_OWNER": "your-username",
        "GITHUB_REPO": "your-repository",
        "ANTHROPIC_API_KEY": "sk-ant-xxxx",
        "OPENAI_API_KEY": "sk-xxxx"
      }
    }
  }
}
```

### Claude Code CLI

```bash
claude mcp add github-project-manager -- npx -y mcp-github-project-manager
```

Then set environment variables in your shell or use a `.env` file.

### Cursor

Add to your Cursor MCP configuration:

**Location:** Settings > MCP > Edit Config

```json
{
  "mcpServers": {
    "github-project-manager": {
      "command": "npx",
      "args": ["-y", "mcp-github-project-manager"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx",
        "GITHUB_OWNER": "your-username",
        "GITHUB_REPO": "your-repository"
      }
    }
  }
}
```

See [Cursor MCP docs](https://docs.cursor.com/context/model-context-protocol) for more information.

### VS Code

Add to your VS Code MCP configuration:

**Location:** Settings > Extensions > MCP > Edit Settings JSON

```json
{
  "servers": {
    "github-project-manager": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-github-project-manager"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx",
        "GITHUB_OWNER": "your-username",
        "GITHUB_REPO": "your-repository"
      }
    }
  }
}
```

See [VS Code MCP docs](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) for more information.

### Windsurf

Add to your Windsurf MCP configuration:

```json
{
  "mcpServers": {
    "github-project-manager": {
      "command": "npx",
      "args": ["-y", "mcp-github-project-manager"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx",
        "GITHUB_OWNER": "your-username",
        "GITHUB_REPO": "your-repository"
      }
    }
  }
}
```

See [Windsurf MCP docs](https://docs.windsurf.com/windsurf/mcp) for more information.

### Roocode

Add to your Roocode MCP configuration:

```json
{
  "mcpServers": {
    "github-project-manager": {
      "command": "npx",
      "args": ["-y", "mcp-github-project-manager"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx",
        "GITHUB_OWNER": "your-username",
        "GITHUB_REPO": "your-repository"
      }
    }
  }
}
```

---

## Docker Configuration

### Using docker run

```bash
docker run -it \
  -e GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx \
  -e GITHUB_OWNER=your-username \
  -e GITHUB_REPO=your-repository \
  -e ANTHROPIC_API_KEY=sk-ant-xxxx \
  mcp-github-project-manager
```

### Using Docker Compose

Create a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  mcp-server:
    build: .
    environment:
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - GITHUB_OWNER=${GITHUB_OWNER}
      - GITHUB_REPO=${GITHUB_REPO}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - NODE_ENV=production
      - LOG_LEVEL=info
    stdin_open: true
    tty: true
```

Then run:

```bash
docker-compose up
```

### Environment File with Docker

Create a `.env.docker` file:

```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=your-username
GITHUB_REPO=your-repository
ANTHROPIC_API_KEY=sk-ant-xxxx
```

Run with:

```bash
docker run -it --env-file .env.docker mcp-github-project-manager
```

---

## Security Best Practices

### Token Security

1. **Never commit tokens to version control**
   - Add `.env` to `.gitignore`
   - Use environment variables in CI/CD

2. **Use granular token scopes**
   - Only enable scopes you need
   - Use fine-grained tokens when possible

3. **Rotate tokens periodically**
   - Set reminders to regenerate tokens
   - Revoke old tokens promptly

4. **Use different tokens for different environments**
   - Development: limited scope token
   - Production: full scope token with restricted IP

### API Key Security

1. **Store API keys securely**
   - Use secrets managers (AWS Secrets Manager, HashiCorp Vault)
   - Never log API keys

2. **Monitor API usage**
   - Set up billing alerts
   - Review usage patterns for anomalies

3. **Use least privilege**
   - Only configure providers you actually use
   - Remove unused API keys

### Production Deployment

1. **Use secure environment injection**
   ```bash
   # Kubernetes secrets
   kubectl create secret generic mcp-secrets \
     --from-literal=GITHUB_TOKEN=ghp_xxxx \
     --from-literal=ANTHROPIC_API_KEY=sk-ant-xxxx
   ```

2. **Enable audit logging**
   ```env
   LOG_LEVEL=info
   NODE_ENV=production
   ```

3. **Restrict network access**
   - Use firewalls to limit outbound connections
   - Only allow connections to required APIs

---

## Configuration Validation

The server validates configuration on startup. Common validation errors:

| Error | Cause | Solution |
|-------|-------|----------|
| `GITHUB_TOKEN is required` | Token not set | Set GITHUB_TOKEN |
| `Invalid GitHub token format` | Malformed token | Check token starts with `ghp_`, `gho_`, or `github_pat_` |
| `GITHUB_OWNER is required` | Owner not set | Set GITHUB_OWNER |
| `GITHUB_REPO is required` | Repo not set | Set GITHUB_REPO |
| `No AI provider configured` | No API keys | Set at least one AI provider key |

### Testing Configuration

Verify your configuration by running:

```bash
# Test that the server starts
mcp-github-project-manager --verbose

# Check environment variables
env | grep -E "GITHUB_|ANTHROPIC_|OPENAI_|AI_"
```

---

## Configuration Reference

### Complete Example .env File

```env
# ===========================
# Required: GitHub Configuration
# ===========================
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=your-username
GITHUB_REPO=your-repository

# ===========================
# AI Provider Configuration
# At least one is required for AI features
# ===========================
ANTHROPIC_API_KEY=sk-ant-xxxx
OPENAI_API_KEY=sk-xxxx
GOOGLE_API_KEY=xxxx
PERPLEXITY_API_KEY=pplx-xxxx

# ===========================
# AI Model Configuration
# ===========================
AI_MAIN_MODEL=claude-3-5-sonnet-20241022
AI_RESEARCH_MODEL=perplexity-llama-3.1-sonar-large-128k-online
AI_FALLBACK_MODEL=gpt-4o
AI_PRD_MODEL=claude-3-5-sonnet-20241022

# ===========================
# AI Task Generation
# ===========================
MAX_TASKS_PER_PRD=50
DEFAULT_COMPLEXITY_THRESHOLD=7
MAX_SUBTASK_DEPTH=3
AUTO_DEPENDENCY_DETECTION=true
AUTO_EFFORT_ESTIMATION=true

# ===========================
# Enhanced Task Context
# ===========================
ENHANCED_TASK_GENERATION=true
AUTO_CREATE_TRACEABILITY=true
AUTO_GENERATE_USE_CASES=true
AUTO_CREATE_LIFECYCLE=true
ENHANCED_CONTEXT_LEVEL=standard
INCLUDE_BUSINESS_CONTEXT=false
INCLUDE_TECHNICAL_CONTEXT=false
INCLUDE_IMPLEMENTATION_GUIDANCE=false

# ===========================
# GitHub AI Integration
# ===========================
AUTO_CREATE_PROJECT_FIELDS=true
AI_BATCH_SIZE=10

# ===========================
# Agent Orchestration (auto-reclaim scheduler)
# ===========================
AGENT_RECLAIM_ENABLED=true
AGENT_RECLAIM_INTERVAL_MS=300000
AGENT_STALE_AFTER_MINUTES=30

# ===========================
# Server Configuration
# ===========================
NODE_ENV=development
LOG_LEVEL=info
LOG_FORMAT=text
# ===========================
# Tool Exposure
# ===========================
# Comma-separated list of compound tool groups to expose (default: all)
MCP_TOOL_GROUPS=all
```

---

## See Also

- [Troubleshooting Guide](TROUBLESHOOTING.md) - Common issues and solutions
- [Tool Reference](TOOLS.md) - 16 compound tools (134 actions) documented
- [API Reference](API.md) - Service and infrastructure APIs
- [User Guide](user-guide.md) - Getting started guide
