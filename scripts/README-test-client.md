# MCP Test Client

A comprehensive CLI tool for testing all tools provided by the MCP GitHub Project Manager server.

## Overview

The MCP Test Client provides both automated and interactive testing capabilities for all MCP server tools. It can:

- List all available tools with descriptions
- Test individual tools with sample data
- Run comprehensive test suites across all tools
- Provide interactive mode for manual testing
- Generate detailed test reports

## Quick Start

### 1. Build the Project

```bash
# Using the shell wrapper (recommended)
./scripts/test-mcp.sh build

# Or manually
npm run build
```

### 2. Set Environment Variables

Create a `.env` file in the project root:

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=your-github-username
GITHUB_REPO=your-repository-name
```

Or export them directly:

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
export GITHUB_OWNER=your-github-username
export GITHUB_REPO=your-repository-name
```

### 3. Run Tests

```bash
# List all available tools
./scripts/test-mcp.sh list-tools

# Test all tools with sample data
./scripts/test-mcp.sh test-all

# Test a specific tool
./scripts/test-mcp.sh test-tool create_project

# Interactive mode
./scripts/test-mcp.sh interactive
```

## Usage

### Shell Wrapper (Recommended)

The shell wrapper (`test-mcp.sh`) provides the easiest way to use the test client:

```bash
# Show help
./scripts/test-mcp.sh help

# Build project
./scripts/test-mcp.sh build

# List tools
./scripts/test-mcp.sh list-tools

# Test all tools
./scripts/test-mcp.sh test-all

# Test specific tool
./scripts/test-mcp.sh test-tool create_project

# Interactive mode
./scripts/test-mcp.sh interactive
```

### Direct Node.js Usage

You can also run the test client directly:

```bash
# List tools
node scripts/mcp-test-client.js list-tools

# Test specific tool
node scripts/mcp-test-client.js test-tool create_project

# Test all tools
node scripts/mcp-test-client.js test-all

# Interactive mode
node scripts/mcp-test-client.js interactive
```

## Commands

### `list-tools`

Lists all available tools with descriptions, organized by category:

- **Project Management**: create_project, list_projects, create_milestone, etc.
- **Planning & Analytics**: create_roadmap, get_milestone_metrics, etc.
- **AI Task Management**: generate_prd, parse_prd, get_next_task, etc.
- **Other**: create_label, list_labels, etc.

### `test-tool <name>`

Tests a specific tool with predefined sample data. Shows:
- Tool description
- Sample arguments used
- Execution result or error details

Example:
```bash
./scripts/test-mcp.sh test-tool create_project
```

### `test-all`

Runs automated tests on all tools that have sample data defined. Provides:
- Individual test results (PASSED/FAILED/SKIPPED)
- Summary statistics
- Detailed error information for failed tests

### `interactive`

Enters interactive mode with the following commands:
- `help` - Show available commands
- `list` - List all tools
- `test <tool-name>` - Test a tool with sample data
- `call <tool-name>` - Call a tool with custom JSON arguments
- `schema <tool-name>` - Show tool input schema
- `exit` - Exit interactive mode

## Sample Data

The test client includes predefined sample data for the following tools:

### Project Management
- `create_project` - Creates a test project
- `create_milestone` - Creates a test milestone
- `create_issue` - Creates a test issue
- `create_sprint` - Creates a test sprint
- `create_label` - Creates a test label

### AI Task Management
- `generate_prd` - Generates a PRD for a task management app
- `parse_prd` - Parses a sample PRD document

## Environment Variables

### Required
- `GITHUB_TOKEN` - GitHub personal access token with appropriate permissions
- `GITHUB_OWNER` - GitHub repository owner/organization name
- `GITHUB_REPO` - GitHub repository name

### Optional
- `MCP_SERVER_PATH` - Path to the MCP server executable (default: `../build/index.js`)

## Troubleshooting

### Common Issues

1. **"MCP server not found"**
   - Run `npm run build` to build the project
   - Check that `build/index.js` exists

2. **"Missing required environment variables"**
   - Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO
   - Create a `.env` file or export variables

3. **"Tool execution failed"**
   - Check GitHub token permissions
   - Verify repository exists and is accessible
   - Check network connectivity

4. **"Request timeout"**
   - Server may be taking too long to respond
   - Check server logs for errors
   - Verify GitHub API is accessible

### Debug Mode

For detailed debugging, you can monitor server output by running the Node.js client directly and watching the console output.

## Extending the Test Client

### Adding Sample Data for New Tools

Edit `scripts/mcp-test-client.js` and add entries to the `SAMPLE_DATA` object:

```javascript
const SAMPLE_DATA = {
  // ... existing data
  
  your_new_tool: {
    parameter1: 'value1',
    parameter2: 'value2'
  }
};
```

### Adding New Test Commands

You can extend the interactive mode by adding new cases to the switch statement in the `interactiveMode` function.

## Files

- `scripts/mcp-test-client.js` - Main Node.js test client
- `scripts/test-mcp.sh` - Shell wrapper script
- `scripts/README-test-client.md` - This documentation

## License

Same as the main project (MIT License).
