# Comprehensive E2E Testing Guide for MCP Tools

This guide covers the comprehensive end-to-end testing suite for all MCP (Model Context Protocol) tools in the GitHub Project Manager.

The test runner is **Vitest 5** — there is no Jest config in this project. See
[TESTING.md](TESTING.md) for the full suite layout.

## Overview

The E2E test suite provides comprehensive testing for:
- **The public compound tool surface** — all 20 tools / 169 actions (see [TOOLS.md](TOOLS.md))
- **Complex Workflow Integration** — Multi-tool workflows and real-world scenarios
- **Platform Validation** — Full platform capability testing
- **Real API Testing** - Optional testing with actual GitHub and AI APIs

## The action sweep

The suites below need live GitHub credentials; without them they skip, which
is why CI also runs a credential-free **action sweep**
(`src/__tests__/e2e/tools/action-sweep.e2e.ts`):

```bash
npm run test:e2e:sweep     # every action of every public tool
npm run test:e2e:coverage  # the coverage matrix + the gate
```

It drives the same registry and the same compound executors the server uses,
with the GitHub API stubbed at the HTTP boundary, and asserts per action that
it is routed and that it fails gracefully rather than crashing. The catalog
is derived from the registry at runtime - 20 tools, 169 actions - so the
numbers the README publishes are checked, not assumed.

## Test Structure

```
src/__tests__/e2e/tools/
├── github-project-tools.e2e.ts      # GitHub project management tools
├── ai-task-tools.e2e.ts             # AI-powered task management tools
├── tool-integration-workflows.e2e.ts # Complex multi-tool workflows
├── platform-validation.e2e.ts       # Full platform capability validation
├── agent-orchestration.e2e.ts       # Agent orchestration lifecycle
├── basic-validation.e2e.ts          # Basic protocol validation
├── full-pipeline.e2e.ts             # PRD → issues end-to-end pipeline
└── utils/
    └── MCPToolTestUtils.ts           # Test utilities and helpers
```

## Test Categories

### 1. GitHub Project Management Tools (`github-project-tools.e2e.ts`)

Tests the GitHub-facing compound tools. Each compound tool takes an `action`
parameter, so a "create project" call is `manage_project` with
`action: "create"`.

**Project tools** (`manage_project`):
- `create`, `list`, `get`, `update`, `delete`
- `create_field`, `list_fields`, `update_field`
- `create_view`, `list_views`, `update_view`, `delete_view`
- `add_item`, `remove_item`, `list_items`, `filter_items`
- `set_field_value`, `get_field_value`, `clear_field_value`

**Milestone tools** (`manage_milestones`):
- `create`, `list`, `update`, `delete`, `get_metrics`, `get_overdue`, `get_upcoming`

**Issue tools** (`manage_issues`):
- `create`, `list`, `get`, `update`, `create_comment`, `list_comments`, `search_advanced`

**Sprint tools** (`manage_sprints`):
- `create`, `list`, `get_current`, `update`, `add_issues`, `remove_issues`, `get_metrics`, `plan`

**Roadmap and planning tools**:
- `ai_generate/parse_prd`, `ai_generate/materialize_tasks`
- `manage_milestones/get_metrics`, `manage_sprints/get_metrics`
- `manage_milestones/get_overdue`, `manage_milestones/get_upcoming`

**Label tools** (`manage_labels`):
- `create`, `list`

### 2. AI Task Management Tools (`ai-task-tools.e2e.ts`)

Tests the AI compound tools.

**PRD Generation** (`ai_generate`):
- `generate_prd` - Generate Product Requirements Documents from ideas
- `enhance_prd` - Enhance existing PRDs with additional details
- `parse_prd` - Parse PRDs and generate tasks

**Task Management** (`ai_generate`):
- `get_next_task` - Get task recommendations for teams
- `analyze_complexity` - Analyze and score task complexity
- `expand_task` - Break down tasks into subtasks

**Feature Management** (`ai_generate`):
- `add_feature` - Add new features to existing projects

**Requirements Traceability** (`ai_generate`):
- `create_traceability_matrix` - Create comprehensive traceability matrices

### 3. Tool Integration Workflows (`tool-integration-workflows.e2e.ts`)

Tests complex workflows combining multiple tools:

