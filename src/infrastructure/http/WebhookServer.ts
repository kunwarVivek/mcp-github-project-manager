import * as http from 'node:http';
import * as url from 'node:url';
import type { GitHubWebhookHandler, ResourceEvent } from '../events/GitHubWebhookHandler';
import type { EventSubscriptionManager, EventSubscription, } from '../events/EventSubscriptionManager';
import type { EventStore } from '../events/EventStore';
import { type ILogger, Logger } from '../logger/index';
import { SecurityAuditLog } from '../observability/SecurityAuditLog';
import { WEBHOOK_PORT, SSE_ENABLED, WEBHOOK_TIMEOUT_MS, WEBHOOK_ALLOWED_ORIGINS, WEBHOOK_RATE_LIMIT, WEBHOOK_RATE_WINDOW_MS } from '../../env';

export interface SSEConnection {
  id: string;
  response: http.ServerResponse;
  subscriptionId?: string;
  lastEventId?: string;
  clientId: string;
  createdAt: string;
}

export interface WebhookServerOptions {
  port: number;
  enableSSE: boolean;
  timeout: number;
}

export class WebhookServer {
  private readonly logger: ILogger;
  private readonly options: WebhookServerOptions;
  private readonly webhookHandler: GitHubWebhookHandler;
  private readonly subscriptionManager: EventSubscriptionManager;
  private readonly eventStore: EventStore;

  private server?: http.Server;
  private sseConnections = new Map<string, SSEConnection>();
  private isRunning = false;
  private readonly rateLimitMap = new Map<string, { count: number; windowStart: number }>();
  private readonly securityLog: SecurityAuditLog;
  private readonly processedDeliveries = new Set<string>();
  private readonly processedDeliveriesOrder: string[] = [];
  private static readonly MAX_DELIVERY_CACHE = 10_000;
  private static readonly MAX_WEBHOOK_BODY_SIZE = 1_048_576; // 1 MB

  constructor(
    webhookHandler: GitHubWebhookHandler,
    subscriptionManager: EventSubscriptionManager,
    eventStore: EventStore,
    options?: Partial<WebhookServerOptions>,
    logger?: ILogger,
    securityLog?: SecurityAuditLog,
  ) {
    this.logger = logger ?? Logger.getInstance();
    this.securityLog = securityLog ?? new SecurityAuditLog(this.logger);
    this.options = {
      port: options?.port || WEBHOOK_PORT,
      enableSSE: options?.enableSSE ?? SSE_ENABLED,
      timeout: options?.timeout || WEBHOOK_TIMEOUT_MS
    };

    this.webhookHandler = webhookHandler;
    this.subscriptionManager = subscriptionManager;
    this.eventStore = eventStore;

    this.setupEventListeners();
  }

