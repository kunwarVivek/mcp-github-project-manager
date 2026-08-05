import { z } from "zod";
import { ToolDefinition, ToolSchema } from "../ToolValidator";
import { ANNOTATION_PATTERNS } from "../annotations/tool-annotations";
import {
  EventListOutputSchema,
  SubscriptionOutputSchema,
} from "./project-schemas";

// ============================================================================
// Event Management Schemas
// ============================================================================

export const subscribeToEventsSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  filters: z.array(
    z.object({
      resourceType: z.enum(["PROJECT", "MILESTONE", "ISSUE", "SPRINT"]).optional(),
      eventType: z.enum(["created", "updated", "deleted", "closed", "reopened"]).optional(),
      resourceId: z.string().optional(),
      source: z.enum(["github", "api"]).optional(),
      tags: z.array(z.string()).optional(),
    })
  ).default([]),
  transport: z.enum(["sse", "webhook", "internal"]).default("sse"),
  endpoint: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type SubscribeToEventsArgs = z.infer<typeof subscribeToEventsSchema>;

export const getRecentEventsSchema = z.object({
  resourceType: z.enum(["PROJECT", "MILESTONE", "ISSUE", "SPRINT"]).optional(),
  resourceId: z.string().optional(),
  eventType: z.enum(["created", "updated", "deleted", "closed", "reopened"]).optional(),
  limit: z.number().int().positive().default(100).optional(),
});

export type GetRecentEventsArgs = z.infer<typeof getRecentEventsSchema>;

export const replayEventsSchema = z.object({
  fromTimestamp: z.string().datetime("From timestamp must be a valid ISO date string"),
  toTimestamp: z.string().datetime().optional(),
  resourceType: z.enum(["PROJECT", "MILESTONE", "ISSUE", "SPRINT"]).optional(),
  resourceId: z.string().optional(),
  limit: z.number().int().positive().default(1000).optional(),
});

export type ReplayEventsArgs = z.infer<typeof replayEventsSchema>;

// ============================================================================
// Event Management Tool Definitions
// ============================================================================

export const subscribeToEventsTool: ToolDefinition<SubscribeToEventsArgs, z.infer<typeof SubscriptionOutputSchema>> = {
  name: "subscribe_to_events",
  title: "Subscribe to Events",
  description: "Subscribe to real-time events for GitHub resources",
  schema: subscribeToEventsSchema as unknown as ToolSchema<SubscribeToEventsArgs>,
  outputSchema: SubscriptionOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
  examples: [
    {
      name: "Subscribe to all project events",
      description: "Subscribe to all events for projects",
      args: {
        clientId: "my-client",
        filters: [{ resourceType: "PROJECT" }],
        transport: "sse"
      }
    },
    {
      name: "Subscribe to issue updates",
      description: "Subscribe to update events for a specific issue",
      args: {
        clientId: "my-client",
        filters: [{ resourceType: "ISSUE", eventType: "updated", resourceId: "123" }],
        transport: "sse"
      }
    }
  ]
};

export const getRecentEventsTool: ToolDefinition<GetRecentEventsArgs, z.infer<typeof EventListOutputSchema>> = {
  name: "get_recent_events",
  title: "Get Recent Events",
  description: "Get recent events for GitHub resources",
  schema: getRecentEventsSchema as unknown as ToolSchema<GetRecentEventsArgs>,
  outputSchema: EventListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "Get recent project events",
      description: "Get the last 50 events for projects",
      args: {
        resourceType: "PROJECT",
        limit: 50
      }
    },
    {
      name: "Get recent events for specific issue",
      description: "Get recent events for a specific issue",
      args: {
        resourceType: "ISSUE",
        resourceId: "123",
        limit: 20
      }
    }
  ]
};

export const replayEventsTool: ToolDefinition<ReplayEventsArgs, z.infer<typeof EventListOutputSchema>> = {
  name: "replay_events",
  title: "Replay Events",
  description: "Replay events from a specific timestamp",
  schema: replayEventsSchema as unknown as ToolSchema<ReplayEventsArgs>,
  outputSchema: EventListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "Replay events from yesterday",
      description: "Replay all events from yesterday",
      args: {
        fromTimestamp: "2025-01-01T00:00:00Z",
        limit: 500
      }
    },
    {
      name: "Replay project events from specific time",
      description: "Replay project events from a specific timestamp",
      args: {
        fromTimestamp: "2025-01-01T12:00:00Z",
        resourceType: "PROJECT",
        limit: 100
      }
    }
  ]
};
