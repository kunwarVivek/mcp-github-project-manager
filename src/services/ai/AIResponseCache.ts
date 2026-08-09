import { createHash } from 'node:crypto';

interface CachedResponse {
  response: unknown;
  timestamp: number;
  ttlMs: number;
}

/**
 * Simple in-memory cache for AI responses.
 * Keys are content hashes; entries expire after TTL.
 */
export class AIResponseCache {
  private cache = new Map<string, CachedResponse>();
  private readonly defaultTtlMs: number;
  private readonly maxEntries: number;

  constructor(options?: { defaultTtlMs?: number; maxEntries?: number }) {
    this.defaultTtlMs = options?.defaultTtlMs ?? 3600_000; // 1 hour
    this.maxEntries = options?.maxEntries ?? 500;
  }

  /** Generate a cache key from the request content. */
  private hashKey(content: string, model?: string): string {
    return createHash('sha256').update(`${model ?? ''}:${content}`).digest('hex').substring(0, 16);
  }

  /** Get cached response if available and not expired. */
  get(content: string, model?: string): { hit: true; response: unknown } | { hit: false } {
    const key = this.hashKey(content, model);
    const entry = this.cache.get(key);
    if (!entry) return { hit: false };
    if (Date.now() - entry.timestamp > entry.ttlMs) {
      this.cache.delete(key);
      return { hit: false };
    }
    return { hit: true, response: entry.response };
  }

  /** Cache a response. */
  set(content: string, response: unknown, model?: string, ttlMs?: number): void {
    if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    const key = this.hashKey(content, model);
    this.cache.set(key, { response, timestamp: Date.now(), ttlMs: ttlMs ?? this.defaultTtlMs });
  }

  /** Clear all cached responses. */
  clear(): void { this.cache.clear(); }

  /** Current cache size. */
  get size(): number { return this.cache.size; }
}