  /**
   * Start the webhook server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("Webhook server is already running");
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res).catch(error => {
          this.logger.error("Error handling request:", error);
          this.sendErrorResponse(res, 500, "Internal server error");
        });
      });

      this.server.setTimeout(this.options.timeout);

      this.server.listen(this.options.port, () => {
        this.isRunning = true;
        this.logger.info(`Webhook server started on port ${this.options.port}`);
        resolve();
      });

      this.server.on('error', (error) => {
        this.logger.error("Webhook server error:", error);
        reject(error);
      });
    });
  }

  /**
   * Stop the webhook server
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      return;
    }

    return new Promise((resolve) => {
      // Close all SSE connections
      for (const connection of this.sseConnections.values()) {
        connection.response.end();
      }
      this.sseConnections.clear();

      this.server!.close(() => {
        this.isRunning = false;
        this.logger.info("Webhook server stopped");
        resolve();
      });
    });
  }

  /**
   * Get server status
   */
  getStatus(): { running: boolean; port: number; connections: number } {
    return {
      running: this.isRunning,
      port: this.options.port,
      connections: this.sseConnections.size
    };
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const parsedUrl = url.parse(req.url || '', true);
    const pathname = parsedUrl.pathname || '';
    const method = req.method || 'GET';

    // Security headers on every response
    this.setSecurityHeaders(res);

    // CORS headers
    this.setCORSHeaders(req, res);

    // Handle preflight requests
    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Rate limiting
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    if (this.isRateLimited(clientIp)) {
      this.securityLog.record({
        type: 'rate_limit_exceeded',
        source: clientIp,
        details: { path: pathname, method },
        severity: 'medium',
      });
      this.sendErrorResponse(res, 429, 'Too Many Requests');
      return;
    }

    try {
      switch (true) {
        case pathname === '/webhooks/github' && method === 'POST':
          await this.handleGitHubWebhook(req, res);
          break;
        case pathname === '/events/stream' && method === 'GET':
          await this.handleSSEConnection(req, res);
          break;
        case pathname === '/events/subscribe' && method === 'POST':
          await this.handleCreateSubscription(req, res);
          break;
        case pathname.startsWith('/events/subscribe/') && method === 'DELETE':
          await this.handleDeleteSubscription(req, res, pathname);
          break;
        case pathname.startsWith('/events/replay/') && method === 'GET':
          await this.handleEventReplay(req, res, pathname);
          break;
        case pathname === '/events/recent' && method === 'GET':
          await this.handleRecentEvents(req, res, parsedUrl.query);
          break;
        case pathname === '/health' && method === 'GET':
          await this.handleHealthCheck(req, res);
          break;
        default:
          this.sendErrorResponse(res, 404, "Not found");
      }
    } catch (error: unknown) {
      const statusCode = (error instanceof Error && 'statusCode' in error && typeof (error as Record<string, unknown>).statusCode === 'number') ? (error as Record<string, unknown>).statusCode as number : 500;
      if (statusCode === 413) {
        this.securityLog.record({
          type: 'payload_too_large',
          source: clientIp,
          details: { path: pathname, method },
          severity: 'medium',
        });
      }
      const message = statusCode === 413 ? 'Payload Too Large' : 'Internal server error';
      this.logger.error(`Error handling ${method} ${pathname}:`, error);
      this.sendErrorResponse(res, statusCode, message);
    }
  }

  /**
   * Handle GitHub webhook
   */
  private async handleGitHubWebhook(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Content-Type validation
    const contentType = req.headers['content-type'] || '';
    if (!contentType.startsWith('application/json')) {
      this.securityLog.record({
        type: 'content_type_invalid',
        source: req.socket.remoteAddress ?? 'unknown',
        details: { contentType },
        severity: 'low',
      });
      this.sendErrorResponse(res, 415, 'Unsupported Media Type: expected application/json');
      return;
    }

    const body = await this.readRequestBody(req);
    const signature = req.headers['x-hub-signature-256'] as string;
    const eventType = req.headers['x-github-event'] as string;
    const delivery = req.headers['x-github-delivery'] as string;

    if (!eventType) {
      this.sendErrorResponse(res, 400, "Missing X-GitHub-Event header");
      return;
    }

    // Idempotency: deduplicate by delivery ID
    if (delivery && this.processedDeliveries.has(delivery)) {
      this.sendJSONResponse(res, 200, { success: true, deduplicated: true });
      return;
    }

    // Validate signature
    const isValidSignature = await this.webhookHandler.validateSignature(body, signature);
    if (!isValidSignature) {
      this.securityLog.record({
        type: signature ? 'webhook_signature_invalid' : 'webhook_signature_missing',
        source: req.socket.remoteAddress ?? 'unknown',
        details: { eventType, delivery },
        severity: 'high',
      });
      this.sendErrorResponse(res, 401, "Invalid signature");
      return;
    }

    try {
      const payload = JSON.parse(body);

      // Validate payload structure
      if (!this.webhookHandler.validateWebhookPayload(eventType, payload)) {
        this.sendErrorResponse(res, 400, "Invalid payload structure");
        return;
      }

      // Create webhook event
      const webhookEvent = this.webhookHandler.createWebhookEvent(eventType, payload, signature, delivery);

      // Process webhook
      const result = await this.webhookHandler.processWebhookEvent(webhookEvent);

      // Track delivery as processed
      if (delivery) {
        this.trackDelivery(delivery);
      }

      if (result.success) {
        // Store events
        if (result.events.length > 0) {
          await this.eventStore.storeEvents(result.events);

          // Notify subscribers
          for (const event of result.events) {
            await this.subscriptionManager.notifySubscribers(event);
          }
        }

        this.sendJSONResponse(res, 200, {
          success: true,
          eventsGenerated: result.events.length,
          skipped: result.skipped,
          reason: result.reason
        });
      } else {
        this.sendJSONResponse(res, 400, {
          success: false,
          errors: result.errors
        });
      }
    } catch (error) {
      this.logger.error("Error processing webhook:", error);
      this.sendErrorResponse(res, 400, "Invalid JSON payload");
    }
  }

