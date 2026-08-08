/**
 * DomainEventBus - Event Publishing and Subscribing
 *
 * This module provides a centralized event bus for domain events.
 * It enables loose coupling between event producers and consumers.
 *
 * ## Design Decisions
 * - Singleton pattern for application-wide event bus
 * - Type-safe subscriptions using generic event types
 * - Support for both sync and async handlers
 * - Error isolation: handler errors don't affect other handlers
 * - Event history for debugging and replay
 *
 * ## Usage
 * ```typescript
 * // Subscribe to events
 * domainEventBus.subscribe(IssueCreatedEvent, (event) => {
 *   console.log(`Issue created: ${event.data.title}`);
 * });
 *
 * // Publish events
 * domainEventBus.publish(IssueCreatedEvent.create({
 *   issueId: 'issue-1',
 *   title: 'Fix bug',
 * }));
 *
 * // Async subscription
 * domainEventBus.subscribeAsync(IssueCreatedEvent, async (event) => {
 *   await sendNotification(event.data.assignees);
 * });
 * ```
 */

import { DomainEvent } from './DomainEvent';

/**
 * Event handler function type
 */
export type EventHandler<T extends DomainEvent> = (event: T) => void;

/**
 * Async event handler function type
 */
export type AsyncEventHandler<T extends DomainEvent> = (event: T) => Promise<void>;

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  /** Priority for handler execution (lower = higher priority) */
  priority?: number;
  /** Whether to catch and log errors instead of throwing */
  catchErrors?: boolean;
}

/**
 * Internal subscription record
 */
interface SubscriptionRecord<T extends DomainEvent> {
  handler: EventHandler<T> | AsyncEventHandler<T>;
  options: SubscriptionOptions;
  isAsync: boolean;
}

/**
 * DomainEventBus - Centralized event publishing and subscribing
 */
export class DomainEventBus {
  private static instance: DomainEventBus;

  /**
   * Map of event type to subscriptions
   */
  private subscriptions: Map<string, SubscriptionRecord<DomainEvent>[]> = new Map();

  /**
   * Event history for debugging (bounded)
   */
  private history: DomainEvent[] = [];
  private readonly maxHistorySize = 100;

