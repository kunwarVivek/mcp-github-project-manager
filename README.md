# MCP GitHub Project Manager

A comprehensive Model Context Protocol (MCP) server that provides advanced GitHub project management capabilities with **AI-powered task management** and **complete requirements traceability**. Transform your project ideas into actionable tasks with full end-to-end tracking from business requirements to implementation.

[![npm version](https://img.shields.io/npm/v/mcp-github-project-manager.svg)](https://www.npmjs.com/package/mcp-github-project-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/mcp-github-project-manager.svg)](https://nodejs.org/)

## Overview

This server implements the [Model Context Protocol](https://modelcontextprotocol.io) to provide comprehensive GitHub project management with advanced AI capabilities. Beyond traditional project management, it offers AI-powered task generation, requirements traceability, and intelligent project planning through GitHub's GraphQL API while maintaining state and handling errors according to MCP specifications.

### 🚀 What Makes This Special

- **AI-Powered**: Transform project ideas into comprehensive PRDs and actionable tasks using multiple AI providers
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

For more details on Docker usage, see [DOCKER.md](DOCKER.md).

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
```

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

// Call MCP tools
const result = await client.callTool("create_project", {
  title: "My Project",
  description: "A new GitHub project"
});
```

For more examples, see the [User Guide](docs/user-guide.md) and the [examples/](examples/) directory.

### AI Tools Usage Examples

#### Complete Project Workflow
```bash
# 1. Generate PRD from project idea
generate_prd({
  "projectIdea": "AI-powered task management system with real-time collaboration",
  "projectName": "TaskAI Pro",
  "author": "product-team",
  "complexity": "high",
  "timeline": "6 months",
  "includeResearch": true
})

# 2. Parse PRD and generate tasks with traceability
parse_prd({
  "prdContent": "<generated PRD content>",
  "maxTasks": 30,
  "createTraceabilityMatrix": true,
  "includeUseCases": true,
  "projectId": "task-ai-pro"
})

# 3. Get next task recommendations
get_next_task({
  "sprintCapacity": 40,
  "teamSkills": ["react", "node.js", "typescript"],
  "maxComplexity": 7,
  "includeAnalysis": true
})

# 4. Analyze complex tasks
analyze_task_complexity({
  "taskTitle": "Implement real-time collaboration",
  "taskDescription": "Build WebSocket-based real-time collaboration with conflict resolution",
  "teamExperience": "mixed",
  "includeBreakdown": true,
  "includeRisks": true
})

# 5. Break down complex tasks
expand_task({
  "taskTitle": "Build analytics dashboard",
  "taskDescription": "Create comprehensive analytics dashboard with AI insights",
  "currentComplexity": 8,
  "targetComplexity": 3,
  "includeEstimates": true,
  "includeDependencies": true
})
```

#### Feature Addition Workflow
```bash
# Add new feature with complete lifecycle
add_feature({
  "featureIdea": "Advanced Analytics Dashboard",
  "description": "Real-time analytics with custom charts and AI-powered insights",
  "requestedBy": "product-manager",
  "businessJustification": "Increase user engagement and provide actionable insights",
  "targetUsers": ["project-managers", "team-leads", "executives"],
  "autoApprove": true,
  "expandToTasks": true,
  "createLifecycle": true
})

# This automatically creates:
# ✅ Business requirement analysis
# ✅ Use cases with actor-goal-scenario structure
# ✅ Tasks with complete traceability links
# ✅ Lifecycle tracking for all tasks
```

#### Requirements Traceability
```bash
# Create comprehensive traceability matrix
create_traceability_matrix({
  "projectId": "task-ai-pro",
  "prdContent": "<PRD content>",
  "features": [...],
  "tasks": [...],
  "validateCompleteness": true
})

# Output includes:
# ✅ Business Requirements → Features → Use Cases → Tasks
# ✅ Bidirectional traceability links
# ✅ Coverage analysis with gap identification
# ✅ Orphaned task detection
# ✅ Unimplemented requirement tracking
```

#### Enhanced Task Context Generation
```bash
# Default: Traceability-based context (fast, no AI required)
parse_prd({
  "prdContent": "<PRD content>",
  "enhancedGeneration": true,
  "contextLevel": "standard"
})

# Enhanced: AI-powered comprehensive context
parse_prd({
  "prdContent": "<PRD content>",
  "enhancedGeneration": true,
  "contextLevel": "full",
  "includeBusinessContext": true,
  "includeTechnicalContext": true,
  "includeImplementationGuidance": true
})

# Performance optimized: Minimal context for speed
parse_prd({
  "prdContent": "<PRD content>",
  "enhancedGeneration": true,
  "contextLevel": "minimal",
  "includeBusinessContext": false,
  "includeTechnicalContext": false,
  "includeImplementationGuidance": false
})
```

**Context Generation Levels:**
- **Minimal**: Basic traceability context only (fastest)
- **Standard**: Traceability + basic business context (default)
- **Full**: Complete AI-enhanced context with implementation guidance

**Generated Task Context Includes:**
- **Business Context**: Why the task matters, user impact, success metrics
- **Feature Context**: Parent feature information, user stories, business value
- **Technical Context**: Constraints, architecture decisions, integration points
- **Implementation Guidance**: Step-by-step recommendations, best practices, pitfalls
- **Enhanced Acceptance Criteria**: Detailed verification methods and priorities
- **Contextual References**: Links to relevant PRD sections and technical specs

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

   Create a `Dockerfile` in your project directory:

   ```dockerfile
   FROM node:18-alpine

   WORKDIR /app

   # Install the package globally
   RUN npm install -g mcp-github-project-manager

   # Default command to run the server
   CMD ["mcp-github-project-manager"]
   ```

   Build the image:

   ```bash
   docker build -t github-project-manager-mcp .
   ```

2. **Configure Your MCP Client:**

   Update your MCP client's configuration to use the Docker command:

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

## Architecture

The server follows Clean Architecture principles with distinct layers:

- **Domain Layer**: Core entities, repository interfaces, and Zod schemas
- **Infrastructure Layer**: GitHub API integration and implementations
- **Service Layer**: Business logic coordination
- **MCP Layer**: Tool definitions and request handling

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

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
- [Project Roadmap](ROADMAP.md)

## Current Status

### Core Features
| Feature | Status | Notes |
|---------|--------|-------|
| Project Creation | ✅ Complete | Full support for v2 projects |
| Milestone Management | ✅ Complete | CRUD operations implemented |
| Sprint Planning | ✅ Complete | Including metrics tracking |
| Issue Management | ✅ Complete | With custom fields support |
| Resource Versioning | ✅ Complete | With optimistic locking and schema validation |
| Webhook Integration | 📅 Planned | Real-time updates |

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
| Security | ✅ Complete | Token validation and scope checking |
| Error Handling | ✅ Complete | According to MCP specifications |
| Transport | ✅ Complete | Stdio and HTTP support |

See [STATUS.md](STATUS.md) for detailed implementation status.
| Resource Management | ✅ Complete | With optimistic locking and relationship tracking |
| Response Handling | ✅ Complete | Rich content formatting with multiple content types |
| Error Handling | ✅ Complete | Comprehensive error mapping to MCP error codes |
| State Management | ✅ Complete | With conflict resolution and rate limiting |

### Recent Improvements

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

Despite the recent improvements, the following functional gaps still exist and are prioritized for future development:

1. **Persistent Caching Strategy**:
   - While the ResourceCache provides in-memory caching, it lacks persistence across server restarts
   - No distributed caching for multi-instance deployments
   - Missing cache eviction policies for memory management

2. **Real-time Event Processing**:
   - No webhook integration for real-time updates from GitHub
   - Missing event-based subscription system for clients
   - Lack of server-sent events (SSE) support for streaming updates

3. **Advanced GitHub Projects v2 Features**:
   - Limited support for custom field types and validation
   - Incomplete integration with GitHub's newer Projects v2 field types
   - Missing automation rule management

4. **Performance Optimization**:
   - No query batching for related resources
   - Missing background refresh for frequently accessed resources
   - Incomplete prefetching for related resources

5. **Data Visualization and Reporting**:
   - No built-in visualization generators for metrics
   - Missing report generation capabilities
   - Limited time-series data analysis

See [docs/mcp/gaps-analysis.md](docs/mcp/gaps-analysis.md) for detailed implementation status.

## Documentation

- [User Guide](docs/user-guide.md) - Detailed usage instructions
- [API Reference](docs/api-reference/index.md) - Comprehensive tool documentation
- [Tutorials](docs/tutorials/getting-started.md) - Step-by-step guides
- [Examples](examples/README.md) - Code examples for common tasks
- [Architecture](ARCHITECTURE.md) - System architecture and design
- [Contributing](docs/contributing/index.md) - Development guidelines
- [MCP Documentation](docs/mcp/) - MCP-specific details

### Interactive Documentation

For an interactive exploration of the API, open the [API Explorer](docs/api-explorer.html) in your browser.

## Development

### Testing
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e
```

### Code Quality
```bash
# Lint code
npm run lint

# Type check
npm run type-check

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
