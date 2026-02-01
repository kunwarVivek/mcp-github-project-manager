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

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_MAIN_MODEL` | `claude-3-5-sonnet-20241022` | Primary model for complex tasks |
| `AI_RESEARCH_MODEL` | `perplexity-llama-3.1-sonar-large-128k-online` | Model for research tasks |
| `AI_FALLBACK_MODEL` | `gpt-4o` | Fallback when primary unavailable |
| `AI_PRD_MODEL` | `claude-3-5-sonnet-20241022` | Model for PRD generation |

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
# Server Configuration
# ===========================
NODE_ENV=development
LOG_LEVEL=info
```

---

## See Also

- [Troubleshooting Guide](TROUBLESHOOTING.md) - Common issues and solutions
- [Tool Reference](TOOLS.md) - All 119 MCP tools documented
- [API Reference](API.md) - Service and infrastructure APIs
- [User Guide](user-guide.md) - Getting started guide
