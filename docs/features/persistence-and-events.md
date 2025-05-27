# Persistence and Real-time Events

The MCP GitHub Project Manager includes comprehensive persistence and real-time event processing capabilities to address critical production requirements.

## Overview

This implementation provides:

1. **Persistent State Management**: Eliminates cold start delays by maintaining synchronized state across server restarts
2. **Real-time Event Processing**: Delivers GitHub changes to clients within seconds via webhooks and Server-Sent Events
3. **Event Replay**: Ensures no missed events with comprehensive event storage and replay capabilities
4. **Intelligent Caching**: Minimizes API calls through timestamp-based change detection and smart invalidation

## Architecture

### Core Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MCP Client    │    │  Webhook Server  │    │  GitHub API     │
│                 │    │  (Port 3001)     │    │                 │
└─────────┬───────┘    └─────────┬────────┘    └─────────┬───────┘
          │                      │                       │
          │ MCP Tools            │ Webhooks              │ GraphQL/REST
          │                      │                       │
          ▼                      ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Server Core                              │
├─────────────────┬───────────────────┬───────────────────────────┤
│ Sync Service    │ Event System      │ Cache & Persistence       │
│                 │                   │                           │
│ • Initial Sync  │ • Webhook Handler │ • Resource Cache          │
│ • Change Detect │ • Subscription Mgr│ • File Persistence        │
│ • API Throttle  │ • Event Store     │ • Metadata Storage        │
└─────────────────┴───────────────────┴───────────────────────────┘
```

## Persistence System

### GitHubStateSyncService

Maintains local state synchronization with GitHub resources:

```typescript
// Perform initial sync on startup
const syncResult = await syncService.performInitialSync(30000); // 30s timeout

// Sync specific resource types
await syncService.syncResourceType(ResourceType.PROJECT);

// Check which resources need syncing
const changedResources = await syncService.checkResourceChanges(metadata);
```

**Features:**
- **Non-blocking startup**: 30-second timeout with graceful degradation
- **Intelligent sync**: Only syncs resources that have changed based on timestamps
- **Selective sync**: Configure which resource types to sync via `SYNC_RESOURCES`
- **Error resilience**: Continues operation even if sync fails

### FilePersistenceAdapter

Lightweight file-based persistence for resource metadata:

```typescript
// Save resource metadata
await persistence.saveMetadata({
  resourceId: 'project-1',
  resourceType: ResourceType.PROJECT,
  lastModified: '2025-01-15T10:30:00Z',
  version: 1,
  syncedAt: new Date().toISOString()
});

// Load all metadata
const metadata = await persistence.loadMetadata();

// Get persistence statistics
const stats = await persistence.getStats();
```

**Features:**
- **Atomic writes**: Uses temporary files to prevent corruption
- **File locking**: Prevents concurrent access issues
- **Compression**: Optional gzip compression for large metadata files
- **Backup & recovery**: Automatic backups with configurable retention
- **Error recovery**: Recovers from corrupted files using backups

### Enhanced ResourceCache

Extended caching with persistence integration:

```typescript
// Cache with type information
await cache.set(ResourceType.PROJECT, 'project-1', projectData);

// Retrieve with type safety
const project = await cache.get(ResourceType.PROJECT, 'project-1');

// Check sync requirements
const needsSync = cache.needsSync(ResourceType.PROJECT, 'project-1');

// Get all metadata for persistence
const allMetadata = cache.getAllMetadata();
```

## Real-time Event System

### GitHub Webhook Handler

Processes GitHub webhooks and converts them to standardized resource events:

```typescript
// Validate webhook signature
const isValid = await webhookHandler.validateSignature(payload, signature);

// Process webhook event
const result = await webhookHandler.processWebhookEvent(webhookEvent);

