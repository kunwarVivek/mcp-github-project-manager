# Deployment Guide

The server ships as an npm package (`mcp-github-project-manager`) and as a
multi-stage Docker image built on `node:24-slim`.

## Installation Options

### NPM (Recommended)

```bash
npm install -g mcp-github-project-manager
```

Requires **Node.js 22.12+**; Node 24 is the supported target (`.node-version`).

### From Source

```bash
git clone https://github.com/kunwarVivek/mcp-github-project-manager.git
cd mcp-github-project-manager
npm install        # or: pnpm install
npm run build      # or: pnpm run build
```

Both npm and pnpm are supported. `package-lock.json` and `pnpm-lock.yaml` are
both committed and kept in sync; the package manager is deliberately **not**
pinned in `package.json`.

### Docker

The `Dockerfile` is a two-stage build on `node:24-slim`:

- **Builder** — installs dependencies with `npm ci --ignore-scripts` and runs
  `npm run build` (TypeScript → ESM, with `.js` import extensions added by the
  `postbuild` script).
- **Runtime** — installs production dependencies only (`npm ci --omit=dev`),
  copies `build/` in, and runs as the **non-root** user `mcpuser`.

```bash
# Build image
docker build -t mcp-github-project-manager .

# Run container
docker run -it \
  -e GITHUB_TOKEN=your_token \
  -e GITHUB_OWNER=your_org \
  -e GITHUB_REPO=your_repo \
  mcp-github-project-manager
```

The MCP server speaks stdio, so `docker run` without `-i` will look like it
hangs — it is waiting for the client to talk to it.

### Docker Compose

A `docker-compose.yml` is provided at the repository root:

```bash
docker compose up
```

It builds the image, passes the required GitHub variables through from your
shell environment, exposes the webhook port, and mounts a named volume for the
cache. See [CONFIGURATION.md](CONFIGURATION.md#docker-configuration) for the
full file.

## MCP Client Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "github-project-manager": {
      "command": "npx",
      "args": ["-y", "mcp-github-project-manager"],
      "env": {
        "GITHUB_TOKEN": "your_github_token",
        "GITHUB_OWNER": "your_org",
        "GITHUB_REPO": "your_repo"
      }
    }
  }
}
```

### With AI Features

```json
{
  "mcpServers": {
    "github-project-manager": {
      "command": "npx",
      "args": ["-y", "mcp-github-project-manager"],
      "env": {
        "GITHUB_TOKEN": "your_github_token",
        "GITHUB_OWNER": "your_org",
        "GITHUB_REPO": "your_repo",
        "ANTHROPIC_API_KEY": "your_anthropic_key",
        "AI_MAIN_MODEL": "your_main_model"
      }
    }
  }
}
```

There are no built-in default models — configure the model names you want to
use. See [CONFIGURATION.md](CONFIGURATION.md#per-role-ai-provider-configuration)
for per-provider overrides.

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub Personal Access Token with `repo` and `project` scopes |
| `GITHUB_OWNER` | GitHub username or organization |
| `GITHUB_REPO` | Repository name |

`GITHUB_TOKEN` is resolved through a chain: `--token` CLI flag →
`$SECRETS_DIR/GITHUB_TOKEN` file → `GITHUB_TOKEN` env var → `gh auth token`.
A working `gh` login therefore needs no configuration at all; disable the
fallback with `GH_CLI_TOKEN_FALLBACK=false`.

### Optional (GitHub App auth)

| Variable | Description |
|----------|-------------|
| `GITHUB_APP_ID` | App ID — used instead of the PAT when all three App values are set |
| `GITHUB_APP_PRIVATE_KEY` | App private key |
| `GITHUB_APP_INSTALLATION_ID` | Installation ID |

A partial App configuration falls back to the PAT rather than failing.

### Optional (AI Features)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_API_KEY` | Google AI API key |
| `PERPLEXITY_API_KEY` | Perplexity API key |
| `AI_MAIN_MODEL` / `AI_PRD_MODEL` / `AI_RESEARCH_MODEL` / `AI_FALLBACK_MODEL` | Model per role (no defaults) |
| `AI_<ROLE>_PROVIDER` / `AI_<ROLE>_API_KEY` / `AI_<ROLE>_BASE_URL` | Per-role provider, key and endpoint override |

### Optional (Advanced)

| Variable | Description |
|----------|-------------|
| `LOG_LEVEL` | Logging level: `debug`, `info`, `warn`, `error` |
| `LOG_FORMAT` | Log output format: `json`, `text` (default: `text`) |
| `MCP_TOOL_GROUPS` | Comma-separated **group names** to expose: `all` (default), `core`, `ai`, `agents`, `events`, `system`. A tool name here exposes nothing. Only `discover_tools` is always exposed. |
| `MAX_CACHE_ENTRIES` | In-memory cache cap before oldest-first eviction (default: 10000) |
| `CACHE_DIRECTORY` | Directory for persistent cache/event state (default: `.mcp-cache`) |
| `SECRETS_DIR` | Load secrets from mounted files (Docker/k8s `/run/secrets`); precedes env vars |
| `WEBHOOK_SECRET` | Webhook HMAC secret (signature validation fails closed) |
| `WEBHOOK_ALLOW_UNSIGNED` | Accept unsigned webhooks when no secret is set — trusted dev only |
| `WEBHOOK_PORT` | Webhook server port (default: 3001) |
| `SSE_ENABLED` | Enable Server-Sent Events (default: `true`) |
| `SYNC_ENABLED` | Enable background GitHub state sync (default: `true`) |

The full list lives in [CONFIGURATION.md](CONFIGURATION.md).

## GitHub Token Scopes

Required scopes for your Personal Access Token:

- `repo` - Full repository access
- `project` - Project board access
- `write:org` - Organization write access (for org projects)
- `workflow` - Required for the `manage_workflows` tool

## Production Considerations

### Resource Limits

The server is designed for single-user operation. For multi-user scenarios:

- Deploy separate instances per user
- Use container orchestration (K8s, ECS)
- Configure appropriate memory limits (512MB minimum)

### Caching

In-memory cache is used by default. For production:

- Cache is lost on restart unless `CACHE_DIRECTORY` points at a persistent volume
- Consider external cache for persistence
- The cache is capped by `MAX_CACHE_ENTRIES` with oldest-first eviction

### Rate Limiting

GitHub API has rate limits:

- 5,000 requests/hour for authenticated requests
- Circuit breaker protects against cascading failures
- Retry policies handle transient failures

### Security

- Webhook signature validation **fails closed**: with no `WEBHOOK_SECRET`,
  webhooks are rejected unless `WEBHOOK_ALLOW_UNSIGNED=true` (trusted dev only).
- Logs are redacted — token/secret-shaped keys are stripped, and the token is
  not enumerable on the GitHub config object.
- The Docker image runs as the non-root user `mcpuser`.

## Troubleshooting

### Connection Issues

```bash
# Test GitHub token
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user

# Verify MCP server starts
npx -y mcp-github-project-manager --help
```

### Permission Errors

Ensure your token has the required scopes:

```bash
# Check token scopes
curl -I -H "Authorization: token YOUR_TOKEN" https://api.github.com/user
# Look for X-OAuth-Scopes header
```

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for more solutions.
