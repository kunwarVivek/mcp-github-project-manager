import { beforeEach, describe, expect, it } from '@jest/globals';
import { ResourceCache } from "../../../../infrastructure/cache/ResourceCache";
import { ResourceType, ResourceStatus } from "../../../../domain/resource-types";

describe("ResourceCache", () => {
  let cache: ResourceCache;

  beforeEach(() => {
    // Get a fresh instance for each test
    cache = ResourceCache.getInstance();
  });

  const mockResource = {
    id: "test-1",
    type: ResourceType.PROJECT,
    version: 1,
    status: ResourceStatus.ACTIVE,
    createdAt: "2025-03-01T00:00:00Z",
    updatedAt: "2025-03-01T00:00:00Z",
    deletedAt: null,
    name: "Test Project",
  };

  describe("basic operations", () => {
    it("should store and retrieve a resource", async () => {
      await cache.set(mockResource);
      const retrieved = await cache.get(ResourceType.PROJECT, "test-1");
      expect(retrieved).toEqual(mockResource);
    });

    it("should delete a resource", async () => {
      await cache.set(mockResource);
      await cache.delete(ResourceType.PROJECT, "test-1");
      const retrieved = await cache.get(ResourceType.PROJECT, "test-1");
      expect(retrieved).toBeNull();
    });

    it("should clear resources by type", async () => {
      await cache.set(mockResource);
      await cache.set({
        ...mockResource,
        id: "test-2",
      });

      await cache.clearByType(ResourceType.PROJECT);
      const retrieved1 = await cache.get(ResourceType.PROJECT, "test-1");
      const retrieved2 = await cache.get(ResourceType.PROJECT, "test-2");
      
      expect(retrieved1).toBeNull();
      expect(retrieved2).toBeNull();
    });
  });

  describe("tag operations", () => {
    it("should store and retrieve resources by tag", async () => {
      await cache.set(mockResource, {
        tags: ["tag1", "tag2"],
      });

      const tag1Resources = await cache.getByTag(
        "tag1",
        ResourceType.PROJECT
      );
      const tag2Resources = await cache.getByTag(
        "tag2",
        ResourceType.PROJECT
      );

      expect(tag1Resources).toHaveLength(1);
      expect(tag2Resources).toHaveLength(1);
      expect(tag1Resources[0]).toEqual(mockResource);
      expect(tag2Resources[0]).toEqual(mockResource);
    });

    it("should clear resources by tag", async () => {
      await cache.set(mockResource, {
        tags: ["tag1"],
      });

      await cache.clearByTag("tag1");
      const resources = await cache.getByTag(
        "tag1",
        ResourceType.PROJECT
      );

      expect(resources).toHaveLength(0);
    });
  });

  describe("cache options", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should respect TTL options", async () => {
      await cache.set(mockResource, {
        ttl: 60, // 60 seconds
      });

      // Advance time by 61 seconds
      jest.advanceTimersByTime(61000);

      const retrieved = await cache.get(ResourceType.PROJECT, "test-1");
      expect(retrieved).toBeNull();
    });

    it("should handle multiple tags for a resource", async () => {
      await cache.set(mockResource, {
        tags: ["tag1", "tag2", "tag3"],
      });

      const tag1Resources = await cache.getByTag("tag1", ResourceType.PROJECT);
      const tag2Resources = await cache.getByTag("tag2", ResourceType.PROJECT);
      const tag3Resources = await cache.getByTag("tag3", ResourceType.PROJECT);

      expect(tag1Resources).toHaveLength(1);
      expect(tag2Resources).toHaveLength(1);
      expect(tag3Resources).toHaveLength(1);
    });
  });

  describe("error handling", () => {
    it("should handle get errors gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      // Force an error by passing invalid parameters
      const result = await cache.get(undefined as any, undefined as any);
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle set errors gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      // Force an error by passing invalid resource
      await cache.set(undefined as any);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});