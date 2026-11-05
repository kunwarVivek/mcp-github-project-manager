# GitHub Projects MCP Integration

## Overview

This document details how the MCP server interfaces with GitHub's Projects API (v2) and implements the Model Context Protocol for project management functionality.

## Architecture

### Integration Layers

```
┌─────────────────┐
│   MCP Layer     │ ← Tool definitions, request/response handling
├─────────────────┤
│ Service Layer   │ ← Business logic, coordination
├─────────────────┤
│    Domain       │ ← Core entities, interfaces
├─────────────────┤
│ Infrastructure  │ ← GitHub API integration, repositories
└─────────────────┘
```

### Core Components

1. **Repository Layer**
   - GitHubProjectRepository: Project CRUD operations
   - GitHubIssueRepository: Issue management
   - GitHubMilestoneRepository: Milestone operations
   - GitHubSprintRepository: Sprint planning

2. **Service Layer**
   - ProjectManagementService: thin facade of typed per-feature service getters
   - Per-feature services (IssueService, SprintPlanningService, ...): business logic
   - GitHubRequestExecutor: the one retry + rate-limit path for every GitHub call

3. **MCP Layer**
   - Tool definitions
   - Request validation
   - Response formatting
   - Error handling

## GitHub API Integration

### GraphQL API Usage

```typescript
// Example GraphQL Mutations - Schema Compliant Implementation
const createProjectMutation = `
  mutation($input: CreateProjectV2Input!) {
    createProjectV2(input: $input) {
      projectV2 {
        id
        title
        shortDescription
        closed
        createdAt
        updatedAt
      }
    }
  }
`;

const updateProjectMutation = `
  mutation($input: UpdateProjectV2Input!) {
    updateProjectV2(input: $input) {
      projectV2 {
        id
        title
        shortDescription
        closed
        createdAt
        updatedAt
      }
    }
  }
`;

// Schema-Compliant Implementation
class GitHubProjectRepository {
  async create(data: CreateProject): Promise<Project> {
    // Step 1: Create project (without description - schema compliance)
    const createInput: any = {
      ownerId: this.owner,
      title: data.title,
    };
    
    if (this.repo) {
      createInput.repositoryId = this.repo;
    }
    
    const createResponse = await this.graphql(createProjectMutation, {
      input: createInput,
    });
    
    let project = createResponse.createProjectV2.projectV2;
    
    // Step 2: Update with description if provided (separate mutation)
    if (data.description) {
      const updateResponse = await this.graphql(updateProjectMutation, {
        input: {
          projectId: project.id,
          shortDescription: data.description,
        },
      });
      project = updateResponse.updateProjectV2.projectV2;
    }
    
    return this.mapToProject(project);
  }
}
```

### Schema Compliance Notes

**Important**: GitHub's CreateProjectV2Input schema does NOT accept description fields:
- ❌ `description` - Not a valid field
- ❌ `shortDescription` - Not a valid field  

Valid CreateProjectV2Input fields:
- ✅ `ownerId` (required)
- ✅ `title` (required) 
- ✅ `repositoryId` (optional)
- ✅ `teamId` (optional)
- ✅ `clientMutationId` (optional)

To set a project description, use a separate UpdateProjectV2Input mutation after creation.

### API Features

1. **Projects API (v2)**
   - Project creation and configuration
   - Custom field management
   - View configuration
   - Item management

2. **Issues API**
   - Issue CRUD operations
   - Label management
   - Milestone association
   - Status updates

3. **Milestones API**
   - Milestone management
   - Progress tracking
   - Due date handling

## MCP Implementation

### Tool Definitions

MCP clients see **compound tools**, not one tool per operation. Each compound
tool takes an `action` parameter that routes to an internal executor. The
project-facing definitions look like this:

```typescript
// The public tool: manage_project, action: "create"
const manageProjectSchema = z.object({
  action: z.enum(["create", "list", "get", "update", "delete", /* ... */]),
  title: z.string().optional(),
  owner: z.string().optional(),
  shortDescription: z.string().optional(),
  visibility: z.enum(["private", "public"]).optional(),
  projectId: z.string().optional(),
});
```

