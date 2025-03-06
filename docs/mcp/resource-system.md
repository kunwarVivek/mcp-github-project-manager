# MCP Resource System

This document describes the Model Context Protocol (MCP) resource system implementation, which provides a standardized way to manage resources with caching, lifecycle management, and event handling.

## Overview

The resource system consists of three main components:
1. Resource Types - Define the structure and validation of resources
2. Resource Cache - Handle caching and retrieval of resources
3. Resource Manager - Manage resource lifecycle and events

## Resource Types

Resources are defined using Zod schemas for runtime validation:

```typescript
import { z } from "zod";

// Basic resource schema
const ResourceSchema = z.object({
  id: z.string(),
  type: z.enum(["project", "milestone", "issue", "sprint"]),
  version: z.number(),
  status: z.enum(["active", "deleted", "archived"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

// Example project schema
const ProjectSchema = ResourceSchema.merge(
  z.object({
    name: z.string(),
    description: z.string().optional(),
    settings: z.record(z.unknown()).optional(),
  })
);
```

## Resource Cache

The cache system provides:
- In-memory caching with TTL support
- Tag-based resource indexing
- Pattern-based cache clearing
- Error resilience

```typescript
// Cache usage examples
const cache = ResourceCache.getInstance();

// Store with tags
await cache.set(resource, {
  ttl: 3600,
  tags: ["active", "project"],
});

// Retrieve
const resource = await cache.get(ResourceType.PROJECT, "123");

// Get by tag
const resources = await cache.getByTag("active", ResourceType.PROJECT);

// Clear by type
await cache.clearByType(ResourceType.PROJECT);
```

## Resource Manager

Handles:
- Resource lifecycle (create, read, update, delete, archive)
- Version control and optimistic locking
- Event emission for resource changes
- Resource validation

```typescript
const manager = ResourceManager.getInstance();

// Create
const project = await manager.create(ResourceType.PROJECT, {
  name: "New Project",
  description: "Project description",
});

// Update with optimistic locking
await manager.update(
  ResourceType.PROJECT,
  "123",
  { name: "Updated Name" },
  { optimisticLock: true }
);

// Delete
await manager.delete(ResourceType.PROJECT, "123");

// Archive
await manager.archive(ResourceType.PROJECT, "123");

// Event handling
manager.onEvent(async (event) => {
  console.log(`Resource ${event.type}: ${event.resourceId}`);
});
```

## Resource Events

The system emits events for:
- Resource creation
- Resource updates
- Resource deletion
- Resource archival

Each event includes:
- Event ID
- Event type
- Resource ID and type
- Timestamp
- Actor information
- Event-specific payload

## Best Practices

1. Resource Creation
   - Always validate required fields
   - Use appropriate resource types
   - Consider cache options based on usage patterns

2. Resource Updates
   - Use optimistic locking for concurrent updates
   - Validate updates against resource schema
   - Consider event handlers for updates

3. Resource Deletion
   - Consider soft deletion vs hard deletion
   - Clear related cache entries
   - Handle dependent resources

4. Caching Strategy
   - Set appropriate TTL values
   - Use tags for efficient querying
   - Implement cache warming for critical resources

5. Error Handling
   - Handle cache misses gracefully
   - Implement retry mechanisms
   - Log cache errors for monitoring

## Testing

The system includes comprehensive tests:
- Unit tests for cache operations
- Unit tests for resource lifecycle
- Event handling tests
- Error scenario tests

Run tests using:
```bash
npm test
```

## Adding New Resource Types

To add a new resource type:

1. Define the resource schema:
```typescript
const NewResourceSchema = ResourceSchema.merge(
  z.object({
    // Resource-specific fields
  })
);
```

2. Add the resource type to the ResourceType enum:
```typescript
enum ResourceType {
  NEW_RESOURCE = "new-resource",
  // ...
}
```

3. Create specific types for creation and updates:
```typescript
type CreateNewResourceData = Omit<NewResource, 'id' | 'type' | /* ... */>;
type UpdateNewResourceData = Partial<CreateNewResourceData>;
```

4. Implement validation and any specific resource handling in ResourceManager

## Migration Guide

When migrating existing resources to use this system:

1. Define schemas for existing resources
2. Create migration scripts to convert data
3. Update cache keys and indices
4. Test with production data volume
5. Plan for cache warming

## Monitoring

Consider monitoring:
- Cache hit/miss rates
- Resource operation latency
- Event processing delays
- Error rates by resource type
- Cache memory usage