  /**
   * Whether to record events in history
   */
  private enableHistory = true;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): DomainEventBus {
    if (!DomainEventBus.instance) {
      DomainEventBus.instance = new DomainEventBus();
    }
    return DomainEventBus.instance;
  }

  /**
   * Reset the singleton (for testing)
   */
  static resetInstance(): void {
    DomainEventBus.instance = undefined as unknown as DomainEventBus;
  }

  // =========================================================================
  // Subscription Methods
  // =========================================================================

  /**
   * Subscribe to a specific event type by name
   */
  subscribeByName(
    eventTypeName: string,
    handler: EventHandler<DomainEvent>,
    options: SubscriptionOptions = {}
  ): () => void {
    const record: SubscriptionRecord<DomainEvent> = {
      handler,
      options: { priority: 0, catchErrors: false, ...options },
      isAsync: false,
    };

    return this.addSubscription(eventTypeName, record);
  }

  /**
   * Subscribe to a specific event type with async handler by name
   */
  subscribeByNameAsync(
    eventTypeName: string,
    handler: AsyncEventHandler<DomainEvent>,
    options: SubscriptionOptions = {}
  ): () => void {
    const record: SubscriptionRecord<DomainEvent> = {
      handler,
      options: { priority: 0, catchErrors: false, ...options },
      isAsync: true,
    };

    return this.addSubscription(eventTypeName, record);
  }

  /**
   * Subscribe to all events
   */
  subscribeToAll(
    handler: EventHandler<DomainEvent>,
    options: SubscriptionOptions = {}
  ): () => void {
    const record: SubscriptionRecord<DomainEvent> = {
      handler,
      options: { priority: 0, catchErrors: false, ...options },
      isAsync: false,
    };

    return this.addSubscription('*', record);
  }

  /**
   * Unsubscribe from all events for a specific type
   */
  unsubscribeAll(eventType?: string): void {
    if (eventType) {
      this.subscriptions.delete(eventType);
    } else {
      this.subscriptions.clear();
    }
  }

  // =========================================================================
  // Publishing Methods
  // =========================================================================

  /**
   * Publish a domain event synchronously
   */
  publish<T extends DomainEvent>(event: T): void {
    // Record in history
    if (this.enableHistory) {
      this.recordEvent(event);
    }

    // Get handlers for this event type
    const handlers = this.getHandlersForEvent(event);

    // Execute handlers in priority order
    for (const record of handlers) {
      try {
        if (record.isAsync) {
          // For sync publish, we execute async handlers but don't await
          // This maintains the sync API while still executing async handlers
          (record.handler as AsyncEventHandler<T>)(event).catch((error) => {
            if (!record.options.catchErrors) {
              console.error(`Error in async event handler for ${event.eventType}:`, error);
            }
          });
        } else {
          (record.handler as EventHandler<T>)(event);
        }
      } catch (error) {
        if (!record.options.catchErrors) {
          console.error(`Error in event handler for ${event.eventType}:`, error);
        }
      }
    }
  }

  /**
   * Publish a domain event asynchronously (awaits all handlers)
   */
  async publishAsync<T extends DomainEvent>(event: T): Promise<void> {
    // Record in history
    if (this.enableHistory) {
      this.recordEvent(event);
    }

    // Get handlers for this event type
    const handlers = this.getHandlersForEvent(event);

    // Execute handlers in priority order
    const promises: Promise<void>[] = [];

    for (const record of handlers) {
      const executeHandler = async (): Promise<void> => {
        try {
          if (record.isAsync) {
            await (record.handler as AsyncEventHandler<T>)(event);
          } else {
            (record.handler as EventHandler<T>)(event);
          }
        } catch (error) {
          if (!record.options.catchErrors) {
            console.error(`Error in event handler for ${event.eventType}:`, error);
            throw error;
          }
        }
      };

      promises.push(executeHandler());
    }

    await Promise.all(promises);
  }

  // =========================================================================
  // History Methods
  // =========================================================================

  /**
   * Get event history
   */
  getHistory(limit?: number): readonly DomainEvent[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Get history for a specific aggregate
   */
  getHistoryForAggregate(aggregateId: string, limit?: number): readonly DomainEvent[] {
    const filtered = this.history.filter(e => e.aggregateId === aggregateId);
    if (limit) {
      return filtered.slice(-limit);
    }
    return filtered;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Enable or disable history recording
   */
  setHistoryEnabled(enabled: boolean): void {
    this.enableHistory = enabled;
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  /**
   * Get the number of subscriptions for an event type
   */
  getSubscriptionCount(eventType?: string): number {
    if (eventType) {
      return this.subscriptions.get(eventType)?.length ?? 0;
    }

    let count = 0;
    for (const subs of this.subscriptions.values()) {
      count += subs.length;
    }
    return count;
  }

  /**
   * Check if there are any subscriptions
   */
  hasSubscriptions(): boolean {
    return this.subscriptions.size > 0;
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  private addSubscription<T extends DomainEvent>(
    typeName: string,
    record: SubscriptionRecord<T>
  ): () => void {
    const handlers = this.subscriptions.get(typeName) || [];
    handlers.push(record as SubscriptionRecord<DomainEvent>);

    // Sort by priority (lower = higher priority)
    handlers.sort((a, b) => (a.options.priority ?? 0) - (b.options.priority ?? 0));

    this.subscriptions.set(typeName, handlers);

    // Return unsubscribe function
    return () => {
      const currentHandlers = this.subscriptions.get(typeName);
      if (currentHandlers) {
        const index = currentHandlers.indexOf(record as SubscriptionRecord<DomainEvent>);
        if (index !== -1) {
          currentHandlers.splice(index, 1);
        }
      }
    };
  }

  private getHandlersForEvent(event: DomainEvent): SubscriptionRecord<DomainEvent>[] {
    const handlers: SubscriptionRecord<DomainEvent>[] = [];

    // Get handlers for specific event type
    const typeHandlers = this.subscriptions.get(event.eventType);
    if (typeHandlers) {
      handlers.push(...typeHandlers);
    }

    // Get handlers for wildcard subscription
    const wildcardHandlers = this.subscriptions.get('*');
    if (wildcardHandlers) {
      handlers.push(...wildcardHandlers);
    }

    return handlers;
  }

  private recordEvent(event: DomainEvent): void {
    this.history.push(event);

    // Trim history if it exceeds max size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }
}

/**
 * Singleton instance of the domain event bus
 */
export const domainEventBus = DomainEventBus.getInstance();
