# MCP GitHub Project Manager Examples

This directory contains example code demonstrating how to use the MCP GitHub Project Manager for various project management tasks.

## Table of Contents

- [Directory Structure](#directory-structure)
- [Running the Examples](#running-the-examples)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
- [Installation Options](#installation-options)
  - [Using npm](#option-1-using-npm-for-application-integration)
  - [Install globally](#option-2-install-globally-for-cli-usage)
  - [Run with TypeScript](#option-3-run-directly-with-typescript)
  - [Install in AI Assistants](#option-4-install-in-ai-assistants)
    - [Claude](#claude)
    - [Roocode](#roocode)
    - [Windsurf](#windsurf)
    - [VS Code](#vs-code)
    - [Cursor](#cursor)
    - [Using Docker](#using-docker)
    - [Troubleshooting](#troubleshooting)
- [Basic Examples](#basic-examples)
- [Advanced Examples](#advanced-examples)
- [Integration Examples](#integration-examples)
- [Best Practices](#best-practices)
- [Contributing](#contributing)
- [License](#license)

## Directory Structure

- `basic/` - Basic examples for common operations
- `advanced/` - Advanced examples for complex scenarios
- `integration/` - Examples showing integration with other systems and frameworks

## Running the Examples

### Prerequisites

1. Node.js 18.x or higher
2. TypeScript installed (`npm install -g typescript ts-node`)
3. MCP GitHub Project Manager installed (`npm install mcp-github-project-manager`)
4. Valid GitHub token with appropriate permissions

### Setup

```bash
# Install the package
npm install mcp-github-project-manager

# Configure environment variables
export GITHUB_TOKEN=your_github_token
export GITHUB_OWNER=your_github_username_or_org
export GITHUB_REPO=your_repository_name

# Run an example
ts-node examples/basic/create-simple-project.ts
```

### Installation Options

#### Option 1: Using npm (for application integration)

```bash
# Install in your project
npm install mcp-github-project-manager
```

#### Option 2: Install globally (for CLI usage)

```bash
# Install globally
npm install -g mcp-github-project-manager

# Run the MCP server with environment variables
mcp-github-project-manager

# Or run with command line arguments
mcp-github-project-manager --token=your_token --owner=your_username --repo=your_repo

# Display help information
mcp-github-project-manager --help
```

#### Option 3: Run directly with TypeScript

```bash
# Run directly with ts-node
node --loader ts-node/esm src/index.ts

# Run with command line arguments
node --loader ts-node/esm src/index.ts --token=your_token --owner=your_username --repo=your_repo

# Use the npm dev script (watches for changes)
npm run dev

# Display help information
node --loader ts-node/esm src/index.ts --help
```

#### Option 4: Install in AI Assistants

##### Claude

Add this to your Claude Desktop configuration file:

```json
{
  "mcpServers": {
    "github-project-manager": {
      "command": "npx",
      "args": ["-y", "mcp-github-project-manager"],
      "env": {
        "GITHUB_TOKEN": "your_github_token",
        "GITHUB_OWNER": "your_username",
        "GITHUB_REPO": "your_repo"
      }
    }
  }
}
```

##### Roocode

Add this to your Roocode configuration:

```json
{
  "mcpServers": {
    "github-project-manager": {
      "command": "npx",
      "args": ["-y", "mcp-github-project-manager"],
      "env": {
        "GITHUB_TOKEN": "your_github_token",
        "GITHUB_OWNER": "your_username",
        "GITHUB_REPO": "your_repo"
      }
    }
  }
}
```

##### Windsurf

Add this to your Windsurf MCP configuration:

```json
{
  "mcpServers": {
    "github-project-manager": {
      "command": "npx",
      "args": ["-y", "mcp-github-project-manager"],
      "env": {
        "GITHUB_TOKEN": "your_github_token",
        "GITHUB_OWNER": "your_username",
        "GITHUB_REPO": "your_repo"
      }
    }
  }
}
```

##### VS Code

Add this to your VS Code MCP configuration:

```json
{
  "servers": {
    "github-project-manager": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-github-project-manager"],
      "env": {
        "GITHUB_TOKEN": "your_github_token",
        "GITHUB_OWNER": "your_username",
        "GITHUB_REPO": "your_repo"
      }
    }
  }
}
```

##### Cursor

Add this to your Cursor MCP configuration:

```json
{
  "mcpServers": {
    "github-project-manager": {
      "command": "npx",
      "args": ["-y", "mcp-github-project-manager"],
      "env": {
        "GITHUB_TOKEN": "your_github_token",
        "GITHUB_OWNER": "your_username",
        "GITHUB_REPO": "your_repo"
      }
    }
  }
}
```

See the [main README](../README.md#installing-in-ai-assistants) for more detailed installation instructions for various AI assistants.

##### Using Docker

You can also run the MCP server in a Docker container:

```json
{
  "mcpServers": {
    "github-project-manager": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "github-project-manager-mcp"],
      "env": {
        "GITHUB_TOKEN": "your_github_token",
        "GITHUB_OWNER": "your_username",
        "GITHUB_REPO": "your_repo"
      }
    }
  }
}
```

See the [main README](../README.md#using-docker) for instructions on building the Docker image.

##### Troubleshooting

If you encounter issues with the MCP server:

1. Try using `bunx` instead of `npx` if you have module resolution issues
2. On Windows, use `cmd /c npx -y mcp-github-project-manager` as the command
3. Check that your GitHub token has the required permissions
4. Ensure you're using Node.js v18 or higher

See the [main README](../README.md#troubleshooting) for more troubleshooting tips.

## Basic Examples

### Create Simple Project

[`basic/create-simple-project.ts`](basic/create-simple-project.ts)

Creates a basic project with a single milestone and two issues.

```bash
ts-node examples/basic/create-simple-project.ts
```

### Plan Sprint

[`basic/plan-sprint.ts`](basic/plan-sprint.ts)

Plans a sprint with existing issues.

```bash
ts-node examples/basic/plan-sprint.ts
```

### Track Progress

[`basic/track-progress.ts`](basic/track-progress.ts)

Tracks the progress of a sprint.

```bash
ts-node examples/basic/track-progress.ts
```

## Advanced Examples

Coming soon:

- Creating complex roadmaps with multiple milestones
- Working with custom fields
- Performing batch operations
- Implementing automation workflows

## Integration Examples

Coming soon:

- Integration with GitHub Actions
- Integration with Slack for notifications
- Generating reports and visualizations
- Implementing custom workflows

## Best Practices

1. **Error Handling**: All examples include proper error handling to demonstrate how to handle various error scenarios.

2. **Configuration**: Use environment variables or command line arguments for configuration. Command line arguments take precedence over environment variables.

3. **Validation**: Always validate input data before making API calls.

4. **Rate Limiting**: Be mindful of GitHub API rate limits, especially when running multiple examples in succession.

## Contributing

Feel free to contribute additional examples by following the [Contributing Guide](../docs/contributing/index.md).

## License

These examples are licensed under the same license as the main project.

## Integration Examples

### Node.js Integration

```javascript
import { Server } from "mcp-github-project-manager";

const server = new Server({
  transport: "stdio",
  config: {
    githubToken: process.env.GITHUB_TOKEN
  }
});

server.start();
```

### Using with OpenAI Function Calling

```javascript
import { OpenAI } from "openai";
import { spawn } from "child_process";
import { McpClient } from "@modelcontextprotocol/client";

// Start MCP server as a child process
// Option 1: Using environment variables
const serverProcess = spawn("mcp-github-project-manager", [], {
  env: { ...process.env, GITHUB_TOKEN: "your_token" }
});

// Option 2: Using command line arguments
// const serverProcess = spawn("mcp-github-project-manager", [
//   "--token", "your_token",
//   "--owner", "your_username",
//   "--repo", "your_repo"
// ]);

// Create MCP client
const mcpClient = new McpClient({
  transport: {
    type: "process",
    process: serverProcess
  }
});

// Get available tools
const tools = await mcpClient.listTools();

// Configure OpenAI with tools
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const completion = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Create a project roadmap for Q3 2025" }],
  tools: tools.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }))
});

// Handle tool calls from OpenAI
if (completion.choices[0].message.tool_calls) {
  // Process and execute tool calls with MCP client
}
```

See individual example files for more details and use cases.
