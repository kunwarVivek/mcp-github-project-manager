import { Resource, ResourceCacheOptions } from "../../domain/resource-types";

interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
  tags?: string[];
}

export class ResourceCache {
  private cache: Map<string, CacheEntry<any>>;
  private defaultTTL: number = 3600000; // 1 hour in milliseconds

  constructor() {
    this.cache = new Map();
  }

  async set<T extends Resource>(
    id: string,
    value: T,
    options?: ResourceCacheOptions
  ): Promise<void> {
    const ttl = options?.ttl || this.defaultTTL;
    const expiresAt = Date.now() + ttl;

    const entry: CacheEntry<T> = {
      value,
      expiresAt,
      tags: options?.tags,
    };

    this.cache.set(id, entry);
  }

  async get<T extends Resource>(
    id: string,
    options?: ResourceCacheOptions
  ): Promise<T | null> {
    const entry = this.cache.get(id) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(id);
      return null;
    }

    if (options?.includeDeleted === false && this.isDeleted(entry.value)) {
      return null;
    }

    if (options?.tags?.length) {
      if (!this.hasMatchingTags(entry, options.tags)) {
        return null;
      }
    }

    return entry.value;
  }

  async delete(id: string): Promise<void> {
    this.cache.delete(id);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    for (const [id, entry] of this.cache.entries()) {
      if (this.hasMatchingTags(entry, tags)) {
        this.cache.delete(id);
      }
    }
  }

  async setTags(id: string, tags: string[]): Promise<void> {
    const entry = this.cache.get(id);
    if (entry) {
      entry.tags = tags;
      this.cache.set(id, entry);
    }
  }

  private isDeleted(value: Resource): boolean {
    return value.deletedAt !== null && value.deletedAt !== undefined;
  }

  private hasMatchingTags(entry: CacheEntry<any>, tags: string[]): boolean {
    if (!entry.tags) return false;
    return tags.some(tag => entry.tags!.includes(tag));
  }

  // Utility methods for testing and monitoring
  getSize(): number {
    return this.cache.size;
  }

  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  getTags(id: string): string[] | undefined {
    return this.cache.get(id)?.tags;
  }
}