// Generated resource events
result.events.forEach(event => {
  console.log(`${event.type} ${event.resourceType} ${event.resourceId}`);
});
```

**Supported Events:**
- `projects_v2`: Project creation, updates, deletion
- `projects_v2_item`: Project item changes
- `milestone`: Milestone lifecycle events
- `issues`: Issue creation, updates, state changes
- `pull_request`: Pull request events (treated as issues)

### Event Subscription Manager

Manages client subscriptions to resource events:

```typescript
// Subscribe to events
const subscriptionId = subscriptionManager.subscribe({
  clientId: 'my-client',
  filters: [
    { resourceType: ResourceType.PROJECT, eventType: 'created' },
    { resourceType: ResourceType.ISSUE, resourceId: 'specific-issue' }
  ],
  transport: 'sse'
});

// Get matching subscriptions for an event
const subscriptions = subscriptionManager.getSubscriptionsForEvent(event);

// Unsubscribe
subscriptionManager.unsubscribe(subscriptionId);
```

**Transport Types:**
- `sse`: Server-Sent Events for real-time browser updates
- `webhook`: HTTP callbacks to external endpoints
- `internal`: In-process event handling for cache invalidation

### Event Store

Persistent event storage with query capabilities:

```typescript
// Store events
await eventStore.storeEvent(resourceEvent);
await eventStore.storeEvents([event1, event2, event3]);

// Query events
const recentEvents = await eventStore.getEvents({
  resourceType: 'PROJECT',
  eventType: 'updated',
  limit: 100
});

// Replay events from timestamp
const missedEvents = await eventStore.getEventsFromTimestamp('2025-01-15T10:00:00Z');
```

**Features:**
- **File-based storage**: Events stored in daily rotation files
- **Memory buffer**: Fast access to recent events (configurable size)
- **Query support**: Filter by resource type, event type, timestamp, etc.
- **Retention policies**: Automatic cleanup of old events (default: 7 days)
- **Event replay**: Retrieve missed events for disconnected clients

### Webhook Server

HTTP server for receiving GitHub webhooks and serving SSE connections:

```typescript
// Start webhook server
await webhookServer.start(); // Listens on port 3001

// Endpoints:
// POST /webhooks/github - GitHub webhook endpoint
// GET /events/stream - SSE endpoint for real-time events
// POST /events/subscribe - Create event subscription
// DELETE /events/subscribe/:id - Remove subscription
// GET /events/replay/:timestamp - Replay events from timestamp
```

## Configuration

### Environment Variables

```bash
# Sync Configuration
SYNC_ENABLED=true                    # Enable/disable sync (default: true)
SYNC_TIMEOUT_MS=30000               # Initial sync timeout (default: 30s)
SYNC_INTERVAL_MS=0                  # Periodic sync interval (0 = disabled)
CACHE_DIRECTORY=.mcp-cache          # Cache storage directory
SYNC_RESOURCES=PROJECT,MILESTONE,ISSUE,SPRINT  # Resource types to sync

# Event System Configuration
WEBHOOK_SECRET=your-webhook-secret   # GitHub webhook secret for validation
WEBHOOK_PORT=3001                   # Webhook server port
SSE_ENABLED=true                    # Enable Server-Sent Events
EVENT_RETENTION_DAYS=7              # Event storage retention period
MAX_EVENTS_IN_MEMORY=1000          # Maximum events in memory buffer
WEBHOOK_TIMEOUT_MS=5000             # Webhook request timeout
```

### CLI Options

```bash
# Skip sync on startup (useful for development)
mcp-github-project-manager --skip-sync

# Custom cache directory
mcp-github-project-manager --cache-dir=/custom/path