  /**
   * Handle SSE connection
   */
  private async handleSSEConnection(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!this.options.enableSSE) {
      this.sendErrorResponse(res, 503, "SSE not enabled");
      return;
    }

    const parsedUrl = url.parse(req.url || '', true);
    const clientId = parsedUrl.query.clientId as string || `client-${Date.now()}`;
    const lastEventId = req.headers['last-event-id'] as string;

    // Set SSE headers
    const allowedOrigin = this.resolveAllowedOrigin(req);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Headers': 'Cache-Control' } : {}),
    });

    // Create SSE connection
    const connectionId = `sse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const connection: SSEConnection = {
      id: connectionId,
      response: res,
      lastEventId,
      clientId,
      createdAt: new Date().toISOString()
    };

    this.sseConnections.set(connectionId, connection);

    // Send initial connection event
    this.sendSSEEvent(res, 'connected', { connectionId, clientId });

    // Handle connection close
    req.on('close', () => {
      this.sseConnections.delete(connectionId);
      this.logger.debug(`SSE connection ${connectionId} closed`);
    });

    // Send missed events if lastEventId is provided
    if (lastEventId) {
      try {
        const missedEvents = await this.eventStore.getEventsFromTimestamp(lastEventId, 100);
        for (const event of missedEvents) {
          this.sendSSEEvent(res, 'event', event);
        }
      } catch (error) {
        this.logger.error("Error sending missed events:", error);
      }
    }

    this.logger.info(`SSE connection established: ${connectionId} for client ${clientId}`);
  }

  /**
   * Handle create subscription
   */
  private async handleCreateSubscription(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await this.readRequestBody(req);

    try {
      const subscriptionData = JSON.parse(body);

      // Validate required fields
      if (!subscriptionData.clientId || !subscriptionData.transport) {
        this.sendErrorResponse(res, 400, "Missing required fields: clientId, transport");
        return;
      }

      // Create subscription
      const subscriptionId = this.subscriptionManager.subscribe({
        clientId: subscriptionData.clientId,
        filters: subscriptionData.filters || [],
        transport: subscriptionData.transport,
        endpoint: subscriptionData.endpoint,
        expiresAt: subscriptionData.expiresAt,
        metadata: subscriptionData.metadata
      });

      this.sendJSONResponse(res, 201, {
        subscriptionId,
        success: true
      });
    } catch (error) {
      this.logger.error("Error creating subscription:", error);
      this.sendErrorResponse(res, 400, "Invalid subscription data");
    }
  }

  /**
   * Handle delete subscription
   */
  private async handleDeleteSubscription(_req: http.IncomingMessage, res: http.ServerResponse, pathname: string): Promise<void> {
    const subscriptionId = pathname.split('/').pop();

    if (!subscriptionId) {
      this.sendErrorResponse(res, 400, "Missing subscription ID");
      return;
    }

    const success = this.subscriptionManager.unsubscribe(subscriptionId);

    if (success) {
      this.sendJSONResponse(res, 200, { success: true });
    } else {
      this.sendErrorResponse(res, 404, "Subscription not found");
    }
  }

  /**
   * Handle event replay
   */
  private async handleEventReplay(_req: http.IncomingMessage, res: http.ServerResponse, pathname: string): Promise<void> {
    const timestamp = pathname.split('/').pop();

    if (!timestamp) {
      this.sendErrorResponse(res, 400, "Missing timestamp");
      return;
    }

    try {
      const events = await this.eventStore.getEventsFromTimestamp(timestamp, 1000);
      this.sendJSONResponse(res, 200, { events });
    } catch (error) {
      this.logger.error("Error replaying events:", error);
      this.sendErrorResponse(res, 500, "Error replaying events");
    }
  }

  /**
   * Handle recent events
   */
  private async handleRecentEvents(_req: http.IncomingMessage, res: http.ServerResponse, query: any): Promise<void> {
    const limit = parseInt(query.limit as string, 10) || 100;

    try {
      const events = await this.eventStore.getRecentEvents(limit);
      this.sendJSONResponse(res, 200, { events });
    } catch (error) {
      this.logger.error("Error getting recent events:", error);
      this.sendErrorResponse(res, 500, "Error getting recent events");
    }
  }

  /**
   * Handle health check
   */
  private async handleHealthCheck(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const stats = await this.eventStore.getStats();
    const subscriptionStats = this.subscriptionManager.getStats();

    this.sendJSONResponse(res, 200, {
      status: 'healthy',
      server: this.getStatus(),
      events: stats,
      subscriptions: subscriptionStats
    });
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for SSE events
    this.subscriptionManager.on('sseEvent', ({ subscriptions, event }) => {
      this.handleSSEEventNotification(subscriptions, event);
    });
  }

  /**
   * Handle SSE event notification
   */
  private handleSSEEventNotification(subscriptions: EventSubscription[], event: ResourceEvent): void {
    for (const subscription of subscriptions) {
      // Find SSE connections for this subscription
      for (const connection of this.sseConnections.values()) {
        if (connection.clientId === subscription.clientId) {
          this.sendSSEEvent(connection.response, 'event', event);
        }
      }
    }
  }

  /**
   * Send SSE event
   */
  private sendSSEEvent(res: http.ServerResponse, type: string, data: any): void {
    try {
      const eventData = `event: ${type}\ndata: ${JSON.stringify(data)}\nid: ${data.id || Date.now()}\n\n`;
      res.write(eventData);
    } catch (error) {
      this.logger.error("Error sending SSE event:", error);
    }
  }

  /**
   * Read request body
   */
  private async readRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let body = '';
      let size = 0;
      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > WebhookServer.MAX_WEBHOOK_BODY_SIZE) {
          req.destroy();
          reject(Object.assign(new Error('Payload Too Large'), { statusCode: 413 }));
          return;
        }
        body += chunk.toString();
      });
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  /**
   * Set CORS headers
   */
  private setCORSHeaders(req: http.IncomingMessage, res: http.ServerResponse): void {
    const allowedOrigin = this.resolveAllowedOrigin(req);
    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Hub-Signature-256, X-GitHub-Event, X-GitHub-Delivery');
      res.setHeader('Vary', 'Origin');
    } else if (req.headers['origin']) {
      this.securityLog.record({
        type: 'cors_origin_rejected',
        source: req.socket.remoteAddress ?? 'unknown',
        details: { origin: req.headers['origin'] },
        severity: 'medium',
      });
    }
  }

  /**
   * Resolve the allowed origin from request against the allowlist.
   * Returns the reflected origin, '*', or undefined (no CORS headers).
   */
  private resolveAllowedOrigin(req: http.IncomingMessage): string | undefined {
    const cfg = WEBHOOK_ALLOWED_ORIGINS;
    if (!cfg) return undefined; // empty = reject cross-origin
    if (cfg === '*') return '*';
    const allowed = cfg.split(',').map(o => o.trim()).filter(Boolean);
    const origin = req.headers['origin'];
    if (origin && allowed.includes(origin)) return origin;
    return undefined;
  }

  /**
   * Set security response headers
   */
  private setSecurityHeaders(res: http.ServerResponse): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0');
  }

  /**
   * Simple in-memory per-IP rate limiter (sliding window).
   */
  private isRateLimited(ip: string): boolean {
    const now = Date.now();
    const limit = WEBHOOK_RATE_LIMIT;
    const window = WEBHOOK_RATE_WINDOW_MS;
    const entry = this.rateLimitMap.get(ip);
    if (!entry || now - entry.windowStart >= window) {
      this.rateLimitMap.set(ip, { count: 1, windowStart: now });
      return false;
    }
    entry.count++;
    return entry.count > limit;
  }

  /**
   * Track a processed delivery ID with bounded FIFO eviction.
   */
  private trackDelivery(delivery: string): void {
    this.processedDeliveries.add(delivery);
    this.processedDeliveriesOrder.push(delivery);
    while (this.processedDeliveriesOrder.length > WebhookServer.MAX_DELIVERY_CACHE) {
      const oldest = this.processedDeliveriesOrder.shift()!;
      this.processedDeliveries.delete(oldest);
    }
  }

  /**
   * Send JSON response
   */
  private sendJSONResponse(res: http.ServerResponse, statusCode: number, data: any): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  /**
   * Send error response
   */
  private sendErrorResponse(res: http.ServerResponse, statusCode: number, message: string): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }

  getSecurityLog(): SecurityAuditLog {
    return this.securityLog;
  }
}