**Complete Project Setup Workflow:**
1. Generate PRD from project idea
2. Create GitHub project
3. Parse PRD to generate tasks
4. Create milestones and issues
5. Plan sprints with task assignments

**AI-Enhanced Project Management:**
1. Enhance PRDs with technical details
2. Add new features dynamically
3. Generate comprehensive traceability matrices
4. Optimize task recommendations

**Metrics and Monitoring:**
1. Track milestone progress
2. Monitor sprint performance
3. Identify overdue items
4. Generate team recommendations

### 4. Platform Validation (`platform-validation.e2e.ts`)

Comprehensive validation of the full platform capabilities:

**Domain Entities:**
- Project creation with rich metadata
- Milestone with deadline tracking
- Issues with labels and priorities
- Issue status updates

**Agent Orchestration:**
- Agent registration with capabilities
- Task checkout with strategies
- Heartbeat processing
- Work product submission
- Task completion

**Budget Enforcement:**
- Budget setting and checking
- Token usage recording

**Agent Metrics:**
- Activity dashboard
- Aggregate metrics

**Review Workflow:**
- Submit → Approve workflow
- Reviewer agent support

**Sprint Planning:**
- Sprint creation and listing

**Platform Integration:**
- All 20 compound tools accessible
- Domain entities created during test

## Running Tests

All scripts work with both `npm` and `pnpm`.

### Mock Tests (Default)
```bash
# Run all E2E tool tests with mocked APIs
npm run test:e2e:tools

# Run specific test categories
npm run test:e2e:tools:github     # GitHub tools only
npm run test:e2e:tools:ai         # AI tools only
npm run test:e2e:tools:workflows  # Integration workflows only
npm run test:e2e:tools:agent      # Agent orchestration only
npm run test:e2e:tools:platform   # Platform validation only
```

### Real API Tests
```bash
# Run all E2E tool tests with real APIs
npm run test:e2e:tools:real

# Run specific categories with real APIs
npm run test:e2e:tools:real:github
npm run test:e2e:tools:real:ai
npm run test:e2e:tools:real:workflows
npm run test:e2e:tools:real:agent
npm run test:e2e:tools:real:platform

# Run complete test suite (unit + integration + E2E)
npm run test:all:real
```

Real-API runs consume your GitHub rate limit — use a dedicated test repository.

## Environment Setup

### Required Environment Variables

**For GitHub API Testing:**
```bash
GITHUB_TOKEN=ghp_your_github_token
GITHUB_OWNER=your-github-username
GITHUB_REPO=your-test-repository
```

**For AI API Testing:**
```bash
# At least one AI API key is required
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
OPENAI_API_KEY=sk-your-openai-key
GOOGLE_API_KEY=your-google-ai-key
PERPLEXITY_API_KEY=pplx-your-perplexity-key

# AI model configuration (optional — there are no built-in defaults)
AI_MAIN_MODEL=your-main-model
AI_RESEARCH_MODEL=your-research-model
AI_FALLBACK_MODEL=your-fallback-model
AI_PRD_MODEL=your-prd-model
```

**For Real API Testing:**
```bash
E2E_REAL_API=true  # Enable real API calls
```

### GitHub Token Permissions

For real API testing, your GitHub token needs these permissions:
- `repo` (full repository access)
- `project` (full project access)
- `workflow` (workflow access)
- `write:org` (organization write access)
- `admin:org` (organization admin access)

## Test Features

### Comprehensive Tool Coverage
- ✅ **The 20 compound tools** - complete CRUD and workflow coverage
- ✅ **Schema Validation** - Argument validation for all tools
- ✅ **Error Handling** - Graceful error handling and recovery
- ✅ **Real API Integration** - Optional real API testing

### Advanced Testing Capabilities
- ✅ **Tool Registration Validation** - Verify all tools are properly registered
- ✅ **Schema Compliance** - Validate tool schemas match MCP specification
- ✅ **Response Format Validation** - Ensure responses follow expected formats
- ✅ **Workflow Integration** - Test complex multi-tool workflows
- ✅ **Performance Testing** - Monitor tool execution performance
- ✅ **Credential Management** - Graceful handling of missing credentials

### Test Utilities

The `MCPToolTestUtils` class provides:
- **Server Lifecycle Management** - Start/stop MCP server for testing
- **Tool Execution** - Call tools through actual MCP interface
- **Response Validation** - Validate tool responses and formats
- **Error Testing** - Test tool validation and error handling
- **Test Data Generation** - Generate realistic test data
- **Credential Detection** - Skip tests when credentials are missing

