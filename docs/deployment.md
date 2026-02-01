# Deployment Guide

## Installation Options

### NPM (Recommended)

```bash
npm install -g mcp-github-project-manager
```

### From Source

```bash
git clone https://github.com/kunwarVivek/mcp-github-project-manager.git
cd mcp-github-project-manager
npm install
npm run build
```

### Docker

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
        "ANTHROPIC_API_KEY": "your_anthropic_key"
      }
    }
  }
}
```

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub Personal Access Token with `repo` and `project` scopes |
| `GITHUB_OWNER` | GitHub username or organization |
| `GITHUB_REPO` | Repository name |

### Optional (AI Features)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_AI_API_KEY` | Google AI API key |
| `PERPLEXITY_API_KEY` | Perplexity API key |
| `AI_PROVIDER` | Preferred provider: `anthropic`, `openai`, `google` |

### Optional (Advanced)

| Variable | Description |
|----------|-------------|
| `LOG_LEVEL` | Logging level: `debug`, `info`, `warn`, `error` |
| `CACHE_TTL` | Cache TTL in seconds (default: 300) |
| `ENABLE_WEBHOOKS` | Enable webhook server: `true`/`false` |
| `WEBHOOK_PORT` | Webhook server port (default: 3000) |

## GitHub Token Scopes

Required scopes for your Personal Access Token:

- `repo` - Full repository access
- `project` - Project board access
- `read:org` - Organization read access (for org projects)

## Production Considerations

### Resource Limits

The server is designed for single-user operation. For multi-user scenarios:

- Deploy separate instances per user
- Use container orchestration (K8s, ECS)
- Configure appropriate memory limits (512MB minimum)

### Caching

In-memory cache is used by default. For production:

- Cache is lost on restart
- Consider external cache for persistence
- Default TTL is 5 minutes

### Rate Limiting

GitHub API has rate limits:

- 5,000 requests/hour for authenticated requests
- Circuit breaker protects against cascading failures
- Retry policies handle transient failures

## Troubleshooting

### Connection Issues

```bash
# Test GitHub token
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user

# Verify MCP server starts
npx mcp-github-project-manager --help
```

### Permission Errors

Ensure your token has the required scopes:

```bash
# Check token scopes
curl -I -H "Authorization: token YOUR_TOKEN" https://api.github.com/user
# Look for X-OAuth-Scopes header
```

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for more solutions.
