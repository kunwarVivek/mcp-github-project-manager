/**
 * Unit tests for EmbeddingCache
 *
 * Tests in-memory embedding cache with TTL expiration,
 * content hash validation, and LRU-style eviction.
 */

import { EmbeddingCache } from '../../src/cache/EmbeddingCache';

describe('EmbeddingCache', () => {
  let cache: EmbeddingCache;

  beforeEach(() => {
    jest.useFakeTimers();
    cache = new EmbeddingCache();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Basic Operations', () => {
    it('should set and get embedding', () => {
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const contentHash = EmbeddingCache.computeContentHash('title', 'body');

      cache.set('issue-1', contentHash, embedding);
      const result = cache.get('issue-1', contentHash);

      expect(result).toEqual(embedding);
    });

    it('should return null for non-existent entry', () => {
      const contentHash = EmbeddingCache.computeContentHash('title', 'body');
      const result = cache.get('non-existent', contentHash);

      expect(result).toBeNull();
    });

    it('should check if issue exists with has()', () => {
      const contentHash = EmbeddingCache.computeContentHash('title', 'body');
      cache.set('issue-1', contentHash, [0.1]);

      expect(cache.has('issue-1')).toBe(true);
      expect(cache.has('issue-2')).toBe(false);
    });

    it('should clear all entries', () => {
      const contentHash = EmbeddingCache.computeContentHash('title', 'body');
      cache.set('issue-1', contentHash, [0.1]);
      cache.set('issue-2', contentHash, [0.2]);

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.has('issue-1')).toBe(false);
    });

    it('should return correct size', () => {
      const contentHash = EmbeddingCache.computeContentHash('title', 'body');

      expect(cache.size()).toBe(0);

      cache.set('issue-1', contentHash, [0.1]);
      expect(cache.size()).toBe(1);

      cache.set('issue-2', contentHash, [0.2]);
      expect(cache.size()).toBe(2);
    });

    it('should return all keys', () => {
      const contentHash = EmbeddingCache.computeContentHash('title', 'body');
      cache.set('issue-1', contentHash, [0.1]);
      cache.set('issue-2', contentHash, [0.2]);

      const keys = cache.keys();

      expect(keys).toContain('issue-1');
      expect(keys).toContain('issue-2');
      expect(keys).toHaveLength(2);
    });

    it('should overwrite existing entry', () => {
      const contentHash = EmbeddingCache.computeContentHash('title', 'body');
      cache.set('issue-1', contentHash, [0.1]);
      cache.set('issue-1', contentHash, [0.9]);

      const result = cache.get('issue-1', contentHash);
      expect(result).toEqual([0.9]);
    });
  });

  describe('TTL Expiration', () => {
    it('should return null for expired entry', () => {
      // Create cache with 1 hour TTL
      const cacheWithTTL = new EmbeddingCache(60 * 60 * 1000); // 1 hour
      const contentHash = EmbeddingCache.computeContentHash('title', 'body');

      cacheWithTTL.set('issue-1', contentHash, [0.1]);

      // Advance time past TTL
      jest.advanceTimersByTime(2 * 60 * 60 * 1000); // 2 hours

      const result = cacheWithTTL.get('issue-1', contentHash);
      expect(result).toBeNull();
    });

    it('should return entry before TTL expires', () => {
      const cacheWithTTL = new EmbeddingCache(60 * 60 * 1000); // 1 hour
      const contentHash = EmbeddingCache.computeContentHash('title', 'body');

      cacheWithTTL.set('issue-1', contentHash, [0.1]);

      // Advance time but not past TTL
      jest.advanceTimersByTime(30 * 60 * 1000); // 30 minutes

      const result = cacheWithTTL.get('issue-1', contentHash);
      expect(result).toEqual([0.1]);
    });

    it('should delete expired entry on get()', () => {
      const cacheWithTTL = new EmbeddingCache(60 * 60 * 1000);
      const contentHash = EmbeddingCache.computeContentHash('title', 'body');

      cacheWithTTL.set('issue-1', contentHash, [0.1]);
      jest.advanceTimersByTime(2 * 60 * 60 * 1000);

      cacheWithTTL.get('issue-1', contentHash);

      // Entry should be removed
      expect(cacheWithTTL.has('issue-1')).toBe(false);
    });

    it('should use default TTL of 24 hours', () => {
      const defaultCache = new EmbeddingCache();
      const contentHash = EmbeddingCache.computeContentHash('title', 'body');

      defaultCache.set('issue-1', contentHash, [0.1]);

      // 12 hours later should still work
      jest.advanceTimersByTime(12 * 60 * 60 * 1000);
      expect(defaultCache.get('issue-1', contentHash)).toEqual([0.1]);

      // 25 hours total should expire
      jest.advanceTimersByTime(13 * 60 * 60 * 1000);
      expect(defaultCache.get('issue-1', contentHash)).toBeNull();
    });

    it('should clean expired entries with cleanExpired()', () => {
      const cacheWithTTL = new EmbeddingCache(60 * 60 * 1000);
      const contentHash = EmbeddingCache.computeContentHash('title', 'body');

      cacheWithTTL.set('issue-1', contentHash, [0.1]);
      cacheWithTTL.set('issue-2', contentHash, [0.2]);

      jest.advanceTimersByTime(30 * 60 * 1000); // 30 min
      cacheWithTTL.set('issue-3', contentHash, [0.3]); // Added later

      jest.advanceTimersByTime(45 * 60 * 1000); // 75 min total

      const removed = cacheWithTTL.cleanExpired();

      expect(removed).toBe(2); // issue-1 and issue-2 expired
      expect(cacheWithTTL.has('issue-3')).toBe(true);
    });
  });

  describe('Content Hash Validation', () => {
    it('should return null if content hash changes', () => {
      const hash1 = EmbeddingCache.computeContentHash('title', 'body');
      const hash2 = EmbeddingCache.computeContentHash('title', 'modified body');

      cache.set('issue-1', hash1, [0.1]);

      // Request with different hash
      const result = cache.get('issue-1', hash2);
      expect(result).toBeNull();
    });

    it('should delete entry when content hash changes', () => {
      const hash1 = EmbeddingCache.computeContentHash('title', 'body');
      const hash2 = EmbeddingCache.computeContentHash('title', 'modified body');

      cache.set('issue-1', hash1, [0.1]);
      cache.get('issue-1', hash2);

      // Entry should be removed
      expect(cache.has('issue-1')).toBe(false);
    });

    it('should compute consistent hash for same content', () => {
      const hash1 = EmbeddingCache.computeContentHash('title', 'body');
      const hash2 = EmbeddingCache.computeContentHash('title', 'body');

      expect(hash1).toBe(hash2);
    });

    it('should compute different hash for different content', () => {
      const hash1 = EmbeddingCache.computeContentHash('title1', 'body');
      const hash2 = EmbeddingCache.computeContentHash('title2', 'body');

      expect(hash1).not.toBe(hash2);
    });

    it('should normalize content before hashing (trim + lowercase)', () => {
      const hash1 = EmbeddingCache.computeContentHash('  Title  ', '  Body  ');
      const hash2 = EmbeddingCache.computeContentHash('title', 'body');

      expect(hash1).toBe(hash2);
    });

    it('should handle empty title or body', () => {
      const hashEmptyTitle = EmbeddingCache.computeContentHash('', 'body');
      const hashEmptyBody = EmbeddingCache.computeContentHash('title', '');
      const hashBothEmpty = EmbeddingCache.computeContentHash('', '');

      expect(hashEmptyTitle.length).toBe(64); // SHA256 hex length
      expect(hashEmptyBody.length).toBe(64);
      expect(hashBothEmpty.length).toBe(64);
    });

    it('should handle null-ish values', () => {
      const hash = EmbeddingCache.computeContentHash(null as any, undefined as any);
      expect(hash.length).toBe(64);
    });
  });

  describe('Eviction', () => {
    it('should evict oldest entries when exceeding maxSize', () => {
      const smallCache = new EmbeddingCache(24 * 60 * 60 * 1000, 5); // Max 5 entries

      // Add 5 entries
      for (let i = 1; i <= 5; i++) {
        const hash = EmbeddingCache.computeContentHash(`title-${i}`, 'body');
        smallCache.set(`issue-${i}`, hash, [i * 0.1]);
        jest.advanceTimersByTime(1000); // Space them out in time
      }

      expect(smallCache.size()).toBe(5);

      // Add 6th entry - should trigger eviction
      const hash6 = EmbeddingCache.computeContentHash('title-6', 'body');
      smallCache.set('issue-6', hash6, [0.6]);

      // Should have evicted oldest (issue-1)
      expect(smallCache.size()).toBeLessThanOrEqual(5);
      expect(smallCache.has('issue-6')).toBe(true);
    });

    it('should evict approximately 10% of maxSize entries', () => {
      const cache100 = new EmbeddingCache(24 * 60 * 60 * 1000, 100);

      // Fill to capacity
      for (let i = 1; i <= 100; i++) {
        const hash = EmbeddingCache.computeContentHash(`title-${i}`, 'body');
        cache100.set(`issue-${i}`, hash, [i * 0.01]);
        jest.advanceTimersByTime(10);
      }

      // Add one more
      const hashNew = EmbeddingCache.computeContentHash('new', 'body');
      cache100.set('issue-new', hashNew, [0.99]);

      // Should have evicted ~10 entries
      expect(cache100.size()).toBeLessThanOrEqual(91);
    });

    it('should not evict when updating existing entry', () => {
      const smallCache = new EmbeddingCache(24 * 60 * 60 * 1000, 3);

      const hash = EmbeddingCache.computeContentHash('title', 'body');
      smallCache.set('issue-1', hash, [0.1]);
      smallCache.set('issue-2', hash, [0.2]);
      smallCache.set('issue-3', hash, [0.3]);

      // Update existing
      smallCache.set('issue-1', hash, [0.9]);

      expect(smallCache.size()).toBe(3);
      expect(smallCache.get('issue-1', hash)).toEqual([0.9]);
    });

    it('should use default maxSize of 10000', () => {
      const defaultCache = new EmbeddingCache();
      const stats = defaultCache.getStats();

      expect(stats.maxSize).toBe(10000);
    });
  });

  describe('Statistics', () => {
    it('should return cache statistics', () => {
      const contentHash = EmbeddingCache.computeContentHash('title', 'body');
      cache.set('issue-1', contentHash, [0.1]);

      const stats = cache.getStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('ttlMs');
      expect(stats.size).toBe(1);
    });

    it('should track oldest and newest entry ages', () => {
      const contentHash = EmbeddingCache.computeContentHash('title', 'body');

      cache.set('issue-1', contentHash, [0.1]);
      jest.advanceTimersByTime(60 * 1000); // 1 minute
      cache.set('issue-2', contentHash, [0.2]);
      jest.advanceTimersByTime(30 * 1000); // 30 more seconds

      const stats = cache.getStats();

      expect(stats.oldestEntryAge).toBeGreaterThan(stats.newestEntryAge!);
    });

    it('should handle empty cache stats', () => {
      const stats = cache.getStats();

      expect(stats.size).toBe(0);
      expect(stats.oldestEntryAge).toBeUndefined();
      expect(stats.newestEntryAge).toBeUndefined();
    });
  });
});
