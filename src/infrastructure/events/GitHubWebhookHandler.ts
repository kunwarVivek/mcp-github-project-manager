import * as crypto from 'crypto';
import { ResourceType } from '../../domain/resource-types';
import { Logger } from '../logger/index';
import { WEBHOOK_SECRET } from '../../env';

export interface WebhookEvent {
  id: string;
  type: string;
  timestamp: string;
  payload: any;
  signature: string;
  delivery: string;
}

export interface ResourceEvent {
  id: string;
  type: 'created' | 'updated' | 'deleted' | 'closed' | 'reopened';
  resourceType: ResourceType;
  resourceId: string;
  timestamp: string;
  data: any;
  source: 'github' | 'api';
  metadata?: Record<string, any>;
}

export interface WebhookProcessingResult {
  success: boolean;
  events: ResourceEvent[];
  errors: string[];
  skipped: boolean;
  reason?: string;
}

export class GitHubWebhookHandler {
  private readonly logger = Logger.getInstance();
  private readonly webhookSecret: string;

  constructor(webhookSecret?: string) {
    this.webhookSecret = webhookSecret || WEBHOOK_SECRET;
  }

  /**
   * Validate GitHub webhook signature
   */
  async validateSignature(payload: string, signature: string): Promise<boolean> {
    if (!this.webhookSecret) {
      this.logger.warn("No webhook secret configured, skipping signature validation");
      return true; // Allow if no secret is configured
    }

    if (!signature) {
      this.logger.error("No signature provided in webhook request");
      return false;
    }

    try {
      // GitHub sends signature as "sha256=<hash>"
      const expectedSignature = signature.startsWith('sha256=')
        ? signature
        : `sha256=${signature}`;

      const computedSignature = `sha256=${crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload, 'utf8')
        .digest('hex')}`;

      // Use timingSafeEqual to prevent timing attacks
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const computedBuffer = Buffer.from(computedSignature, 'utf8');

      if (expectedBuffer.length !== computedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, computedBuffer);
    } catch (error) {
      this.logger.error("Error validating webhook signature:", error);
      return false;
    }
  }

