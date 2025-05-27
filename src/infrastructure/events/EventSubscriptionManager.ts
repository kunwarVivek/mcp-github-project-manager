import { ResourceType } from '../../domain/resource-types';
import { ResourceEvent } from './GitHubWebhookHandler';
import { Logger } from '../logger/index';
import { EventEmitter } from 'events';

export interface EventFilter {
  resourceType?: ResourceType;
  eventType?: ResourceEvent['type'];
  resourceId?: string;
  tags?: string[];
  source?: ResourceEvent['source'];
}

export interface EventSubscription {
  id: string;
  clientId: string;
  filters: EventFilter[];
  transport: 'sse' | 'webhook' | 'internal';
  endpoint?: string;
  lastEventId?: string;
  createdAt: string;
  expiresAt?: string;
  active: boolean;
  metadata?: Record<string, any>;
}

export interface SubscriptionStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  subscriptionsByTransport: Record<string, number>;
  subscriptionsByResourceType: Record<string, number>;
}

export class EventSubscriptionManager extends EventEmitter {
  private readonly logger = Logger.getInstance();
  private subscriptions = new Map<string, EventSubscription>();
  private clientSubscriptions = new Map<string, Set<string>>();
  private resourceTypeIndex = new Map<ResourceType, Set<string>>();
  private eventTypeIndex = new Map<ResourceEvent['type'], Set<string>>();

  constructor() {
    super();
    this.setMaxListeners(1000); // Allow many event listeners
  }

  /**
   * Create a new event subscription
   */
  subscribe(subscription: Omit<EventSubscription, 'id' | 'createdAt' | 'active'>): string {
    const subscriptionId = this.generateSubscriptionId();

    const fullSubscription: EventSubscription = {
      ...subscription,
      id: subscriptionId,
      createdAt: new Date().toISOString(),
      active: true
    };

    // Store subscription
    this.subscriptions.set(subscriptionId, fullSubscription);

    // Index by client
    if (!this.clientSubscriptions.has(subscription.clientId)) {
      this.clientSubscriptions.set(subscription.clientId, new Set());
    }
    this.clientSubscriptions.get(subscription.clientId)!.add(subscriptionId);

    // Index by resource types and event types in filters
    this.indexSubscription(subscriptionId, fullSubscription);

    this.logger.info(`Created subscription ${subscriptionId} for client ${subscription.clientId}`);
    this.emit('subscriptionCreated', fullSubscription);

    return subscriptionId;
  }

  /**
   * Remove a subscription
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    // Remove from indices
    this.removeFromIndices(subscriptionId, subscription);

    // Remove from client index
    const clientSubs = this.clientSubscriptions.get(subscription.clientId);
    if (clientSubs) {
      clientSubs.delete(subscriptionId);
      if (clientSubs.size === 0) {
        this.clientSubscriptions.delete(subscription.clientId);
      }
    }

    // Remove subscription
    this.subscriptions.delete(subscriptionId);

    this.logger.info(`Removed subscription ${subscriptionId} for client ${subscription.clientId}`);
    this.emit('subscriptionRemoved', subscription);

    return true;
  }

  /**
   * Unsubscribe all subscriptions for a client
   */
  unsubscribeClient(clientId: string): number {
    const clientSubs = this.clientSubscriptions.get(clientId);
    if (!clientSubs) {
      return 0;
    }

    const subscriptionIds = Array.from(clientSubs);
    let removedCount = 0;

    for (const subscriptionId of subscriptionIds) {
      if (this.unsubscribe(subscriptionId)) {
        removedCount++;
      }
    }

    this.logger.info(`Removed ${removedCount} subscriptions for client ${clientId}`);
    return removedCount;
  }

  /**
   * Get subscription by ID
   */
  getSubscription(subscriptionId: string): EventSubscription | null {
    return this.subscriptions.get(subscriptionId) || null;
  }

  /**
   * Get all subscriptions for a client
   */
  getClientSubscriptions(clientId: string): EventSubscription[] {
    const subscriptionIds = this.clientSubscriptions.get(clientId);
    if (!subscriptionIds) {
      return [];
    }

    const subscriptions: EventSubscription[] = [];
    for (const id of subscriptionIds) {
      const subscription = this.subscriptions.get(id);
      if (subscription) {
        subscriptions.push(subscription);
      }
    }

    return subscriptions;
  }

