import { vi } from 'vitest';
/**
 * Unit tests for HealthService
 *
 * Tests health check aggregation:
 * - Overall status computation
 * - Service status checks
 * - Cache stats inclusion
 * - AI availability and circuit state
 */

import { HealthService, } from '../../../src/infrastructure/health/HealthService.js';
import type { AIServiceFactory } from '../../../src/services/ai/AIServiceFactory.js';
import type { ResourceCache, CacheStats } from '../../../src/infrastructure/cache/ResourceCache.js';
import type { AIResiliencePolicy } from '../../../src/infrastructure/resilience/AIResiliencePolicy.js';
import type { GitHubRepositoryFactory } from '../../../src/infrastructure/github/GitHubRepositoryFactory.js';

// Mock types for testing
type MockAIServiceFactory = {
  isAIAvailable: Mock;
  validateConfiguration: Mock;
};

type MockResourceCache = {
  getStats: Mock;
};

type MockAIResiliencePolicy = {
  getCircuitState: Mock;
};

type MockGitHubFactory = {
  getOctokit: Mock;
};

describe('HealthService', () => {
  let mockAIFactory: MockAIServiceFactory;
  let mockCache: MockResourceCache;
  let mockResilience: MockAIResiliencePolicy;
  let mockGitHubFactory: MockGitHubFactory;

  beforeEach(() => {
    mockGitHubFactory = {
      getOctokit: vi.fn().mockReturnValue({
        rest: {
          rateLimit: {
            get: vi.fn().mockResolvedValue({
              data: { rate: { remaining: 4999, limit: 5000 } },
            }),
          },
        },
      }),
    };

    mockAIFactory = {
      isAIAvailable: vi.fn().mockReturnValue(true),
      validateConfiguration: vi.fn().mockReturnValue({
        availableModels: ['main', 'fallback'],
        unavailableModels: ['research'],
      }),
    };

    mockCache = {
      getStats: vi.fn().mockReturnValue({
        size: 100,
        persistenceEnabled: true,
        lastPersist: '2026-01-31T07:00:00Z',
      } as CacheStats),
    };

    mockResilience = {
      getCircuitState: vi.fn().mockReturnValue('closed'),
    };
  });

  describe('check()', () => {
    it('returns HealthStatus structure', async () => {
      const healthService = new HealthService();
      const status = await healthService.check();

      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('timestamp');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('services');
      expect(status.services).toHaveProperty('github');
      expect(status.services).toHaveProperty('ai');
      expect(status.services).toHaveProperty('cache');
    });

    it('returns healthy status when all services ok', async () => {
      const healthService = new HealthService({
        aiFactory: mockAIFactory as unknown as AIServiceFactory,
        aiResilience: mockResilience as unknown as AIResiliencePolicy,
        cache: mockCache as unknown as ResourceCache,
        githubFactory: mockGitHubFactory as unknown as GitHubRepositoryFactory,
      });

      const status = await healthService.check();

      expect(status.status).toBe('healthy');
      expect(status.services.github.connected).toBe(true);
      expect(status.services.github.rateLimit).toEqual({ remaining: 4999, limit: 5000 });
      expect(status.services.ai.available).toBe(true);
      expect(status.services.ai.circuitState).toBe('closed');
    });

    it('reports GitHub unhealthy when the rate-limit probe fails', async () => {
      mockGitHubFactory.getOctokit.mockReturnValue({
        rest: {
          rateLimit: {
            get: vi.fn().mockRejectedValue(new Error('Bad credentials')),
          },
        },
      });

      const healthService = new HealthService({
        aiFactory: mockAIFactory as unknown as AIServiceFactory,
        aiResilience: mockResilience as unknown as AIResiliencePolicy,
        cache: mockCache as unknown as ResourceCache,
        githubFactory: mockGitHubFactory as unknown as GitHubRepositoryFactory,
      });

      const status = await healthService.check();

      expect(status.services.github.connected).toBe(false);
      expect(status.status).toBe('unhealthy');
    });

    it('returns degraded when AI unavailable', async () => {
      mockAIFactory.isAIAvailable.mockReturnValue(false);

      const healthService = new HealthService({
        aiFactory: mockAIFactory as unknown as AIServiceFactory,
        aiResilience: mockResilience as unknown as AIResiliencePolicy,
        cache: mockCache as unknown as ResourceCache,
        githubFactory: mockGitHubFactory as unknown as GitHubRepositoryFactory,
      });

      const status = await healthService.check();

      expect(status.status).toBe('degraded');
      expect(status.services.ai.available).toBe(false);
    });

    it('returns degraded when circuit is open', async () => {
      mockResilience.getCircuitState.mockReturnValue('open');

      const healthService = new HealthService({
        aiFactory: mockAIFactory as unknown as AIServiceFactory,
        aiResilience: mockResilience as unknown as AIResiliencePolicy,
        cache: mockCache as unknown as ResourceCache,
        githubFactory: mockGitHubFactory as unknown as GitHubRepositoryFactory,
      });

      const status = await healthService.check();

      expect(status.status).toBe('degraded');
      expect(status.services.ai.circuitState).toBe('open');
    });

    it('includes cache stats', async () => {
      const healthService = new HealthService({
        cache: mockCache as unknown as ResourceCache,
      });

      const status = await healthService.check();

      expect(status.services.cache.entries).toBe(100);
      expect(status.services.cache.persistenceEnabled).toBe(true);
      expect(status.services.cache.lastPersist).toBe('2026-01-31T07:00:00Z');
    });

    it('includes AI model configuration', async () => {
      const healthService = new HealthService({
        aiFactory: mockAIFactory as unknown as AIServiceFactory,
        aiResilience: mockResilience as unknown as AIResiliencePolicy,
      });

      const status = await healthService.check();

      expect(status.services.ai.models.available).toEqual(['main', 'fallback']);
      expect(status.services.ai.models.unavailable).toEqual(['research']);
    });

    it('includes timestamp in ISO format', async () => {
      const healthService = new HealthService();
      const beforeCheck = Date.now();
      const status = await healthService.check();
      const afterCheck = Date.now();

      const timestamp = new Date(status.timestamp).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(beforeCheck);
      expect(timestamp).toBeLessThanOrEqual(afterCheck);
    });

    it('includes uptime in seconds', async () => {
      const healthService = new HealthService();
      const status = await healthService.check();

      expect(typeof status.uptime).toBe('number');
      expect(status.uptime).toBeGreaterThan(0);
    });
  });

  describe('service availability', () => {
    it('handles missing aiFactory gracefully', async () => {
      const healthService = new HealthService({
        cache: mockCache as unknown as ResourceCache,
      });

      const status = await healthService.check();

      expect(status.services.ai.available).toBe(false);
      expect(status.services.ai.circuitState).toBe('disabled');
      expect(status.services.ai.models.unavailable).toEqual([
        'main',
        'research',
        'fallback',
        'prd',
      ]);
    });

    it('handles missing cache gracefully', async () => {
      const healthService = new HealthService({
        aiFactory: mockAIFactory as unknown as AIServiceFactory,
        aiResilience: mockResilience as unknown as AIResiliencePolicy,
      });

      const status = await healthService.check();

      expect(status.services.cache.entries).toBe(0);
      expect(status.services.cache.persistenceEnabled).toBe(false);
      expect(status.services.cache.lastPersist).toBeUndefined();
    });

    it('handles missing resilience gracefully', async () => {
      const healthService = new HealthService({
        aiFactory: mockAIFactory as unknown as AIServiceFactory,
        cache: mockCache as unknown as ResourceCache,
      });

      const status = await healthService.check();

      expect(status.services.ai.circuitState).toBe('disabled');
    });

    it('reports GitHub disconnected when no GitHub factory is wired', async () => {
      const healthService = new HealthService();
      const status = await healthService.check();

      // No GitHub factory means connectivity cannot be verified, so the check
      // fails honest (connected: false) rather than reporting a hardcoded success.
      expect(status.services.github.connected).toBe(false);
      expect(status.status).toBe('unhealthy');
    });
  });

  describe('constructor', () => {
    it('accepts no dependencies', () => {
      const healthService = new HealthService();
      expect(healthService).toBeInstanceOf(HealthService);
    });

    it('accepts partial dependencies', () => {
      const healthService = new HealthService({
        cache: mockCache as unknown as ResourceCache,
      });
      expect(healthService).toBeInstanceOf(HealthService);
    });

    it('accepts all dependencies', () => {
      const healthService = new HealthService({
        aiFactory: mockAIFactory as unknown as AIServiceFactory,
        aiResilience: mockResilience as unknown as AIResiliencePolicy,
        cache: mockCache as unknown as ResourceCache,
      });
      expect(healthService).toBeInstanceOf(HealthService);
    });
  });
});