# Verbose logging
mcp-github-project-manager --verbose
```

## MCP Tools

### Event Management Tools

#### subscribe_to_events

Subscribe to real-time events for GitHub resources:

```json
{
  "name": "subscribe_to_events",
  "arguments": {
    "clientId": "my-client",
    "filters": [
      {
        "resourceType": "PROJECT",
        "eventType": "created"
      }
    ],
    "transport": "sse"
  }
}
```

#### get_recent_events

Retrieve recent events with optional filtering:

```json
{
  "name": "get_recent_events",
  "arguments": {
    "resourceType": "ISSUE",
    "resourceId": "123",
    "limit": 50
  }
}
```

#### replay_events

Replay events from a specific timestamp:

```json
{
  "name": "replay_events",
  "arguments": {
    "fromTimestamp": "2025-01-15T10:00:00Z",
    "resourceType": "PROJECT",
    "limit": 100
  }
}
```

## Performance Characteristics

### Startup Performance
- **Cold start**: 30-second maximum for initial sync
- **Warm start**: <2 seconds with existing cache
- **Graceful degradation**: Continues without sync if timeout exceeded

### Storage Efficiency
- **Metadata**: ~1KB per resource (compressed)
- **Events**: ~2KB per event (compressed)
- **Typical usage**: <100MB for large projects

### Memory Usage
- **Cache**: Configurable, typically 10-50MB
- **Event buffer**: 1000 events max (~2MB)
- **Total overhead**: <100MB additional memory

### API Efficiency
- **Sync optimization**: Only fetches changed resources
- **Cache hit ratio**: >90% for repeated requests
- **Rate limiting**: Respects GitHub API limits

## Error Handling

### Sync Failures
- **Timeout**: Logs warning, continues with empty cache
- **API errors**: Retries with exponential backoff
- **Partial failures**: Continues with successfully synced resources

### Event Processing
- **Webhook validation**: Rejects invalid signatures
- **Malformed events**: Logs error, continues processing
- **Storage failures**: Events remain in memory buffer

### Persistence Failures
- **File corruption**: Automatic recovery from backups
- **Disk full**: Graceful degradation to memory-only mode
- **Permission errors**: Clear error messages with suggestions

## Monitoring and Observability

### Health Endpoints

```bash
# Server health with statistics
curl http://localhost:3001/health

# Response includes:
# - Server status and uptime
# - Event store statistics
# - Subscription counts
# - Cache statistics
```

### Logging

The system provides comprehensive logging at different levels:

- **INFO**: Startup, sync completion, major events
- **DEBUG**: Detailed operation traces, cache hits/misses
- **WARN**: Recoverable errors, degraded performance
- **ERROR**: Critical failures requiring attention

### Metrics

Key metrics tracked:
- Sync duration and success rate
- Cache hit/miss ratios
- Event processing latency
- Subscription counts by type
- Storage usage and growth

## Best Practices

### Production Deployment

1. **Configure webhook secret**: Always set `WEBHOOK_SECRET` for security
2. **Monitor disk usage**: Events and cache grow over time
3. **Set appropriate retention**: Balance storage vs. replay requirements
4. **Use compression**: Enable for production to save storage
5. **Monitor logs**: Watch for sync failures and API rate limits

### Development Setup

1. **Disable sync**: Use `--skip-sync` for faster development cycles
2. **Use verbose logging**: Enable `--verbose` for debugging
3. **Local webhook testing**: Use ngrok or similar for webhook development
4. **Clean cache**: Regularly clean `.mcp-cache` during development

### Client Integration

1. **Handle reconnections**: Implement SSE reconnection logic
2. **Use event replay**: Catch up on missed events after disconnections
3. **Filter subscriptions**: Only subscribe to needed events to reduce noise
4. **Implement timeouts**: Don't wait indefinitely for events

## Troubleshooting

### Common Issues

**Sync timeout on startup:**
```bash
# Increase timeout or disable sync
SYNC_TIMEOUT_MS=60000 mcp-github-project-manager
# or
mcp-github-project-manager --skip-sync
```

**Webhook signature validation fails:**
```bash
# Verify webhook secret matches GitHub configuration
WEBHOOK_SECRET=your-actual-secret mcp-github-project-manager
```

**Events not being received:**
```bash
# Check webhook server is running and accessible
curl http://localhost:3001/health

# Verify GitHub webhook configuration points to correct URL
# Check firewall and network connectivity
```

**High memory usage:**
```bash
# Reduce event buffer size
MAX_EVENTS_IN_MEMORY=500 mcp-github-project-manager

# Enable compression
# Clean old cache files
```

### Debug Commands

```bash
# Check cache contents
ls -la .mcp-cache/

# View recent events
curl http://localhost:3001/events/recent?limit=10

# Check subscription status
curl http://localhost:3001/health | jq '.subscriptions'
```
