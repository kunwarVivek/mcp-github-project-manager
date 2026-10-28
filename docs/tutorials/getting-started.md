# Getting Started with GitHub Project Manager MCP

This tutorial walks through installing the server, pointing it at a repository,
and driving the first project-management operations.

## Prerequisites

Before you begin, make sure you have:

- Node.js 22.12+ (24 recommended)
- npm or pnpm
- A GitHub account with appropriate permissions
- A GitHub Personal Access Token with required scopes:
  - `repo` (Full repository access)
  - `project` (Project access)
  - `write:org` (Organization access)

> A working `gh` CLI login is enough on its own — the server falls back to
> `gh auth token` when no token is configured.

## Step 1: Installation and Setup

First, let's install and configure the server:

```bash
# Install from npm (recommended)
npm install -g mcp-github-project-manager

# Or clone the repository for development
git clone https://github.com/kunwarVivek/mcp-github-project-manager.git
cd mcp-github-project-manager
npm install        # or: pnpm install

# Create environment configuration
cp .env.example .env
```

Now, edit the `.env` file with your GitHub credentials:

```env
GITHUB_TOKEN=your_personal_access_token
GITHUB_OWNER=your_github_username_or_org
GITHUB_REPO=your_repository_name
```

## Step 2: Build and Start the Server

Build and start the MCP server:

```bash
# Build the project
npm run build      # or: pnpm run build

# Start the server
npm start
```

The server speaks MCP over stdio. It writes diagnostics to **stderr** and
nothing to stdout — stdout carries the JSON-RPC stream and any stray write
there corrupts the session. So a silent start is expected; connect an MCP
client to confirm it is alive.

To inspect the server interactively:

```bash
npm run inspect
```

## Step 3: Register the Server with an MCP Client

Add the server to your MCP client. For Claude Desktop
(`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "github-project-manager": {
      "command": "npx",
      "args": ["-y", "mcp-github-project-manager"],
      "env": {
        "GITHUB_TOKEN": "your_personal_access_token",
        "GITHUB_OWNER": "your_github_username_or_org",
        "GITHUB_REPO": "your_repository_name"
      }
    }
  }
}
```

## Step 4: Discover the Tool Surface

The server exposes **20 compound tools covering 169 actions**. Start with the
`discover_tools` meta-tool — it lists the tools, their actions, and their
parameter schemas at runtime:

```json
{"tool": "discover_tools", "arguments": {}}
```

```json
{"tool": "discover_tools", "arguments": {"group": "manage_project"}}
```

```json
{"tool": "discover_tools", "arguments": {"group": "manage_project", "action": "create", "includeSchemas": true}}
```

## Step 5: Create Your First Project

Every compound tool takes an `action` parameter:

```json
{"tool": "manage_project", "arguments": {
  "action": "create",
  "title": "My First Project",
  "owner": "your_github_username_or_org",
  "visibility": "private"
}}
```

Then add a milestone and an issue:

```json
{"tool": "manage_milestones", "arguments": {
  "action": "create",
  "title": "Phase 1",
  "dueDate": "2026-12-31"
}}
```

```json
{"tool": "manage_issues", "arguments": {
  "action": "create",
  "title": "Setup project repository",
  "body": "Create and configure the initial project repository",
  "labels": ["feature"]
}}
```

## Step 6: Plan a Sprint

```json
{"tool": "manage_sprints", "arguments": {
  "action": "create",
  "title": "Sprint 1",
  "startDate": "2026-01-01",
  "endDate": "2026-01-14",
  "goals": ["Complete initial project setup"]
}}
```

## Step 7: Track Progress

```json
{"tool": "manage_sprints", "arguments": {
  "action": "get_metrics",
  "sprintId": "<sprint-id>"
}}
```

## Running the Examples in Code

The `examples/` directory contains runnable TypeScript examples that call the
services directly (not through MCP):

```bash
npm exec tsx examples/basic/create-simple-project.ts
npm exec tsx examples/basic/plan-sprint.ts
npm exec tsx examples/basic/track-progress.ts
```

They resolve the service through `createProjectManagementService()` in
`src/container.ts` and need the same `GITHUB_*` environment variables. See
[examples/README.md](../../examples/README.md) for the full set.

## Troubleshooting

If you encounter any issues:

### Authentication Errors

```
Error: Unauthorized: Bad credentials
```

- Verify that your GitHub token is correct and has not expired
- Check that your token has the required scopes
- Ensure the token is correctly set in your `.env` file
- Remember the credential chain: `--token` flag → `$SECRETS_DIR/GITHUB_TOKEN` →
  `GITHUB_TOKEN` → `gh auth token`

### Rate Limiting

```
Error: Rate limited: API rate limit exceeded
```

- Implement request batching for large operations
- Add retry logic with exponential backoff
- Monitor rate limit headers in responses

### Resource Not Found

```
Error: Resource not found: Issue with ID 123 not found
```

- Verify that the resource IDs you're using are correct
- Check that you have access to the resources
- Ensure you're using the correct owner and repository

### A Tool Is Missing

`MCP_TOOL_GROUPS` filters the exposed tool set by **group name** (`core`,
`ai`, `agents`, `events`, `system`), not by tool name. See
[CONFIGURATION.md](../CONFIGURATION.md#tool-exposure).

## Next Steps

Congratulations! You've completed the getting started tutorial. Here are some next steps:

1. Explore the [Tool Reference](../TOOLS.md) for all 20 compound tools and their 169 actions
2. Check out the [Examples](../../examples/README.md) directory for more code samples
3. Read the [Agent Harness Integration guide](../agent-harness-integration.md) for autonomous agent workflows
4. Contribute to the project by following the [Contributing Guide](../contributing/index.md)
