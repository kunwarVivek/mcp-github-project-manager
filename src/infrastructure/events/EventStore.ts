import * as fs from 'fs/promises';
import * as path from 'path';
import { ResourceEvent } from './GitHubWebhookHandler';
import { Logger } from '../logger/index';
import { EVENT_RETENTION_DAYS, MAX_EVENTS_IN_MEMORY, CACHE_DIRECTORY } from '../../env';

export interface EventStoreOptions {
  retentionDays: number;
  maxEventsInMemory: number;
  storageDirectory: string;
  enableCompression: boolean;
}

export interface EventQuery {
  resourceType?: string;
  resourceId?: string;
  eventType?: string;
  source?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
  limit?: number;
  offset?: number;
}

export interface EventStoreStats {
  totalEvents: number;
  eventsInMemory: number;
  eventsOnDisk: number;
  oldestEvent?: string;
  newestEvent?: string;
  storageSize: number;
}

export class EventStore {
  private readonly logger = Logger.getInstance();
  private readonly options: EventStoreOptions;
  private readonly eventsDirectory: string;
  private readonly indexFile: string;
  private directoryInitialized = false;

  // In-memory event buffer for fast access
  private memoryBuffer: ResourceEvent[] = [];
  private eventIndex = new Map<string, number>(); // eventId -> buffer index

  // File rotation tracking
  private currentFileDate: string = '';
  private currentFileEvents: number = 0;
  private readonly maxEventsPerFile = 10000;

  constructor(options?: Partial<EventStoreOptions>) {
    this.options = {
      retentionDays: options?.retentionDays || EVENT_RETENTION_DAYS,
      maxEventsInMemory: options?.maxEventsInMemory || MAX_EVENTS_IN_MEMORY,
      storageDirectory: options?.storageDirectory || path.join(CACHE_DIRECTORY, 'events'),
      enableCompression: options?.enableCompression ?? true
    };

    this.eventsDirectory = this.options.storageDirectory;
    this.indexFile = path.join(this.eventsDirectory, 'index.json');
  }

  /**
   * Store a new event
   */
  async storeEvent(event: ResourceEvent): Promise<void> {
    try {
      await this.ensureDirectoryExists();

      // Add to memory buffer
      this.addToMemoryBuffer(event);

      // Persist to disk
      await this.persistEvent(event);

      this.logger.debug(`Stored event ${event.id} (${event.type} ${event.resourceType})`);
    } catch (error) {
      this.logger.error(`Failed to store event ${event.id}:`, error);
      throw error;
    }
  }

  /**
   * Store multiple events in batch
   */
  async storeEvents(events: ResourceEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    try {
      await this.ensureDirectoryExists();

      // Add all to memory buffer
      for (const event of events) {
        this.addToMemoryBuffer(event);
      }

      // Persist all to disk
      await this.persistEvents(events);

      this.logger.debug(`Stored ${events.length} events in batch`);
    } catch (error) {
      this.logger.error(`Failed to store ${events.length} events in batch:`, error);
      throw error;
    }
  }

  /**
   * Get events by query
   */
  async getEvents(query: EventQuery = {}): Promise<ResourceEvent[]> {
    try {
      // First check memory buffer
      let events = this.queryMemoryBuffer(query);

      // If we need more events or specific time range, check disk
      if (this.needsDiskQuery(query, events.length)) {
        const diskEvents = await this.queryDiskEvents(query);
        events = this.mergeAndDeduplicateEvents(events, diskEvents);
      }

      // Apply final filtering and sorting
      events = this.applyFinalFiltering(events, query);

      this.logger.debug(`Retrieved ${events.length} events for query`);
      return events;
    } catch (error) {
      this.logger.error("Failed to get events:", error);
      throw error;
    }
  }

  /**
   * Get events from a specific timestamp (for replay)
   */
  async getEventsFromTimestamp(timestamp: string, limit?: number): Promise<ResourceEvent[]> {
    return this.getEvents({
      fromTimestamp: timestamp,
      limit: limit || 1000
    });
  }

  /**
   * Get recent events
   */
  async getRecentEvents(limit: number = 100): Promise<ResourceEvent[]> {
    const events = [...this.memoryBuffer]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);