```typescript
// The public tool: manage_project, action: "add_item" / "set_field_value"
const manageProjectItemSchema = z.object({
  action: z.enum(["add_item", "remove_item", "list_items", "set_field_value", "get_field_value"]),
  projectId: z.string(),
  contentId: z.string().optional(),
  itemId: z.string().optional(),
  fieldId: z.string().optional(),
  value: z.unknown().optional(),
});
```

The full surface is documented in [TOOLS.md](../TOOLS.md), and
`discover_tools` returns the live schemas at runtime.

### Concurrency and Idempotency

There is no in-process resource versioning or lock manager. Concurrency is
handled with GitHub's own primitives and two server-side mechanisms:

1. **Compare-and-swap** — the agent registry is a file written through the
   Contents API with the blob sha it read; GitHub answers 409 on a stale write
   and the store re-applies its mutation on the fresh record.
2. **Idempotency keys** — create actions accept `idempotencyKey`; a repeat with
   the same key and arguments within 24 h replays the first result instead of
   creating a duplicate (see [TOOLS.md](../TOOLS.md#cross-cutting-parameters)).

## Error Handling

### API Error Mapping

`GitHubErrorHandler` (`infrastructure/github/GitHubErrorHandler.ts`) converts
Octokit failures into structured domain errors, and `ToolValidator.mapGitHubError`
turns them into actionable tool-error text (401/403/404/422/rate-limit/5xx). A tool
that fails returns `{ content, isError: true }` with a stable code in `_meta.error`;
a JSON-RPC error is reserved for an unknown tool. See
[response-handling.md](response-handling.md).

### Retry Strategy

Retries live in one place, `GitHubRequestExecutor`: before each attempt it
acquires budget from the shared `RateLimitManager` (backing off once the remaining
GraphQL points fall below `RATE_LIMIT_FLOOR`), then runs the operation and retries
retryable failures (up to 3 attempts) using GitHub's rate-limit headers for the delay.

## Best Practices

1. **API Usage**
   - Implement proper rate limit handling
   - Use request batching for multiple operations
   - Handle API errors gracefully
   - Validate inputs before API calls

2. **Concurrency**
   - Use `idempotencyKey` on create actions that may be retried
   - Use the registry's compare-and-swap; never read-modify-write from a stale copy
   - Cache frequently accessed data (`ResourceCache`)

3. **Error Handling**
   - Map API errors to MCP errors
   - Implement retry strategies
   - Provide detailed error context
   - Log errors appropriately

## Examples

### Creating a Project with Items

```typescript
// Example usage
async function createProjectWithItems(
  title: string,
  items: ProjectItem[]
): Promise<Project> {
  const project = await projectRepo.create({
    title,
    description: 'Created via MCP',
  });

  await Promise.all(
    items.map(item =>
      projectRepo.addItem(project.id, item)
    )
  );

  return project;
}
```

### Retrying a Create Safely

```json
{"tool": "manage_issues", "arguments": {"action": "create", "title": "Fix login", "idempotencyKey": "req-2026-11-02-001"}}
```

Sending the same call again with the same key returns the first result flagged `replayed: true`.

## Testing

1. **Unit Tests**
   - Test individual components
   - Mock GitHub API responses
   - Validate error handling

2. **Integration Tests**
   - Test complete workflows
   - Verify API integration
   - Check resource management

3. **E2E Tests**
   - Test full system functionality
   - Verify real API interactions
   - Validate error scenarios

## References

- [Tool Reference](../TOOLS.md) — the <!-- count:tools -->21<!-- /count --> compound tools and their <!-- count:actions -->175<!-- /count --> actions
- [GitHub Projects API Documentation](https://docs.github.com/en/rest/projects)
- [MCP Specification](https://modelcontextprotocol.io)
- [Architecture Documentation](../architecture.md)