import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Resource, ResourceType } from "../../../../domain/resource-types";
import { ResourceCache } from "../../../../infrastructure/cache/ResourceCache";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function resource(id: string, type: ResourceType = ResourceType.ISSUE): Resource {
  return { id, type, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() };
}

describe("ResourceCache (real implementation)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is a constructible class that stores and returns resources", async () => {
    const cache = new ResourceCache();
    const issue = resource("1");
    await cache.set(ResourceType.ISSUE, "1", issue);

    expect(await cache.get(ResourceType.ISSUE, "1")).toEqual(issue);
    expect(await cache.get(ResourceType.ISSUE, "missing")).toBeNull();
    expect(await cache.get(ResourceType.PROJECT, "1")).toBeNull();
  });

  describe("capacity cap", () => {
    it("evicts oldest-written entries first once maxEntries is exceeded", async () => {
      const cache = new ResourceCache(3);
      for (const id of ["a", "b", "c", "d", "e"]) {
        await cache.set(ResourceType.ISSUE, id, resource(id));
      }

      expect(cache.getSize()).toBe(3);
      expect(await cache.get(ResourceType.ISSUE, "a")).toBeNull();
      expect(await cache.get(ResourceType.ISSUE, "b")).toBeNull();
      for (const id of ["c", "d", "e"]) {
        expect(await cache.get(ResourceType.ISSUE, id)).not.toBeNull();
      }
    });

    it("treats a re-set as most recently written so it survives eviction", async () => {
      const cache = new ResourceCache(3);
      for (const id of ["a", "b", "c"]) {
        await cache.set(ResourceType.ISSUE, id, resource(id));
      }
      await cache.set(ResourceType.ISSUE, "a", resource("a"));
      await cache.set(ResourceType.ISSUE, "d", resource("d"));

      expect(await cache.get(ResourceType.ISSUE, "a")).not.toBeNull();
      expect(await cache.get(ResourceType.ISSUE, "b")).toBeNull();
      expect(cache.getSize()).toBe(3);
    });

    it("does not grow past the cap when the same key is rewritten", async () => {
      const cache = new ResourceCache(2);
      for (let i = 0; i < 10; i++) {
        await cache.set(ResourceType.ISSUE, "same", resource("same"));
      }
      expect(cache.getSize()).toBe(1);
    });

    it("removes evicted entries from tag, type and namespace indices", async () => {
      const cache = new ResourceCache(1);
      await cache.set(ResourceType.ISSUE, "old", resource("old"), {
        tags: ["t"],
        namespaces: ["ns"],
      });
      await cache.set(ResourceType.PROJECT, "new", resource("new", ResourceType.PROJECT));

      expect(await cache.getByTag("t")).toEqual([]);
      expect(await cache.getByNamespace("ns")).toEqual([]);
      expect(await cache.getByType(ResourceType.ISSUE)).toEqual([]);
      expect(cache.getStats()).toMatchObject({
        size: 1,
        tagCount: 0,
        namespaceCount: 0,
        typeCount: 1,
      });
    });
  });

  describe("TTL expiry", () => {
    it("returns the entry before the TTL and null after it", async () => {
      const cache = new ResourceCache();
      await cache.set(ResourceType.ISSUE, "1", resource("1"), { ttl: 1000 });

      vi.advanceTimersByTime(1000);
      expect(await cache.get(ResourceType.ISSUE, "1")).not.toBeNull();

      vi.advanceTimersByTime(1);
      expect(await cache.get(ResourceType.ISSUE, "1")).toBeNull();
      expect(cache.getSize()).toBe(0);
    });

    it("applies a one hour default TTL", async () => {
      const cache = new ResourceCache();
      await cache.set(ResourceType.ISSUE, "1", resource("1"));

      vi.advanceTimersByTime(3_600_000);
      expect(await cache.get(ResourceType.ISSUE, "1")).not.toBeNull();
      vi.advanceTimersByTime(1);
      expect(await cache.get(ResourceType.ISSUE, "1")).toBeNull();
    });

    it("cleans every index when an entry expires on access", async () => {
      const cache = new ResourceCache();
      await cache.set(ResourceType.ISSUE, "1", resource("1"), {
        ttl: 100,
        tags: ["t"],
        namespaces: ["ns1", "ns2"],
      });

      vi.advanceTimersByTime(101);
      expect(await cache.get(ResourceType.ISSUE, "1")).toBeNull();

      expect(cache.getStats()).toMatchObject({
        size: 0,
        tagCount: 0,
        typeCount: 0,
        namespaceCount: 0,
      });
    });

    it("lets queries skip expired entries and prune them from the indices", async () => {
      const cache = new ResourceCache();
      await cache.set(ResourceType.ISSUE, "short", resource("short"), {
        ttl: 100,
        namespaces: ["ns"],
      });
      await cache.set(ResourceType.ISSUE, "long", resource("long"), {
        ttl: 10_000,
        namespaces: ["ns"],
      });

      vi.advanceTimersByTime(500);
      const found = await cache.getByNamespace("ns");
      expect(found.map((r) => r.id)).toEqual(["long"]);
      expect(cache.getKeys()).toEqual(["issue:long"]);
    });

    it("refresh extends the lifetime of an entry", async () => {
      const cache = new ResourceCache();
      await cache.set(ResourceType.ISSUE, "1", resource("1"), { ttl: 100 });
      await cache.refresh("issue:1", 10_000);

      vi.advanceTimersByTime(5000);
      expect(await cache.get(ResourceType.ISSUE, "1")).not.toBeNull();
    });
  });

  describe("index consistency", () => {
    it("serves tag, type and namespace queries and drops them on delete", async () => {
      const cache = new ResourceCache();
      await cache.set(ResourceType.ISSUE, "1", resource("1"), {
        tags: ["t1", "t2"],
        namespaces: ["ns"],
      });
      await cache.set(ResourceType.ISSUE, "2", resource("2"), {
        tags: ["t1"],
        namespaces: ["ns"],
      });

      expect((await cache.getByTag("t1")).map((r) => r.id).sort()).toEqual(["1", "2"]);
      expect((await cache.getByNamespace("ns")).map((r) => r.id).sort()).toEqual(["1", "2"]);
      expect(await cache.getByType(ResourceType.ISSUE)).toHaveLength(2);

      await cache.delete("issue:1");
      expect((await cache.getByTag("t1")).map((r) => r.id)).toEqual(["2"]);
      expect(await cache.getByTag("t2")).toEqual([]);
      expect((await cache.getByNamespace("ns")).map((r) => r.id)).toEqual(["2"]);

      await cache.delete("issue:2");
      expect(cache.getStats()).toMatchObject({
        size: 0,
        tagCount: 0,
        typeCount: 0,
        namespaceCount: 0,
      });
    });

    it("drops stale tag and namespace memberships when a key is re-set with new ones", async () => {
      const cache = new ResourceCache();
      await cache.set(ResourceType.ISSUE, "1", resource("1"), {
        tags: ["old-tag"],
        namespaces: ["old-ns"],
      });
      await cache.set(ResourceType.ISSUE, "1", resource("1"), {
        tags: ["new-tag"],
        namespaces: ["new-ns"],
      });

      expect(await cache.getByTag("old-tag")).toEqual([]);
      expect(await cache.getByNamespace("old-ns")).toEqual([]);
      expect(await cache.getByTag("new-tag")).toHaveLength(1);
      expect(await cache.getByNamespace("new-ns")).toHaveLength(1);
      expect(cache.getStats()).toMatchObject({ tagCount: 1, namespaceCount: 1 });
    });

    it("invalidateByTags and clearByType leave no index residue", async () => {
      const cache = new ResourceCache();
      await cache.set(ResourceType.ISSUE, "1", resource("1"), { tags: ["x"], namespaces: ["n"] });
      await cache.set(ResourceType.PROJECT, "p", resource("p", ResourceType.PROJECT), {
        tags: ["y"],
        namespaces: ["n"],
      });

      await cache.invalidateByTags(["x"]);
      expect(await cache.get(ResourceType.ISSUE, "1")).toBeNull();
      expect((await cache.getByNamespace("n")).map((r) => r.id)).toEqual(["p"]);

      await cache.clearByType(ResourceType.PROJECT);
      expect(cache.getStats()).toMatchObject({
        size: 0,
        tagCount: 0,
        typeCount: 0,
        namespaceCount: 0,
      });
    });
  });
});