  /**
   * Notify subscribers of a new event
   */
  async notifySubscribers(event: ResourceEvent): Promise<void> {
    const matchingSubscriptions = this.getSubscriptionsForEvent(event);

    if (matchingSubscriptions.length === 0) {
      this.logger.debug(`No subscriptions found for event ${event.id}`);
      return;
    }

    this.logger.debug(`Notifying ${matchingSubscriptions.length} subscribers for event ${event.id}`);

    // Group subscriptions by transport type for efficient processing
    const subscriptionsByTransport = this.groupSubscriptionsByTransport(matchingSubscriptions);

    // Process each transport type
    for (const [transport, subscriptions] of subscriptionsByTransport.entries()) {
      try {
        await this.notifySubscriptionsByTransport(transport, subscriptions, event);
      } catch (error) {
        this.logger.error(`Failed to notify ${transport} subscribers:`, error);
      }
    }
  }

  /**
   * Get subscriptions that match an event
   */
  getSubscriptionsForEvent(event: ResourceEvent): EventSubscription[] {
    const matchingSubscriptions: EventSubscription[] = [];

    // Get potential matches from indices
    const potentialMatches = new Set<string>();

    // Add subscriptions that match resource type
    const resourceTypeMatches = this.resourceTypeIndex.get(event.resourceType);
    if (resourceTypeMatches) {
      resourceTypeMatches.forEach(id => potentialMatches.add(id));
    }

    // Add subscriptions that match event type
    const eventTypeMatches = this.eventTypeIndex.get(event.type);
    if (eventTypeMatches) {
      eventTypeMatches.forEach(id => potentialMatches.add(id));
    }

    // If no index matches, check all subscriptions (for subscriptions with no filters)
    if (potentialMatches.size === 0) {
      this.subscriptions.forEach((_, id) => potentialMatches.add(id));
    }

    // Filter potential matches
    for (const subscriptionId of potentialMatches) {
      const subscription = this.subscriptions.get(subscriptionId);
      if (subscription && subscription.active && this.eventMatchesSubscription(event, subscription)) {
        matchingSubscriptions.push(subscription);
      }
    }

    return matchingSubscriptions;
  }