  /**
   * Process incoming webhook event
   */
  async processWebhookEvent(event: WebhookEvent): Promise<WebhookProcessingResult> {
    const result: WebhookProcessingResult = {
      success: false,
      events: [],
      errors: [],
      skipped: false
    };

    try {
      this.logger.info(`Processing webhook event: ${event.type} (${event.id})`);

      // Convert webhook to resource events
      const resourceEvents = await this.convertToResourceEvents(event);

      if (resourceEvents.length === 0) {
        result.skipped = true;
        result.reason = `No relevant resource events found for webhook type: ${event.type}`;
        this.logger.debug(result.reason);
        return result;
      }

      result.events = resourceEvents;
      result.success = true;

      this.logger.info(`Successfully processed webhook ${event.id}: generated ${resourceEvents.length} resource events`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error processing webhook";
      result.errors.push(errorMessage);
      this.logger.error(`Failed to process webhook ${event.id}:`, error);
    }

    return result;
  }

  /**
   * Convert GitHub webhook to resource events
   */
  async convertToResourceEvents(webhook: WebhookEvent): Promise<ResourceEvent[]> {
    const events: ResourceEvent[] = [];

    try {
      switch (webhook.type) {
        case 'projects_v2':
          events.push(...await this.handleProjectsV2Event(webhook));
          break;
        case 'projects_v2_item':
          events.push(...await this.handleProjectsV2ItemEvent(webhook));
          break;
        case 'milestone':
          events.push(...await this.handleMilestoneEvent(webhook));
          break;
        case 'issues':
          events.push(...await this.handleIssueEvent(webhook));
          break;
        case 'pull_request':
          events.push(...await this.handlePullRequestEvent(webhook));
          break;
        case 'project_card':
        case 'project_column':
        case 'project':
          events.push(...await this.handleLegacyProjectEvent(webhook));
          break;
        default:
          this.logger.debug(`Unhandled webhook type: ${webhook.type}`);
      }
    } catch (error) {
      this.logger.error(`Error converting webhook ${webhook.type} to resource events:`, error);
      throw error;
    }

    return events;
  }

  /**
   * Handle GitHub Projects v2 events
   */
  private async handleProjectsV2Event(webhook: WebhookEvent): Promise<ResourceEvent[]> {
    const { action, projects_v2: project } = webhook.payload;

    if (!project) {
      return [];
    }

    const eventType = this.mapActionToEventType(action);
    if (!eventType) {
      return [];
    }

    return [{
      id: `${webhook.id}-project-${project.id}`,
      type: eventType,
      resourceType: ResourceType.PROJECT,
      resourceId: project.id.toString(),
      timestamp: webhook.timestamp,
      data: project,
      source: 'github',
      metadata: {
        action,
        webhookId: webhook.id,
        delivery: webhook.delivery
      }
    }];
  }

  /**
   * Handle GitHub Projects v2 item events
   */
  private async handleProjectsV2ItemEvent(webhook: WebhookEvent): Promise<ResourceEvent[]> {
    const { action, projects_v2_item: item } = webhook.payload;

    if (!item) {
      return [];
    }

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
          timestamp: webhook.timestamp,
          data: item,
          source: 'github',
          metadata: {
            action,
            projectId: item.project_node_id,
            webhookId: webhook.id,
            delivery: webhook.delivery
          }
        });
      }
    }

    return events;
  }

  /**
   * Handle milestone events
   */
  private async handleMilestoneEvent(webhook: WebhookEvent): Promise<ResourceEvent[]> {
    const { action, milestone } = webhook.payload;

    if (!milestone) {
      return [];
    }

    const eventType = this.mapActionToEventType(action);
    if (!eventType) {
      return [];
    }

    return [{
      id: `${webhook.id}-milestone-${milestone.id}`,
      type: eventType,
      resourceType: ResourceType.MILESTONE,
      resourceId: milestone.id.toString(),
      timestamp: webhook.timestamp,
      data: milestone,
      source: 'github',
      metadata: {
        action,
        webhookId: webhook.id,
        delivery: webhook.delivery
      }
    }];
  }

  /**
   * Handle issue events
   */
  private async handleIssueEvent(webhook: WebhookEvent): Promise<ResourceEvent[]> {
    const { action, issue } = webhook.payload;

    if (!issue) {
      return [];
    }

    const eventType = this.mapActionToEventType(action);
    if (!eventType) {
      return [];
    }

    return [{
      id: `${webhook.id}-issue-${issue.id}`,
      type: eventType,
      resourceType: ResourceType.ISSUE,
      resourceId: issue.id.toString(),
      timestamp: webhook.timestamp,
      data: issue,
      source: 'github',
      metadata: {
        action,
        webhookId: webhook.id,
        delivery: webhook.delivery
      }
    }];
  }

  /**
   * Handle pull request events (treated as issues for project management)
   */
  private async handlePullRequestEvent(webhook: WebhookEvent): Promise<ResourceEvent[]> {
    const { action, pull_request } = webhook.payload;

    if (!pull_request) {
      return [];
    }

    const eventType = this.mapActionToEventType(action);
    if (!eventType) {
      return [];
    }

    return [{
      id: `${webhook.id}-pr-${pull_request.id}`,
      type: eventType,
      resourceType: ResourceType.ISSUE, // PRs are treated as issues in project management
      resourceId: pull_request.id.toString(),
      timestamp: webhook.timestamp,
      data: pull_request,
      source: 'github',
      metadata: {
        action,
        isPullRequest: true,
        webhookId: webhook.id,
        delivery: webhook.delivery
      }
    }];
  }

  /**
   * Handle legacy project events (GitHub Projects v1)
   */
  private async handleLegacyProjectEvent(webhook: WebhookEvent): Promise<ResourceEvent[]> {
    // For now, we'll skip legacy project events since we focus on Projects v2
    this.logger.debug(`Skipping legacy project event: ${webhook.type}`);
    return [];
  }

  /**
   * Map GitHub action to our event type
   */
  private mapActionToEventType(action: string): ResourceEvent['type'] | null {
    switch (action) {
      case 'created':
      case 'opened':
        return 'created';
      case 'edited':
      case 'updated':
        return 'updated';
      case 'deleted':
        return 'deleted';
      case 'closed':
        return 'closed';
      case 'reopened':
        return 'reopened';
      default:
        return null;
    }
  }

  /**
   * Create a webhook event from HTTP request data
   */
  createWebhookEvent(
    eventType: string,
    payload: any,
    signature: string,
    delivery: string
  ): WebhookEvent {
    return {
      id: `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      timestamp: new Date().toISOString(),
      payload,
      signature,
      delivery
    };
  }

  /**
   * Validate webhook payload structure
   */
  validateWebhookPayload(eventType: string, payload: any): boolean {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    // Basic validation based on event type
    switch (eventType) {
      case 'projects_v2':
        return !!(payload.projects_v2 && payload.action);
      case 'projects_v2_item':
        return !!(payload.projects_v2_item && payload.action);
      case 'milestone':
        return !!(payload.milestone && payload.action);
      case 'issues':
        return !!(payload.issue && payload.action);
      case 'pull_request':
        return !!(payload.pull_request && payload.action);
      default:
        return true; // Allow unknown event types for future compatibility
    }
  }
}