### Platform Validation Features

The platform validation tests verify:

| Capability | Validation |
|------------|------------|
| MCP Protocol | Tool discovery, schema validation |
| Domain Entities | Project, Milestone, Issue CRUD |
| Agent Orchestration | Register → Checkout → Work → Complete |
| Budget Enforcement | Set, check, record usage |
| Review Workflow | Submit → Approve cycle |
| Sprint Planning | Create and list sprints |
| Tool Accessibility | All 20 compound tools available |

## Test Configuration

### Vitest Configuration (`vitest.config.ts`)
- **Test Timeout:** 10 seconds by default; E2E suites raise it per-suite where a real server process is spawned
- **Include:** `src/__tests__/**` (`*.test.ts`, `*.spec.ts`, `*.e2e.ts`) and the legacy root `tests/**` tree
- **Environment:** `node`
- **Setup files:** `reflect-metadata`, `src/__tests__/e2e/setup.ts`
- **Coverage:** disabled for E2E runs — E2E focuses on integration, not line coverage

> There is no `jest.e2e.tools.config.js`. Configuration lives in `vitest.config.ts`.

### Environment Detection
- **Mock Mode:** Default - uses mocked APIs for fast, reliable testing
- **Real API Mode:** Optional - uses actual GitHub and AI APIs
- **Credential Detection:** Automatically skips tests when credentials are missing
- **Graceful Degradation:** Continues testing even when some services are unavailable

## Best Practices

### Running Tests Locally
1. **Start with Mock Tests:** Always run mock tests first to verify basic functionality
2. **Use Real APIs Sparingly:** Only use real API tests when necessary
3. **Set Up Test Repository:** Use a dedicated test repository for real API tests
4. **Monitor Rate Limits:** Be aware of GitHub API rate limits during real API testing

### CI/CD Integration
1. **Mock Tests in CI:** Run mock tests in all CI builds
2. **Real API Tests Nightly:** Run real API tests on a schedule
3. **Credential Management:** Use secure environment variable management
4. **Test Reporting:** Leverage JUnit XML reports for test result tracking

### Debugging Failed Tests
1. **Check Credentials:** Verify all required environment variables are set
2. **Review Logs:** Check stderr output for detailed error messages
3. **Test Individual Tools:** Use specific test patterns to isolate issues
4. **Validate Server Build:** Ensure `npm run build` completes successfully

## Example Usage

### Basic Tool Testing
```typescript
// Test a specific tool
const utils = new MCPToolTestUtils();
await utils.startServer();

const response = await utils.callTool('manage_project', {
  action: 'create',
  title: 'Test Project',
  visibility: 'private'
});

expect(response.id).toBeDefined();
await utils.stopServer();
```

### Workflow Testing
```typescript
// Test complete workflow
const prdResponse = await utils.callTool('ai_generate', { action: 'generate_prd' /* args */ });
const parseResponse = await utils.callTool('ai_generate', {
  action: 'parse_prd',
  prdContent: MCPToolTestUtils.extractContent(prdResponse)
});
const projectResponse = await utils.callTool('manage_project', { action: 'create' /* args */ });
```

## Troubleshooting

### Common Issues

**Server Build Errors:**
```bash
npm run build  # Ensure server builds successfully
```

**Missing Dependencies:**
```bash
npm install    # or: pnpm install
```

**Permission Errors:**
- Verify GitHub token has required permissions
- Check repository access and organization membership

**API Rate Limits:**
- Use mock tests for frequent testing
- Implement delays between real API calls
- Monitor GitHub API rate limit headers

### Getting Help

1. **Check Test Logs:** Review detailed error messages in test output
2. **Validate Environment:** Ensure all required environment variables are set
3. **Test Individual Components:** Use specific test patterns to isolate issues
4. **Review Documentation:** Check tool-specific documentation for requirements

## Contributing

When adding new tools or modifying existing ones:

1. **Add Tool Tests:** Create comprehensive tests for new tools
2. **Update Workflows:** Include new tools in integration workflows
3. **Validate Schemas:** Ensure tool schemas are properly tested
4. **Document Changes:** Update this guide with new testing procedures
5. **Test Both Modes:** Verify tests work in both mock and real API modes
