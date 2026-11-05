import { type Mock, vi } from "vitest";

/**
 * Unit tests for HealthService
 *
 * Tests health check aggregation:
 * - Overall status computation
 * - Service status checks
 * - Cache stats inclusion
 * - AI availability and circuit state
 */

import type { CacheStats, ResourceCache } from "../../../../infrastructure/cache/ResourceCache";
import type { GitHubRepositoryFactory } from "../../../../infrastructure/github/GitHubRepositoryFactory";
import { HealthService } from "../../../../infrastructure/health/HealthService";
import type { AIServiceFactory } from "../../../../services/ai/AIServiceFactory";
import { partialFake } from "../../../helpers/aiFakes";

// Mock types for testing
type MockAIServiceFactory = {
  isAIAvailable: Mock;
  getCircuitState: Mock;
  validateConfiguration: Mock;
};

type MockResourceCache = {
  getStats: Mock;
};

type MockGitHubFactory = {
  getOctokit: Mock;
};

describe("HealthService", () => {
  let mockAIFactory: MockAIServiceFactory;
  let mockCache: MockResourceCache;
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
      getCircuitState: vi.fn().mockReturnValue("closed"),
      validateConfiguration: vi.fn().mockReturnValue({
        availableModels: ["main", "fallback"],
        unavailableModels: ["research"],
      }),
    };

    mockCache = {
      getStats: vi.fn().mockReturnValue({
        size: 100,
        persistenceEnabled: true,
        lastPersist: "2026-01-31T07:00:00Z",
      } as CacheStats),
    };

    mockAIFactory.getCircuitState.mockReturnValue("closed");
  });

  describe("check()", () => {
    it("returns HealthStatus structure", async () => {
      const healthService = new HealthService();
      const status = await healthService.check();

      expect(status).toHaveProperty("status");
      expect(status).toHaveProperty("timestamp");
      expect(status).toHaveProperty("uptime");
      expect(status).toHaveProperty("services");
      expect(status.services).toHaveProperty("github");
      expect(status.services).toHaveProperty("ai");
      expect(status.services).toHaveProperty("cache");
    });

    it("returns healthy status when all services ok", async () => {
      const healthService = new HealthService({
        aiFactory: partialFake<AIServiceFactory>(mockAIFactory),
        cache: partialFake<ResourceCache>(mockCache),
        githubFactory: partialFake<GitHubRepositoryFactory>(mockGitHubFactory),
      });

      const status = await healthService.check();

      expect(status.status).toBe("healthy");
      expect(status.services.github.connected).toBe(true);
      expect(status.services.github.rateLimit).toEqual({ remaining: 4999, limit: 5000 });
      expect(status.services.ai.available).toBe(true);
      expect(status.services.ai.circuitState).toBe("closed");
    });

    it("reports GitHub unhealthy when the rate-limit probe fails", async () => {
      mockGitHubFactory.getOctokit.mockReturnValue({
        rest: {
          rateLimit: {
            get: vi.fn().mockRejectedValue(new Error("Bad credentials")),
          },
        },
      });

      const healthService = new HealthService({
        aiFactory: partialFake<AIServiceFactory>(mockAIFactory),
        cache: partialFake<ResourceCache>(mockCache),
        githubFactory: partialFake<GitHubRepositoryFactory>(mockGitHubFactory),
      });

      const status = await healthService.check();

      expect(status.services.github.connected).toBe(false);
      expect(status.status).toBe("unhealthy");
    });

    it("returns degraded when AI unavailable", async () => {
      mockAIFactory.isAIAvailable.mockReturnValue(false);

      const healthService = new HealthService({
        aiFactory: partialFake<AIServiceFactory>(mockAIFactory),
        cache: partialFake<ResourceCache>(mockCache),
        githubFactory: partialFake<GitHubRepositoryFactory>(mockGitHubFactory),
      });

      const status = await healthService.check();

      expect(status.status).toBe("degraded");
      expect(status.services.ai.available).toBe(false);
    });

    it("returns degraded when circuit is open", async () => {
      mockAIFactory.getCircuitState.mockReturnValue("open");

      const healthService = new HealthService({
        aiFactory: partialFake<AIServiceFactory>(mockAIFactory),
        cache: partialFake<ResourceCache>(mockCache),
        githubFactory: partialFake<GitHubRepositoryFactory>(mockGitHubFactory),
      });

      const status = await healthService.check();

      expect(status.status).toBe("degraded");
      expect(status.services.ai.circuitState).toBe("open");
    });

    it("includes cache stats", async () => {
      const healthService = new HealthService({
        cache: partialFake<ResourceCache>(mockCache),
      });

      const status = await healthService.check();

      expect(status.services.cache.entries).toBe(100);
      expect(status.services.cache.persistenceEnabled).toBe(true);
      expect(status.services.cache.lastPersist).toBe("2026-01-31T07:00:00Z");
    });

    it("includes AI model configuration", async () => {
      const healthService = new HealthService({
        aiFactory: partialFake<AIServiceFactory>(mockAIFactory),
      });

      const status = await healthService.check();

      expect(status.services.ai.models.available).toEqual(["main", "fallback"]);
      expect(status.services.ai.models.unavailable).toEqual(["research"]);
    });

    it("includes timestamp in ISO format", async () => {
      const healthService = new HealthService();
      const beforeCheck = Date.now();
      const status = await healthService.check();
      const afterCheck = Date.now();

      const timestamp = new Date(status.timestamp).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(beforeCheck);
      expect(timestamp).toBeLessThanOrEqual(afterCheck);
    });

    it("includes uptime in seconds", async () => {
      const healthService = new HealthService();
      const status = await healthService.check();

      expect(typeof status.uptime).toBe("number");
      expect(status.uptime).toBeGreaterThan(0);
    });
  });

  describe("service availability", () => {
    it("handles missing aiFactory gracefully", async () => {
      const healthService = new HealthService({
        cache: partialFake<ResourceCache>(mockCache),
      });

      const status = await healthService.check();

      expect(status.services.ai.available).toBe(false);
      expect(status.services.ai.circuitState).toBe("disabled");
      expect(status.services.ai.models.unavailable).toEqual([
        "main",
        "research",
        "fallback",
        "prd",
      ]);
    });

    it("handles missing cache gracefully", async () => {
      const healthService = new HealthService({
        aiFactory: partialFake<AIServiceFactory>(mockAIFactory),
      });

      const status = await healthService.check();

      expect(status.services.cache.entries).toBe(0);
      expect(status.services.cache.persistenceEnabled).toBe(false);
      expect(status.services.cache.lastPersist).toBeUndefined();
    });

    it("reports circuit disabled only when the factory reports resilience off", async () => {
      mockAIFactory.getCircuitState.mockReturnValue("disabled");
      const healthService = new HealthService({
        aiFactory: partialFake<AIServiceFactory>(mockAIFactory),
      });

      const status = await healthService.check();

      expect(status.services.ai.circuitState).toBe("disabled");
    });

    it("reflects half-open circuit from the factory", async () => {
      mockAIFactory.getCircuitState.mockReturnValue("half-open");
      const healthService = new HealthService({
        aiFactory: partialFake<AIServiceFactory>(mockAIFactory),
      });

      const status = await healthService.check();

      expect(status.services.ai.circuitState).toBe("half-open");
    });

    it("reports GitHub disconnected when no GitHub factory is wired", async () => {
      const healthService = new HealthService();
      const status = await healthService.check();

      // No GitHub factory means connectivity cannot be verified, so the check
      // fails honest (connected: false) rather than reporting a hardcoded success.
      expect(status.services.github.connected).toBe(false);
      expect(status.status).toBe("unhealthy");
    });
  });

  describe("constructor", () => {
    it("accepts no dependencies", () => {
      const healthService = new HealthService();
      expect(healthService).toBeInstanceOf(HealthService);
    });

    it("accepts partial dependencies", () => {
      const healthService = new HealthService({
        cache: partialFake<ResourceCache>(mockCache),
      });
      expect(healthService).toBeInstanceOf(HealthService);
    });

    it("accepts all dependencies", () => {
      const healthService = new HealthService({
        aiFactory: partialFake<AIServiceFactory>(mockAIFactory),
        cache: partialFake<ResourceCache>(mockCache),
      });
      expect(healthService).toBeInstanceOf(HealthService);
    });
  });
});