    return events;
  }

  /**
   * Clean up old events based on retention policy
   */
  async cleanup(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.options.retentionDays);
      const cutoffTimestamp = cutoffDate.toISOString();

      // Clean memory buffer
      const initialMemorySize = this.memoryBuffer.length;
      this.memoryBuffer = this.memoryBuffer.filter(event => event.timestamp >= cutoffTimestamp);
      this.rebuildEventIndex();

      // Clean disk files
      const deletedFiles = await this.cleanupDiskFiles(cutoffDate);

      this.logger.info(`Cleanup completed: removed ${initialMemorySize - this.memoryBuffer.length} events from memory, ${deletedFiles} files from disk`);
    } catch (error) {
      this.logger.error("Failed to cleanup events:", error);
    }
  }

  /**
   * Get event store statistics
   */
  async getStats(): Promise<EventStoreStats> {
    try {
      const diskStats = await this.getDiskStats();

      const stats: EventStoreStats = {
        totalEvents: this.memoryBuffer.length + diskStats.eventCount,
        eventsInMemory: this.memoryBuffer.length,
        eventsOnDisk: diskStats.eventCount,
        storageSize: diskStats.totalSize
      };

      if (this.memoryBuffer.length > 0) {
        const sortedEvents = [...this.memoryBuffer].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        stats.oldestEvent = sortedEvents[0].timestamp;
        stats.newestEvent = sortedEvents[sortedEvents.length - 1].timestamp;
      }

      return stats;
    } catch (error) {
      this.logger.error("Failed to get event store stats:", error);
      throw error;
    }
  }

  /**
   * Add event to memory buffer
   */
  private addToMemoryBuffer(event: ResourceEvent): void {
    // Check if event already exists
    if (this.eventIndex.has(event.id)) {
      return; // Duplicate event, skip
    }

    // Add to buffer
    this.memoryBuffer.push(event);
    this.eventIndex.set(event.id, this.memoryBuffer.length - 1);

    // Trim buffer if it exceeds max size
    if (this.memoryBuffer.length > this.options.maxEventsInMemory) {
      const eventsToRemove = this.memoryBuffer.length - this.options.maxEventsInMemory;
      const removedEvents = this.memoryBuffer.splice(0, eventsToRemove);

      // Update index
      this.rebuildEventIndex();

      this.logger.debug(`Trimmed ${eventsToRemove} events from memory buffer`);
    }
  }

  /**
   * Rebuild event index after buffer modifications
   */
  private rebuildEventIndex(): void {
    this.eventIndex.clear();
    this.memoryBuffer.forEach((event, index) => {
      this.eventIndex.set(event.id, index);
    });
  }

  /**
   * Persist event to disk
   */
  private async persistEvent(event: ResourceEvent): Promise<void> {
    await this.persistEvents([event]);
  }

  /**
   * Persist multiple events to disk
   */
  private async persistEvents(events: ResourceEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Check if we need a new file
    if (this.currentFileDate !== today || this.currentFileEvents >= this.maxEventsPerFile) {
      this.currentFileDate = today;
      this.currentFileEvents = 0;
    }

    const filename = this.getEventFileName(today, this.currentFileEvents);
    const filepath = path.join(this.eventsDirectory, filename);

    try {
      // Read existing events if file exists
      let existingEvents: ResourceEvent[] = [];
      try {
        const content = await fs.readFile(filepath, 'utf8');
        existingEvents = JSON.parse(content);
      } catch {
        // File doesn't exist or is empty, start fresh
      }

      // Append new events
      existingEvents.push(...events);

      // Write back to file
      await fs.writeFile(filepath, JSON.stringify(existingEvents, null, 2));

      this.currentFileEvents += events.length;
    } catch (error) {
      this.logger.error(`Failed to persist events to ${filepath}:`, error);
      throw error;
    }
  }

  /**
   * Query events from memory buffer
   */
  private queryMemoryBuffer(query: EventQuery): ResourceEvent[] {
    let events = [...this.memoryBuffer];

    // Apply filters
    if (query.resourceType) {
      events = events.filter(e => e.resourceType === query.resourceType);
    }
    if (query.resourceId) {
      events = events.filter(e => e.resourceId === query.resourceId);
    }
    if (query.eventType) {
      events = events.filter(e => e.type === query.eventType);
    }
    if (query.source) {
      events = events.filter(e => e.source === query.source);
    }
    if (query.fromTimestamp) {
      events = events.filter(e => e.timestamp >= query.fromTimestamp!);
    }
    if (query.toTimestamp) {
      events = events.filter(e => e.timestamp <= query.toTimestamp!);
    }

    return events;
  }

  /**
   * Query events from disk files
   */
  private async queryDiskEvents(query: EventQuery): Promise<ResourceEvent[]> {
    const events: ResourceEvent[] = [];

    try {
      const files = await fs.readdir(this.eventsDirectory);
      const eventFiles = files.filter(f => f.startsWith('events-') && f.endsWith('.json'));

      for (const file of eventFiles) {
        try {
          const filepath = path.join(this.eventsDirectory, file);
          const content = await fs.readFile(filepath, 'utf8');
          const fileEvents: ResourceEvent[] = JSON.parse(content);

          // Apply basic filtering
          const filteredEvents = fileEvents.filter(event => {
            if (query.resourceType && event.resourceType !== query.resourceType) return false;
            if (query.resourceId && event.resourceId !== query.resourceId) return false;
            if (query.eventType && event.type !== query.eventType) return false;
            if (query.source && event.source !== query.source) return false;
            if (query.fromTimestamp && event.timestamp < query.fromTimestamp) return false;
            if (query.toTimestamp && event.timestamp > query.toTimestamp) return false;
            return true;
          });

          events.push(...filteredEvents);
        } catch (error) {
          this.logger.warn(`Failed to read event file ${file}:`, error);
        }
      }
    } catch (error) {
      this.logger.error("Failed to query disk events:", error);
    }

    return events;
  }

  /**
   * Check if we need to query disk based on query and memory results
   */
  private needsDiskQuery(query: EventQuery, memoryResultCount: number): boolean {
    // If we have a specific time range that might extend beyond memory
    if (query.fromTimestamp || query.toTimestamp) {
      return true;
    }

    // If we need more results than what's in memory
    if (query.limit && query.limit > memoryResultCount) {
      return true;
    }

    return false;
  }

  /**
   * Merge and deduplicate events from memory and disk
   */
  private mergeAndDeduplicateEvents(memoryEvents: ResourceEvent[], diskEvents: ResourceEvent[]): ResourceEvent[] {
    const eventMap = new Map<string, ResourceEvent>();

    // Add memory events (they take precedence)
    for (const event of memoryEvents) {
      eventMap.set(event.id, event);
    }

    // Add disk events (only if not already in memory)
    for (const event of diskEvents) {
      if (!eventMap.has(event.id)) {
        eventMap.set(event.id, event);
      }
    }

    return Array.from(eventMap.values());
  }

  /**
   * Apply final filtering and sorting
   */
  private applyFinalFiltering(events: ResourceEvent[], query: EventQuery): ResourceEvent[] {
    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Apply offset and limit
    if (query.offset) {
      events = events.slice(query.offset);
    }
    if (query.limit) {
      events = events.slice(0, query.limit);
    }

    return events;
  }

  /**
   * Get event file name
   */
  private getEventFileName(date: string, sequence: number): string {
    const paddedSequence = sequence.toString().padStart(4, '0');
    return `events-${date}-${paddedSequence}.json`;
  }

  /**
   * Clean up old disk files
   */
  private async cleanupDiskFiles(cutoffDate: Date): Promise<number> {
    let deletedFiles = 0;

    try {
      const files = await fs.readdir(this.eventsDirectory);
      const eventFiles = files.filter(f => f.startsWith('events-') && f.endsWith('.json'));

      for (const file of eventFiles) {
        // Extract date from filename
        const dateMatch = file.match(/events-(\d{4}-\d{2}-\d{2})-/);
        if (dateMatch) {
          const fileDate = new Date(dateMatch[1]);
          if (fileDate < cutoffDate) {
            const filepath = path.join(this.eventsDirectory, file);
            await fs.unlink(filepath);
            deletedFiles++;
            this.logger.debug(`Deleted old event file: ${file}`);
          }
        }
      }
    } catch (error) {
      this.logger.error("Failed to cleanup disk files:", error);
    }

    return deletedFiles;
  }

  /**
   * Get disk storage statistics
   */
  private async getDiskStats(): Promise<{ eventCount: number; totalSize: number }> {
    let eventCount = 0;
    let totalSize = 0;

    try {
      const files = await fs.readdir(this.eventsDirectory);
      const eventFiles = files.filter(f => f.startsWith('events-') && f.endsWith('.json'));

      for (const file of eventFiles) {
        try {
          const filepath = path.join(this.eventsDirectory, file);
          const stats = await fs.stat(filepath);
          totalSize += stats.size;

          // Count events in file
          const content = await fs.readFile(filepath, 'utf8');
          const events = JSON.parse(content);
          eventCount += events.length;
        } catch (error) {
          this.logger.warn(`Failed to get stats for event file ${file}:`, error);
        }
      }
    } catch (error) {
      this.logger.error("Failed to get disk stats:", error);
    }

    return { eventCount, totalSize };
  }

  /**
   * Ensure events directory exists
   */
  private async ensureDirectoryExists(): Promise<void> {
    if (this.directoryInitialized) {
      return;
    }

    try {
      // Create parent directory first if it doesn't exist
      const parentDir = path.dirname(this.eventsDirectory);
      await fs.mkdir(parentDir, { recursive: true });

      // Then create the events directory
      await fs.mkdir(this.eventsDirectory, { recursive: true });

      this.directoryInitialized = true;
    } catch (error) {
      this.logger.error("Failed to create events directory:", error);
      throw error;
    }
  }
}