  /**
   * Update subscription's last event ID
   */
  updateLastEventId(subscriptionId: string, eventId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.lastEventId = eventId;
      this.subscriptions.set(subscriptionId, subscription);
    }
  }

  /**
   * Deactivate expired subscriptions
   */
  cleanupExpiredSubscriptions(): number {
    const now = new Date().toISOString();
    const expiredSubscriptions: string[] = [];

    for (const [id, subscription] of this.subscriptions.entries()) {
      if (subscription.expiresAt && subscription.expiresAt < now) {
        expiredSubscriptions.push(id);
      }
    }

    let removedCount = 0;
    for (const id of expiredSubscriptions) {
      if (this.unsubscribe(id)) {
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.info(`Cleaned up ${removedCount} expired subscriptions`);
    }

    return removedCount;
  }

  /**
   * Get subscription statistics
   */
  getStats(): SubscriptionStats {
    const stats: SubscriptionStats = {
      totalSubscriptions: this.subscriptions.size,
      activeSubscriptions: 0,
      subscriptionsByTransport: {},
      subscriptionsByResourceType: {}
    };

    for (const subscription of this.subscriptions.values()) {
      if (subscription.active) {
        stats.activeSubscriptions++;
      }

      // Count by transport
      const transport = subscription.transport;
      stats.subscriptionsByTransport[transport] = (stats.subscriptionsByTransport[transport] || 0) + 1;

      // Count by resource type (from filters)
      for (const filter of subscription.filters) {
        if (filter.resourceType) {
          const resourceType = filter.resourceType;
          stats.subscriptionsByResourceType[resourceType] = (stats.subscriptionsByResourceType[resourceType] || 0) + 1;
        }
      }
    }

    return stats;
  }

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Index subscription for efficient lookup
   */
  private indexSubscription(subscriptionId: string, subscription: EventSubscription): void {
    for (const filter of subscription.filters) {
      // Index by resource type
      if (filter.resourceType) {
        if (!this.resourceTypeIndex.has(filter.resourceType)) {
          this.resourceTypeIndex.set(filter.resourceType, new Set());
        }
        this.resourceTypeIndex.get(filter.resourceType)!.add(subscriptionId);
      }

      // Index by event type
      if (filter.eventType) {
        if (!this.eventTypeIndex.has(filter.eventType)) {
          this.eventTypeIndex.set(filter.eventType, new Set());
        }
        this.eventTypeIndex.get(filter.eventType)!.add(subscriptionId);
      }
    }
  }

  /**
   * Remove subscription from indices
   */
  private removeFromIndices(subscriptionId: string, subscription: EventSubscription): void {
    for (const filter of subscription.filters) {
      // Remove from resource type index
      if (filter.resourceType) {
        const resourceTypeSet = this.resourceTypeIndex.get(filter.resourceType);
        if (resourceTypeSet) {
          resourceTypeSet.delete(subscriptionId);
          if (resourceTypeSet.size === 0) {
            this.resourceTypeIndex.delete(filter.resourceType);
          }
        }
      }

      // Remove from event type index
      if (filter.eventType) {
        const eventTypeSet = this.eventTypeIndex.get(filter.eventType);
        if (eventTypeSet) {
          eventTypeSet.delete(subscriptionId);
          if (eventTypeSet.size === 0) {
            this.eventTypeIndex.delete(filter.eventType);
          }
        }
      }
    }
  }

  /**
   * Check if event matches subscription filters
   */
  private eventMatchesSubscription(event: ResourceEvent, subscription: EventSubscription): boolean {
    // If no filters, match all events
    if (subscription.filters.length === 0) {
      return true;
    }

    // Event must match at least one filter
    return subscription.filters.some(filter => this.eventMatchesFilter(event, filter));
  }

  /**
   * Check if event matches a specific filter
   */
  private eventMatchesFilter(event: ResourceEvent, filter: EventFilter): boolean {
    // Check resource type
    if (filter.resourceType && filter.resourceType !== event.resourceType) {
      return false;
    }

    // Check event type
    if (filter.eventType && filter.eventType !== event.type) {
      return false;
    }

    // Check resource ID
    if (filter.resourceId && filter.resourceId !== event.resourceId) {
      return false;
    }

    // Check source
    if (filter.source && filter.source !== event.source) {
      return false;
    }

    // Check tags (if event has metadata with tags)
    if (filter.tags && filter.tags.length > 0) {
      const eventTags = event.metadata?.tags || [];
      const hasMatchingTag = filter.tags.some(tag => eventTags.includes(tag));
      if (!hasMatchingTag) {
        return false;
      }
    }

    return true;
  }

  /**
   * Group subscriptions by transport type
   */
  private groupSubscriptionsByTransport(subscriptions: EventSubscription[]): Map<string, EventSubscription[]> {
    const grouped = new Map<string, EventSubscription[]>();

    for (const subscription of subscriptions) {
      const transport = subscription.transport;
      if (!grouped.has(transport)) {
        grouped.set(transport, []);
      }
      grouped.get(transport)!.push(subscription);
    }

    return grouped;
  }

  /**
   * Notify subscriptions by transport type
   */
  private async notifySubscriptionsByTransport(
    transport: string,
    subscriptions: EventSubscription[],
    event: ResourceEvent
  ): Promise<void> {
    switch (transport) {
      case 'sse':
        this.emit('sseEvent', { subscriptions, event });
        break;
      case 'webhook':
        this.emit('webhookEvent', { subscriptions, event });
        break;
      case 'internal':
        this.emit('internalEvent', { subscriptions, event });
        break;
      default:
        this.logger.warn(`Unknown transport type: ${transport}`);
    }

    // Update last event ID for all notified subscriptions
    for (const subscription of subscriptions) {
      this.updateLastEventId(subscription.id, event.id);
    }
  }
}
