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

The image `ENTRYPOINT` is `build/bin.js`, so the CLI subcommands work inside
the container (`docker run ... mcp-github-project-manager auth status`).

**Credentials in containers / Kubernetes**

- *Interactive:* run `auth login` once with a persistent, `mcpuser`-writable
  location for the token store (`GITHUB_OAUTH_TOKEN_FILE`), then start the
  server with the same mount:
  ```bash
  docker run -it --rm \
    -e GITHUB_OAUTH_CLIENT_ID=<client id> \
    -e GITHUB_OAUTH_TOKEN_FILE=/data/github-oauth.json \
    -v /path/writable-by-mcpuser:/data \
    mcp-github-project-manager auth login
  ```
  The verification URL and code are printed to stderr; open the URL on any
  device.
- *Mounted token file:* mount a pre-authorised store and point
  `GITHUB_OAUTH_TOKEN_FILE` at it. The file MUST be mode `0600` — a store
  readable by group/other is ignored.
- *Headless / CI / k8s:* prefer a GitHub App (`GITHUB_APP_*`) or a PAT via
  `SECRETS_DIR` (e.g. a mounted Secret at `/run/secrets/GITHUB_TOKEN`) over the
  device flow, which needs a human to approve a code.
- *Vertex AI Gemini:* set `GOOGLE_VERTEX_PROJECT`; credentials come from Google
  ADC — workload identity / the metadata server on GCP, or a mounted service
  account key referenced by `GOOGLE_APPLICATION_CREDENTIALS`.
- *`/events/*`:* publishing port `3001` now also needs `EVENTS_AUTH_TOKEN` or
  `OAUTH_*` (see Security below).

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
| `GITHUB_OWNER` | GitHub username or organization |
| `GITHUB_REPO` | Repository name |

`GITHUB_TOKEN` is **not** required. Credentials resolve per tool call, first hit
wins: GitHub App installation (`GITHUB_APP_*`) → `--token` CLI flag →
`$SECRETS_DIR/GITHUB_TOKEN` file → `GITHUB_TOKEN` env var → stored OAuth token
(`auth login`) → `gh auth token`. A working `gh` login needs no configuration at
all; disable that fallback with `GH_CLI_TOKEN_FALLBACK=false`. With none
available the server fails fast at startup.

### Optional (GitHub App auth)

| Variable | Description |
|----------|-------------|
| `GITHUB_APP_ID` | App ID — highest-priority credential when all three App values are set |
| `GITHUB_APP_PRIVATE_KEY` | App private key |
| `GITHUB_APP_INSTALLATION_ID` | Installation ID |

A partial App configuration falls through to the next credential rather than failing.

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

### Optional (OAuth device flow)

| Variable | Description |
|----------|-------------|
| `GITHUB_OAUTH_CLIENT_ID` | Client ID of an OAuth App / GitHub App with Device Flow enabled (required for `auth login` and for using a stored token) |
| `GITHUB_OAUTH_CLIENT_SECRET` | Only used to revoke the token on `auth logout` |
| `GITHUB_OAUTH_SCOPES` | Requested scopes (default `repo project read:org`) |
| `GITHUB_OAUTH_TOKEN_FILE` | Token store path (default `$XDG_CONFIG_HOME/mcp-github-project-manager/github-oauth.json`; file must be `0600`) |

### Optional (inbound `/events/*` auth)

| Variable | Description |
|----------|-------------|
| `EVENTS_AUTH_TOKEN` | Shared bearer token for `/events/*` |
| `OAUTH_ISSUER` / `OAUTH_AUDIENCE` | OAuth 2.1 resource server (audience required with issuer) |
| `OAUTH_JWKS_URI` / `OAUTH_REQUIRED_SCOPES` / `OAUTH_RESOURCE_URL` | Optional JWKS override, required scopes, RFC 9728 resource URL |
| `EVENTS_ALLOW_UNAUTHENTICATED` | Opt out of `/events/*` auth (trusted dev only) |

### Optional (Gemini via Vertex AI)

| Variable | Description |
|----------|-------------|
| `GOOGLE_VERTEX_PROJECT` | GCP project; enables the `google-vertex` provider |
| `GOOGLE_VERTEX_LOCATION` | Region (default `us-central1`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | ADC service-account key path; on GKE/Cloud Run prefer workload identity / the metadata server and leave it unset |

## GitHub Token Scopes

Required scopes if you use a Personal Access Token (one option among several):

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
- **Breaking:** `/events/stream`, `/events/subscribe`, `/events/replay/:id` and
  `/events/recent` require `Authorization: Bearer`. Set `EVENTS_AUTH_TOKEN` or
  the `OAUTH_ISSUER` + `OAUTH_AUDIENCE` resource-server settings; with neither,
  they return `401`. `EVENTS_ALLOW_UNAUTHENTICATED=true` opts out (trusted dev
  only). `POST /webhooks/github` is unchanged (HMAC only).
- **Behind a reverse proxy / load balancer:** set `TRUST_PROXY` to the number
  of proxies in front of the server (e.g. `TRUST_PROXY=1`). The rate limiter
  and security audit log otherwise key on the socket peer address and ignore
  `X-Forwarded-For`, so all clients would share the proxy's bucket. With `N`
  hops the address `N`-from-the-right in `X-Forwarded-For` is used; `true` and
  other non-integer values abort startup. Do not over-count hops: entries left
  of your outermost proxy are client-controlled.
- `WEBHOOK_ALLOWED_ORIGINS=*` aborts startup while `EVENTS_AUTH_TOKEN` or
  `OAUTH_ISSUER` is set; list exact origins.
- **Breaking:** anonymous `/health` now returns only `{"status":"healthy"}`;
  full stats need a bearer token. Probes that only check status are unaffected.
  See [CONFIGURATION.md](CONFIGURATION.md#inbound-http-authentication-events).

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
