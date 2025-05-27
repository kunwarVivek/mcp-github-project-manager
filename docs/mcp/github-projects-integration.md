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
   - ProjectManagementService: Business logic coordination
   - ResourceManager: Resource state management
   - OptimisticLockManager: Concurrency control

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

1. **Project Management Tools**
```typescript
interface CreateProjectTool {
  name: 'create_project';
  description: 'Create a new GitHub Project';
  parameters: {
    title: string;
    description?: string;
    visibility?: 'public' | 'private';
  };
  returns: Project;
}

interface UpdateProjectTool {
  name: 'update_project';
  description: 'Update an existing GitHub Project';
  parameters: {
    projectId: string;
    updates: Partial<Project>;
  };
  returns: Project;
}
```

2. **Resource Management Tools**
```typescript
interface AddProjectItemTool {
  name: 'add_project_item';
  description: 'Add an item to a GitHub Project';
  parameters: {
    projectId: string;
    item: ProjectItem;
  };
  returns: void;
}

interface UpdateFieldValueTool {
  name: 'update_field_value';
  description: 'Update a field value for a project item';
  parameters: {
    projectId: string;
    itemId: string;
    fieldId: string;
    value: any;
  };
  returns: void;
}
```

### Resource Management

1. **Version Control**
```typescript
class ResourceManager {
  async trackVersion(resource: Resource): Promise<Version> {
    const version = await this.createVersion(resource);
    await this.cache.set(`${resource.id}:version`, version);
    return version;
  }

  async validateVersion(resource: Resource, version: Version): Promise<boolean> {
    const currentVersion = await this.cache.get(`${resource.id}:version`);
    return currentVersion?.number === version.number;
  }
}
```

2. **Locking Mechanism**
```typescript
class OptimisticLockManager {
  async acquireLock(resourceId: string): Promise<Lock> {
    const lock = await this.createLock(resourceId);
    await this.cache.set(`${resourceId}:lock`, lock);
    return lock;
  }

  async validateLock(resourceId: string, lockId: string): Promise<boolean> {
    const lock = await this.cache.get(`${resourceId}:lock`);
    return lock?.id === lockId && !lock.expired;
  }
}
```

## Error Handling

### API Error Mapping

```typescript
class GitHubErrorHandler {
  mapToMCPError(error: any): MCPError {
    if (error instanceof RequestError) {
      return this.mapRequestError(error);
    }
    if (error instanceof ValidationError) {
      return this.mapValidationError(error);
    }
    return new MCPError('UNKNOWN_ERROR', error.message);
  }

  private mapRequestError(error: RequestError): MCPError {
    switch (error.status) {
      case 404:
        return new MCPError('RESOURCE_NOT_FOUND', error.message);
      case 429:
        return new MCPError('RATE_LIMIT_EXCEEDED', error.message);
      default:
        return new MCPError('API_ERROR', error.message);
    }
  }
}
```

### Retry Strategy

```typescript
class RetryManager {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = defaultOptions
  ): Promise<T> {
    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (!this.shouldRetry(error) || attempt === options.maxAttempts) {
          throw error;
        }
        await this.delay(this.calculateBackoff(attempt));
      }
    }
    throw new Error('Max retry attempts exceeded');
  }
}
```

## Best Practices

1. **API Usage**
   - Implement proper rate limit handling
   - Use request batching for multiple operations
   - Handle API errors gracefully
   - Validate inputs before API calls

2. **Resource Management**
   - Always use version tracking
   - Implement proper locking mechanisms
   - Handle concurrent modifications
   - Cache frequently accessed data

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

### Handling Field Updates

```typescript
// Example field update with retry
async function updateFieldValue(
  projectId: string,
  itemId: string,
  fieldId: string,
  value: any
): Promise<void> {
  await retryManager.executeWithRetry(async () => {
    const lock = await lockManager.acquireLock(itemId);
    try {
      await fieldManager.validateValue(fieldId, value);
      await projectRepo.updateFieldValue(projectId, itemId, fieldId, value);
    } finally {
      await lockManager.releaseLock(itemId, lock.id);
    }
  });
}
```

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

- [GitHub Projects API Documentation](https://docs.github.com/en/rest/projects)
- [MCP Specification](https://modelcontextprotocol.io)
- [Architecture Documentation](../../ARCHITECTURE.md)