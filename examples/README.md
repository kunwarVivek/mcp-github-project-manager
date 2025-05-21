# MCP GitHub Project Manager Examples

This directory contains example code demonstrating how to use the MCP GitHub Project Manager for various project management tasks.

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

# Run the MCP server
mcp-github-project-manager
```

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

2. **Environment Variables**: Use environment variables for sensitive information like tokens.

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
const serverProcess = spawn("mcp-github-project-manager", [], {
  env: { ...process.env, GITHUB_TOKEN: "your_token" }
});

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
