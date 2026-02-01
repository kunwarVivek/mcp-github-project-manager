/**
 * Embedding Cache for Issue Intelligence
 *
 * In-memory cache for issue embeddings with TTL-based expiration.
 * Caches embeddings by issue ID with content hash validation to detect changes.
 * Supports optional file persistence.
 */

import * as crypto from 'crypto';

/**
 * Cached embedding entry with metadata.
 */
interface CachedEmbedding {
  /** Issue identifier */
  issueId: string;
  /** Hash of title + body to detect content changes */
  contentHash: string;
  /** The embedding vector */
  embedding: number[];
  /** Timestamp when cached (ms since epoch) */
  cachedAt: number;
}

/**
 * Default TTL: 24 hours in milliseconds.
 */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Default maximum cache size.
 */
const DEFAULT_MAX_SIZE = 10000;

/**
 * In-memory cache for issue embeddings with TTL-based expiration
 * and content hash validation.
 *
 * Features:
 * - TTL-based expiration (default 24 hours)
 * - Content hash validation (detects changed issues)
 * - LRU-style eviction when max size exceeded
 * - Thread-safe for single-threaded Node.js usage
 */
export class EmbeddingCache {
  private cache: Map<string, CachedEmbedding>;
  private readonly ttlMs: number;
  private readonly maxSize: number;

  /**
   * Create a new embedding cache.
   *
   * @param ttlMs - Time-to-live in milliseconds (default: 24 hours)
   * @param maxSize - Maximum number of entries (default: 10000)
   */
  constructor(ttlMs: number = DEFAULT_TTL_MS, maxSize: number = DEFAULT_MAX_SIZE) {
    this.cache = new Map();
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  /**
   * Get a cached embedding if it exists, is not expired, and content hasn't changed.
   *
   * @param issueId - The issue identifier
   * @param contentHash - Hash of current content to validate against cached hash
   * @returns The embedding vector if valid, null otherwise
   */
  get(issueId: string, contentHash: string): number[] | null {
    const entry = this.cache.get(issueId);

    if (!entry) {
      return null;
    }

    // Check if content has changed
    if (entry.contentHash !== contentHash) {
      // Content changed, invalidate cache entry
      this.cache.delete(issueId);
      return null;
    }

    // Check if expired
    if (Date.now() > entry.cachedAt + this.ttlMs) {
      // Expired, remove entry
      this.cache.delete(issueId);
      return null;
    }

    return entry.embedding;
  }

  /**
   * Store an embedding in the cache.
   *
   * If cache exceeds maxSize, oldest entries are evicted.
   *
   * @param issueId - The issue identifier
   * @param contentHash - Hash of the content (for change detection)
   * @param embedding - The embedding vector to cache
   */
  set(issueId: string, contentHash: string, embedding: number[]): void {
    // Check if we need to evict entries
    if (this.cache.size >= this.maxSize && !this.cache.has(issueId)) {
      this.evictOldest();
    }

    const entry: CachedEmbedding = {
      issueId,
      contentHash,
      embedding,
      cachedAt: Date.now()
    };

    this.cache.set(issueId, entry);
  }

  /**
   * Compute a content hash from issue title and body.
   *
   * Uses SHA256 for consistent hashing. Normalizes input by trimming
   * whitespace and converting to lowercase.
   *
   * @param title - Issue title
   * @param body - Issue body/description
   * @returns Hex string of the SHA256 hash
   */
  static computeContentHash(title: string, body: string): string {
    // Normalize: trim whitespace, lowercase for consistency
    const normalizedContent = `${(title || '').trim().toLowerCase()}\n${(body || '').trim().toLowerCase()}`;
    return crypto.createHash('sha256').update(normalizedContent).digest('hex');
  }

  /**
   * Check if an issue ID exists in the cache.
   *
   * Note: Does not validate expiry or content hash.
   *
   * @param issueId - The issue identifier
   * @returns True if the issue is in the cache
   */
  has(issueId: string): boolean {
    return this.cache.has(issueId);
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the current number of cached entries.
   *
   * @returns Number of entries in cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all cached issue IDs.
   *
   * @returns Array of cached issue IDs
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Evict oldest entries to make room for new ones.
   *
   * Removes up to 10% of maxSize entries, sorted by cachedAt timestamp.
   */
  private evictOldest(): void {
    // Calculate how many to evict (10% of max size, minimum 1)
    const evictCount = Math.max(1, Math.floor(this.maxSize * 0.1));

    // Get all entries sorted by cachedAt (oldest first)
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].cachedAt - b[1].cachedAt);

    // Remove the oldest entries
    for (let i = 0; i < evictCount && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Remove expired entries from the cache.
   *
   * Can be called periodically for cache maintenance.
   *
   * @returns Number of entries removed
   */
  cleanExpired(): number {
    const now = Date.now();
    let removed = 0;

    for (const [issueId, entry] of this.cache.entries()) {
      if (now > entry.cachedAt + this.ttlMs) {
        this.cache.delete(issueId);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get cache statistics.
   *
   * @returns Cache stats including size, TTL, and max size
   */
  getStats(): {
    size: number;
    maxSize: number;
    ttlMs: number;
    oldestEntryAge?: number;
    newestEntryAge?: number;
  } {
    let oldestAge: number | undefined;
    let newestAge: number | undefined;
    const now = Date.now();

    for (const entry of this.cache.values()) {
      const age = now - entry.cachedAt;
      if (oldestAge === undefined || age > oldestAge) {
        oldestAge = age;
      }
      if (newestAge === undefined || age < newestAge) {
        newestAge = age;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
      oldestEntryAge: oldestAge,
      newestEntryAge: newestAge
    };
  }
}
