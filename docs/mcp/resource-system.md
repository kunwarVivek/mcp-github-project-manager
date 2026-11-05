# MCP Resource System

This document describes how the server models GitHub resources: their types and
schemas, the in-memory `ResourceCache`, and how change events are produced and
stored.

> The earlier design of this document described a `ResourceManager` (lifecycle
> and versioning) and an `OptimisticLockManager`. Neither exists in the code:
> they were removed. Concurrency control is GitHub's own — the agent registry
> uses sha compare-and-swap on the Contents API (see [architecture.md](../architecture.md))
> — and change events flow through `EventStore` / `EventSubscriptionManager`.

## Overview

The resource system consists of three parts:
1. **Resource types** — `ResourceType` / `ResourceStatus` and the Zod schemas that validate resources (`src/domain/resource-types.ts`, `src/domain/resource-schemas.ts`)
2. **Resource cache** — `ResourceCache`, in-memory with TTL, tag/type/namespace indices and optional file persistence (`src/infrastructure/cache/`)
3. **Events** — `GitHubWebhookHandler` → `EventStore` → `EventSubscriptionManager` (`src/infrastructure/events/`), exposed through the `manage_events` tool and the SSE endpoint

The MCP-facing resources (`github://config`, `github://projects`,
`github://sprints/current`, `github://milestones`, `github://agents`,
`github://tools`) are registered in `src/infrastructure/mcp/resources.ts`.

## Resource Types

Resources are defined using Zod schemas for runtime validation. This project
uses **zod 4** — `z.record` requires an explicit key schema:

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
    // zod 4: z.record needs an explicit key schema
    settings: z.record(z.string(), z.unknown()).optional(),
  })
);
```

The canonical `ResourceType` and `ResourceStatus` enums live in
`src/domain/resource-types.ts`.

## Resource Cache

The cache system provides:
- In-memory caching with TTL support and a capacity cap (oldest-first eviction)
- Tag-, type- and namespace-based indexing
- Pattern-based invalidation
- Optional file persistence (`enablePersistence()`, `persist()`, `restore()`)

```typescript
const cache = ResourceCache.getInstance();

// Store with tags (type, id, value, options)
await cache.set(ResourceType.PROJECT, "123", projectData, {
  ttl: 3600000,
  tags: ["active"],
});

// Retrieve
const project = await cache.get(ResourceType.PROJECT, "123");

// Get by tag
const active = await cache.getByTag("active", ResourceType.PROJECT);

// Clear by type
await cache.clearByType(ResourceType.PROJECT);
```

See [API.md](../API.md#resourcecache) for the full method list.

## Change Events

Resource changes arrive from GitHub webhooks. `GitHubWebhookHandler` verifies the
HMAC signature (fail-closed), `EventStore` keeps recent events (with optional
persistence and retention), and `EventSubscriptionManager` fans them out to
subscribers. Clients read them through `manage_events` (`subscribe`,
`get_recent`, `replay`) or the SSE endpoint, which requires `EVENTS_AUTH_TOKEN`.

## Best Practices

1. Caching strategy
   - Set an appropriate TTL
   - Use tags for efficient querying
   - Invalidate by tag or pattern after a write
2. Concurrent writes
   - Rely on GitHub's own concurrency primitives (compare-and-swap on the
     Contents API for the agent registry; field-level writes elsewhere)
   - Never read-modify-write a shared record from a stale copy
3. Error handling
   - Handle cache misses gracefully
   - Log cache errors for monitoring

## Testing

Cache tests live under `src/__tests__/unit/infrastructure/cache/`. Run them with:
```bash
npm test -- cache
```

## Adding New Resource Types

1. Define the resource schema:
```typescript
const NewResourceSchema = ResourceSchema.merge(
  z.object({
    // Resource-specific fields
  })
);
```

2. Add the resource type to the `ResourceType` enum:
```typescript
// src/domain/resource-types.ts
export enum ResourceType {
  NEW_RESOURCE = "new-resource",
  // ...
}
```

3. Create specific types for creation and updates:
```typescript
type CreateNewResourceData = Omit<NewResource, 'id' | 'type' | /* ... */>;
type UpdateNewResourceData = Partial<CreateNewResourceData>;
```

4. Add the schema to `src/domain/resource-schemas.ts` and the repository / service that reads and writes it.

## Monitoring

Consider monitoring:
- Cache hit/miss rates (`ResourceCache.getStats()`)
- Event processing delays
- Error rates by resource type
- Cache memory usage
