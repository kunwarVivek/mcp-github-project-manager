# GitHub Project Manager MCP Examples

This directory contains example code demonstrating how to use the GitHub Project Manager MCP Server for various project management tasks.

## Directory Structure

- `basic/` - Basic examples for common operations
- `advanced/` - Advanced examples for complex scenarios
- `integration/` - Examples showing integration with other systems

## Running the Examples

### Prerequisites

1. Node.js 18.x or higher
2. TypeScript installed (`npm install -g typescript ts-node`)
3. GitHub Project Manager MCP Server installed and configured
4. Valid GitHub token with appropriate permissions

### Setup

1. Create a `.env` file in the project root with your GitHub credentials:

```env
GITHUB_TOKEN=your_personal_access_token
GITHUB_OWNER=your_github_username_or_org
GITHUB_REPO=your_repository_name
```

2. Install dependencies:

```bash
npm install
# or
pnpm install
```

### Running an Example

Use `ts-node` to run any example:

```bash
ts-node examples/basic/create-simple-project.ts
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
