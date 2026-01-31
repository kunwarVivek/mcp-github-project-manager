/**
 * Health check MCP tool for system monitoring.
 *
 * Provides the health_check tool which returns comprehensive
 * system health status including GitHub, AI, and cache services.
 */

import { z } from 'zod';
import { ToolDefinition, ToolSchema } from './ToolValidator.js';
import { HealthService } from '../health/index.js';
import { AIServiceFactory } from '../../services/ai/AIServiceFactory.js';
import { ResourceCache } from '../cache/ResourceCache.js';

/**
 * Schema for health_check tool input (no parameters required)
 */
export const healthCheckSchema = z.object({});

export type HealthCheckArgs = z.infer<typeof healthCheckSchema>;

/**
 * Zod schema for health status output - matches HealthStatus interface
 */
export const HealthStatusOutputSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string(),
  uptime: z.number(),
  services: z.object({
    github: z.object({
      connected: z.boolean(),
      rateLimit: z.object({
        remaining: z.number(),
        limit: z.number(),
      }).optional(),
    }),
    ai: z.object({
      available: z.boolean(),
      circuitState: z.enum(['closed', 'open', 'half-open', 'disabled']),
      models: z.object({
        available: z.array(z.string()),
        unavailable: z.array(z.string()),
      }),
    }),
    cache: z.object({
      entries: z.number(),
      persistenceEnabled: z.boolean(),
      lastPersist: z.string().optional(),
    }),
  }),
});

export type HealthStatusOutput = z.infer<typeof HealthStatusOutputSchema>;

/**
 * health_check MCP tool definition.
 *
 * Returns comprehensive system health status including:
 * - GitHub connection status
 * - AI service availability and circuit breaker state
 * - Cache status and persistence info
 */
export const healthCheckTool: ToolDefinition<HealthCheckArgs, HealthStatusOutput> = {
  name: 'health_check',
  title: 'Health Check',
  description: 'Check system health and service availability. Returns status of GitHub connection, AI services, and cache.',
  schema: healthCheckSchema as unknown as ToolSchema<HealthCheckArgs>,
  outputSchema: HealthStatusOutputSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false, // Does not make external calls (GitHub check is placeholder)
  },
  examples: [
    {
      name: 'Check system health',
      description: 'Get the current health status of all system services',
      args: {},
    },
  ],
};

/**
 * Execute the health_check tool.
 *
 * Creates a HealthService with available dependencies and returns
 * the comprehensive health status.
 *
 * @returns The current system health status
 */
export async function executeHealthCheck(): Promise<HealthStatusOutput> {
  const healthService = new HealthService({
    aiFactory: AIServiceFactory.getInstance(),
    cache: ResourceCache.getInstance(),
    // Note: aiResilience is not wired here as it requires explicit enablement
    // The health check will show circuitState: 'disabled' in this case
  });

  return healthService.check();
}
