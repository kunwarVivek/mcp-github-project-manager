# Comprehensive E2E Testing Guide for MCP Tools

This guide covers the comprehensive end-to-end testing suite for all MCP (Model Context Protocol) tools in the GitHub Project Manager.

## Overview

The E2E test suite provides comprehensive testing for:
- **40+ GitHub Project Management Tools** - Complete CRUD operations for projects, milestones, issues, sprints, etc.
- **8 AI Task Management Tools** - PRD generation, task parsing, complexity analysis, etc.
- **Complex Workflow Integration** - Multi-tool workflows and real-world scenarios
- **Real API Testing** - Optional testing with actual GitHub and AI APIs

## Test Structure

```
src/__tests__/e2e/tools/
├── github-project-tools.e2e.ts      # GitHub project management tools
├── ai-task-tools.e2e.ts             # AI-powered task management tools
├── tool-integration-workflows.e2e.ts # Complex multi-tool workflows
└── utils/
    └── MCPToolTestUtils.ts           # Test utilities and helpers
```

## Test Categories

### 1. GitHub Project Management Tools (`github-project-tools.e2e.ts`)

Tests all GitHub-related MCP tools:

**Project Tools:**
- `create_project`, `list_projects`, `get_project`, `update_project`, `delete_project`
- `create_project_field`, `list_project_fields`, `update_project_field`
- `create_project_view`, `list_project_views`, `update_project_view`
- `add_project_item`, `remove_project_item`, `list_project_items`
- `set_field_value`, `get_field_value`

**Milestone Tools:**
- `create_milestone`, `list_milestones`, `update_milestone`, `delete_milestone`

**Issue Tools:**
- `create_issue`, `list_issues`, `get_issue`, `update_issue`

**Sprint Tools:**
- `create_sprint`, `list_sprints`, `get_current_sprint`, `update_sprint`
- `add_issues_to_sprint`, `remove_issues_from_sprint`

**Roadmap and Planning Tools:**
- `create_roadmap`, `plan_sprint`, `get_milestone_metrics`, `get_sprint_metrics`
- `get_overdue_milestones`, `get_upcoming_milestones`

**Label Tools:**
- `create_label`, `list_labels`

### 2. AI Task Management Tools (`ai-task-tools.e2e.ts`)

Tests all AI-powered MCP tools:

**PRD Generation:**
- `generate_prd` - Generate Product Requirements Documents from ideas
- `enhance_prd` - Enhance existing PRDs with additional details
- `parse_prd` - Parse PRDs and generate tasks

**Task Management:**
- `get_next_task` - Get task recommendations for teams
- `analyze_task_complexity` - Analyze and score task complexity
- `expand_task` - Break down tasks into subtasks

**Feature Management:**
- `add_feature` - Add new features to existing projects

**Requirements Traceability:**
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

## Running Tests

### Mock Tests (Default)
```bash
# Run all E2E tool tests with mocked APIs
npm run test:e2e:tools

# Run specific test categories
npm run test:e2e:tools:github     # GitHub tools only
npm run test:e2e:tools:ai         # AI tools only
npm run test:e2e:tools:workflows  # Integration workflows only
```

### Real API Tests
```bash
# Run all E2E tool tests with real APIs
npm run test:e2e:tools:real

# Run specific categories with real APIs
npm run test:e2e:tools:real:github
npm run test:e2e:tools:real:ai
npm run test:e2e:tools:real:workflows

# Run complete test suite (unit + integration + E2E)
npm run test:all:real
```

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

# AI model configuration (optional)
AI_MAIN_MODEL=claude-3-5-sonnet-20241022
AI_RESEARCH_MODEL=perplexity-llama-3.1-sonar-large-128k-online
AI_FALLBACK_MODEL=gpt-4o
AI_PRD_MODEL=claude-3-5-sonnet-20241022
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
- ✅ **40+ GitHub Tools** - Complete CRUD operations
- ✅ **8 AI Tools** - Full AI workflow testing
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

## Test Configuration

### Jest Configuration (`jest.e2e.tools.config.js`)
- **Test Timeout:** 60 seconds for comprehensive E2E tests
- **Concurrency:** Sequential execution to avoid conflicts
- **Coverage:** Disabled for E2E tests (focused on integration)
- **Reporting:** JUnit XML reports for CI/CD integration

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

const response = await utils.callTool('create_project', {
  title: 'Test Project',
  visibility: 'private'
});

expect(response.id).toBeDefined();
await utils.stopServer();
```

### Workflow Testing
```typescript
// Test complete workflow
const prdResponse = await utils.callTool('generate_prd', { /* args */ });
const parseResponse = await utils.callTool('parse_prd', { 
  prdContent: MCPToolTestUtils.extractContent(prdResponse)
});
const projectResponse = await utils.callTool('create_project', { /* args */ });
```

## Troubleshooting

### Common Issues

**Server Build Errors:**
```bash
npm run build  # Ensure server builds successfully
```

**Missing Dependencies:**
```bash
npm install jest-junit  # Install test reporting dependency
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
