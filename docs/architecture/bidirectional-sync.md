# Bidirectional Synchronization: MCP GitHub Project Manager

This document details the bidirectional synchronization mechanism between the MCP GitHub Project Manager and GitHub's API.

## 1. Real-time Task Update Flow

The system uses a combination of webhooks and periodic synchronization to maintain real-time updates:

```typescript
private async handleProjectsV2ItemEvent(webhook: WebhookEvent): Promise<ResourceEvent[]> {
  const { action, projects_v2_item: item } = webhook.payload;
  
  const events: ResourceEvent[] = [];

  // Handle the item itself (could be an issue or pull request)
  if (item.content_type === 'Issue' && item.content_node_id) {
    const eventType = this.mapActionToEventType(action);
    if (eventType) {
      events.push({
        id: `${webhook.id}-issue-${item.content_node_id}`,
        type: eventType,
        resourceType: ResourceType.ISSUE,
        resourceId: item.content_node_id,
        // ...other properties
      });
    }
  }

  return events;
}
```

The flow works as follows:
1. GitHub sends webhook events when tasks (issues/PRs) are updated
2. The `GitHubWebhookHandler` processes these events and converts them to standardized `ResourceEvent` objects
3. These events are then propagated through the system to update local state
4. For outgoing changes, the MCP server uses GitHub's GraphQL API to push updates

## 2. Detecting Human Team Member Changes

Changes made by team members in GitHub Projects are detected through:

```typescript
private async syncResourceTypeWithMetadata(
  type: ResourceType,
  metadata: SyncMetadata[]
): Promise<{ synced: number; skipped: number }> {
  // Check which resources need syncing
  const resourcesNeedingSync = await this.checkResourceChanges(metadata);

  this.logger.info(`${type}: ${resourcesNeedingSync.length} resources need syncing out of ${metadata.length} total`);

  // Sync resources that need updating
  for (const resourceId of resourcesNeedingSync) {
    try {
      await this.syncSingleResource(type, resourceId);
      synced++;
    } catch (error) {
      this.logger.warn(`Failed to sync ${type} ${resourceId}:`, error);
      // Continue with other resources
    }
  }
  // ...
}
```

The system:
1. Maintains metadata about each resource including last modified timestamps
2. Periodically checks for changes using the `checkResourceChanges` method
3. Uses ETag/version tracking to detect changes efficiently
4. Synchronizes only resources that have changed since last sync

## 3. Progress Tracking and Status Updates

When developers update task status in GitHub, the system:

1. Receives webhook notifications for status changes
2. Updates the local cache with new status information
3. Propagates these changes to any subscribed clients
4. Updates progress metrics based on task status changes

The implementation leverages the event system to track these changes in real-time.

## 4. Components for Event Handling and Synchronization

The key components responsible for handling events and synchronization are:

1. **GitHubWebhookHandler**: Processes incoming webhook events from GitHub
   - Converts GitHub-specific events to standardized resource events
   - Handles different event types (projects, issues, PRs, etc.)

2. **GitHubStateSyncService**: Manages state synchronization
   - Performs initial sync on startup
   - Handles periodic syncs for specific resource types
   - Maintains metadata for efficient change detection

3. **ResourceCache**: Stores synchronized resources
   - Provides type-safe access to resources
   - Tracks resource metadata for change detection

4. **EventSubscriptionManager**: Manages client subscriptions to events
   - Allows filtering by resource type and event type
   - Delivers events to subscribed clients

Conflict resolution uses optimistic locking with version checks:

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

## 5. Recalibrating Task Estimates and Project Timelines

The system recalibrates task estimates and project timelines through:

1. **AI-powered analysis**: The system includes AI tools that can analyze task complexity and adjust estimates
2. **Event-based triggers**: When tasks are updated, the system can trigger re-estimation
3. **Progressive response**: Updates are streamed to clients as they occur

```
# 3. Get next task recommendations
get_next_task({
  "sprintCapacity": 40,
  "teamSkills": ["react", "node.js", "typescript", "python"],
  "maxComplexity": 7,
  "includeAnalysis": true,
  "excludeBlocked": true
})
```

The AI features can analyze task progress and provide updated recommendations as the project evolves.

## Architecture Diagram

```
┌─────────────────┐         ┌─────────────────┐
│  GitHub API     │◄────────┤ Webhook Handler │
│  (Projects v2)  │         └────────┬────────┘
└────────┬────────┘                  │
         │                           ▼
         │                  ┌─────────────────┐
         │                  │ Event System    │
         │                  │ - Subscription  │
         │                  │ - Event Store   │
         │                  └────────┬────────┘
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│ GitHub Repos    │◄────────┤ Resource Cache  │
│ - Project       │         │ - Type Safety   │
│ - Issue         │         │ - Metadata      │
│ - Milestone     │         └────────┬────────┘
└────────┬────────┘                  │
         │                           ▼
         │                  ┌─────────────────┐
         │                  │ Sync Service    │
         ▼                  │ - Change Detect │
┌─────────────────┐         │ - Versioning    │
│  MCP Layer      │◄────────┤ - Persistence   │
└─────────────────┘         └─────────────────┘
```

This bidirectional synchronization architecture ensures that changes flow seamlessly between GitHub and the MCP system, maintaining consistency while providing real-time updates to all stakeholders.