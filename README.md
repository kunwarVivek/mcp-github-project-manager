# MCP GitHub Project Manager

A comprehensive Model Context Protocol (MCP) server that provides advanced GitHub project management capabilities with **AI-powered task management** and **complete requirements traceability**. Transform your project ideas into actionable tasks with full end-to-end tracking from business requirements to implementation.

[![npm version](https://img.shields.io/npm/v/mcp-github-project-manager.svg)](https://www.npmjs.com/package/mcp-github-project-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/mcp-github-project-manager.svg)](https://nodejs.org/)

## Overview

This server implements the [Model Context Protocol](https://modelcontextprotocol.io) to provide comprehensive GitHub project management with advanced AI capabilities. Beyond traditional project management, it offers AI-powered task generation, requirements traceability, and intelligent project planning through GitHub's GraphQL API while maintaining state and handling errors according to MCP specifications.

### What Makes This Special

- **16 Compound Tools (134 actions)**: Progressive-disclosure API — AI agents see 16 tools instead of 131, with `discover_tools` for runtime exploration
- **AI-Powered**: Transform project ideas into comprehensive PRDs and actionable tasks using multiple AI providers
- **Agent Orchestration**: Autonomous AI agent task assignment, heartbeat monitoring, budget enforcement, and work product tracking
- **Complete Traceability**: Full end-to-end tracking from business requirements → features → use cases → tasks
- **Intelligent Analysis**: AI-powered complexity analysis, effort estimation, and task recommendations
- **Professional Standards**: IEEE 830 compliant requirements documentation with enterprise-grade change management


## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Key Features](#key-features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
  - [As a command-line tool](#as-a-command-line-tool)
  - [Running from source with TypeScript](#running-from-source-with-typescript)
  - [As a Node.js module](#as-a-nodejs-module)
  - [Integration with MCP clients](#integration-with-mcp-clients)
  - [Installing in AI Assistants](#installing-in-ai-assistants)
    - [Claude](#install-in-claude)
    - [Roocode](#install-in-roocode)
    - [Windsurf](#install-in-windsurf)
    - [VS Code](#install-in-vs-code)
    - [Cursor](#install-in-cursor)
    - [Using Docker](#using-docker)
  - [Troubleshooting](#troubleshooting)
- [Agent Orchestration](#agent-orchestration)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)
- [References](#references)
- [Current Status](#current-status)

## Quick Start

### Using NPM
```bash
# Install the package globally
npm install -g mcp-github-project-manager

# Set up your environment variables
export GITHUB_TOKEN="your_github_token"
export GITHUB_OWNER="your_github_username_or_organization"
export GITHUB_REPO="your_repository_name"

# Run the MCP server
mcp-github-project-manager
```

### Using Docker
```bash
# Build the Docker image
docker build -t mcp-github-project-manager .

# Run with environment variables
docker run -it \
  -e GITHUB_TOKEN=your_github_token \
  -e GITHUB_OWNER=your_github_username_or_organization \
  -e GITHUB_REPO=your_repository_name \
  mcp-github-project-manager
```

## Key Features

### 🤖 AI-Powered Task Management
- **PRD Generation** (`generate_prd`): Transform project ideas into comprehensive Product Requirements Documents
- **Intelligent Task Breakdown** (`parse_prd`): AI-powered parsing of PRDs into actionable development tasks
- **Smart Feature Addition** (`add_feature`): Add new features with automatic impact analysis and task generation
- **Task Complexity Analysis** (`analyze_task_complexity`): Detailed AI analysis of task complexity, effort estimation, and risk assessment
- **Next Task Recommendations** (`get_next_task`): AI-powered recommendations for optimal task prioritization
- **Task Expansion** (`expand_task`): Break down complex tasks into manageable subtasks automatically
- **PRD Enhancement** (`enhance_prd`): Improve existing PRDs with AI-powered gap analysis and improvements

### 🎯 Enhanced Task Context Generation
- **Traceability-Based Context** (Default): Rich context from requirements traceability without AI dependency
- **AI-Enhanced Context** (Optional): Comprehensive business, technical, and implementation context using AI
- **Configurable Context Levels**: Choose between minimal, standard, and full context depth
- **Business Context**: Extract business objectives, user impact, and success metrics
- **Technical Context**: Analyze technical constraints, architecture decisions, and integration points
- **Implementation Guidance**: AI-generated step-by-step implementation recommendations
- **Contextual References**: Links to relevant PRD sections, features, and technical specifications
- **Enhanced Acceptance Criteria**: Detailed, testable criteria with verification methods
- **Graceful Degradation**: Works perfectly without AI keys, falls back to traceability-based context

### 🔗 Complete Requirements Traceability
- **End-to-End Tracking** (`create_traceability_matrix`): Full traceability from PRD business requirements → features → use cases → tasks
- **Bidirectional Links**: Complete bidirectional traceability with impact analysis
- **Use Case Management**: Professional actor-goal-scenario use case generation and tracking
- **Coverage Analysis**: Comprehensive coverage metrics with gap identification
- **Orphaned Task Detection**: Identify tasks without requirements links
- **Change Impact Analysis**: Track requirement changes and their impact across all levels

### 📊 Multi-Provider AI Support
- **Anthropic Claude**: Primary AI provider for complex reasoning
- **OpenAI GPT**: Alternative provider with fallback support
- **Google Gemini**: Additional AI capabilities
- **Perplexity**: Research and analysis tasks
- **Automatic Fallback**: Seamless switching between providers

### 🏗️ Core Project Management
- **Project Management**: Create and manage GitHub Projects (v2)
- **Issues and Milestones**: Full CRUD operations with advanced filtering
- **Sprint Planning**: Plan and manage development sprints with AI assistance
- **Custom Fields and Views**: Create different views (board, table, timeline, roadmap)
- **Resource Versioning**: Intelligent caching and optimistic locking

### ⚡ Advanced Features
- **MCP Implementation**: Full MCP specification compliance with Zod validation
- **GitHub Integration**: GraphQL API integration with intelligent rate limiting
- **Real-time Sync**: Bidirectional synchronization with GitHub
- **Webhook Integration**: Real-time updates via GitHub webhooks
- **Progress Tracking**: Comprehensive metrics and progress reporting
- **Event System**: Track and replay project events

### Agent Orchestration (16 compound tools)
- **Compound Tool API**: 16 tools with `action` routing replace 131 individual tools — simpler for AI agents
- **Agent Registry**: Register, list, and deregister autonomous AI agents
- **Task Checkout**: Claim tasks with configurable selection strategies (priority, age, skills, deadline)
- **Heartbeat Monitoring**: Periodic liveness and progress reporting with stale-agent detection
- **Work Product Tracking**: Submit code changes, PRs, test results, and review artifacts
- **Budget Enforcement**: Per-agent token budgets with warning thresholds and hard stops
- **Activity Dashboard**: Real-time view of all agent statuses, tasks, and budget consumption
- **Subagent Hierarchy**: Parent-child agent relationships with cascade deregistration
- **Runtime Discovery**: `discover_tools` meta-tool for exploring available actions and schemas

## Installation

### Option 1: Install from npm (recommended)

```bash
# Install the package globally
npm install -g mcp-github-project-manager

# Or install in your project
npm install mcp-github-project-manager
```

### Option 2: Install from source

```bash
# Clone the repository
git clone https://github.com/kunwarVivek/mcp-github-project-manager.git
cd mcp-github-project-manager

# Install dependencies
npm install
# or
pnpm install

# Build the project
npm run build
```

### Set up environment variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your GitHub token and details
```

## Configuration

### Required Environment Variables

#### GitHub Configuration
```env
GITHUB_TOKEN=your_github_token
GITHUB_OWNER=repository_owner
GITHUB_REPO=repository_name
```

The GitHub token requires these permissions:
- `repo` (Full repository access)
- `project` (Project access)
- `write:org` (Organization access)

#### AI Provider Configuration
At least one AI provider is required for AI-powered features:

```env
# Primary AI providers (at least one required)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_API_KEY=your_google_api_key_here
PERPLEXITY_API_KEY=your_perplexity_api_key_here

# AI Model Configuration (optional - uses defaults if not specified)
AI_MAIN_MODEL=claude-3-5-sonnet-20241022
AI_RESEARCH_MODEL=perplexity-llama-3.1-sonar-large-128k-online
AI_FALLBACK_MODEL=gpt-4o
AI_PRD_MODEL=claude-3-5-sonnet-20241022

# AI Task Generation Configuration (optional)
MAX_TASKS_PER_PRD=50
DEFAULT_COMPLEXITY_THRESHOLD=7
MAX_SUBTASK_DEPTH=3
AUTO_DEPENDENCY_DETECTION=true
AUTO_EFFORT_ESTIMATION=true

# Enhanced Task Context Generation Configuration (optional)
ENHANCED_TASK_GENERATION=true
AUTO_CREATE_TRACEABILITY=true
AUTO_GENERATE_USE_CASES=true
AUTO_CREATE_LIFECYCLE=true
ENHANCED_CONTEXT_LEVEL=standard
INCLUDE_BUSINESS_CONTEXT=false
INCLUDE_TECHNICAL_CONTEXT=false
INCLUDE_IMPLEMENTATION_GUIDANCE=false

# Security, secrets, webhooks & cache (optional)
SECRETS_DIR=/run/secrets          # load secrets from mounted files (Docker/k8s); takes precedence over env vars
WEBHOOK_SECRET=your_webhook_secret
WEBHOOK_ALLOW_UNSIGNED=false       # fail closed: reject unsigned webhooks unless explicitly enabled (dev only)
WEBHOOK_PORT=3001
MAX_CACHE_ENTRIES=10000            # in-memory cache cap before oldest-first eviction
```

See the [Configuration Guide](docs/CONFIGURATION.md) for the complete list.

### AI Provider Setup

#### Anthropic Claude
1. Sign up at [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Set `ANTHROPIC_API_KEY` in your environment

#### OpenAI
1. Sign up at [OpenAI Platform](https://platform.openai.com/)
2. Create an API key
3. Set `OPENAI_API_KEY` in your environment

#### Google Gemini
1. Sign up at [Google AI Studio](https://aistudio.google.com/)
2. Create an API key
3. Set `GOOGLE_API_KEY` in your environment

#### Perplexity
1. Sign up at [Perplexity API](https://www.perplexity.ai/settings/api)
2. Create an API key
3. Set `PERPLEXITY_API_KEY` in your environment

## Usage

### As a command-line tool

If installed globally:

```bash
# Start the MCP server using stdio transport
mcp-github-project-manager

# Start with environment variables
GITHUB_TOKEN=your_token mcp-github-project-manager

# Start with command line arguments
mcp-github-project-manager --token=your_token --owner=your_username --repo=your_repo

# Use a specific .env file
mcp-github-project-manager --env-file=.env.production

# Show verbose output
mcp-github-project-manager --verbose

# Display help information
mcp-github-project-manager --help
```

### Running from source with TypeScript

If you're developing or running from source:

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

#### Command Line Options

| Option | Short | Description |
|--------|-------|-------------|
| `--token <token>` | `-t` | GitHub personal access token |
| `--owner <owner>` | `-o` | GitHub repository owner (username or organization) |
| `--repo <repo>` | `-r` | GitHub repository name |
| `--env-file <path>` | `-e` | Path to .env file (default: .env in project root) |
| `--verbose` | `-v` | Enable verbose logging |
| `--help` | `-h` | Display help information |
| `--version` | | Display version information |

Command line arguments take precedence over environment variables.

### As a Node.js module

```javascript
import { Server } from "mcp-github-project-manager";

// Create and start an MCP server instance
const server = new Server({
  transport: "stdio", // or "http" for HTTP server
  config: {
    githubToken: process.env.GITHUB_TOKEN,
    githubOwner: process.env.GITHUB_OWNER,
    githubRepo: process.env.GITHUB_REPO
  }
});

server.start();
```

### Integration with MCP clients

```javascript
// Example using an MCP client library
import { McpClient } from "@modelcontextprotocol/client";
import { spawn } from "child_process";

// Create a child process running the MCP server
const serverProcess = spawn("mcp-github-project-manager", [], {
  env: { ...process.env, GITHUB_TOKEN: "your_token" }
});

// Connect the MCP client to the server
const client = new McpClient({
  transport: {
    type: "process",
    process: serverProcess
  }
});

// Call MCP tools (compound API)
const result = await client.callTool("manage_project", {
  action: "create",
  title: "My Project",
  owner: "myorg"
});
```

For more examples, see the [User Guide](docs/user-guide.md) and the [examples/](examples/) directory.

### Compound Tool API Examples

The MCP server exposes 16 compound tools (134 actions). Each tool accepts an `action` parameter that routes to the underlying operation. Use `discover_tools` to explore capabilities at runtime.

#### Quick Start Workflow
```json
// 1. Create a project
{"tool": "manage_project", "arguments": {"action": "create", "title": "My Project", "owner": "myorg"}}

// 2. Create an issue
{"tool": "manage_issues", "arguments": {"action": "create", "title": "First Issue", "body": "Description here"}}

// 3. Register an AI agent
{"tool": "agent_work", "arguments": {"action": "register", "name": "claude-eng-1", "role": "engineer"}}

// 4. Agent checks out a task
{"tool": "agent_work", "arguments": {"action": "checkout_task", "agentId": "agent-abc123", "strategy": "highest_priority"}}

// 5. Discover available tools at runtime
{"tool": "discover_tools", "arguments": {}}
{"tool": "discover_tools", "arguments": {"group": "manage_issues", "action": "create", "includeSchemas": true}}
```

#### AI-Powered Project Workflow
```json
// 1. Generate PRD from project idea
{"tool": "ai_generate", "arguments": {"action": "generate_prd", "projectIdea": "AI-powered task management with real-time collaboration", "projectName": "TaskAI Pro", "complexity": "high"}}

// 2. Parse PRD into tasks with traceability
{"tool": "ai_generate", "arguments": {"action": "parse_prd", "prdContent": "<generated PRD>", "maxTasks": 30, "createTraceabilityMatrix": true}}

// 3. Get next task recommendations
{"tool": "ai_generate", "arguments": {"action": "get_next_task", "sprintCapacity": 40, "teamSkills": ["react", "node.js", "typescript"]}}

// 4. Analyze task complexity
{"tool": "ai_generate", "arguments": {"action": "analyze_complexity", "taskTitle": "Implement real-time collaboration", "includeRisks": true}}

// 5. Break down complex tasks
{"tool": "ai_generate", "arguments": {"action": "expand_task", "taskTitle": "Build analytics dashboard", "currentComplexity": 8, "targetComplexity": 3}}
```

#### Feature Addition Workflow
```json
// Add new feature with complete lifecycle
{"tool": "ai_generate", "arguments": {"action": "add_feature", "featureIdea": "Advanced Analytics Dashboard", "description": "Real-time analytics with AI insights", "expandToTasks": true}}
// Automatically creates: business requirements, use cases, tasks with traceability, lifecycle tracking

// Create traceability matrix
{"tool": "ai_generate", "arguments": {"action": "create_traceability_matrix", "projectId": "task-ai-pro", "validateCompleteness": true}}
```

#### Tool Discovery
```json
// List all 16 compound tools
{"tool": "discover_tools", "arguments": {}}

// Explore a specific tool's actions
{"tool": "discover_tools", "arguments": {"group": "ai_generate"}}

// Get full schema for a specific action
{"tool": "discover_tools", "arguments": {"group": "ai_generate", "action": "generate_prd", "includeSchemas": true}}
```

#### MCP_TOOL_GROUPS Configuration

Control which compound tools are exposed to MCP clients:
```bash
# Default: all tools exposed
MCP_TOOL_GROUPS=all

# Expose only project management tools
MCP_TOOL_GROUPS=core

# Add AI tools
MCP_TOOL_GROUPS=core,ai
```

`discover_tools` is always available regardless of this setting.

**Context Generation Levels:**
- **Minimal**: Basic traceability context only (fastest)
- **Standard**: Traceability + basic business context (default)
- **Full**: Complete AI-enhanced context with implementation guidance

### 🧪 Testing Enhanced Context Generation

The enhanced context generation functionality includes comprehensive test coverage:

#### **Test Files Created:**
- `src/__tests__/TaskContextGenerationService.test.ts` - Core context generation service tests
- `src/__tests__/TaskGenerationService.enhanced.test.ts` - Enhanced task generation integration tests
- `src/__tests__/ParsePRDTool.enhanced.test.ts` - Tool-level context generation tests

#### **Test Coverage:**
- **Traceability-based context generation** (default behavior)
- **AI-enhanced context generation** (when AI is available)
- **Graceful fallback** when AI services are unavailable
- **Configuration validation** and environment variable handling
- **Error handling** and resilience testing
- **Integration testing** with existing task generation pipeline

#### **Running Context Generation Tests:**
```bash
# Run all AI-related tests (includes context generation)
npm run test:ai

# Run specific context generation tests
npm test -- --testPathPattern="TaskContextGeneration"
npm test -- --testPathPattern="enhanced"

# Run all tests
npm test
```

## 🧪 Comprehensive E2E Testing Suite

The MCP GitHub Project Manager includes a comprehensive end-to-end testing suite that tests all MCP tools through the actual MCP interface with both mocked and real API calls.

### **Test Coverage:**
- ✅ **40+ GitHub Project Management Tools** - Complete CRUD operations for projects, milestones, issues, sprints, labels, and more
- ✅ **8 AI Task Management Tools** - PRD generation, task parsing, complexity analysis, feature management, and traceability
- ✅ **Complex Workflow Integration** - Multi-tool workflows and real-world project management scenarios
- ✅ **Real API Testing** - Optional testing with actual GitHub and AI APIs
- ✅ **Schema Validation** - Comprehensive argument validation for all tools
- ✅ **Error Handling** - Graceful error handling and recovery testing

### **Quick Start:**
```bash
# Run comprehensive E2E tests (mocked APIs)
npm run test:e2e:tools

# Run with real APIs (requires credentials)
npm run test:e2e:tools:real

# Use the interactive test runner
npm run test:e2e:runner

# Run specific test categories
npm run test:e2e:tools:github     # GitHub tools only
npm run test:e2e:tools:ai         # AI tools only
npm run test:e2e:tools:workflows  # Integration workflows
```

### **Test Runner Options:**
```bash
# Interactive test runner with options
node scripts/run-e2e-tests.js --help

# Examples:
node scripts/run-e2e-tests.js --real-api --github-only
node scripts/run-e2e-tests.js --build --verbose --timeout 120
node scripts/run-e2e-tests.js --ai-only --real-api
```

### **Environment Setup for Real API Testing:**

**GitHub API (Required for GitHub tools):**
```bash
GITHUB_TOKEN=ghp_your_github_token
GITHUB_OWNER=your-github-username
GITHUB_REPO=your-test-repository
```

**AI APIs (Required for AI tools):**
```bash
# At least one AI API key required
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
OPENAI_API_KEY=sk-your-openai-key
GOOGLE_API_KEY=your-google-ai-key
PERPLEXITY_API_KEY=pplx-your-perplexity-key
```

**Enable Real API Testing:**
```bash
E2E_REAL_API=true npm run test:e2e:tools:real
```

### **Test Features:**
- **Tool Registration Validation** - Verify all tools are properly registered with correct schemas
- **MCP Protocol Compliance** - Ensure all tools follow MCP specification
- **Response Format Validation** - Validate tool responses match expected formats
- **Workflow Integration Testing** - Test complex multi-tool workflows
- **Credential Management** - Graceful handling of missing credentials
- **Performance Monitoring** - Track tool execution performance
- **Comprehensive Error Testing** - Validate error handling and recovery

### **Documentation:**
- 📖 [Comprehensive E2E Testing Guide](docs/e2e-testing-guide.md) - Detailed testing documentation
- 🔧 [Test Configuration](jest.e2e.tools.config.js) - Jest configuration for E2E tests
- 🛠️ [Test Utilities](src/__tests__/e2e/utils/MCPToolTestUtils.ts) - Reusable test utilities

The E2E test suite ensures that all MCP tools work correctly both individually and in complex workflows, providing confidence in the reliability and integration of the entire system.

#### **Test Scenarios Covered:**
- ✅ Default traceability-based context (no AI required)
- ✅ AI-enhanced business context generation
- ✅ AI-enhanced technical context generation
- ✅ Implementation guidance generation
- ✅ Context merging and conflict resolution
- ✅ Error handling and graceful degradation
- ✅ Configuration validation and defaults
- ✅ Tool-level parameter validation
- ✅ Integration with existing traceability system

### Installing in AI Assistants

#### Install in Claude

To install the MCP server in Claude Desktop:

```json
{
  "mcpServers": {
    "github-project-manager": {
      "command": "npx",
      "args": ["-y", "mcp-github-project-manager"],
      "env": {
        "GITHUB_TOKEN": "your_github_token",
        "GITHUB_OWNER": "your_username",
        "GITHUB_REPO": "your_repo",
        "ANTHROPIC_API_KEY": "your_anthropic_api_key",
        "OPENAI_API_KEY": "your_openai_api_key",
        "GOOGLE_API_KEY": "your_google_api_key",
        "PERPLEXITY_API_KEY": "your_perplexity_api_key"
      }
    }
  }
}
```

For Claude Code CLI, run:

```bash
claude mcp add github-project-manager -- npx -y mcp-github-project-manager
```

#### Install in Roocode

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

#### Install in Windsurf

Add this to your Windsurf MCP config file:

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

See [Windsurf MCP docs](https://docs.windsurf.com/windsurf/mcp) for more information.

#### Install in VS Code

Add this to your VS Code MCP config file:

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

See [VS Code MCP docs](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) for more information.

#### Install in Cursor

Add this to your Cursor MCP config file:

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

See [Cursor MCP docs](https://docs.cursor.com/context/model-context-protocol) for more information.

#### Using Docker

If you prefer to run the MCP server in a Docker container:

1. **Build the Docker Image:**

```bash
docker build -t mcp-gh-project .
```

2. **Run the container:**

```bash
docker run -d \
  -e GITHUB_TOKEN=your_github_token \
  -e GITHUB_OWNER=your_github_owner \
  -e GITHUB_REPO=your_repository_name \
  mcp-gh-project:latest
```

Or with CLI arguments:

```bash
docker run -d mcp-gh-project:latest \
  --github_token your_github_token \
  --github_owner your_owner \
  --github_repo your_repo
```

3. **Configure Your MCP Client:**

```json
{
  "mcpServers": {
    "github-project-manager": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "GITHUB_TOKEN", "-e", "GITHUB_OWNER", "-e", "GITHUB_REPO", "mcp-gh-project:latest"],
      "env": {
        "GITHUB_TOKEN": "your_token",
        "GITHUB_OWNER": "your_owner",
        "GITHUB_REPO": "your_repo"
      }
    }
  }
}
```
         "env": {
           "GITHUB_TOKEN": "your_github_token",
           "GITHUB_OWNER": "your_username",
           "GITHUB_REPO": "your_repo"
         }
       }
     }
   }
   ```

### Troubleshooting

#### Common Issues

1. **Module Not Found Errors**

   If you encounter module resolution issues, try using `bunx` instead of `npx`:

   ```json
   {
     "mcpServers": {
       "github-project-manager": {
         "command": "bunx",
         "args": ["-y", "mcp-github-project-manager"]
       }
     }
   }
   ```

2. **Windows-Specific Configuration**

   On Windows, you may need to use `cmd` to run the command:

   ```json
   {
     "mcpServers": {
       "github-project-manager": {
         "command": "cmd",
         "args": [
           "/c",
           "npx",
           "-y",
           "mcp-github-project-manager"
         ]
       }
     }
   }
   ```

3. **Permission Issues**

   If you encounter permission issues, make sure your GitHub token has the required permissions listed in the Configuration section.

## Agent Orchestration

The agent orchestration layer enables autonomous AI agents (Claude Code, Codex, Cursor, etc.) to self-assign tasks, report progress, submit work products, and operate within token budgets — all backed by GitHub-native storage.

### How It Works

Agents interact with the orchestration layer through two compound tools — `agent_work` (task lifecycle) and `agent_manage` (administration):

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Agent Orchestration Layer                        │
│                                                                     │
│  ┌───────────┐  ┌──────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │  Agent     │  │  Task        │  │  Work       │  │  Budget    │  │
│  │  Registry  │  │  Checkout    │  │  Products   │  │  Manager   │  │
│  └───────────┘  └──────────────┘  └─────────────┘  └────────────┘  │
│         │              │                │                │          │
│         ▼              ▼                ▼                ▼          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │           GitHub-Native Storage (Issues + Projects)         │    │
│  │  • Agent registry → pinned issue (label: agent-registry)   │    │
│  │  • Task claims   → project custom fields                   │    │
│  │  • Work products → structured issue comments               │    │
│  │  • Budgets       → agent registry metadata                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Agent Compound Tools

| Tool | Action | Purpose |
|------|--------|---------|
| `agent_work` | `register` | Register an AI agent with role, runtime, and capabilities |
| `agent_work` | `checkout_task` | Claim the next available task using a selection strategy |
| `agent_work` | `release_task` | Return a task to the pool (blocked, wrong skills, etc.) |
| `agent_work` | `complete_task` | Mark a task as completed with a summary |
| `agent_work` | `heartbeat` | Report liveness, progress %, branch, and blockers |
| `agent_work` | `check_work_status` | Check the review/merge status of submitted work |
| `agent_work` | `get_task_context` | Get enriched context for a task |
| `agent_manage` | `list` | List registered agents, filter by role or status |
| `agent_manage` | `deregister` | Remove an agent from the registry |
| `agent_manage` | `get_activity` | Dashboard of all agents: tasks, progress, heartbeat, budget |
| `agent_manage` | `submit_work_product` | Submit code changes with branch, PR, files, and test results |
| `agent_manage` | `get_budget` | Check an agent's token budget (used, remaining, warnings) |
| `agent_manage` | `set_budget` | Configure token budget, warning threshold, hard stop, reset period |

### Quick Start: Autonomous Agent Loop

```json
// 1. Register the agent
{"tool": "agent_work", "arguments": {"action": "register", "name": "claude-eng-1", "role": "engineer", "runtime": "claude-code", "capabilities": ["typescript", "react", "testing"]}}
// → { id: "agent-abc123", status: "idle", ... }

// 2. Check out a task
{"tool": "agent_work", "arguments": {"action": "checkout_task", "agentId": "agent-abc123", "strategy": "highest_priority"}}
// → { success: true, issueNumber: 42, issueTitle: "Add login form", branchSuggestion: "feat/42-add-login-form" }

// 3. Get full context
{"tool": "agent_work", "arguments": {"action": "get_task_context", "issueNumber": 42}}
// → { issue: {...}, milestone: {...}, acceptanceCriteria: [...], codingStandards: "..." }

// 4. Work on the task, sending heartbeats periodically
{"tool": "agent_work", "arguments": {"action": "heartbeat", "agentId": "agent-abc123", "status": "working", "taskId": "issue-42", "progress": 60, "progressSummary": "Tests passing, working on edge cases", "currentBranch": "feat/42-add-login-form"}}

// 5. Submit the work product
{"tool": "agent_manage", "arguments": {"action": "submit_work_product", "agentId": "agent-abc123", "taskId": "issue-42", "issueNumber": 42, "branch": "feat/42-add-login-form", "prNumber": 99, "summary": "Added login form with email/password validation"}}

// 6. Complete the task
{"tool": "agent_work", "arguments": {"action": "complete_task", "agentId": "agent-abc123", "taskId": "issue-42", "summary": "Implemented login form with validation and tests"}}

// 7. Repeat: checkout next task
{"tool": "agent_work", "arguments": {"action": "checkout_task", "agentId": "agent-abc123", "strategy": "highest_priority"}}
```

### Subagent Hierarchy

Agents can register child agents using `parentAgentId`. This enables multi-agent architectures:

```json
// Parent agent registers itself
{"tool": "agent_work", "arguments": {"action": "register", "name": "lead-agent", "role": "pm", "runtime": "claude-code"}}
// → { id: "agent-lead" }

// Parent spawns a sub-agent
{"tool": "agent_work", "arguments": {"action": "register", "name": "worker-1", "role": "engineer", "runtime": "claude-code", "parentAgentId": "agent-lead", "capabilities": ["typescript", "testing"]}}

// Deregistering the parent cascades to all children
{"tool": "agent_manage", "arguments": {"action": "deregister", "agentId": "agent-lead"}}
// → Removes lead-agent and worker-1
```

### Budget Enforcement

Token budgets prevent runaway AI costs:

```json
// Set a daily budget with 80% warning
{"tool": "agent_manage", "arguments": {"action": "set_budget", "agentId": "agent-abc123", "totalTokens": 500000, "warningThreshold": 0.8, "hardStop": true, "resetPeriod": "daily"}}

// Check budget status before expensive operations
{"tool": "agent_manage", "arguments": {"action": "get_budget", "agentId": "agent-abc123"}}
// → { usedTokens: 350000, remainingTokens: 150000, usagePercent: 70, isWarning: false, isExhausted: false }
```

### GitHub-Native Data Model

All orchestration state lives in your GitHub repository — no external database required:

| Data | Storage | Details |
|------|---------|---------|
| Agent registry | Pinned issue | JSON body on an issue labeled `agent-registry` |
| Task claims | Project custom fields | `agent_claimed_by`, `agent_claimed_at`, `agent_status`, `agent_work_branch`, `agent_pr_number` |
| Work products | Issue comments | Structured comments with `<!-- agent-work-product: -->` markers |
| Budgets | Agent metadata | Stored in the agent registry alongside each agent record |
| Heartbeats | Agent metadata | `lastHeartbeat` timestamp on the agent record |

### Configuration

| Constant | Default | Description |
|----------|---------|-------------|
| Heartbeat timeout | 30 minutes | Agent is considered stale after this period |
| Default budget | 500,000 tokens | Initial token budget per agent |
| Registry label | `agent-registry` | GitHub issue label for the agent registry |

See the [Tool Reference](docs/TOOLS.md#agent-orchestration-tools) for detailed parameter documentation.


## Architecture

The server follows Clean Architecture principles with distinct layers:

- **Domain Layer**: Core entities, repository interfaces, and Zod schemas
- **Infrastructure Layer**: GitHub API integration and implementations
- **Service Layer**: Business logic coordination
- **MCP Layer**: Tool definitions and request handling

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## References

- [Model Context Protocol](https://modelcontextprotocol.io)
- [GitHub Projects API](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects)

## Current Status

### Core Features
| Feature | Status | Notes |
|---------|--------|-------|
| Project Creation | ✅ Complete | Full support for v2 projects |
| Milestone Management | ✅ Complete | CRUD operations implemented |
| Sprint Planning | ✅ Complete | Including metrics tracking |
| Issue Management | ✅ Complete | With custom fields support |
| Resource Versioning | ✅ Complete | With optimistic locking and schema validation |
| Webhook Integration | ✅ Complete | Real-time updates; fail-closed HMAC signature validation + SSE streaming |

### AI-Powered Features
| Feature | Status | Notes |
|---------|--------|-------|
| PRD Generation | ✅ Complete | Multi-provider AI support with comprehensive PRD creation |
| Task Generation | ✅ Complete | AI-powered parsing of PRDs into actionable tasks |
| Feature Addition | ✅ Complete | Smart feature addition with impact analysis |
| Task Complexity Analysis | ✅ Complete | Detailed AI analysis with risk assessment |
| Task Recommendations | ✅ Complete | AI-powered next task recommendations |
| Task Expansion | ✅ Complete | Break down complex tasks into subtasks |
| PRD Enhancement | ✅ Complete | AI-powered PRD improvement and gap analysis |
| Requirements Traceability | ✅ Complete | End-to-end traceability matrix with coverage analysis |

### Requirements Traceability
| Feature | Status | Notes |
|---------|--------|-------|
| Business Requirements Extraction | ✅ Complete | Extract from PRD objectives and success metrics |
| Use Case Generation | ✅ Complete | Actor-goal-scenario structure with alternatives |
| Traceability Links | ✅ Complete | Bidirectional links with impact analysis |
| Coverage Analysis | ✅ Complete | Gap identification and orphaned task detection |
| Change Tracking | ✅ Complete | Requirement change impact analysis |
| Verification Tracking | ✅ Complete | Test case mapping and verification status |

### MCP Implementation
| Component | Status | Notes |
|-----------|--------|-------|
| Tool Definitions | ✅ Complete | All core tools implemented with Zod validation |
| Resource Management | ✅ Complete | Full CRUD operations with versioning |
| Security | ✅ Complete | Token validation, fail-closed webhook signatures, file-mounted secrets (`SECRETS_DIR`) |
| Error Handling | ✅ Complete | According to MCP specifications |
| Transport | ✅ Complete | Stdio and HTTP support |

See [.planning/STATUS.md](.planning/STATUS.md) for detailed implementation status.
| Resource Management | ✅ Complete | With optimistic locking and relationship tracking |
| Response Handling | ✅ Complete | Rich content formatting with multiple content types |
| Error Handling | ✅ Complete | Comprehensive error mapping to MCP error codes |
| State Management | ✅ Complete | With conflict resolution and rate limiting |

### Recent Improvements

- **Dependency & SDK modernization (2026-07-15)**:
  - Migrated to Vercel AI SDK v5 and Zod v4 (coupled upgrade; MCP SDK 1.29 accepts Zod 4)
  - Aligned Octokit type packages with `@octokit/rest` 22
  - Cleared the critical Handlebars vulnerability and all high-severity advisories

- **Architecture & reliability (2026-07-15)**:
  - Decomposed the `ProjectManagementService` facade (extracted `IssueService`, `RoadmapService`; automation delegates to `ProjectAutomationService`)
  - Broke a circular dependency; health check now performs a real GitHub rate-limit probe
  - Fail-closed webhook signature validation; file-mounted secrets (`SECRETS_DIR`) with rotation
  - Size-bounded cache eviction (`MAX_CACHE_ENTRIES`) and a namespace-index cleanup fix

- **Enhanced Resource System**:
  - Added Zod schema validation for all resource types
  - Implemented resource relationship tracking
  - Created a centralized ResourceFactory for consistent resource access

- **Improved GitHub API Integration**:
  - Added intelligent rate limiting with automatic throttling
  - Implemented pagination support for REST and GraphQL APIs
  - Enhanced error handling with specific error types

- **Advanced Tool System**:
  - Created tool definition registry with Zod validation
  - Implemented standardized tool response formatting
  - Added example-based documentation for all tools

- **Rich Response Formatting**:
  - Added support for multiple content types (JSON, Markdown, HTML, Text)
  - Implemented progress updates for long-running operations
  - Added pagination support for large result sets

### Identified Functional Gaps

Remaining gaps prioritized for future development (updated 2026-07-15). The live,
code-verified status is in [`docs/remediation/GAP-TRACKER.md`](docs/remediation/GAP-TRACKER.md).

1. **Distributed Caching**:
   - ResourceCache now has persistence (`CachePersistence`) and size-bounded
     oldest-first eviction (`MAX_CACHE_ENTRIES`). Still single-instance only —
     no distributed/shared cache for multi-instance deployments.

2. **Performance Optimization**:
   - No query batching for related resources
   - Missing background refresh for frequently accessed resources
   - Incomplete prefetching for related resources

3. **Data Visualization and Reporting** (roadmap phase 11, not yet built):
   - No built-in visualization generators for metrics
   - Missing report generation capabilities
   - Limited time-series data analysis

Resolved since earlier snapshots: real-time webhook integration + SSE streaming,
automation-rule management, cache persistence + eviction, and a fail-closed
webhook signature check.

## Documentation

### Getting Started
- [Deployment Guide](docs/deployment.md) - Installation, Docker, and MCP client setup
- [Configuration Guide](docs/CONFIGURATION.md) - All configuration options
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md) - Common issues and solutions

### Reference
- [Tool Reference](docs/TOOLS.md) - 16 compound tools (134 actions) documented
- [Architecture](docs/architecture.md) - System design and patterns
- [API Reference](docs/API.md) - Service and infrastructure APIs

### Guides
- [Tutorials](docs/tutorials/getting-started.md) - Step-by-step guides
- [User Guide](docs/user-guide.md) - Detailed usage instructions
- [Testing Guide](docs/TESTING.md) - Test suite documentation

### Development
- [Contributing](docs/contributing/index.md) - Development guidelines
- [MCP Integration](docs/mcp/) - MCP-specific details

### Interactive Documentation

For an interactive exploration of the API, open the [API Explorer](docs/api-explorer.html) in your browser.

## Development

### Testing
```bash
# Unit tests
npm test

# AI service/tool tests
npm run test:ai

# End-to-end tests
npm run test:e2e

# E2E MCP tool suite (mocked GitHub/AI)
npm run test:e2e:tools
```

### Code Quality
```bash
# Lint code
npm run lint

# Type check
npx tsc --noEmit

# Format code
npm run format
```

## Contributing

We welcome contributions to the GitHub Project Manager MCP Server! Please see our [Contributing Guide](docs/contributing/index.md) for details on:

- [Development Workflow](docs/contributing/development-workflow.md)
- [Code Standards](docs/contributing/index.md#coding-standards)
- [Testing Guidelines](docs/contributing/index.md#testing-guidelines)
- [Documentation Guidelines](docs/contributing/index.md#documentation-guidelines)

## License

[MIT](LICENSE)
