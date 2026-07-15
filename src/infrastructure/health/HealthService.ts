/**
 * HealthService - Centralized health check logic for system monitoring.
 *
 * Provides comprehensive health checks for all system components:
 * - GitHub connection status
 * - AI service availability and circuit breaker state
 * - Cache status and persistence
 *
 * @example
 * ```typescript
 * const healthService = new HealthService({
 *   aiFactory: AIServiceFactory.getInstance(),
 *   cache: ResourceCache.getInstance()
 * });
 *
 * const status = await healthService.check();
 * if (status.status === 'degraded') {
 *   console.log('System running in degraded mode');
 * }
 * ```
 */

import type { AIServiceFactory } from '../../services/ai/AIServiceFactory.js';
import type { ResourceCache, CacheStats } from '../cache/ResourceCache.js';
import type { AIResiliencePolicy } from '../resilience/AIResiliencePolicy.js';
import type { CircuitBreakerState } from '../resilience/CircuitBreakerService.js';
import type { GitHubRepositoryFactory } from '../github/GitHubRepositoryFactory.js';

/**
 * Health status for individual services
 */
export interface ServiceHealthStatus {
  github: {
    connected: boolean;
    rateLimit?: {
      remaining: number;
      limit: number;
    };
  };
  ai: {
    available: boolean;
    circuitState: CircuitBreakerState | 'disabled';
    models: {
      available: string[];
      unavailable: string[];
    };
  };
  cache: {
    entries: number;
    persistenceEnabled: boolean;
    lastPersist?: string;
  };
}

/**
 * Overall system health status
 */
export interface HealthStatus {
  /**
   * Overall system status:
   * - 'healthy': All services operational
   * - 'degraded': Some services unavailable but system functional
   * - 'unhealthy': Critical services down
   */
  status: 'healthy' | 'degraded' | 'unhealthy';

  /**
   * ISO timestamp of the health check
   */
  timestamp: string;

  /**
   * System uptime in seconds
   */
  uptime: number;

  /**
   * Individual service health status
   */
  services: ServiceHealthStatus;
}

/**
 * Dependencies for HealthService
 */
export interface HealthServiceDependencies {
  aiFactory?: AIServiceFactory;
  aiResilience?: AIResiliencePolicy;
  cache?: ResourceCache;
  githubFactory?: GitHubRepositoryFactory;
}

/**
 * HealthService provides centralized health checking for the system.
 *
 * It aggregates health status from multiple components and computes
 * an overall system health status.
 */
export class HealthService {
  private readonly aiFactory?: AIServiceFactory;
  private readonly aiResilience?: AIResiliencePolicy;
  private readonly cache?: ResourceCache;
  private readonly githubFactory?: GitHubRepositoryFactory;

  /**
   * Creates a new HealthService.
   *
   * @param deps - Optional dependencies for health checks
   */
  constructor(deps?: HealthServiceDependencies) {
    this.aiFactory = deps?.aiFactory;
    this.aiResilience = deps?.aiResilience;
    this.cache = deps?.cache;
    this.githubFactory = deps?.githubFactory;
  }

  /**
   * Perform a comprehensive health check.
   *
   * Checks all available services and computes overall status:
   * - 'unhealthy' if GitHub is not connected
   * - 'degraded' if AI is unavailable or circuit is open
   * - 'healthy' otherwise
   *
   * @returns Complete health status
   */
  async check(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    const uptime = process.uptime();

    // Check all services
    const [github, ai, cache] = await Promise.all([
      this.checkGitHub(),
      this.checkAI(),
      this.checkCache(),
    ]);

    // Compute overall status
    let status: HealthStatus['status'] = 'healthy';

    // GitHub down = unhealthy (core functionality)
    if (!github.connected) {
      status = 'unhealthy';
    }
    // AI unavailable or circuit open = degraded
    else if (!ai.available || ai.circuitState === 'open') {
      status = 'degraded';
    }

    return {
      status,
      timestamp,
      uptime,
      services: {
        github,
        ai,
        cache,
      },
    };
  }

  /**
   * Check GitHub connection status by querying the REST rate-limit endpoint.
   * This is a lightweight call that verifies connectivity, token validity, and
   * returns current rate-limit headroom in a single request.
   *
   * Fails honest: if no GitHub factory is wired, or the call errors (bad token,
   * network failure, GitHub outage), reports `connected: false` so orchestration
   * probes see the real state instead of a hardcoded success.
   *
   * @returns GitHub health status
   */
  private async checkGitHub(): Promise<ServiceHealthStatus['github']> {
    if (!this.githubFactory) {
      return { connected: false };
    }

    try {
      const octokit = this.githubFactory.getOctokit();
      const response = await octokit.rest.rateLimit.get();
      return {
        connected: true,
        rateLimit: {
          remaining: response.data.rate.remaining,
          limit: response.data.rate.limit,
        },
      };
    } catch {
      return { connected: false };
    }
  }

  /**
   * Check AI service availability and circuit breaker state.
   *
   * @returns AI health status
   */
  private async checkAI(): Promise<ServiceHealthStatus['ai']> {
    if (!this.aiFactory) {
      return {
        available: false,
        circuitState: 'disabled',
        models: {
          available: [],
          unavailable: ['main', 'research', 'fallback', 'prd'],
        },
      };
    }

    const isAvailable = this.aiFactory.isAIAvailable();
    const config = this.aiFactory.validateConfiguration();

    // Get circuit state from resilience policy if available
    let circuitState: CircuitBreakerState | 'disabled' = 'disabled';
    if (this.aiResilience) {
      circuitState = this.aiResilience.getCircuitState();
    }

    return {
      available: isAvailable,
      circuitState,
      models: {
        available: config.availableModels,
        unavailable: config.unavailableModels,
      },
    };
  }

  /**
   * Check cache status.
   *
   * @returns Cache health status
   */
  private async checkCache(): Promise<ServiceHealthStatus['cache']> {
    if (!this.cache) {
      return {
        entries: 0,
        persistenceEnabled: false,
      };
    }

    const stats: CacheStats = this.cache.getStats();

    return {
      entries: stats.size,
      persistenceEnabled: stats.persistenceEnabled,
      lastPersist: stats.lastPersist,
    };
  }
}
